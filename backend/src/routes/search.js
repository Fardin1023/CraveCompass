const express = require('express');
const { query, validationResult } = require('express-validator');
const Place = require('../models/Place');
const SearchHistory = require('../models/SearchHistory');
const { parseQuery } = require('../services/queryParser');
const { searchNearby, textSearch, transformGooglePlace } = require('../services/googlePlaces');
const { searchOsmNearby, transformOsmPlace } = require('../services/osmPlaces');

const router = express.Router();

/**
 * POST /api/search
 * Natural language search with query parsing
 */
function escapeRegex(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * POST /api/search
 * Natural language search with query parsing and name matching
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
      const {
        q = '',
        lat,
        lng,
        radius = 25000,
        limit = 30,
        page = 1,
        priceLevel,
        openNow,
        minRating,
      } = {
        ...req.query,
        ...req.body,
      };

      const parsed = parseQuery(q);
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const hasGeo = lat !== undefined && lng !== undefined;
      const _lat = lat ? parseFloat(lat) : undefined;
      const _lng = lng ? parseFloat(lng) : undefined;
      const _radius = parseInt(radius);

      // Build filter
      const baseFilter = {};
      const orConditions = [];

      const cleanQ = (q || '').trim();

      if (cleanQ) {
        const escapedQ = escapeRegex(cleanQ);
        const qRegex = new RegExp(escapedQ, 'i');

        // High-priority matches on restaurant name
        orConditions.push(
          { name: qRegex },
          { cuisine: qRegex },
          { tags: qRegex },
          { categories: qRegex },
          { 'address.formatted': qRegex },
          { 'address.street': qRegex },
          { 'address.city': qRegex }
        );

        // Individual word terms in name or cuisine (for "Star Kabab" -> "Star", "Kabab")
        const terms = cleanQ.split(/\s+/).filter((t) => t.length > 1);
        terms.forEach((term) => {
          const escapedTerm = escapeRegex(term);
          orConditions.push({ name: new RegExp(escapedTerm, 'i') });
          orConditions.push({ cuisine: new RegExp(escapedTerm, 'i') });
          orConditions.push({ tags: new RegExp(escapedTerm, 'i') });
        });
      }

      if (parsed.cuisines && parsed.cuisines.length > 0) {
        parsed.cuisines.forEach((c) => {
          const cRegex = new RegExp(escapeRegex(c), 'i');
          orConditions.push(
            { cuisine: c },
            { tags: c },
            { categories: cRegex },
            { name: cRegex }
          );
        });
      }

      if (orConditions.length > 0) {
        baseFilter.$or = orConditions;
      }

      // Budget / Price Level filter
      const activePriceLevel = priceLevel !== undefined && priceLevel !== ''
        ? (Array.isArray(priceLevel) ? priceLevel.map(Number) : String(priceLevel).split(',').map(Number))
        : parsed.priceLevel;

      if (activePriceLevel && activePriceLevel.length > 0) {
        baseFilter.priceLevel = { $in: activePriceLevel };
      }

      const isOpenNow = openNow === true || openNow === 'true' || parsed.openNow;
      if (isOpenNow) baseFilter['openingHours.openNow'] = true;

      const ratingThreshold = minRating ? parseFloat(minRating) : parsed.rating;
      if (ratingThreshold) baseFilter.rating = { $gte: ratingThreshold };

      // When searching by name/text, search city-wide so places aren't cut off by small radius.
      // Only apply spatial bounding box if user did NOT provide a specific search text query.
      if (hasGeo && !cleanQ) {
        const earthRadius = 6371000;
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
        .limit(parseInt(limit) * 2)
        .lean();

      // If spatial bounding box yielded 0 results, retry without geo restriction
      if (places.length === 0 && baseFilter.location) {
        const fallbackFilter = { ...baseFilter };
        delete fallbackFilter.location;
        places = await Place.find(fallbackFilter)
          .skip(skip)
          .limit(parseInt(limit) * 2)
          .lean();
      }

      // Live discovery from OpenStreetMap if fewer than 3 results
      if (places.length < 3 && hasGeo) {
        try {
          const keyword = cleanQ || parsed.cuisines?.join(' ') || '';
          const osmResults = await searchOsmNearby({
            lat: _lat,
            lng: _lng,
            radius: Math.max(_radius, 6000),
            limit: parseInt(limit),
            keyword,
          });

          if (osmResults && osmResults.length > 0) {
            const upsertPromises = osmResults.map(async (osmEl) => {
              const doc = transformOsmPlace(osmEl);
              return Place.findOneAndUpdate(
                { googlePlaceId: doc.googlePlaceId },
                { $set: doc },
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );
            });
            await Promise.allSettled(upsertPromises);

            // Re-query without strict bounding box to capture new items
            const relaxedFilter = { ...baseFilter };
            delete relaxedFilter.location;
            places = await Place.find(relaxedFilter).limit(parseInt(limit) * 2).lean();
          }
        } catch (osmErr) {
          console.warn('OpenStreetMap search discovery failed:', osmErr.message);
        }
      }

      // Ranking & Sorting:
      // 1. Direct name match (starts with or includes query)
      // 2. Proximity to user if coordinates available
      if (cleanQ || hasGeo) {
        const lowerQ = cleanQ.toLowerCase();
        places.sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();

          if (lowerQ) {
            const aExact = aName === lowerQ;
            const bExact = bName === lowerQ;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aStarts = aName.startsWith(lowerQ);
            const bStarts = bName.startsWith(lowerQ);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            const aContains = aName.includes(lowerQ);
            const bContains = bName.includes(lowerQ);
            if (aContains && !bContains) return -1;
            if (!aContains && bContains) return 1;
          }

          if (hasGeo && a.location?.coordinates && b.location?.coordinates) {
            const distA = Math.pow(a.location.coordinates[0] - _lng, 2) + Math.pow(a.location.coordinates[1] - _lat, 2);
            const distB = Math.pow(b.location.coordinates[0] - _lng, 2) + Math.pow(b.location.coordinates[1] - _lat, 2);
            return distA - distB;
          }

          return (b.rating || 0) - (a.rating || 0);
        });
      }

      const total = places.length;
      const paginatedPlaces = places.slice(0, parseInt(limit));

      // Log search history
      try {
        await SearchHistory.create({
          sessionId: req.headers['x-session-id'] || 'anonymous',
          query: q,
          parsedIntent: parsed,
          location: hasGeo
            ? { type: 'Point', coordinates: [_lng, _lat] }
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
        pages: Math.ceil(total / parseInt(limit)) || 1,
        results: paginatedPlaces,
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

    const escaped = escapeRegex(q.trim());
    const regex = new RegExp(escaped, 'i');
    const places = await Place.find(
      {
        $or: [
          { name: regex },
          { cuisine: regex },
          { tags: regex },
          { 'address.street': regex },
          { 'address.city': regex },
        ],
      },
      { name: 1, 'address.city': 1, 'address.formatted': 1, cuisine: 1, rating: 1, priceLevel: 1 }
    )
      .limit(10)
      .lean();

    // Sort direct name matches first
    const lowerQ = q.trim().toLowerCase();
    places.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aStarts = aName.startsWith(lowerQ);
      const bStarts = bName.startsWith(lowerQ);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });

    const suggestions = places.map((p) => ({
      id: p._id,
      name: p.name,
      city: p.address?.city || p.address?.formatted || 'Dhaka',
      cuisine: Array.isArray(p.cuisine) ? p.cuisine[0] : p.cuisine,
      rating: p.rating,
      priceLevel: p.priceLevel,
    }));

    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
