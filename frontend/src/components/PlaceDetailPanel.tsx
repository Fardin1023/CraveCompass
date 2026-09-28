'use client';
import { useState, useEffect } from 'react';
import type { Place } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { getPlaceById } from '@/lib/api';

interface PlaceDetailPanelProps {
  place: Place;
  onClose: () => void;
  onRequireAuth?: () => void;
}

const PRICE_LABEL = ['', '$', '$$', '$$$', '$$$$'];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="star-rating" style={{ gap: '3px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`star ${star <= Math.floor(rating) ? 'filled' : ''}`} style={{ fontSize: '16px' }}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function PlaceDetailPanel({
  place: initialPlace,
  onClose,
  onRequireAuth,
}: PlaceDetailPanelProps) {
  const [place, setPlace] = useState<Place>(initialPlace);

  useEffect(() => {
    setPlace(initialPlace);
    if (initialPlace?._id) {
      getPlaceById(initialPlace._id)
        .then((res) => {
          if (res?.place) setPlace(res.place);
        })
        .catch(() => {});
    }
  }, [initialPlace]);

  const { isFavorite, toggleFavorite, isAuthenticated } = useAuth();
  const isOpen = place.openingHours?.openNow;
  const favorite = isFavorite(place._id);

  const handleFavoriteClick = async () => {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    try {
      await toggleFavorite(place._id);
    } catch (_) {}
  };

  const openDirections = () => {
    const [lng, lat] = place.location.coordinates;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank'
    );
  };

  const openWebsite = () => {
    if (place.website) window.open(place.website, '_blank');
  };

  const callPhone = () => {
    if (place.phone) window.location.href = `tel:${place.phone}`;
  };

  return (
    <div
      className="detail-panel"
      role="dialog"
      aria-label={`Details for ${place.name}`}
      aria-modal="true"
    >
      <div className="detail-panel-drag" aria-hidden="true" />

      <div className="detail-panel-content">
        {/* Header */}
        <div className="detail-panel-header">
          <h2 className="detail-panel-name">{place.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className={`detail-fav-btn ${favorite ? 'active' : ''}`}
              onClick={handleFavoriteClick}
              title={favorite ? 'Remove from saved spots' : 'Save to favorites'}
              aria-label={favorite ? 'Remove from saved spots' : 'Save to favorites'}
            >
              {favorite ? '❤️ Saved' : '🤍 Save'}
            </button>
            <button
              id="detail-close-btn"
              className="detail-close-btn"
              onClick={onClose}
              aria-label="Close details panel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hero Image */}
        {place.primaryPhoto && (
          <div className="detail-panel-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={place.primaryPhoto} alt={`Photo of ${place.name}`} />
          </div>
        )}

        {/* Stats */}
        <div className="detail-stats">
          {place.rating !== undefined && (
            <div className="detail-stat">
              <div className="detail-stat-value">
                {place.rating.toFixed(1)} ⭐
              </div>
              <div className="detail-stat-label">
                {place.totalRatings
                  ? `${place.totalRatings.toLocaleString()} reviews`
                  : 'Rating'}
              </div>
            </div>
          )}
          {place.priceLevel && (
            <div className="detail-stat">
              <div className="detail-stat-value">{PRICE_LABEL[place.priceLevel]}</div>
              <div className="detail-stat-label">Price Range</div>
            </div>
          )}
          <div className="detail-stat">
            <div className="detail-stat-value" style={{ color: isOpen ? '#34d399' : isOpen === false ? '#f87171' : 'var(--text-muted)' }}>
              {isOpen === true ? '●' : isOpen === false ? '●' : '?'}
            </div>
            <div className="detail-stat-label">
              {isOpen === true ? 'Open Now' : isOpen === false ? 'Closed' : 'Hours'}
            </div>
          </div>
        </div>

        {/* Info */}
        <p className="detail-section-title">Information</p>
        <div>
          {place.address?.formatted && (
            <div className="detail-info-row">
              <svg className="detail-info-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {place.address.formatted}
            </div>
          )}
          {place.phone && (
            <div className="detail-info-row" style={{ cursor: 'pointer' }} onClick={callPhone}>
              <svg className="detail-info-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              {place.phone}
            </div>
          )}
          {place.website && (
            <div className="detail-info-row" style={{ cursor: 'pointer', color: 'var(--brand-primary)' }} onClick={openWebsite}>
              <svg className="detail-info-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" />
              </svg>
              Visit website
            </div>
          )}
          {place.openingHours?.weekdayText?.length && (
            <div className="detail-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-primary)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Hours</span>
              </div>
              {place.openingHours.weekdayText.map((text, i) => (
                <div key={i} style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '23px' }}>
                  {text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cuisine & Tags */}
        {(place.cuisine?.length || place.tags?.length) && (
          <>
            <p className="detail-section-title" style={{ marginTop: '16px' }}>Tags</p>
            <div className="detail-tags">
              {[...(place.cuisine || []), ...(place.tags || [])]
                .filter((v, i, a) => a.indexOf(v) === i)
                .slice(0, 10)
                .map((tag) => (
                  <span key={tag} className="detail-tag">{tag}</span>
                ))}
            </div>
          </>
        )}

        {/* Reviews */}
        {place.reviews?.length > 0 && (
          <>
            <p className="detail-section-title" style={{ marginTop: '20px' }}>Reviews</p>
            {place.reviews.slice(0, 2).map((review, i) => (
              <div
                key={i}
                style={{
                  padding: '12px',
                  background: 'var(--bg-glass)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {review.author}
                  </span>
                  <StarRating rating={review.rating} />
                </div>
                {review.text && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
                    {review.text.slice(0, 150)}{review.text.length > 150 ? '...' : ''}
                  </p>
                )}
              </div>
            ))}
          </>
        )}

        {/* Actions */}
        <div className="detail-actions">
          <button
            id="get-directions-btn"
            className="detail-action-btn primary"
            onClick={openDirections}
            aria-label={`Get directions to ${place.name}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            Directions
          </button>
          {place.phone && (
            <button
              id="call-restaurant-btn"
              className="detail-action-btn secondary"
              onClick={callPhone}
              aria-label={`Call ${place.name}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Call
            </button>
          )}
          {place.website && (
            <button
              id="visit-website-btn"
              className="detail-action-btn secondary"
              onClick={openWebsite}
              aria-label={`Visit ${place.name} website`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Website
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
