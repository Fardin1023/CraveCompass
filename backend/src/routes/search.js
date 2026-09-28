const express = require('express');
const Place = require('../models/Place');
const SearchHistory = require('../models/SearchHistory');
const { parseQuery } = require('../services/queryParser');
const { searchOsmNearby, transformOsmPlace } = require('../services/osmPlaces');

const router = express.Router();

function escapeRegex(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Handle natural language and direct restaurant/place name search
 * Supports both GET and POST requests
 */
async function handleSearch(req, res) {
  try {
    const q = String(req.body?.q || req.query?.q || '').trim();
    const lat = req.body?.lat !== undefined ? req.body.lat : req.query?.lat;
    const lng = req.body?.lng !== undefined ? req.body.lng : req.query?.lng;
    const radius = parseInt(req.body?.radius || req.query?.radius || 25000);
    const limit = Math.min(parseInt(req.body?.limit || req.query?.limit || 30), 60);
    const page = Math.max(parseInt(req.body?.page || req.query?.page || 1), 1);
    const priceLevel = req.body?.priceLevel !== undefined ? req.body.priceLevel : req.query?.priceLevel;
    const openNow = req.body?.openNow !== undefined ? req.body.openNow : req.query?.openNow;
    const minRating = req.body?.minRating !== undefined ? req.body.minRating : req.query?.minRating;

    const parsed = parseQuery(q);
    const skip = (page - 1) * limit;
    const hasGeo = lat !== undefined && lng !== undefined && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
    const _lat = hasGeo ? parseFloat(lat) : undefined;
    const _lng = hasGeo ? parseFloat(lng) : undefined;

    const baseFilter = {};
    const orConditions = [];

    if (q) {
      const escapedQ = escapeRegex(q);
      const qRegex = new RegExp(escapedQ, 'i');

      // Apostrophe-tolerant search (e.g. "Sultan's Dine" <=> "Sultans Dine")
      const strippedQ = q.replace(/['’]/g, '');
      const strippedRegex = new RegExp(escapeRegex(strippedQ), 'i');

      orConditions.push(
        { name: qRegex },
        { name: strippedRegex },
        { cuisine: qRegex },
        { tags: qRegex },
        { categories: qRegex },
        { 'address.formatted': qRegex },
        { 'address.street': qRegex },
        { 'address.city': qRegex }
      );

      // Match individual significant words in the restaurant or place name
      const terms = q
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 1 && !['the', 'and', 'near', 'in', 'at'].includes(t.toLowerCase()));

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

    // Explicit User Filter: Price Level
    // If the user explicitly provided priceLevel in query/body, apply it.
    // Only apply parsed.priceLevel if user did not type a specific restaurant name.
    if (priceLevel !== undefined && priceLevel !== '' && priceLevel !== null) {
      const activeLevels = Array.isArray(priceLevel)
        ? priceLevel.map(Number)
        : String(priceLevel).split(',').map(Number);
      if (activeLevels.length > 0) {
        baseFilter.priceLevel = { $in: activeLevels };
      }
    } else if (!q && parsed.priceLevel && parsed.priceLevel.length > 0) {
      baseFilter.priceLevel = { $in: parsed.priceLevel };
    }

    // Explicit User Filter: Open Now
    // Only filter strictly by openNow if user explicitly requested it in UI
    const isOpenNow = openNow === true || openNow === 'true';
    if (isOpenNow) {
      baseFilter['openingHours.openNow'] = true;
    }

    // Explicit User Filter: Min Rating
    if (minRating) {
      baseFilter.rating = { $gte: parseFloat(minRating) };
    } else if (!q && parsed.rating) {
      baseFilter.rating = { $gte: parsed.rating };
    }

    // Only apply spatial bounding box if user didn't type a specific restaurant or place name
    if (hasGeo && !q) {
      const earthRadius = 6371000;
      const latDelta = (radius / earthRadius) * (180 / Math.PI);
      const lngDelta = (radius / earthRadius) * (180 / Math.PI) / Math.cos((_lat * Math.PI) / 180);
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
      .limit(limit * 3)
      .lean();

    // If bounding box was applied and returned 0 places, retry without spatial restriction
    if (places.length === 0 && baseFilter.location) {
      const relaxedFilter = { ...baseFilter };
      delete relaxedFilter.location;
      places = await Place.find(relaxedFilter)
        .skip(skip)
        .limit(limit * 3)
        .lean();
    }

    // Live discovery from OpenStreetMap if fewer than 3 results found
    if (places.length < 3) {
      try {
        const keyword = q || parsed.cuisines?.join(' ') || '';
        const osmResults = await searchOsmNearby({
          lat: hasGeo ? _lat : 23.8103, // Default to Dhaka center
          lng: hasGeo ? _lng : 90.4125,
          radius: Math.max(radius, 15000),
          limit,
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

          // Re-query database to fetch newly added places
          const refetchFilter = { ...baseFilter };
          delete refetchFilter.location;
          places = await Place.find(refetchFilter)
            .limit(limit * 3)
            .lean();
        }
      } catch (osmErr) {
        console.warn('OpenStreetMap live discovery error:', osmErr.message);
      }
    }

    // Ranking & Prioritization:
    // 1. Direct restaurant name matches (exact match > startsWith > includes)
    // 2. Individual word matches in name
    // 3. Cuisine match
    // 4. Proximity / Rating
    if (q || hasGeo) {
      const lowerQ = q.toLowerCase().trim();
      const lowerQStripped = lowerQ.replace(/['’]/g, '');

      places.sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aNameStripped = aName.replace(/['’]/g, '');
        const bNameStripped = bName.replace(/['’]/g, '');

        if (lowerQ) {
          // Exact name match
          const aExact = aName === lowerQ || aNameStripped === lowerQStripped;
          const bExact = bName === lowerQ || bNameStripped === lowerQStripped;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          // Starts with name
          const aStarts = aName.startsWith(lowerQ) || aNameStripped.startsWith(lowerQStripped);
          const bStarts = bName.startsWith(lowerQ) || bNameStripped.startsWith(lowerQStripped);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;

          // Contains name
          const aContains = aName.includes(lowerQ) || aNameStripped.includes(lowerQStripped);
          const bContains = bName.includes(lowerQ) || bNameStripped.includes(lowerQStripped);
          if (aContains && !bContains) return -1;
          if (!aContains && bContains) return 1;

          // Word tokens in name
          const terms = lowerQ.split(/\s+/).filter((t) => t.length > 1);
          const aTerms = terms.filter((t) => aName.includes(t)).length;
          const bTerms = terms.filter((t) => bName.includes(t)).length;
          if (aTerms !== bTerms) return bTerms - aTerms;
        }

        // Distance proximity sorting if coordinates are present
        if (hasGeo && a.location?.coordinates && b.location?.coordinates) {
          const distA =
            Math.pow(a.location.coordinates[0] - _lng, 2) +
            Math.pow(a.location.coordinates[1] - _lat, 2);
          const distB =
            Math.pow(b.location.coordinates[0] - _lng, 2) +
            Math.pow(b.location.coordinates[1] - _lat, 2);
          return distA - distB;
        }

        // Fallback to highest rated
        return (b.rating || 0) - (a.rating || 0);
      });
    }

    const total = places.length;
    const paginatedPlaces = places.slice(0, limit);

    // Save search history asynchronously
    try {
      await SearchHistory.create({
        sessionId: req.headers['x-session-id'] || 'anonymous',
        query: q,
        parsedIntent: parsed,
        location: hasGeo ? { type: 'Point', coordinates: [_lng, _lat] } : undefined,
        resultsCount: total,
      });
    } catch (_) {}

    return res.json({
      success: true,
      query: q,
      parsedIntent: parsed,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
      results: paginatedPlaces,
    });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Search failed', message: err.message });
  }
}

// Support both POST and GET on /api/search
router.route('/').get(handleSearch).post(handleSearch);

/**
 * GET /api/search/suggestions
 * Autocomplete suggestions for search bar as the user types
 */
router.get('/suggestions', async (req, res) => {
  try {
    const q = String(req.query?.q || '').trim();
    if (!q || q.length < 2) return res.json({ suggestions: [] });

    const escaped = escapeRegex(q);
    const regex = new RegExp(escaped, 'i');
    const strippedRegex = new RegExp(escapeRegex(q.replace(/['’]/g, '')), 'i');

    const places = await Place.find(
      {
        $or: [
          { name: regex },
          { name: strippedRegex },
          { cuisine: regex },
          { tags: regex },
          { 'address.street': regex },
          { 'address.city': regex },
        ],
      },
      { name: 1, 'address.city': 1, 'address.formatted': 1, cuisine: 1, rating: 1, priceLevel: 1 }
    )
      .limit(12)
      .lean();

    // Prioritize direct name matches
    const lowerQ = q.toLowerCase();
    places.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();

      const aExact = aName === lowerQ;
      const bExact = bName === lowerQ;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = aName.startsWith(lowerQ);
      const bStarts = bName.startsWith(lowerQ);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return (b.rating || 0) - (a.rating || 0);
    });

    const suggestions = places.map((p) => ({
      id: String(p._id),
      name: p.name,
      city: p.address?.city || p.address?.formatted || 'Dhaka',
      cuisine: Array.isArray(p.cuisine) ? p.cuisine[0] : p.cuisine,
      rating: p.rating,
      priceLevel: p.priceLevel,
    }));

    return res.json({ suggestions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
