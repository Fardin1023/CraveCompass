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
  street_food: '🍢', food_cart: '🛺', cart: '🛺', food_court: '🍱',
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
  const userCircleRef = useRef<L.Circle | null>(null);
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

  // User location marker & proximity range circle
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !leafletInstance || !userLocation) return;
    const L = leafletInstance;
    const map = mapRef.current;

    const userLatLng = L.latLng(userLocation.lat, userLocation.lng);

    // Walking proximity circle (350m radius)
    if (userCircleRef.current) {
      userCircleRef.current.setLatLng(userLatLng);
    } else {
      userCircleRef.current = L.circle(userLatLng, {
        radius: 350,
        color: '#38bdf8',
        fillColor: '#0284c7',
        fillOpacity: 0.1,
        weight: 1.5,
        dashArray: '5, 5',
      }).addTo(map);
    }

    // High-visibility beacon marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userLatLng);
    } else {
      const userDivIcon = L.divIcon({
        className: 'user-map-pin-container',
        html: `
          <div class="user-location-beacon" title="Your current location">
            <div class="user-beacon-pulse"></div>
            <div class="user-beacon-wave"></div>
            <div class="user-beacon-core">
              <div class="user-beacon-center"></div>
            </div>
            <div class="user-beacon-label">
              <span class="user-beacon-dot"></span>
              <span>You Are Here</span>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        popupAnchor: [0, -28],
      });

      userMarkerRef.current = L.marker(userLatLng, {
        icon: userDivIcon,
        zIndexOffset: 1200,
      }).addTo(map);

      userMarkerRef.current.bindPopup(
        `<div style="text-align:center;padding:6px 8px;font-family:inherit">
          <div style="font-weight:800;color:#38bdf8;font-size:13px;margin-bottom:3px">📍 You Are Here</div>
          <div style="font-size:11px;color:#cbd5e1">Showing nearby restaurants & food courts</div>
        </div>`,
        { className: 'crave-osm-popup', offset: [0, -22] }
      );
    }
  }, [userLocation, mapLoaded, leafletInstance]);

  // Delegated click listener for popup "View Details" button
  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return;
    const handlePopupClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('.popup-view-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const placeId = btn.getAttribute('data-place-id');
        const place = places.find((p) => p._id === placeId);
        if (place) {
          mapRef.current?.closePopup();
          onMarkerClick(place);
        }
      }
    };
    container.addEventListener('click', handlePopupClick);
    return () => container.removeEventListener('click', handlePopupClick);
  }, [places, onMarkerClick]);

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

      // Direct DOM creation with bound click handler
      marker.bindPopup(() => {
        const div = document.createElement('div');
        div.innerHTML = popupHtml;
        const btn = div.querySelector<HTMLElement>('.popup-view-btn');
        if (btn) {
          L.DomEvent.on(btn, 'click', (e) => {
            L.DomEvent.stopPropagation(e);
            map.closePopup();
            onMarkerClick(place);
          });
        }
        return div;
      }, {
        maxWidth: 280,
        minWidth: 230,
        className: 'crave-osm-popup',
        closeButton: true,
      });

      marker.on('click', () => {
        onMarkerClick(place);
      });

      markersRef.current.set(place._id, marker);
    });
  }, [places, mapLoaded, leafletInstance, onMarkerClick]);

  // Auto-center or fit bounds to user location + nearby places
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !leafletInstance || selectedPlace) return;
    const L = leafletInstance;

    const validPoints: [number, number][] = [];
    if (userLocation) {
      validPoints.push([userLocation.lat, userLocation.lng]);
    }

    places.forEach((p) => {
      if (p.location?.coordinates && p.location.coordinates.length === 2) {
        const [lng, lat] = p.location.coordinates;
        if (!isNaN(lat) && !isNaN(lng)) {
          validPoints.push([lat, lng]);
        }
      }
    });

    if (validPoints.length > 1) {
      const bounds = L.latLngBounds(validPoints);
      mapRef.current.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 15,
        animate: true,
        duration: 1.0,
      });
    } else if (userLocation) {
      mapRef.current.flyTo([userLocation.lat, userLocation.lng], 15, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [userLocation, places, mapLoaded, leafletInstance, selectedPlace]);

  // Fly to selected place
  useEffect(() => {
    if (!mapRef.current || !selectedPlace || !mapLoaded) return;
    const [lng, lat] = selectedPlace.location.coordinates;
    mapRef.current.flyTo([lat, lng], 16, {
      animate: true,
      duration: 1.0,
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
    }
  }, [selectedPlace, mapLoaded]);

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
