const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema(
  {
    sessionId: { type: String, index: true },
    query: { type: String, required: true },
    parsedIntent: mongoose.Schema.Types.Mixed,
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number],
    },
    resultsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

searchHistorySchema.index({ location: '2dsphere' });

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
