const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Place = require('../models/Place');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Strict rate limiter for auth attempts to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // max 25 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login or registration attempts. Please try again in 15 minutes.',
  },
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  '/register',
  authLimiter,
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage('Password must contain at least one letter and one number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    try {
      const { name, email, password } = req.body;

      // Check if email already registered
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'An account with this email address already exists.',
        });
      }

      // Generate colorful avatar based on name
      const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

      const user = new User({
        name,
        email,
        password,
        avatar,
        lastLogin: new Date(),
      });

      await user.save();

      const token = user.generateAuthToken();

      res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        token,
        user: user.toSafeObject(),
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
    }
  }
);

/**
 * POST /api/auth/login
 * Log in an existing user
 */
router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    try {
      const { email, password } = req.body;

      // Find user and explicitly select password hash
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password combination.',
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password combination.',
        });
      }

      user.lastLogin = new Date();
      await user.save();

      const token = user.generateAuthToken();

      res.json({
        success: true,
        message: 'Logged in successfully!',
        token,
        user: user.toSafeObject(),
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json({
      success: true,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve profile' });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile details and preferences
 */
router.put(
  '/profile',
  requireAuth,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 250 })
      .withMessage('Bio cannot exceed 250 characters'),
    body('avatar').optional().isString(),
    body('preferences').optional().isObject(),
    body('settings').optional().isObject(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      });
    }

    try {
      const allowedFields = ['name', 'bio', 'avatar', 'preferences', 'settings'];
      const updates = {};

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
      ).populate('favorites');

      res.json({
        success: true,
        message: 'Profile updated successfully!',
        user: updatedUser.toSafeObject(),
      });
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
  }
);

/**
 * PUT /api/auth/change-password
 * Change account password securely
 */
router.put(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage('New password must contain at least one letter and one number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      });
    }

    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user._id).select('+password');
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: 'Current password does not match.',
        });
      }

      user.password = newPassword; // Will trigger bcrypt pre-save hook
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully! You can now use your new password.',
      });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ success: false, error: 'Failed to update password' });
    }
  }
);

/**
 * POST /api/auth/favorites/:placeId
 * Toggle bookmarking a place as favorite
 */
router.post('/favorites/:placeId', requireAuth, async (req, res) => {
  try {
    const { placeId } = req.params;

    // Verify place exists
    const place = await Place.findById(placeId);
    if (!place) {
      return res.status(404).json({ success: false, error: 'Restaurant or place not found' });
    }

    const user = await User.findById(req.user._id);
    const existingIndex = user.favorites.findIndex(
      (id) => id.toString() === placeId.toString()
    );

    let isFavorite = false;

    if (existingIndex > -1) {
      // Remove from favorites
      user.favorites.splice(existingIndex, 1);
      isFavorite = false;
    } else {
      // Add to favorites
      user.favorites.push(place._id);
      isFavorite = true;
    }

    await user.save();

    res.json({
      success: true,
      isFavorite,
      favoritesCount: user.favorites.length,
      message: isFavorite
        ? `Saved ${place.name} to your favorites!`
        : `Removed ${place.name} from your favorites.`,
    });
  } catch (err) {
    console.error('Toggle favorite error:', err);
    res.status(500).json({ success: false, error: 'Failed to toggle favorite' });
  }
});

/**
 * GET /api/auth/favorites
 * Get all favorite places saved by the user
 */
router.get('/favorites', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json({
      success: true,
      results: user.favorites || [],
      total: (user.favorites || []).length,
    });
  } catch (err) {
    console.error('Get favorites error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch favorites' });
  }
});

module.exports = router;
