'use client';

import { useEffect, useRef } from 'react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAllowLocation: () => void;
  onSelectHub: (coords: { lat: number; lng: number }, name: string) => void;
  loading: boolean;
  error: string | null;
  coords: { lat: number; lng: number } | null;
  locationName: string;
}

const DHAKA_HUBS = [
  {
    name: 'Gulshan & Banani',
    area: 'Fine Dining & Food Courts',
    icon: '✨',
    coords: { lat: 23.7925, lng: 90.4078 },
  },
  {
    name: 'Dhanmondi',
    area: 'Satmasjid Rd & Shimanto Square',
    icon: '🍱',
    coords: { lat: 23.7461, lng: 90.3742 },
  },
  {
    name: 'Uttara',
    area: 'Sector 3, 7 & 11 Food Parks',
    icon: '🍔',
    coords: { lat: 23.8759, lng: 90.3795 },
  },
  {
    name: 'Old Dhaka (Puran Dhaka)',
    area: 'Nazira Bazar & Chawkbazar Biryani',
    icon: '🍚',
    coords: { lat: 23.7104, lng: 90.4074 },
  },
  {
    name: 'Mirpur',
    area: 'Mirpur 10 & 2 Food Streets',
    icon: '🍢',
    coords: { lat: 23.8071, lng: 90.3686 },
  },
];

export default function LocationModal({
  isOpen,
  onClose,
  onAllowLocation,
  onSelectHub,
  loading,
  error,
  coords,
  locationName,
}: LocationModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
    >
      <div className="location-modal-card" ref={cardRef}>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close location popup"
        >
          ✕
        </button>

        {/* Animated Radar Beacon Graphic */}
        <div className="location-modal-icon-wrapper">
          <div className="location-modal-radar-wave wave-1" />
          <div className="location-modal-radar-wave wave-2" />
          <div className="location-modal-icon-center">
            <span className="location-modal-icon-emoji">🧭</span>
          </div>
        </div>

        {/* Header */}
        <div className="location-modal-header">
          <h2 id="location-modal-title" className="location-modal-title">
            Find Food Spots Near You
          </h2>
          <p className="location-modal-subtitle">
            Detect your location to discover the closest restaurants, street food stalls,
            and food courts with real-time walking distances.
          </p>
        </div>

        {/* Current status if already located */}
        {coords && (
          <div className="location-current-badge">
            <span className="location-badge-icon">📍</span>
            <div className="location-badge-text">
              <span className="location-badge-label">Active Location</span>
              <span className="location-badge-value">{locationName}</span>
            </div>
            <span className="location-badge-check">✓ Active</span>
          </div>
        )}

        {/* Error notice if permission blocked */}
        {error && (
          <div className="location-error-alert" role="alert">
            <span className="alert-icon">⚠️</span>
            <div className="alert-content">
              <strong>Location Access Needed:</strong> {error}
              <div className="alert-tip">
                Tip: Click the padlock/settings icon in your browser URL bar to allow location, or choose a popular hub below.
              </div>
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          type="button"
          className={`location-primary-btn ${loading ? 'loading' : ''}`}
          onClick={onAllowLocation}
          disabled={loading}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>Detecting Your Coordinates…</span>
            </>
          ) : (
            <>
              <span className="btn-gps-icon">📍</span>
              <span>{coords ? 'Refresh My GPS Location' : 'Access My Current Location'}</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="location-modal-divider">
          <span>OR CHOOSE A DHAKA FOOD HUB</span>
        </div>

        {/* Dhaka Hubs Selection */}
        <div className="location-hubs-grid">
          {DHAKA_HUBS.map((hub) => (
            <button
              key={hub.name}
              type="button"
              className="location-hub-card"
              onClick={() => {
                onSelectHub(hub.coords, hub.name);
                onClose();
              }}
            >
              <div className="location-hub-icon">{hub.icon}</div>
              <div className="location-hub-info">
                <div className="location-hub-name">{hub.name}</div>
                <div className="location-hub-area">{hub.area}</div>
              </div>
              <span className="location-hub-arrow">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
