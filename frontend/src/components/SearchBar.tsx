'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { SearchSuggestion } from '@/types';

interface SearchBarProps {
  query: string;
  suggestions: SearchSuggestion[];
  loading: boolean;
  onChange: (q: string) => void;
  onSearch: (q: string) => void;
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  onClear: () => void;
}

export default function SearchBar({
  query,
  suggestions,
  loading,
  onChange,
  onSearch,
  onSuggestionSelect,
  onClear,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const showSuggestions = focused && suggestions.length > 0;

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (query.trim()) {
        onSearch(query.trim());
        setFocused(false);
        inputRef.current?.blur();
      }
    },
    [query, onSearch]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getRatingStars = (rating?: number) => {
    if (!rating) return '';
    return `⭐ ${rating.toFixed(1)}`;
  };

  const CUISINE_EMOJI: Record<string, string> = {
    sushi: '🍣', pizza: '🍕', burger: '🍔', mexican: '🌮',
    indian: '🍛', thai: '🍜', chinese: '🥢', korean: '🥘',
    seafood: '🦞', coffee: '☕', dessert: '🍰', vegan: '🥗',
  };

  return (
    <div ref={wrapperRef} className="search-wrapper">
      <form onSubmit={handleSubmit}>
        <div className="search-bar">
          {/* Search icon */}
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <input
            ref={inputRef}
            id="search-input"
            type="text"
            className="search-input"
            placeholder='Try "cheap sushi near me" or "best coffee"'
            value={query}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-label="Search for restaurants"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
          />

          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={onClear}
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}

          <button
            type="submit"
            className="search-submit-btn"
            disabled={loading || !query.trim()}
            aria-label="Search"
          >
            {loading ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </form>

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div
          className="suggestions-dropdown"
          role="listbox"
          aria-label="Search suggestions"
        >
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="suggestion-item"
              role="option"
              onClick={() => {
                onSuggestionSelect(suggestion);
                setFocused(false);
              }}
            >
              <div className="suggestion-icon">
                {CUISINE_EMOJI[suggestion.cuisine || ''] || '🍽️'}
              </div>
              <div>
                <div className="suggestion-name">{suggestion.name}</div>
                <div className="suggestion-meta">
                  {[suggestion.city, suggestion.cuisine, getRatingStars(suggestion.rating)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
