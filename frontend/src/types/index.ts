// Shared TypeScript types for CraveCompass

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PlaceLocation {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface PlaceAddress {
  formatted?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface PlacePhoto {
  reference?: string;
  url?: string;
  width?: number;
  height?: number;
}

export interface PlaceReview {
  author: string;
  rating: number;
  text?: string;
  time?: string;
}

export interface OpeningHours {
  openNow?: boolean;
  weekdayText?: string[];
  periods?: unknown[];
}

export interface Place {
  _id: string;
  googlePlaceId?: string;
  name: string;
  location: PlaceLocation;
  address: PlaceAddress;
  categories: string[];
  cuisine: string[];
  priceLevel?: number; // 1-4
  rating?: number;
  totalRatings?: number;
  phone?: string;
  website?: string;
  openingHours?: OpeningHours;
  photos: PlacePhoto[];
  primaryPhoto?: string;
  reviews: PlaceReview[];
  tags: string[];
  popularityScore: number;
  isFeatured: boolean;
  source: 'google' | 'yelp' | 'foursquare' | 'seed' | 'openstreetmap';
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPreferences {
  dietary?: string[];
  favoriteCuisines?: string[];
  defaultSort?: 'distance' | 'rating' | 'popularity';
}

export interface UserSettings {
  mapDefaultStyle?: 'dark' | 'standard';
  locationSharing?: boolean;
  notifications?: boolean;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  preferences?: UserPreferences;
  favorites?: (Place | string)[];
  settings?: UserSettings;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
  error?: string;
}

export interface SearchResult {
  success: boolean;
  query: string;
  parsedIntent: ParsedIntent;
  total: number;
  page: number;
  limit: number;
  pages: number;
  results: Place[];
}

export interface ParsedIntent {
  originalQuery: string;
  cuisines: string[];
  priceLevel: number[] | null;
  openNow: boolean;
  ambience: string[];
  keywords: string[];
  rating: number | null;
}

export interface SearchSuggestion {
  id: string;
  name: string;
  city?: string;
  cuisine?: string;
  rating?: number;
}

export type FilterCategory =
  | 'all'
  | 'open-now'
  | 'top-rated'
  | 'sushi'
  | 'pizza'
  | 'burger'
  | 'coffee'
  | 'vegan'
  | 'mexican'
  | 'indian'
  | 'korean'
  | 'cheap'
  | 'fancy';

export interface ActiveFilters {
  openNow: boolean;
  minRating?: number;
  priceLevel?: number[];
  cuisine?: string[];
  sortBy: 'distance' | 'rating' | 'popularity';
}

export interface AiBudgetRecommendation {
  placeId?: string;
  name: string;
  cuisine: string;
  rating?: number;
  priceLevel?: number;
  estimatedCost: string;
  suggestedOrder: string;
  reason: string;
  budgetTag: string;
  address?: string;
  primaryPhoto?: string;
  fullPlace?: Place;
}

export interface AiBudgetResponse {
  success: boolean;
  source: 'gemini' | 'fallback';
  budgetAnalysis: string;
  totalBudget: number;
  perPersonBudget: number;
  partySize: number;
  recommendations: AiBudgetRecommendation[];
  budgetTips: string[];
}

