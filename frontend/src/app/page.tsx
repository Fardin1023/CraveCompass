'use client';

// CraveCompass Dhaka — Live Production
import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSearch } from '@/hooks/useSearch';
import { useAuth } from '@/context/AuthContext';
import SearchBar from '@/components/SearchBar';
import FilterBar from '@/components/FilterBar';
import PlaceCard from '@/components/PlaceCard';
import PlaceDetailPanel from '@/components/PlaceDetailPanel';
import AuthModal from '@/components/AuthModal';
import UserProfileModal from '@/components/UserProfileModal';
import FavoritesModal from '@/components/FavoritesModal';
import LocationModal from '@/components/LocationModal';
import { reverseGeocode } from '@/lib/api';
import type { Place, ActiveFilters } from '@/types';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="map-canvas" style={{
      background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '16px',
    }}>
      <div className="loading-spinner" />
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading map…</p>
    </div>
  ),
});

const DEFAULT_FILTERS: ActiveFilters = { openNow: false, sortBy: 'distance' };
const DHAKA_DEFAULT = { lat: 23.8103, lng: 90.4125 };

const CUISINE_LABELS: Record<string, string> = {
  pizza: 'Pizza 🍕', burger: 'Burgers 🍔', biryani: 'Biryani 🍚',
  kabab: 'Kabab 🍢', bangladeshi: 'Bangladeshi 🍛', chicken: 'Chicken 🍗',
  street_food: 'Street Food & Carts 🍢',
  food_court: 'Food Courts 🍱',
  coffee: 'Coffee ☕', sushi: 'Sushi 🍣', thai: 'Thai 🍜',
  vegan: 'Vegan 🥗', breakfast: 'Breakfast 🥞', seafood: 'Seafood 🦞',
};

function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <div className="skeleton-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="skeleton-image" />
      <div style={{ padding: '11px 13px' }}>
        <div className="skeleton-text medium" />
        <div className="skeleton-text short" style={{ marginTop: '7px' }} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { coords, error: geoError, loading: geoLoading, getLocation } = useGeolocation();
  const {
    query, results, suggestions, loading, total, hasSearched,
    search, fetchNearby, fetchSuggestions, setQuery, clearResults,
  } = useSearch();

  const [selectedPlace, setSelectedPlace]     = useState<Place | null>(null);
  const [activeFilters, setActiveFilters]     = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [activeCuisine, setActiveCuisine]     = useState<string | null>(null);
  const [locationName, setLocationName]       = useState<string>('Dhaka, Bangladesh');
  const [toast, setToast]                     = useState<{ message: string; icon: string } | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [customCoords, setCustomCoords]       = useState<{ lat: number; lng: number } | null>(null);

  // Active coordinates: real GPS or selected Dhaka hub
  const activeCoords = coords || customCoords || null;

  // Authentication & User Profile States
  const { user, isAuthenticated, logout, favoritesCount } = useAuth();
  const [authModalOpen, setAuthModalOpen]             = useState(false);
  const [authModalMode, setAuthModalMode]             = useState<'login' | 'register'>('login');
  const [profileModalOpen, setProfileModalOpen]       = useState(false);
  const [favoritesModalOpen, setFavoritesModalOpen]   = useState(false);
  const [userMenuOpen, setUserMenuOpen]               = useState(false);
  const userMenuRef                                   = useRef<HTMLDivElement>(null);
  const searchDebounceRef                             = useRef<ReturnType<typeof setTimeout>>(null);

  // Close user dropdown on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [userMenuOpen]);

  const showToast = useCallback((message: string, icon = 'ℹ️') => {
    setToast({ message, icon });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // When GPS location is acquired, dismiss the location popup
  useEffect(() => {
    if (coords && locationModalOpen) {
      setLocationModalOpen(false);
      showToast('Location acquired! Showing nearby food spots', '📍');
    }
  }, [coords, locationModalOpen, showToast]);

  // Load places on initial mount or when active coordinates change
  useEffect(() => {
    const loc = activeCoords || DHAKA_DEFAULT;
    fetchNearby(loc, activeFilters);
    if (activeCoords) {
      reverseGeocode(activeCoords.lat, activeCoords.lng)
        .then((res) => setLocationName(res.city || res.address))
        .catch(() => setLocationName(customCoords ? locationName : 'Current Location'));
    } else {
      setLocationName('Dhaka, Bangladesh');
    }
  }, [activeCoords]);

  // Re-fetch when non-cuisine filters change (openNow, price, sort)
  useEffect(() => {
    const loc = activeCoords || DHAKA_DEFAULT;
    if (activeCuisine) {
      search(activeCuisine, loc, activeFilters);
    } else if (query) {
      search(query, loc, activeFilters);
    } else {
      fetchNearby(loc, activeFilters);
    }
  }, [activeFilters]);

  // Handle cuisine chip click — triggers a dedicated cuisine search
  const handleCuisineSearch = useCallback(
    (cuisine: string | null) => {
      setActiveCuisine(cuisine);
      setSelectedPlace(null);
      const loc = activeCoords || DHAKA_DEFAULT;
      if (!cuisine) {
        // Clear cuisine filter → show all nearby
        fetchNearby(loc, activeFilters);
        return;
      }
      showToast(`Showing ${CUISINE_LABELS[cuisine] ?? cuisine} places`, '🔍');
      search(cuisine, loc, activeFilters);
    },
    [activeCoords, activeFilters, fetchNearby, search, showToast]
  );

  const handleSearch = useCallback(
    (q: string) => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      setActiveCuisine(null);
      const loc = activeCoords || DHAKA_DEFAULT;
      search(q, loc, activeFilters);
    },
    [activeCoords, activeFilters, search]
  );

  // Live as-you-type search
  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q);
      fetchSuggestions(q);

      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

      if (!q.trim()) {
        const loc = activeCoords || DHAKA_DEFAULT;
        if (activeCuisine) {
          search(activeCuisine, loc, activeFilters);
        } else {
          fetchNearby(loc, activeFilters);
        }
        return;
      }

      searchDebounceRef.current = setTimeout(() => {
        setActiveCuisine(null);
        const loc = activeCoords || DHAKA_DEFAULT;
        search(q.trim(), loc, activeFilters);
      }, 300);
    },
    [setQuery, fetchSuggestions, activeCoords, activeCuisine, activeFilters, search, fetchNearby]
  );

  const handleClear = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setActiveCuisine(null);
    clearResults();
    const loc = activeCoords || DHAKA_DEFAULT;
    fetchNearby(loc, activeFilters);
  }, [clearResults, activeCoords, activeFilters, fetchNearby]);

  const handleLocateMe = useCallback(() => {
    setLocationModalOpen(true);
  }, []);

  const handleFilterChange = useCallback((filters: ActiveFilters) => {
    setActiveFilters(filters);
  }, []);

  const handleMarkerClick  = useCallback((place: Place) => setSelectedPlace(place), []);
  const handleCardClick    = useCallback((place: Place) => setSelectedPlace(place), []);
  const handleCloseDetail  = useCallback(() => setSelectedPlace(null), []);

  useEffect(() => {
    if (geoError) showToast(geoError, '⚠️');
  }, [geoError]);

  return (
    <main className="app-container">
      {/* ── Navbar ─────────────────────────── */}
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <div className="navbar-logo">
          <div className="navbar-logo-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="CraveCompass Logo" />
          </div>
          <span className="navbar-logo-text">CraveCompass</span>
        </div>

        <div className="navbar-search">
          <SearchBar
            query={query}
            suggestions={suggestions}
            loading={loading}
            onChange={handleQueryChange}
            onSearch={handleSearch}
            onSuggestionSelect={(s) => { setQuery(s.name); handleSearch(s.name); }}
            onClear={handleClear}
          />
        </div>

        <div className="navbar-actions">
          {locationName && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {locationName}
            </div>
          )}

          <button
            id="locate-me-btn-nav"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px',
              background: activeCoords ? 'var(--bg-glass)' : 'var(--gradient-brand)',
              border: `1.5px solid ${activeCoords ? 'var(--border-default)' : 'transparent'}`,
              borderRadius: 'var(--radius-pill)',
              fontSize: '13px', fontWeight: 700,
              color: activeCoords ? 'var(--text-secondary)' : 'var(--text-inverse)',
              cursor: 'pointer',
              transition: 'all var(--t-base)',
              boxShadow: activeCoords ? 'none' : 'var(--shadow-orange)',
              flexShrink: 0,
            }}
            onClick={handleLocateMe}
            aria-label="Open location permission modal"
          >
            {geoLoading ? (
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            )}
            {geoLoading ? 'Locating…' : activeCoords ? 'Near Me ✓' : 'Find Near Me'}
          </button>

          {/* User Profile / Auth Area */}
          {isAuthenticated && user ? (
            <div className="user-dropdown-container" ref={userMenuRef}>
              <button
                type="button"
                className="user-profile-trigger"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-label="User profile menu"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Foodie'}
                  alt={user.name}
                  className="user-nav-avatar"
                />
                <span className="user-nav-name">{user.name.split(' ')[0]}</span>
                <span className="user-nav-arrow">{userMenuOpen ? '▴' : '▾'}</span>
              </button>

              {userMenuOpen && (
                <div className="user-dropdown-menu">
                  <div className="user-dropdown-header">
                    <div style={{ fontWeight: 700, color: 'var(--cream)', fontSize: '13px' }}>{user.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }} className="truncate">{user.email}</div>
                  </div>
                  <div className="user-dropdown-divider" />
                  <button
                    type="button"
                    className="user-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setFavoritesModalOpen(true);
                    }}
                  >
                    <span>❤️ Saved Spots</span>
                    <span className="dropdown-counter-badge">{favoritesCount}</span>
                  </button>
                  <button
                    type="button"
                    className="user-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setProfileModalOpen(true);
                    }}
                  >
                    <span>⚙️ Profile & Preferences</span>
                  </button>
                  <div className="user-dropdown-divider" />
                  <button
                    type="button"
                    className="user-dropdown-item danger"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                      showToast('Signed out successfully', '👋');
                    }}
                  >
                    <span>🚪 Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="navbar-signin-btn"
              onClick={() => {
                setAuthModalMode('login');
                setAuthModalOpen(true);
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* ── Filter Bar ─────────────────────── */}
      <FilterBar
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onCuisineSearch={handleCuisineSearch}
        activeCuisine={activeCuisine}
      />

      {/* ── Active cuisine banner ───────────── */}
      {activeCuisine && (
        <div className="active-cuisine-banner">
          <span className="active-cuisine-banner-icon">{CUISINE_LABELS[activeCuisine]?.split(' ')[1] ?? '🔍'}</span>
          Showing <strong>{CUISINE_LABELS[activeCuisine] ?? activeCuisine}</strong> restaurants
          <button
            className="active-cuisine-clear"
            onClick={() => handleCuisineSearch(null)}
            aria-label="Clear cuisine filter"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* ── Active budget banner ───────────── */}
      {activeFilters.priceLevel && activeFilters.priceLevel.length > 0 && (
        <div className="active-budget-banner">
          <span className="active-budget-banner-icon">💰</span>
          <span>
            Filtering by Budget:{' '}
            <strong>
              {activeFilters.priceLevel[0] === 1
                ? 'Under ৳250 (Food Courts & Street Food)'
                : activeFilters.priceLevel[0] === 2
                ? '৳250 – ৳600 (Mid-Range & Cafes)'
                : activeFilters.priceLevel[0] === 3
                ? '৳600 – ৳1500 (Upscale Dining)'
                : '৳1500+ (Luxury Dining)'}
            </strong>
          </span>
          <button
            className="active-budget-clear"
            onClick={() => handleFilterChange({ ...activeFilters, priceLevel: undefined })}
            aria-label="Clear budget filter"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* ── Main Layout ─────────────────────── */}
      <div className="map-layout">

        {/* ── Sidebar ─────────────────────── */}
        <aside className="results-sidebar" aria-label="Search results">
          <div className="sidebar-header">
            <div className="sidebar-title">
              {activeCuisine
                ? `${CUISINE_LABELS[activeCuisine] ?? activeCuisine} Spots`
                : hasSearched ? 'Search Results' : 'Nearby Restaurants'}
            </div>
            <div className="sidebar-count">
              {loading ? (
                <span style={{ fontSize: '15px', color: 'var(--text-muted)' }} className="animate-pulse">
                  Searching…
                </span>
              ) : (
                <>
                  <span>{total || results.length}</span> places
                </>
              )}
            </div>
          </div>

          <div className="sidebar-list" role="list">
            {loading && !results.length ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} delay={i * 80} />)
            ) : results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  {activeCuisine ? '🔍' : hasSearched ? '😕' : '📍'}
                </div>
                <div className="empty-state-title">
                  {activeCuisine
                    ? `No ${CUISINE_LABELS[activeCuisine] ?? activeCuisine} found`
                    : hasSearched ? 'No results found' : 'Discover food near you'}
                </div>
                <div className="empty-state-message">
                  {activeCuisine
                    ? 'Try a different cuisine or clear the filter.'
                    : hasSearched
                    ? 'Try a different search or broaden your filters.'
                    : 'Click "Find Near Me" to discover restaurants, or type a cuisine above.'}
                </div>
                {!coords && !activeCuisine && (
                  <button
                    id="locate-me-empty-btn"
                    style={{
                      marginTop: '16px', padding: '10px 22px',
                      background: 'var(--gradient-brand)',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '14px', fontWeight: 700,
                      color: 'var(--text-inverse)',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-orange)',
                      border: 'none',
                    }}
                    onClick={handleLocateMe}
                  >
                    📍 Find Near Me
                  </button>
                )}
              </div>
            ) : (
              results.map((place, i) => (
                <div key={place._id} role="listitem">
                  <PlaceCard
                    place={place}
                    isActive={selectedPlace?._id === place._id}
                    animationDelay={i * 50}
                    onClick={() => handleCardClick(place)}
                    onRequireAuth={() => {
                      setAuthModalMode('login');
                      setAuthModalOpen(true);
                      showToast('Please sign in to bookmark places', '🔒');
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ── Map ─────────────────────────── */}
        <div className="map-container">
          <MapView
            places={results}
            selectedPlace={selectedPlace}
            userLocation={activeCoords}
            onMarkerClick={handleMarkerClick}
          />

          {/* Locate Me floating */}
          {!activeCoords && (
            <button
              id="locate-me-map-btn"
              className={`locate-me-btn ${geoLoading ? 'loading' : ''}`}
              onClick={handleLocateMe}
              aria-label="Use my location"
            >
              {geoLoading ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
              )}
              Use My Location
            </button>
          )}

          {/* Map Controls */}
          <div className="map-controls">
            <button id="map-zoom-in"  className="map-control-btn" aria-label="Zoom in">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button id="map-zoom-out" className="map-control-btn" aria-label="Zoom out">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Place Detail Panel */}
          {selectedPlace && (
            <PlaceDetailPanel
              place={selectedPlace}
              onClose={handleCloseDetail}
              onRequireAuth={() => {
                setAuthModalMode('login');
                setAuthModalOpen(true);
                showToast('Please sign in to bookmark places', '🔒');
              }}
            />
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────── */}
      <LocationModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onAllowLocation={getLocation}
        onSelectHub={(hubCoords, hubName) => {
          setCustomCoords(hubCoords);
          setLocationName(hubName);
          showToast(`Browsing ${hubName}`, '📍');
        }}
        loading={geoLoading}
        error={geoError}
        coords={activeCoords}
        locationName={locationName}
      />

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => showToast('Welcome to CraveCompass!', '🎉')}
      />

      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onToast={showToast}
      />

      <FavoritesModal
        isOpen={favoritesModalOpen}
        onClose={() => setFavoritesModalOpen(false)}
        onSelectPlace={(p) => {
          setSelectedPlace(p);
          showToast(`Viewing ${p.name}`, '📍');
        }}
        onToast={showToast}
      />

      {/* ── Toast ─────────────────────────── */}
      <div className="toast-container" aria-live="polite">
        {toast && (
          <div className="toast animate-fadeIn">
            <span className="toast-icon">{toast.icon}</span>
            {toast.message}
          </div>
        )}
      </div>
    </main>
  );
}
