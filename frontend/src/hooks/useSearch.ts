'use client';

import { useState, useCallback, useRef } from 'react';
import { searchPlaces, getSearchSuggestions, getNearbyPlaces } from '@/lib/api';
import type { Place, SearchSuggestion, ActiveFilters } from '@/types';

interface SearchState {
  query: string;
  results: Place[];
  suggestions: SearchSuggestion[];
  loading: boolean;
  error: string | null;
  total: number;
  hasSearched: boolean;
}

export function useSearch() {
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    suggestions: [],
    loading: false,
    error: null,
    total: 0,
    hasSearched: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const search = useCallback(
    async (
      query: string,
      coords?: { lat: number; lng: number },
      filters?: ActiveFilters,
      radius = 5000
    ) => {
      setState((s) => ({ ...s, loading: true, error: null, hasSearched: true }));
      try {
        const result = await searchPlaces({
          q: query,
          lat: coords?.lat,
          lng: coords?.lng,
          radius,
          limit: 30,
        });
        setState((s) => ({
          ...s,
          results: result.results,
          total: result.total,
          loading: false,
        }));
      } catch (err: unknown) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : 'Search failed',
          loading: false,
        }));
      }
    },
    []
  );

  const fetchNearby = useCallback(
    async (
      coords: { lat: number; lng: number },
      filters?: ActiveFilters,
      radius = 2000
    ) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await getNearbyPlaces({
          lat: coords.lat,
          lng: coords.lng,
          radius,
          limit: 30,
          openNow: filters?.openNow,
          minRating: filters?.minRating,
          priceLevel: filters?.priceLevel?.join(','),
          cuisine: filters?.cuisine?.join(','),
          sortBy: filters?.sortBy || 'distance',
        });
        setState((s) => ({
          ...s,
          results: result.results,
          total: result.total,
          loading: false,
          hasSearched: true,
        }));
      } catch (err: unknown) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : 'Failed to load nearby places',
          loading: false,
        }));
      }
    },
    []
  );

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 2) {
      setState((s) => ({ ...s, suggestions: [] }));
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await getSearchSuggestions(q);
        setState((s) => ({ ...s, suggestions: res.suggestions }));
      } catch {
        // silently fail suggestions
      }
    }, 300);
  }, []);

  const setQuery = useCallback((query: string) => {
    setState((s) => ({ ...s, query }));
  }, []);

  const clearResults = useCallback(() => {
    setState((s) => ({
      ...s,
      results: [],
      suggestions: [],
      total: 0,
      hasSearched: false,
      query: '',
    }));
  }, []);

  return {
    ...state,
    search,
    fetchNearby,
    fetchSuggestions,
    setQuery,
    clearResults,
  };
}
