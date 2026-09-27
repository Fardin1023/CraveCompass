const express = require('express');
const { query, validationResult } = require('express-validator');
const Place = require('../models/Place');
const SearchHistory = require('../models/SearchHistory');
const { parseQuery } = require('../services/queryParser');
const { searchNearby, textSearch, transformGooglePlace } = require('../services/googlePlaces');

const router = express.Router();

/**
 * POST /api/search
 * Natural language search with query parsing
 */
router.post(
  '/',
  [
    query('q').optional().isString().trim(),
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isInt({ min: 100, max: 50000 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('page').optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { q = '', lat, lng, radius = 25000, limit = 20, page = 1 } = {
        ...req.query,
        ...req.body,
      };

      const parsed = parseQuery(q);
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // MongoDB: $near and $text cannot be used together.
      // Strategy: use $geoWithin for spatial filter, then apply text/cuisine filters.
      const hasGeo = lat !== undefined && lng !== undefined;
      const _lat = lat ? parseFloat(lat) : undefined;
      const _lng = lng ? parseFloat(lng) : undefined;
      const _radius = parseInt(radius);

      // Build base filter
      const baseFilter = {};
      if (parsed.cuisines && parsed.cuisines.length > 0) {
        baseFilter.$or = [
          { cuisine: { $in: parsed.cuisines } },
          { tags: { $in: parsed.cuisines } },
          { categories: { $in: parsed.cuisines.map((c) => new RegExp(c, 'i')) } },
          { name: { $in: parsed.cuisines.map((c) => new RegExp(c, 'i')) } },
        ];
      } else if (q && q.trim()) {
        baseFilter.$or = [
          { name: new RegExp(q.trim(), 'i') },
          { cuisine: new RegExp(q.trim(), 'i') },
          { tags: new RegExp(q.trim(), 'i') },
          { categories: new RegExp(q.trim(), 'i') },
        ];
      }

      if (parsed.priceLevel) baseFilter.priceLevel = { $in: parsed.priceLevel };
      if (parsed.openNow) baseFilter['openingHours.openNow'] = true;
      if (parsed.rating) baseFilter.rating = { $gte: parsed.rating };

      // Add geo bounding box if available
      if (hasGeo) {
        const earthRadius = 6371000; // meters
        const latDelta = (_radius / earthRadius) * (180 / Math.PI);
        const lngDelta = (_radius / earthRadius) * (180 / Math.PI) / Math.cos((_lat * Math.PI) / 180);
        baseFilter.location = {
          $geoWithin: {
            $box: [
              [_lng - lngDelta, _lat - latDelta],
              [_lng + lngDelta, _lat + latDelta],
            ],
          },
        };
      }

      let places = await Place.find(baseFilter)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // If geo bounding box yielded 0 results, retry without geo restriction (e.g. testing outside Dhaka)
      if (places.length === 0 && hasGeo) {
        const fallbackFilter = { ...baseFilter };
        delete fallbackFilter.location;
        places = await Place.find(fallbackFilter)
          .skip(skip)
          .limit(parseInt(limit))
          .lean();
      }

      // Sort by distance client-side when geo available
      if (hasGeo && places.length > 0) {
        places = places.sort((a, b) => {
          const distA = Math.pow(a.location.coordinates[0] - _lng, 2) + Math.pow(a.location.coordinates[1] - _lat, 2);
          const distB = Math.pow(b.location.coordinates[0] - _lng, 2) + Math.pow(b.location.coordinates[1] - _lat, 2);
          return distA - distB;
        });
      }

      let total = await Place.countDocuments(baseFilter);

      // If insufficient local results, fetch from Google and cache
      if (places.length < 5 && lat && lng && process.env.GOOGLE_PLACES_API_KEY && process.env.GOOGLE_PLACES_API_KEY !== 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
        try {
          const keyword = parsed.cuisines.join(' ') || q;
          const googleResults = await searchNearby({
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            radius: parseInt(radius),
            keyword,
          });

          const upsertPromises = (googleResults.results || []).map(async (gPlace) => {
            const transformed = transformGooglePlace(gPlace);
            return Place.findOneAndUpdate(
              { googlePlaceId: transformed.googlePlaceId },
              { $set: transformed },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
          });

          await Promise.allSettled(upsertPromises);

          // Re-query DB after caching
          places = await Place.find(baseFilter).limit(parseInt(limit)).lean();
          total = await Place.countDocuments(baseFilter);
        } catch (googleErr) {
          console.warn('Google Places fetch failed, serving from DB only:', googleErr.message);
        }
      }

      // Log search history
      try {
        await SearchHistory.create({
          sessionId: req.headers['x-session-id'] || 'anonymous',
          query: q,
          parsedIntent: parsed,
          location: lat && lng
            ? { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }
            : undefined,
          resultsCount: total,
        });
      } catch (_) {}

      res.json({
        success: true,
        query: q,
        parsedIntent: parsed,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        results: places,
      });
    } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ error: 'Search failed', message: err.message });
    }
  }
);

/**
 * GET /api/search/suggestions
 * Autocomplete suggestions for search bar
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (!q || q.length < 2) return res.json({ suggestions: [] });

    const regex = new RegExp(q.trim(), 'i');
    const places = await Place.find(
      {
        $or: [
          { name: regex },
          { cuisine: regex },
          { tags: regex },
        ],
      },
      { name: 1, 'address.city': 1, cuisine: 1, rating: 1 }
    )
      .limit(8)
      .lean();

    const suggestions = places.map((p) => ({
      id: p._id,
      name: p.name,
      city: p.address?.city,
      cuisine: p.cuisine?.[0],
      rating: p.rating,
    }));

    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
