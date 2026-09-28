'use client';

import type { ActiveFilters } from '@/types';

interface FilterBarProps {
  activeFilters: ActiveFilters;
  onFilterChange: (filters: ActiveFilters) => void;
  onCuisineSearch: (cuisine: string | null) => void;
  activeCuisine: string | null;
}

const CUISINE_CHIPS = [
  { key: 'pizza',       label: 'Pizza',       emoji: '🍕' },
  { key: 'burger',      label: 'Burgers',     emoji: '🍔' },
  { key: 'biryani',     label: 'Biryani',     emoji: '🍚' },
  { key: 'kabab',       label: 'Kabab',       emoji: '🍢' },
  { key: 'street_food', label: 'Street Food & Carts', emoji: '🍢' },
  { key: 'bangladeshi', label: 'Bangladeshi', emoji: '🍛' },
  { key: 'chicken',     label: 'Chicken',     emoji: '🍗' },
  { key: 'coffee',      label: 'Coffee',      emoji: '☕' },
  { key: 'sushi',       label: 'Sushi',       emoji: '🍣' },
  { key: 'thai',        label: 'Thai',        emoji: '🍜' },
  { key: 'breakfast',   label: 'Breakfast',   emoji: '🥞' },
  { key: 'vegan',       label: 'Vegan',       emoji: '🥗' },
  { key: 'seafood',     label: 'Seafood',     emoji: '🦞' },
];

const PRICE_CHIPS = [
  { key: 'budget',    label: '৳ Budget',   levels: [1] },
  { key: 'mid',       label: '৳৳ Mid',     levels: [2] },
  { key: 'upscale',   label: '৳৳৳ Upscale',levels: [3, 4] },
];

const SORT_CHIPS = [
  { key: 'distance',   label: '📍 Nearest' },
  { key: 'rating',     label: '⭐ Top Rated' },
  { key: 'popularity', label: '🔥 Trending' },
] as const;

export default function FilterBar({
  activeFilters,
  onFilterChange,
  onCuisineSearch,
  activeCuisine,
}: FilterBarProps) {
  const handleOpenNow = () => {
    onFilterChange({ ...activeFilters, openNow: !activeFilters.openNow });
  };

  const handleCuisineChip = (cuisineKey: string) => {
    // Toggle: clicking active cuisine clears it
    if (activeCuisine === cuisineKey) {
      onCuisineSearch(null);
    } else {
      onCuisineSearch(cuisineKey);
    }
  };

  const handlePrice = (levels: number[]) => {
    const isActive = JSON.stringify(activeFilters.priceLevel) === JSON.stringify(levels);
    onFilterChange({ ...activeFilters, priceLevel: isActive ? undefined : levels });
  };

  const handleSort = (sortBy: 'distance' | 'rating' | 'popularity') => {
    onFilterChange({ ...activeFilters, sortBy });
  };

  return (
    <div className="filter-bar" role="toolbar" aria-label="Filter restaurants">
      {/* Open Now */}
      <button
        id="filter-open-now"
        className={`filter-chip ${activeFilters.openNow ? 'active chip-open' : ''}`}
        onClick={handleOpenNow}
        aria-pressed={activeFilters.openNow}
        title="Show only open restaurants"
      >
        🟢 Open Now
      </button>

      <div className="filter-separator" aria-hidden="true" />

      {/* Cuisine chips — each triggers a real search */}
      {CUISINE_CHIPS.map((chip) => (
        <button
          key={chip.key}
          id={`filter-cuisine-${chip.key}`}
          className={`filter-chip ${activeCuisine === chip.key ? 'active' : ''}`}
          onClick={() => handleCuisineChip(chip.key)}
          aria-pressed={activeCuisine === chip.key}
          title={`Show ${chip.label} restaurants`}
        >
          {chip.emoji} {chip.label}
        </button>
      ))}

      <div className="filter-separator" aria-hidden="true" />

      {/* Price */}
      {PRICE_CHIPS.map((chip) => {
        const isActive = JSON.stringify(activeFilters.priceLevel) === JSON.stringify(chip.levels);
        return (
          <button
            key={chip.key}
            id={`filter-price-${chip.key}`}
            className={`filter-chip ${isActive ? 'active' : ''}`}
            onClick={() => handlePrice(chip.levels)}
            aria-pressed={isActive}
          >
            {chip.label}
          </button>
        );
      })}

      <div className="filter-separator" aria-hidden="true" />

      {/* Sort */}
      {SORT_CHIPS.map((chip) => (
        <button
          key={chip.key}
          id={`sort-${chip.key}`}
          className={`filter-chip ${activeFilters.sortBy === chip.key ? 'active' : ''}`}
          onClick={() => handleSort(chip.key)}
          aria-pressed={activeFilters.sortBy === chip.key}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
