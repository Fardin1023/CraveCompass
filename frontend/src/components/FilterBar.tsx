'use client';

import { useState, useRef, useEffect } from 'react';
import type { ActiveFilters } from '@/types';

interface FilterBarProps {
  activeFilters: ActiveFilters;
  onFilterChange: (filters: ActiveFilters) => void;
  onCuisineSearch: (cuisine: string | null) => void;
  activeCuisine: string | null;
  onOpenAiBudget: () => void;
}

export const BUDGET_TIERS = [
  {
    key: 'all',
    label: 'All Budgets',
    levels: undefined,
    badge: 'Any Price',
    desc: 'Show all restaurants & food courts',
    icon: '✨',
  },
  {
    key: 'budget',
    label: '৳ Budget Friendly',
    levels: [1],
    badge: 'Under ৳250',
    desc: 'Food courts, street food stalls, tea & quick bites',
    icon: '🍱',
  },
  {
    key: 'mid',
    label: '৳৳ Mid-Range',
    levels: [2],
    badge: '৳250 – ৳600',
    desc: 'Popular cafes, casual eateries & food court meal sets',
    icon: '🍔',
  },
  {
    key: 'upscale',
    label: '৳৳৳ Upscale',
    levels: [3],
    badge: '৳600 – ৳1500',
    desc: 'Specialty steakhouses, buffets & premium dining',
    icon: '🥩',
  },
  {
    key: 'luxury',
    label: '৳৳৳৳ Luxury',
    levels: [4],
    badge: '৳1500+',
    desc: 'Fine dining & luxury hotel restaurants',
    icon: '🍷',
  },
];

const CUISINE_CHIPS = [
  { key: 'food_court',  label: 'Food Courts',         emoji: '🍱' },
  { key: 'street_food', label: 'Street Food & Carts', emoji: '🍢' },
  { key: 'biryani',     label: 'Biryani',             emoji: '🍚' },
  { key: 'burger',      label: 'Burgers',             emoji: '🍔' },
  { key: 'pizza',       label: 'Pizza',               emoji: '🍕' },
  { key: 'kabab',       label: 'Kabab',               emoji: '🍢' },
  { key: 'bangladeshi', label: 'Bangladeshi',         emoji: '🍛' },
  { key: 'chicken',     label: 'Chicken',             emoji: '🍗' },
  { key: 'coffee',      label: 'Coffee',              emoji: '☕' },
  { key: 'sushi',       label: 'Sushi',               emoji: '🍣' },
  { key: 'thai',        label: 'Thai',                emoji: '🍜' },
  { key: 'breakfast',   label: 'Breakfast',           emoji: '🥞' },
  { key: 'vegan',       label: 'Vegan',               emoji: '🥗' },
  { key: 'seafood',     label: 'Seafood',             emoji: '🦞' },
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
  onOpenAiBudget,
}: FilterBarProps) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const budgetRef = useRef<HTMLDivElement>(null);

  // Close budget dropdown on outside click
  useEffect(() => {
    if (!budgetOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (budgetRef.current && !budgetRef.current.contains(e.target as Node)) {
        setBudgetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [budgetOpen]);

  const handleOpenNow = () => {
    onFilterChange({ ...activeFilters, openNow: !activeFilters.openNow });
  };

  const handleCuisineChip = (cuisineKey: string) => {
    if (activeCuisine === cuisineKey) {
      onCuisineSearch(null);
    } else {
      onCuisineSearch(cuisineKey);
    }
  };

  const handleSelectBudget = (levels?: number[]) => {
    onFilterChange({ ...activeFilters, priceLevel: levels });
    setBudgetOpen(false);
  };

  const handleSort = (sortBy: 'distance' | 'rating' | 'popularity') => {
    onFilterChange({ ...activeFilters, sortBy });
  };

  // Find currently active budget tier
  const currentTier = BUDGET_TIERS.find((t) => {
    if (!t.levels && (!activeFilters.priceLevel || activeFilters.priceLevel.length === 0)) {
      return true;
    }
    return JSON.stringify(t.levels) === JSON.stringify(activeFilters.priceLevel);
  }) || BUDGET_TIERS[0];

  const hasBudgetFilter = Boolean(activeFilters.priceLevel && activeFilters.priceLevel.length > 0);

  return (
    <div className="filter-bar" role="toolbar" aria-label="Filter restaurants">
      {/* ── ✨ Gemini AI Budget Advisor Button ─────────────────── */}
      <button
        type="button"
        id="ai-budget-trigger-btn"
        className="filter-chip ai-budget-chip"
        onClick={onOpenAiBudget}
        title="Input your exact budget in Taka and let Gemini AI find matching meals & food courts"
      >
        <span className="ai-chip-sparkle">✨</span>
        <span className="ai-chip-text">AI Budget Advisor</span>
        <span className="ai-chip-badge">Gemini Free</span>
      </button>

      <div className="filter-separator" aria-hidden="true" />

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

      {/* ── Budget Filter Dropdown ────────────────────────── */}
      <div className="budget-filter-container" ref={budgetRef}>
        <button
          type="button"
          id="filter-budget-btn"
          className={`filter-chip budget-trigger ${hasBudgetFilter ? 'active budget-active' : ''}`}
          onClick={() => setBudgetOpen(!budgetOpen)}
          aria-expanded={budgetOpen}
          aria-haspopup="listbox"
          title="Filter by budget / price level"
        >
          <span className="budget-icon">💰</span>
          <span className="budget-label">
            {hasBudgetFilter ? currentTier.badge : 'Budget'}
          </span>
          <span className="budget-arrow">{budgetOpen ? '▴' : '▾'}</span>
        </button>

        {budgetOpen && (
          <div className="budget-dropdown-popover" role="listbox">
            <div className="budget-popover-header">
              <span className="budget-popover-title">Filter by Budget (৳ BDT)</span>
              {hasBudgetFilter && (
                <button
                  type="button"
                  className="budget-reset-btn"
                  onClick={() => handleSelectBudget(undefined)}
                >
                  Clear
                </button>
              )}
            </div>

            {/* AI Advisor Banner inside dropdown */}
            <div
              className="budget-ai-banner"
              onClick={() => {
                setBudgetOpen(false);
                onOpenAiBudget();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="budget-ai-banner-content">
                <span className="ai-sparkle">✨</span>
                <div>
                  <div className="budget-ai-banner-title">Input Custom Budget to AI</div>
                  <div className="budget-ai-banner-desc">
                    Type e.g. ৳300 or ৳500 for Gemini AI custom suggestions
                  </div>
                </div>
              </div>
              <span className="budget-ai-banner-arrow">→</span>
            </div>

            <div className="budget-tiers-list">
              {BUDGET_TIERS.map((tier) => {
                const isSelected =
                  (!tier.levels && !hasBudgetFilter) ||
                  JSON.stringify(tier.levels) === JSON.stringify(activeFilters.priceLevel);

                return (
                  <button
                    key={tier.key}
                    type="button"
                    className={`budget-tier-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectBudget(tier.levels)}
                  >
                    <span className="tier-icon">{tier.icon}</span>
                    <div className="tier-info">
                      <div className="tier-top">
                        <span className="tier-name">{tier.label}</span>
                        <span className="tier-badge">{tier.badge}</span>
                      </div>
                      <span className="tier-desc">{tier.desc}</span>
                    </div>
                    {isSelected && <span className="tier-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick Budget Chips */}
      <button
        type="button"
        id="quick-budget-chip-1"
        className={`filter-chip ${JSON.stringify(activeFilters.priceLevel) === JSON.stringify([1]) ? 'active' : ''}`}
        onClick={() => handleSelectBudget(JSON.stringify(activeFilters.priceLevel) === JSON.stringify([1]) ? undefined : [1])}
        title="Show Food Courts and Street Food under ৳250"
      >
        ৳ Under 250 (Food Courts)
      </button>

      <button
        type="button"
        id="quick-budget-chip-2"
        className={`filter-chip ${JSON.stringify(activeFilters.priceLevel) === JSON.stringify([2]) ? 'active' : ''}`}
        onClick={() => handleSelectBudget(JSON.stringify(activeFilters.priceLevel) === JSON.stringify([2]) ? undefined : [2])}
        title="Show Mid-range Cafes & Eateries ৳250-600"
      >
        ৳৳ 250-600
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
          title={`Show ${chip.label}`}
        >
          {chip.emoji} {chip.label}
        </button>
      ))}

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
