const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - Verifies JWT token and attaches authenticated user to req.user
 */
const requireAuth = async (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in.',
      });
    }

    const secret = process.env.JWT_SECRET || 'cravecompass_dev_fallback_secret_key_1023';
    let decoded;

    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please log in again.',
          isExpired: true,
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token.',
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ success: false, error: 'Server authentication error' });
  }
};

/**
 * Optional Auth - Attaches user if token is present, continues without error if absent
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const secret = process.env.JWT_SECRET || 'cravecompass_dev_fallback_secret_key_1023';
    try {
      const decoded = jwt.verify(token, secret);
      req.user = await User.findById(decoded.id);
    } catch (_) {
      req.user = null;
    }
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

module.exports = {
  requireAuth,
  optionalAuth,
};
