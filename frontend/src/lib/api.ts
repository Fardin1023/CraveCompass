// API client for CraveCompass backend

import type { Place, SearchResult, SearchSuggestion } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      data.error || `HTTP ${res.status}`,
      res.status,
      data
    );
  }

  return res.json();
}

// ── Search ──────────────────────────────────────────────────

export interface SearchParams {
  q?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  limit?: number;
  page?: number;
}

export async function searchPlaces(params: SearchParams): Promise<SearchResult> {
  return request<SearchResult>('/search', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getSearchSuggestions(
  q: string
): Promise<{ suggestions: SearchSuggestion[] }> {
  const query = new URLSearchParams({ q });
  return request(`/search/suggestions?${query}`);
}

// ── Places ──────────────────────────────────────────────────

export interface NearbyParams {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
  cuisine?: string;
  priceLevel?: string;
  openNow?: boolean;
  minRating?: number;
  sortBy?: 'distance' | 'rating' | 'popularity';
}

export async function getNearbyPlaces(params: NearbyParams): Promise<{
  success: boolean;
  total: number;
  results: Place[];
  center: { lat: number; lng: number };
  radius: number;
}> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) query.set(k, String(v));
  });
  return request(`/places/nearby?${query}`);
}

export async function getPlaceById(id: string): Promise<{ success: boolean; place: Place }> {
  return request(`/places/${id}`);
}

// ── Location ─────────────────────────────────────────────────

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ success: boolean; address: string; city: string; state?: string; country?: string }> {
  const query = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return request(`/location/reverse-geocode?${query}`);
}

// ── Health ───────────────────────────────────────────────────

export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  return request('/health');
}

export { ApiError };
