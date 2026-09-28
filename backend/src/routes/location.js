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

      // 1. Try OpenStreetMap (Nominatim) — 100% free, no API key needed
      try {
        const osmRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'CraveCompass/1.0 (https://cravecompass.app)',
              'Accept-Language': 'en',
            },
          }
        );
        if (osmRes.ok) {
          const osmData = await osmRes.json();
          if (osmData && osmData.address) {
            const addr = osmData.address;
            const city =
              addr.suburb ||
              addr.neighbourhood ||
              addr.city ||
              addr.town ||
              addr.county ||
              addr.state ||
              'Your Location';

            return res.json({
              success: true,
              address: osmData.display_name,
              city: `${city}${addr.city && addr.city !== city ? `, ${addr.city}` : ''}`,
              state: addr.state || '',
              country: addr.country || '',
              lat: parseFloat(lat),
              lng: parseFloat(lng),
              provider: 'openstreetmap',
            });
          }
        }
      } catch (osmErr) {
        console.warn('OpenStreetMap reverse geocode fallback to Google or mock:', osmErr.message);
      }

      // 2. Fallback to Google Places Geocoding if API key is configured
      if (process.env.GOOGLE_PLACES_API_KEY && process.env.GOOGLE_PLACES_API_KEY !== 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
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

          return res.json({
            success: true,
            address: result.formatted_address,
            city: getComponent('locality') || getComponent('administrative_area_level_2'),
            state: getComponent('administrative_area_level_1'),
            country: getComponent('country'),
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            provider: 'google',
          });
        }
      }

      // 3. Fallback coordinates display if network fails
      res.json({
        success: true,
        address: `${parseFloat(lat).toFixed(4)}°N, ${parseFloat(lng).toFixed(4)}°E`,
        city: 'Your Location',
        country: '',
      });
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
