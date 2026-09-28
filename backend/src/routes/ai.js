const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const Place = require('../models/Place');
const { getGeminiBudgetSuggestions } = require('../services/geminiService');
const { reverseGeocode } = require('../services/googlePlaces');

const router = express.Router();

// Dedicated rate limiter for AI queries to prevent quota exhaustion & spam
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 AI requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many AI budget requests from this IP. Please wait a few minutes before asking again.',
  },
});

/**
 * POST /api/ai/budget-suggest
 * Gemini-powered budget food advisor
 */
router.post(
  '/budget-suggest',
  aiLimiter,
  [
    body('budget').notEmpty().withMessage('Budget amount is required'),
    body('partySize').optional().isInt({ min: 1, max: 20 }),
    body('craving').optional().isString(),
    body('lat').optional().isFloat({ min: -90, max: 90 }),
    body('lng').optional().isFloat({ min: -180, max: 180 }),
    body('apiKey').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        budget,
        partySize = 1,
        craving = '',
        lat,
        lng,
        apiKey = '',
      } = req.body;

      // Extract candidate places from DB
      const query = {};
      const numBudget = parseFloat(budget) || 300;
      const perPerson = Math.round(numBudget / Math.max(parseInt(partySize) || 1, 1));

      // Match target price levels
      if (perPerson < 250) {
        query.priceLevel = 1;
      } else if (perPerson <= 600) {
        query.priceLevel = { $in: [1, 2] };
      } else if (perPerson <= 1500) {
        query.priceLevel = { $in: [2, 3] };
      }

      // Fetch candidates from DB
      let candidatePlaces = await Place.find(query).limit(25).lean();

      // If too few candidates matching strict priceLevel, get top rated places across DB
      if (candidatePlaces.length < 5) {
        candidatePlaces = await Place.find({}).sort({ rating: -1, totalRatings: -1 }).limit(25).lean();
      }

      // Sort candidate places by proximity if user coordinates are available
      if (lat && lng && candidatePlaces.length > 0) {
        const _lat = parseFloat(lat);
        const _lng = parseFloat(lng);
        candidatePlaces.sort((a, b) => {
          if (!a.location?.coordinates || !b.location?.coordinates) return 0;
          const distA = Math.hypot(a.location.coordinates[0] - _lng, a.location.coordinates[1] - _lat);
          const distB = Math.hypot(b.location.coordinates[0] - _lng, b.location.coordinates[1] - _lat);
          return distA - distB;
        });
      }

      let areaName = 'Dhaka';
      if (lat && lng) {
        try {
          const geo = await reverseGeocode(parseFloat(lat), parseFloat(lng));
          if (geo.city || geo.address) areaName = geo.city || geo.address;
        } catch (_) {}
      }

      const suggestions = await getGeminiBudgetSuggestions({
        budget: numBudget,
        partySize: parseInt(partySize) || 1,
        craving,
        places: candidatePlaces,
        area: areaName,
        userApiKey: apiKey,
      });

      // Hydrate recommendations with real DB place docs if matching placeId
      if (Array.isArray(suggestions.recommendations)) {
        const placeIds = suggestions.recommendations
          .map((r) => r.placeId)
          .filter(Boolean);

        if (placeIds.length > 0) {
          const dbPlaces = await Place.find({
            $or: [
              { _id: { $in: placeIds.filter((id) => id.match(/^[0-9a-fA-F]{24}$/)) } },
              { googlePlaceId: { $in: placeIds } },
            ],
          }).lean();

          const dbPlaceMap = new Map();
          dbPlaces.forEach((p) => {
            dbPlaceMap.set(String(p._id), p);
            if (p.googlePlaceId) dbPlaceMap.set(p.googlePlaceId, p);
          });

          suggestions.recommendations = suggestions.recommendations.map((rec) => {
            const matchedDb = rec.placeId ? dbPlaceMap.get(rec.placeId) : null;
            if (matchedDb) {
              return {
                ...rec,
                fullPlace: matchedDb,
                primaryPhoto: matchedDb.primaryPhoto || rec.primaryPhoto,
                location: matchedDb.location,
              };
            }
            return rec;
          });
        }
      }

      return res.json({
        success: true,
        ...suggestions,
      });
    } catch (err) {
      console.error('AI budget recommendation error:', err);
      res.status(500).json({
        error: 'Failed to generate budget recommendations',
        message: err.message,
      });
    }
  }
);

module.exports = router;
