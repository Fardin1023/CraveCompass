'use client';

import { useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import type { Place } from '@/types';

interface MapProps {
  places: Place[];
  selectedPlace: Place | null;
  userLocation: { lat: number; lng: number } | null;
  onMarkerClick: (place: Place) => void;
  onMapMove?: (center: { lat: number; lng: number }) => void;
}

// Dhaka, Bangladesh default center [lat, lng]
const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125];
const DEFAULT_ZOOM = 13;

const CUISINE_EMOJI: Record<string, string> = {
  bangladeshi: '🍛', biryani: '🍚', kabab: '🍢', sushi: '🍣',
  japanese: '🍱', pizza: '🍕', italian: '🍝', burger: '🍔',
  american: '🥩', mexican: '🌮', indian: '🍛', thai: '🍜',
  chinese: '🥢', korean: '🥘', seafood: '🦞', coffee: '☕',
  dessert: '🍰', breakfast: '🥞', vegan: '🥗',
  mediterranean: '🫒', chicken: '🍗', continental: '🍽️',
  street_food: '🍢', food_cart: '🛺', cart: '🛺',
  default: '🍽️',
};

const getEmoji = (place: Place) => {
  for (const c of place.cuisine || []) {
    if (CUISINE_EMOJI[c]) return CUISINE_EMOJI[c];
  }
  for (const t of place.tags || []) {
    if (CUISINE_EMOJI[t]) return CUISINE_EMOJI[t];
  }
  return CUISINE_EMOJI.default;
};

const getPriceLabel = (level?: number) => (level ? '৳'.repeat(level) : '');

export default function MapView({
  places,
  selectedPlace,
  userLocation,
  onMarkerClick,
  onMapMove,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [leafletInstance, setLeafletInstance] = useState<typeof L | null>(null);
  const [mapStyle, setMapStyle] = useState<'dark' | 'standard'>('dark');

  // Load Leaflet dynamically on client side
  useEffect(() => {
    let mounted = true;
    import('leaflet').then((mod) => {
      if (mounted) {
        setLeafletInstance(mod.default || mod);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!leafletInstance || !mapContainer.current || mapRef.current) return;
    const L = leafletInstance;

    const initialCenter = userLocation
      ? ([userLocation.lat, userLocation.lng] as [number, number])
      : DEFAULT_CENTER;

    const map = L.map(mapContainer.current, {
      center: initialCenter,
      zoom: DEFAULT_ZOOM,
      zoomControl: false, // We reposition custom controls or add top-right
    });

    // Add zoom control at bottom-right or top-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Tile layer (100% Free OpenStreetMap)
    const osmTileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const osmAttribution =
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

    const tileLayer = L.tileLayer(osmTileUrl, {
      maxZoom: 19,
      attribution: osmAttribution,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    map.whenReady(() => {
      setMapLoaded(true);
    });

    map.on('moveend', () => {
      const center = map.getCenter();
      onMapMove?.({ lat: center.lat, lng: center.lng });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, [leafletInstance]);

  // Apply dark mode class to map container based on selected style
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapStyle === 'dark') {
      mapContainer.current.classList.add('osm-dark-mode');
    } else {
      mapContainer.current.classList.remove('osm-dark-mode');
    }
  }, [mapStyle]);

  // User location marker
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !leafletInstance || !userLocation) return;
    const L = leafletInstance;
    const map = mapRef.current;

    const userLatLng = L.latLng(userLocation.lat, userLocation.lng);

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userLatLng);
    } else {
      const userDivIcon = L.divIcon({
        className: 'user-map-pin',
        html: `
          <div style="
            width: 22px; height: 22px;
            background: radial-gradient(circle, #60a5fa 0%, #2563eb 55%, rgba(37,99,235,0.25) 100%);
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 0 6px rgba(37,99,235,0.25), 0 2px 8px rgba(0,0,0,0.6);
            animation: pulse 2s ease-in-out infinite;
          "></div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      userMarkerRef.current = L.marker(userLatLng, {
        icon: userDivIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    }
  }, [userLocation, mapLoaded, leafletInstance]);

  // Place markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !leafletInstance) return;
    const L = leafletInstance;
    const map = mapRef.current;

    const existingIds = new Set(markersRef.current.keys());
    const newIds = new Set(places.map((p) => p._id));

    // Remove stale markers
    existingIds.forEach((id) => {
      if (!newIds.has(id)) {
        markersRef.current.get(id)?.remove();
        markersRef.current.delete(id);
      }
    });

    places.forEach((place, i) => {
      // place.location.coordinates is [lng, lat]
      const [lng, lat] = place.location.coordinates;
      if (!lat || !lng) return;

      const emoji = getEmoji(place);
      const isOpen = place.openingHours?.openNow;
      const isFeatured = place.isFeatured;

      if (markersRef.current.has(place._id)) {
        markersRef.current.get(place._id)!.setLatLng([lat, lng]);
        return;
      }

      // Marker HTML
      const markerHtml = `
        <div class="map-marker" style="animation-delay: ${i * 50}ms">
          <div class="marker-pin marker-drop" style="animation-delay: ${i * 50}ms">
            <div class="marker-body ${isFeatured ? 'featured' : ''} ${isOpen === true ? 'open' : ''}">
              <span class="marker-emoji">${emoji}</span>
            </div>
          </div>
        </div>
      `;

      const divIcon = L.divIcon({
        className: 'osm-custom-marker',
        html: markerHtml,
        iconSize: [40, 48],
        iconAnchor: [20, 48],
        popupAnchor: [0, -46],
      });

      // Popup HTML with photo and details
      const photoHtml = place.primaryPhoto
        ? `<div class="popup-image"><img src="${place.primaryPhoto}" alt="${place.name}" loading="lazy"/></div>`
        : '';
      const openHtml =
        isOpen !== undefined
          ? `<span class="popup-status ${isOpen ? 'open' : 'closed'}">${isOpen ? '● Open' : '● Closed'}</span>`
          : '';

      const popupHtml = `
        ${photoHtml}
        <div class="popup-content">
          <div class="popup-name">${place.name}</div>
          <div class="popup-meta">
            ${place.rating ? `<span class="popup-meta-rating">⭐ ${place.rating.toFixed(1)}</span>` : ''}
            ${place.priceLevel ? `<span>· ${getPriceLabel(place.priceLevel)}</span>` : ''}
            ${place.cuisine?.[0] ? `<span>· ${place.cuisine[0]}</span>` : ''}
          </div>
          ${openHtml ? `<div style="margin-bottom:10px">${openHtml}</div>` : ''}
          <div class="popup-view-btn" data-place-id="${place._id}">View Details →</div>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: divIcon }).addTo(map);

      marker.bindPopup(popupHtml, {
        maxWidth: 270,
        minWidth: 230,
        className: 'crave-osm-popup',
        closeButton: true,
      });

      marker.on('popupopen', () => {
        setTimeout(() => {
          const btn = document.querySelector(`[data-place-id="${place._id}"]`);
          btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            onMarkerClick(place);
          });
        }, 50);
      });

      marker.on('click', () => {
        onMarkerClick(place);
      });

      markersRef.current.set(place._id, marker);
    });
  }, [places, mapLoaded, leafletInstance, onMarkerClick]);

  // Fit bounds to places
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !leafletInstance || places.length === 0 || selectedPlace) {
      return;
    }
    try {
      const validPoints = places
        .filter((p) => p.location?.coordinates && p.location.coordinates.length === 2)
        .map((p) => [p.location.coordinates[1], p.location.coordinates[0]] as [number, number]);

      if (validPoints.length > 0) {
        const bounds = leafletInstance.latLngBounds(validPoints);
        mapRef.current.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: 14.5,
          animate: true,
          duration: 0.8,
        });
      }
    } catch (_) {}
  }, [places, mapLoaded, leafletInstance]);

  // Fly to selected place
  useEffect(() => {
    if (!mapRef.current || !selectedPlace || !mapLoaded) return;
    const [lng, lat] = selectedPlace.location.coordinates;
    mapRef.current.flyTo([lat, lng], 15, {
      animate: true,
      duration: 1.2,
    });

    const marker = markersRef.current.get(selectedPlace._id);
    if (marker) {
      const el = marker.getElement();
      if (el) {
        const markerPin = el.querySelector('.map-marker');
        if (markerPin) {
          markerPin.classList.remove('active');
          void (markerPin as HTMLElement).offsetWidth;
          markerPin.classList.add('active');
          setTimeout(() => markerPin.classList.remove('active'), 600);
        }
      }
      marker.openPopup();
    }
  }, [selectedPlace, mapLoaded]);

  // Fly to user location on initial locate
  useEffect(() => {
    if (!mapRef.current || !userLocation || !mapLoaded || places.length > 0) return;
    mapRef.current.flyTo([userLocation.lat, userLocation.lng], 14, {
      animate: true,
      duration: 1.5,
    });
  }, [userLocation, mapLoaded]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* OSM Tile Layer Switcher */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 400,
          display: 'flex',
          gap: '6px',
          background: 'rgba(15, 26, 9, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-pill)',
          padding: '4px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <button
          type="button"
          onClick={() => setMapStyle('dark')}
          style={{
            padding: '5px 11px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '11px',
            fontWeight: 700,
            background: mapStyle === 'dark' ? 'var(--gradient-brand)' : 'transparent',
            color: mapStyle === 'dark' ? 'var(--text-inverse)' : 'var(--text-secondary)',
            transition: 'all 0.2s ease',
          }}
          title="OpenStreetMap Dark Tiles"
        >
          🌙 OSM Dark
        </button>
        <button
          type="button"
          onClick={() => setMapStyle('standard')}
          style={{
            padding: '5px 11px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '11px',
            fontWeight: 700,
            background: mapStyle === 'standard' ? 'var(--gradient-brand)' : 'transparent',
            color: mapStyle === 'standard' ? 'var(--text-inverse)' : 'var(--text-secondary)',
            transition: 'all 0.2s ease',
          }}
          title="OpenStreetMap Standard Tiles"
        >
          🗺️ OSM Standard
        </button>
      </div>

      <div
        ref={mapContainer}
        className="map-canvas"
        role="region"
        aria-label="Restaurant OpenStreetMap"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
