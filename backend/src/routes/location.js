const express = require('express');
const { query, validationResult } = require('express-validator');

const router = express.Router();

/**
 * GET /api/location/reverse-geocode
 * Converts lat/lng to human-readable address using Google Geocoding API
 */
router.get(
  '/reverse-geocode',
  [
    query('lat').notEmpty().isFloat({ min: -90, max: 90 }),
    query('lng').notEmpty().isFloat({ min: -180, max: 180 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { lat, lng } = req.query;

      if (!process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_API_KEY === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
        // Return a mock response for development
        return res.json({
          success: true,
          address: `${parseFloat(lat).toFixed(4)}°N, ${parseFloat(lng).toFixed(4)}°E`,
          city: 'Your Location',
          country: '',
        });
      }

      const params = new URLSearchParams({
        latlng: `${lat},${lng}`,
        key: process.env.GOOGLE_PLACES_API_KEY,
        result_type: 'locality|administrative_area_level_1',
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const components = result.address_components;

        const getComponent = (type) =>
          components.find((c) => c.types.includes(type))?.long_name || '';

        res.json({
          success: true,
          address: result.formatted_address,
          city: getComponent('locality') || getComponent('administrative_area_level_2'),
          state: getComponent('administrative_area_level_1'),
          country: getComponent('country'),
          lat: parseFloat(lat),
          lng: parseFloat(lng),
        });
      } else {
        res.json({
          success: true,
          address: `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`,
          city: 'Unknown Location',
        });
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * POST /api/location/validate
 * Validates that a lat/lng is within sane bounds
 */
router.post('/validate', (req, res) => {
  const { lat, lng } = req.body;
  const isValid =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;

  res.json({ valid: isValid, lat, lng });
});

module.exports = router;
