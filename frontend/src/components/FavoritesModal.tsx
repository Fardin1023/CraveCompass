'use client';

import React, { useEffect, useState } from 'react';
import type { Place } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { getUserFavorites } from '@/lib/api';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlace: (place: Place) => void;
  onToast: (msg: string, icon?: string) => void;
}

export default function FavoritesModal({
  isOpen,
  onClose,
  onSelectPlace,
  onToast,
}: FavoritesModalProps) {
  const { token, toggleFavorite } = useAuth();
  const [favorites, setFavorites] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      setLoading(true);
      getUserFavorites(token)
        .then((res) => {
          if (res.success && res.results) {
            setFavorites(res.results);
          }
        })
        .catch(() => {
          onToast('Failed to load saved places', '⚠️');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleRemove = async (e: React.MouseEvent, placeId: string, name: string) => {
    e.stopPropagation();
    try {
      await toggleFavorite(placeId);
      setFavorites((prev) => prev.filter((p) => p._id !== placeId));
      onToast(`Removed ${name} from saved spots`, '💔');
    } catch (_) {
      onToast('Could not update favorite', '⚠️');
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fav-modal-title"
    >
      <div className="fav-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="fav-modal-header">
          <div>
            <h2 id="fav-modal-title" className="fav-modal-title">
              ❤️ Saved Food Spots
            </h2>
            <p className="fav-modal-subtitle">
              {favorites.length} {favorites.length === 1 ? 'place' : 'places'} bookmarked
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="fav-modal-body">
          {loading ? (
            <div className="fav-loading">
              <span className="loading-spinner" />
              <p>Loading saved spots…</p>
            </div>
          ) : favorites.length === 0 ? (
            <div className="fav-empty">
              <span style={{ fontSize: '48px' }}>🍱</span>
              <h3 style={{ color: 'var(--cream)', fontSize: '18px', fontWeight: 800 }}>
                No Saved Places Yet
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '280px', lineHeight: 1.5 }}>
                Click the ❤️ heart icon on any restaurant or street food cart to bookmark it here for quick access!
              </p>
            </div>
          ) : (
            <div className="fav-list">
              {favorites.map((place) => (
                <div
                  key={place._id}
                  className="fav-item"
                  onClick={() => {
                    onSelectPlace(place);
                    onClose();
                  }}
                >
                  <div className="fav-item-image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={place.primaryPhoto || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}
                      alt={place.name}
                      loading="lazy"
                    />
                  </div>
                  <div className="fav-item-info">
                    <h4 className="fav-item-name">{place.name}</h4>
                    <div className="fav-item-meta">
                      {place.rating && <span>⭐ {place.rating.toFixed(1)}</span>}
                      {place.cuisine?.[0] && <span>· {place.cuisine[0]}</span>}
                      {place.address?.city && <span>· {place.address.city}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="fav-remove-btn"
                    onClick={(e) => handleRemove(e, place._id, place.name)}
                    title="Remove from saved spots"
                  >
                    ❤️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
