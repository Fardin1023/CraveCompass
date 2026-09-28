const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  author: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String },
  time: { type: Date, default: Date.now },
});

const photoSchema = new mongoose.Schema({
  reference: { type: String },
  url: { type: String },
  width: Number,
  height: Number,
});

const placeSchema = new mongoose.Schema(
  {
    // Core identifiers
    googlePlaceId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, index: true },

    // Location — GeoJSON Point for $near / $geoWithin queries
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    // Address details
    address: {
      formatted: { type: String },
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String },
    },

    // Business info
    categories: [{ type: String }],
    cuisine: [{ type: String }],
    priceLevel: { type: Number, min: 1, max: 4 }, // 1=$, 4=$$$$
    rating: { type: Number, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    phone: { type: String },
    website: { type: String },

    // Hours
    openingHours: {
      openNow: { type: Boolean },
      periods: [mongoose.Schema.Types.Mixed],
      weekdayText: [{ type: String }],
    },

    // Media
    photos: [photoSchema],
    primaryPhoto: { type: String },

    // Reviews
    reviews: [reviewSchema],

    // Tags for AI search
    tags: [{ type: String, index: true }],

    // Popularity
    popularityScore: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },

    // Source tracking
    source: {
      type: String,
      enum: ['google', 'yelp', 'foursquare', 'seed', 'openstreetmap'],
      default: 'openstreetmap',
    },
    lastFetched: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for geospatial queries
placeSchema.index({ location: '2dsphere' });

// Text index for full-text search
placeSchema.index({ name: 'text', 'address.city': 'text', tags: 'text', cuisine: 'text' });

module.exports = mongoose.model('Place', placeSchema);
