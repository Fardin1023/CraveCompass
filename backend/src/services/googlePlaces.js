/**
 * Google Places API Service
 * Fetches nearby restaurants and place details from Google
 */

const GOOGLE_API_BASE = 'https://maps.googleapis.com/maps/api';

const getApiKey = () => {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set');
  }
  return process.env.GOOGLE_PLACES_API_KEY;
};

/**
 * Search nearby restaurants using Google Places Nearby Search
 */
const searchNearby = async ({ lat, lng, radius = 1500, keyword = '', type = 'restaurant', pagetoken }) => {
  const key = getApiKey();
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius,
    type,
    key,
  });

  if (keyword) params.set('keyword', keyword);
  if (pagetoken) params.set('pagetoken', pagetoken);

  const url = `${GOOGLE_API_BASE}/place/nearbysearch/json?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Places API error: ${res.status}`);

  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places: ${data.status} - ${data.error_message || ''}`);
  }

  return data;
};

/**
 * Get detailed place info (hours, phone, website, reviews)
 */
const getPlaceDetails = async (placeId) => {
  const key = getApiKey();
  const fields = [
    'place_id', 'name', 'geometry', 'formatted_address', 'address_components',
    'rating', 'user_ratings_total', 'price_level', 'types', 'formatted_phone_number',
    'website', 'opening_hours', 'photos', 'reviews',
  ].join(',');

  const params = new URLSearchParams({ place_id: placeId, fields, key });
  const url = `${GOOGLE_API_BASE}/place/details/json?${params}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Place Details error: ${res.status}`);

  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`Google Place Details: ${data.status}`);
  }

  return data.result;
};

/**
 * Get the URL for a place photo
 */
const getPhotoUrl = (photoReference, maxWidth = 800) => {
  const key = getApiKey();
  return `${GOOGLE_API_BASE}/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${key}`;
};

/**
 * Text search — for searching by name/cuisine across a region
 */
const textSearch = async ({ query, lat, lng, radius = 5000 }) => {
  const key = getApiKey();
  const params = new URLSearchParams({ query, key });

  if (lat && lng) {
    params.set('location', `${lat},${lng}`);
    params.set('radius', radius);
  }

  const url = `${GOOGLE_API_BASE}/place/textsearch/json?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Text Search error: ${res.status}`);

  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Text Search: ${data.status}`);
  }

  return data;
};

/**
 * Transform a Google Places result into our Place model format
 */
const transformGooglePlace = (place, detailedResult = null) => {
  const source = detailedResult || place;

  const getPhoto = (photo) =>
    photo?.photo_reference ? getPhotoUrl(photo.photo_reference) : null;

  const addressComponents = source.address_components || [];
  const getComponent = (type) =>
    addressComponents.find((c) => c.types.includes(type))?.long_name || '';

  return {
    googlePlaceId: source.place_id,
    name: source.name,
    location: {
      type: 'Point',
      coordinates: [
        source.geometry.location.lng,
        source.geometry.location.lat,
      ],
    },
    address: {
      formatted: source.formatted_address || source.vicinity,
      street: `${getComponent('street_number')} ${getComponent('route')}`.trim(),
      city: getComponent('locality') || getComponent('administrative_area_level_2'),
      state: getComponent('administrative_area_level_1'),
      country: getComponent('country'),
      postalCode: getComponent('postal_code'),
    },
    categories: source.types || [],
    cuisine: extractCuisineFromTypes(source.types || []),
    priceLevel: source.price_level,
    rating: source.rating,
    totalRatings: source.user_ratings_total,
    phone: source.formatted_phone_number,
    website: source.website,
    openingHours: source.opening_hours
      ? {
          openNow: source.opening_hours.open_now,
          periods: source.opening_hours.periods || [],
          weekdayText: source.opening_hours.weekday_text || [],
        }
      : undefined,
    photos: (source.photos || []).slice(0, 5).map((p) => ({
      reference: p.photo_reference,
      url: getPhotoUrl(p.photo_reference),
      width: p.width,
      height: p.height,
    })),
    primaryPhoto: source.photos?.[0] ? getPhotoUrl(source.photos[0].photo_reference) : null,
    reviews: (source.reviews || []).slice(0, 5).map((r) => ({
      author: r.author_name,
      rating: r.rating,
      text: r.text,
      time: new Date(r.time * 1000),
    })),
    tags: extractTagsFromTypes(source.types || []),
    source: 'google',
    lastFetched: new Date(),
  };
};

const GOOGLE_TYPE_TO_CUISINE = {
  japanese_restaurant: 'sushi',
  chinese_restaurant: 'chinese',
  indian_restaurant: 'indian',
  mexican_restaurant: 'mexican',
  thai_restaurant: 'thai',
  italian_restaurant: 'pizza',
  mediterranean_restaurant: 'mediterranean',
  american_restaurant: 'american',
  seafood_restaurant: 'seafood',
  korean_restaurant: 'korean',
  breakfast_restaurant: 'breakfast',
  bakery: 'dessert',
  cafe: 'coffee',
};

const extractCuisineFromTypes = (types) =>
  types.reduce((acc, t) => {
    if (GOOGLE_TYPE_TO_CUISINE[t]) acc.push(GOOGLE_TYPE_TO_CUISINE[t]);
    return acc;
  }, []);

const extractTagsFromTypes = (types) =>
  types
    .filter((t) => !['point_of_interest', 'establishment', 'food'].includes(t))
    .map((t) => t.replace(/_/g, ' '));

module.exports = {
  searchNearby,
  getPlaceDetails,
  getPhotoUrl,
  textSearch,
  transformGooglePlace,
};
