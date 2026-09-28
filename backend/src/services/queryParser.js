/**
 * Query Parser Service
 * Extracts search intent from natural language queries
 * e.g. "cheap sushi near me open now" →
 *   { cuisine: ['sushi'], priceLevel: [1,2], openNow: true }
 */

const CUISINE_KEYWORDS = {
  pizza: ['pizza', 'pizzeria', 'slice', 'cheez'],
  burger: ['burger', 'burgers', 'hamburger', 'cheeseburger', 'chillox', 'smash'],
  biryani: ['biryani', 'kacchi', 'tehari', 'polao'],
  kabab: ['kabab', 'kebab', 'tikka', 'sheekh', 'boti', 'chaap', 'grill'],
  bangladeshi: ['bangladeshi', 'desi', 'bengali', 'morog', 'khichuri', 'hilsa', 'ilish', 'dal'],
  chicken: ['chicken', 'wings', 'fried chicken', 'peri peri', 'peri-peri'],
  sushi: ['sushi', 'japanese', 'ramen', 'udon', 'miso', 'tempura', 'sashimi'],
  mexican: ['mexican', 'tacos', 'taco', 'burrito', 'quesadilla', 'enchilada', 'tamale'],
  chinese: ['chinese', 'dim sum', 'dumplings', 'noodles', 'wonton', 'kung pao'],
  indian: ['indian', 'curry', 'biryani', 'tikka', 'naan', 'samosa', 'dal'],
  thai: ['thai', 'pad thai', 'green curry', 'tom yum'],
  mediterranean: ['mediterranean', 'greek', 'hummus', 'falafel', 'shawarma', 'kebab'],
  american: ['american', 'bbq', 'barbecue', 'steakhouse', 'steak', 'wings'],
  seafood: ['seafood', 'fish', 'lobster', 'shrimp', 'crab', 'oyster', 'clam'],
  breakfast: ['breakfast', 'brunch', 'pancakes', 'waffles', 'omelette', 'eggs benedict'],
  coffee: ['coffee', 'cafe', 'espresso', 'latte', 'cappuccino', 'café'],
  dessert: ['dessert', 'ice cream', 'cake', 'bakery', 'pastry', 'donut', 'gelato'],
  vegan: ['vegan', 'plant-based', 'vegetarian', 'veggie'],
  korean: ['korean', 'kbbq', 'bibimbap', 'kimchi', 'bulgogi'],
  street_food: ['food cart', 'foodcart', 'street food', 'cart', 'stall', 'fuchka', 'chotpoti', 'jhalmuri', 'tong', 'snack', 'fast food'],
  food_court: ['food court', 'foodcourt', 'food village', 'food park', 'food square', 'court'],
};

const PRICE_KEYWORDS = {
  cheap: [1, 2],
  affordable: [1, 2],
  budget: [1],
  inexpensive: [1, 2],
  moderate: [2, 3],
  mid: [2, 3],
  expensive: [3, 4],
  upscale: [3, 4],
  fancy: [3, 4],
  fine: [4],
  luxury: [4],
};

const OPEN_NOW_KEYWORDS = ['open now', 'open', 'currently open', 'open today'];

const AMBIENCE_KEYWORDS = {
  romantic: ['romantic', 'date night', 'intimate'],
  family: ['family', 'kids', 'child-friendly', 'family-friendly'],
  casual: ['casual', 'relaxed', 'laid-back', 'chill'],
  trendy: ['trendy', 'hipster', 'popular', 'instagram'],
  outdoor: ['outdoor', 'patio', 'rooftop', 'al fresco'],
  delivery: ['delivery', 'takeout', 'take out', 'takeaway'],
};

/**
 * Parse a user query into structured search intent
 * @param {string} query - Raw user query
 * @returns {Object} Parsed intent
 */
const parseQuery = (query) => {
  if (!query || typeof query !== 'string') return {};

  const lowerQuery = query.toLowerCase().trim();

  const intent = {
    originalQuery: query,
    cuisines: [],
    priceLevel: null,
    openNow: false,
    ambience: [],
    keywords: [],
    rating: null,
  };

  // Detect cuisines
  for (const [cuisine, aliases] of Object.entries(CUISINE_KEYWORDS)) {
    if (aliases.some((alias) => lowerQuery.includes(alias))) {
      intent.cuisines.push(cuisine);
    }
  }

  // Detect price level
  for (const [keyword, levels] of Object.entries(PRICE_KEYWORDS)) {
    if (lowerQuery.includes(keyword)) {
      intent.priceLevel = levels;
      break;
    }
  }

  // Detect open now
  intent.openNow = OPEN_NOW_KEYWORDS.some((kw) => lowerQuery.includes(kw));

  // Detect ambience / features
  for (const [amb, aliases] of Object.entries(AMBIENCE_KEYWORDS)) {
    if (aliases.some((alias) => lowerQuery.includes(alias))) {
      intent.ambience.push(amb);
    }
  }

  // Detect high-rating preference
  if (lowerQuery.includes('best') || lowerQuery.includes('top') || lowerQuery.includes('highly rated')) {
    intent.rating = 4.0;
  }

  // Remaining keywords (clean stop words)
  const stopWords = new Set([
    'a', 'an', 'the', 'near', 'me', 'to', 'and', 'or', 'in', 'at',
    'for', 'with', 'i', 'want', 'looking', 'find', 'show', 'get',
    'good', 'great', 'nice', 'food', 'restaurant', 'place', 'places',
    'now', 'open', 'is',
  ]);
  intent.keywords = lowerQuery
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 5);

  return intent;
};

/**
 * Build a MongoDB query object from parsed intent
 */
const buildMongoQuery = (intent, { lat, lng, radiusMeters = 5000 } = {}) => {
  const query = {};

  if (intent.cuisines && intent.cuisines.length > 0) {
    query.$or = [
      { cuisine: { $in: intent.cuisines } },
      { tags: { $in: intent.cuisines } },
      { categories: { $in: intent.cuisines.map((c) => new RegExp(c, 'i')) } },
    ];
  }

  if (intent.priceLevel) {
    query.priceLevel = { $in: intent.priceLevel };
  }

  if (intent.openNow) {
    query['openingHours.openNow'] = true;
  }

  if (intent.rating) {
    query.rating = { $gte: intent.rating };
  }

  // Geospatial filter
  if (lat !== undefined && lng !== undefined) {
    query.location = {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusMeters,
      },
    };
  }

  return query;
};

module.exports = { parseQuery, buildMongoQuery };
