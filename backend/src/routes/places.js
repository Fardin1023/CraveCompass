const express = require('express');
const { param, query, validationResult } = require('express-validator');
const Place = require('../models/Place');
const { getPlaceDetails, transformGooglePlace } = require('../services/googlePlaces');

const router = express.Router();

/**
 * GET /api/places/nearby
 * Get restaurants near a coordinate from DB (with Google fallback)
 */
router.get(
  '/nearby',
  [
    query('lat').notEmpty().isFloat({ min: -90, max: 90 }),
    query('lng').notEmpty().isFloat({ min: -180, max: 180 }),
    query('radius').optional().isInt({ min: 100, max: 50000 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('cuisine').optional().isString(),
    query('priceLevel').optional().isString(),
    query('openNow').optional().isBoolean(),
    query('minRating').optional().isFloat({ min: 0, max: 5 }),
    query('sortBy').optional().isIn(['distance', 'rating', 'popularity']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        lat,
        lng,
        radius = 25000,
        limit = 20,
        cuisine,
        priceLevel,
        openNow,
        minRating,
        sortBy = 'distance',
      } = req.query;

      const _lat = parseFloat(lat);
      const _lng = parseFloat(lng);
      const _radius = parseInt(radius);

      // $geoWithin bounding box (works without sort constraint)
      const earthRadius = 6371000;
      const latDelta = (_radius / earthRadius) * (180 / Math.PI);
      const lngDelta = (_radius / earthRadius) * (180 / Math.PI) / Math.cos((_lat * Math.PI) / 180);

      const geoQuery = {
        location: {
          $geoWithin: {
            $box: [
              [_lng - lngDelta, _lat - latDelta],
              [_lng + lngDelta, _lat + latDelta],
            ],
          },
        },
      };

      if (cuisine) geoQuery.cuisine = { $in: cuisine.split(',') };
      if (priceLevel) geoQuery.priceLevel = { $in: priceLevel.split(',').map(Number) };
      if (openNow === 'true') geoQuery['openingHours.openNow'] = true;
      if (minRating) geoQuery.rating = { $gte: parseFloat(minRating) };

      let sortOption = {};
      if (sortBy === 'rating') sortOption = { rating: -1 };
      else if (sortBy === 'popularity') sortOption = { popularityScore: -1, totalRatings: -1 };

      let places = await Place.find(geoQuery).sort(sortOption).limit(parseInt(limit) * 2).lean();

      // If outside seeded geo area, fallback to all places matching filters
      if (places.length === 0) {
        const fallbackQuery = { ...geoQuery };
        delete fallbackQuery.location;
        places = await Place.find(fallbackQuery).sort(sortOption).limit(parseInt(limit) * 2).lean();
      }

      // Sort by distance when sortBy === 'distance'
      if (sortBy === 'distance') {
        places = places.sort((a, b) => {
          const dA = Math.pow(a.location.coordinates[0] - _lng, 2) + Math.pow(a.location.coordinates[1] - _lat, 2);
          const dB = Math.pow(b.location.coordinates[0] - _lng, 2) + Math.pow(b.location.coordinates[1] - _lat, 2);
          return dA - dB;
        });
      }
      places = places.slice(0, parseInt(limit));

      const total = await Place.countDocuments(places.length > 0 && !geoQuery.location ? {} : geoQuery);


      res.json({
        success: true,
        total,
        results: places,
        center: { lat: parseFloat(lat), lng: parseFloat(lng) },
        radius: parseInt(radius),
      });
    } catch (err) {
      console.error('Nearby search error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * GET /api/places/:id
 * Get a single place by MongoDB ID or Google Place ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let place = await Place.findById(id).lean().catch(() => null);
    if (!place) place = await Place.findOne({ googlePlaceId: id }).lean();

    if (!place) {
      // Try fetching from Google
      if (process.env.GOOGLE_PLACES_API_KEY && process.env.GOOGLE_PLACES_API_KEY !== 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
        try {
          const details = await getPlaceDetails(id);
          const transformed = transformGooglePlace(details, details);
          place = await Place.findOneAndUpdate(
            { googlePlaceId: transformed.googlePlaceId },
            { $set: transformed },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        } catch (googleErr) {
          return res.status(404).json({ error: 'Place not found' });
        }
      } else {
        return res.status(404).json({ error: 'Place not found' });
      }
    }

    // Increment popularity
    await Place.findByIdAndUpdate(place._id, { $inc: { popularityScore: 1 } });

    res.json({ success: true, place });
  } catch (err) {
    console.error('Get place error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/places
 * Paginated list of all places with optional filters
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('cuisine').optional().isString(),
    query('featured').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const { page = 1, limit = 20, cuisine, featured } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const filter = {};
      if (cuisine) filter.cuisine = { $in: cuisine.split(',') };
      if (featured === 'true') filter.isFeatured = true;

      const [places, total] = await Promise.all([
        Place.find(filter)
          .sort({ popularityScore: -1, rating: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Place.countDocuments(filter),
      ]);

      res.json({
        success: true,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        results: places,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
