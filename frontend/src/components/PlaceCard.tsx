'use client';

import type { Place } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface PlaceCardProps {
  place: Place;
  isActive: boolean;
  animationDelay?: number;
  onClick: () => void;
  onRequireAuth?: () => void;
}

const PRICE_LABEL = ['', '$', '$$', '$$$', '$$$$'];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`star ${star <= Math.floor(rating) ? 'filled' : star - 0.5 <= rating ? 'half' : ''}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

const CUISINE_PLACEHOLDER: Record<string, string> = {
  sushi: '🍣', pizza: '🍕', burger: '🍔', mexican: '🌮',
  indian: '🍛', thai: '🍜', chinese: '🥢', korean: '🥘',
  seafood: '🦞', coffee: '☕', dessert: '🍰', vegan: '🥗',
  american: '🍖', italian: '🍝', mediterranean: '🫒', breakfast: '🥞',
  food_court: '🍱',
};

function getPlaceholderEmoji(place: Place): string {
  for (const c of place.cuisine || []) {
    if (CUISINE_PLACEHOLDER[c]) return CUISINE_PLACEHOLDER[c];
  }
  return '🍽️';
}

export default function PlaceCard({
  place,
  isActive,
  animationDelay = 0,
  onClick,
  onRequireAuth,
}: PlaceCardProps) {
  const { isFavorite, toggleFavorite, isAuthenticated } = useAuth();
  const isOpen = place.openingHours?.openNow;
  const hasPhoto = !!place.primaryPhoto;
  const favorite = isFavorite(place._id);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    try {
      await toggleFavorite(place._id);
    } catch (_) {}
  };

  return (
    <article
      id={`place-card-${place._id}`}
      className={`place-card ${isActive ? 'active' : ''}`}
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`${place.name}${place.rating ? `, rated ${place.rating} stars` : ''}`}
      aria-pressed={isActive}
    >
      {/* Image */}
      <div className="place-card-image">
        {/* Favorite Heart Button */}
        <button
          type="button"
          className={`card-fav-btn ${favorite ? 'active' : ''}`}
          onClick={handleFavoriteClick}
          aria-label={favorite ? 'Remove from favorites' : 'Save to favorites'}
          title={favorite ? 'Saved in favorites' : 'Save to favorites'}
        >
          {favorite ? '❤️' : '🤍'}
        </button>
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.primaryPhoto!}
            alt={`Photo of ${place.name}`}
            loading="lazy"
          />
        ) : (
          <div className="place-card-image-placeholder">
            {getPlaceholderEmoji(place)}
          </div>
        )}
        <div className="place-card-overlay" />

        {/* Badges */}
        <div className="place-card-badges">
          {place.isFeatured && (
            <span className="badge badge-featured">✦ Featured</span>
          )}
          {isOpen !== undefined && (
            <span className={`badge ${isOpen ? 'badge-open' : 'badge-closed'}`}>
              {isOpen ? '● Open' : '● Closed'}
            </span>
          )}
        </div>

        {/* Price */}
        {place.priceLevel && (
          <div className="place-card-price">
            {PRICE_LABEL[place.priceLevel]}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="place-card-body">
        <h3 className="place-card-name truncate">{place.name}</h3>

        <div className="place-card-meta">
          {place.rating && (
            <>
              <StarRating rating={place.rating} />
              <span className="place-card-rating">
                {place.rating.toFixed(1)}
                {place.totalRatings && (
                  <span className="place-card-rating-count">
                    ({place.totalRatings.toLocaleString()})
                  </span>
                )}
              </span>
            </>
          )}
          {place.cuisine?.[0] && (
            <>
              <div className="place-card-dot" />
              <span className="place-card-cuisine">{place.cuisine[0]}</span>
            </>
          )}
        </div>

        {place.address?.formatted && (
          <div className="place-card-address">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="truncate" style={{ fontSize: '12px' }}>
              {place.address.city || place.address.formatted}
            </span>
          </div>
        )}

        <div className="place-card-footer">
          <button
            type="button"
            className="card-view-details-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            aria-label={`View details for ${place.name}`}
          >
            <span>View Details</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>
      </div>
    </article>
  );
}
