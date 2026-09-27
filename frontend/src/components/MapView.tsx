'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Place } from '@/types';

interface MapProps {
  places: Place[];
  selectedPlace: Place | null;
  userLocation: { lat: number; lng: number } | null;
  onMarkerClick: (place: Place) => void;
  onMapMove?: (center: { lat: number; lng: number }) => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const DEFAULT_CENTER: [number, number] = [90.4125, 23.8103]; // Dhaka, Bangladesh
const DEFAULT_ZOOM = 12;

const CUISINE_EMOJI: Record<string, string> = {
  bangladeshi: '🍛', biryani: '🍚', kabab: '🍢', sushi: '🍣',
  japanese: '🍱', pizza: '🍕', italian: '🍝', burger: '🍔',
  american: '🥩', mexican: '🌮', indian: '🍛', thai: '🍜',
  chinese: '🥢', korean: '🥘', seafood: '🦞', coffee: '☕',
  dessert: '🍰', breakfast: '🥞', vegan: '🥗',
  mediterranean: '🫒', chicken: '🍗', continental: '🍽️',
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

const getPriceLabel = (level?: number) => level ? '৳'.repeat(level) : '';

export default function MapView({
  places, selectedPlace, userLocation, onMarkerClick, onMapMove,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markersRef   = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const userMarkerRef= useRef<mapboxgl.Marker | null>(null);
  const popupRef     = useRef<mapboxgl.Popup | null>(null);
  const [mapLoaded, setMapLoaded]   = useState(false);
  const [mapboxgl, setMapboxgl]     = useState<typeof import('mapbox-gl') | null>(null);

  // Load mapbox-gl dynamically (client-only)
  useEffect(() => {
    import('mapbox-gl').then((mod) => {
      mod.default.accessToken = MAPBOX_TOKEN;
      setMapboxgl(mod.default as unknown as typeof import('mapbox-gl'));
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapboxgl || !mapContainer.current || mapRef.current) return;
    const map = new (mapboxgl as any).Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: userLocation ? [userLocation.lng, userLocation.lat] : DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      antialias: true,
    });
    map.on('load', () => setMapLoaded(true));
    map.on('moveend', () => {
      const center = map.getCenter();
      onMapMove?.({ lat: center.lat, lng: center.lng });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [mapboxgl]);

  // User location marker
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !mapboxgl || !userLocation) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    } else {
      const el = document.createElement('div');
      el.style.cssText = `
        width:20px;height:20px;
        background:radial-gradient(circle,#60a5fa 0%,#2563eb 55%,rgba(37,99,235,0.25) 100%);
        border-radius:50%;
        border:3px solid white;
        box-shadow:0 0 0 6px rgba(37,99,235,0.2),0 2px 8px rgba(0,0,0,0.5);
        animation:pulse 2s ease-in-out infinite;
      `;
      userMarkerRef.current = new (mapboxgl as any).Marker({ element: el, anchor: 'center' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(mapRef.current!);
    }
  }, [userLocation, mapLoaded, mapboxgl]);

  // Place markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !mapboxgl) return;
    const map = mapRef.current;
    const existingIds = new Set(markersRef.current.keys());
    const newIds      = new Set(places.map((p) => p._id));

    // Remove stale markers
    existingIds.forEach((id) => {
      if (!newIds.has(id)) { markersRef.current.get(id)?.remove(); markersRef.current.delete(id); }
    });

    places.forEach((place, i) => {
      const [lng, lat] = place.location.coordinates;
      const emoji      = getEmoji(place);
      const isOpen     = place.openingHours?.openNow;
      const isFeatured = place.isFeatured;

      if (markersRef.current.has(place._id)) {
        markersRef.current.get(place._id)!.setLngLat([lng, lat]);
        return;
      }

      // Marker element
      const el = document.createElement('div');
      el.className = 'map-marker';
      el.style.animationDelay = `${i * 60}ms`;
      el.innerHTML = `
        <div class="marker-pin marker-drop" style="animation-delay:${i * 60}ms">
          <div class="marker-body ${isFeatured ? 'featured' : ''} ${isOpen === true ? 'open' : ''}">
            <span class="marker-emoji">${emoji}</span>
          </div>
        </div>
      `;

      // Popup HTML with photo
      const photoHtml = place.primaryPhoto
        ? `<div class="popup-image"><img src="${place.primaryPhoto}" alt="${place.name}" loading="lazy"/></div>`
        : '';
      const openHtml = isOpen !== undefined
        ? `<span class="popup-status ${isOpen ? 'open' : 'closed'}">${isOpen ? '● Open' : '● Closed'}</span>`
        : '';

      const popup = new (mapboxgl as any).Popup({ offset: 22, closeButton: true, maxWidth: '270px' }).setHTML(`
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
      `);

      popup.on('open', () => {
        setTimeout(() => {
          document.querySelector(`[data-place-id="${place._id}"]`)
            ?.addEventListener('click', () => onMarkerClick(place));
        }, 80);
      });

      const marker = new (mapboxgl as any).Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', () => {
        onMarkerClick(place);
        popupRef.current?.remove();
        if (marker.getPopup() && !marker.getPopup()?.isOpen()) marker.togglePopup();
        popupRef.current = popup;
      });

      markersRef.current.set(place._id, marker);
    });
  }, [places, mapLoaded, mapboxgl, onMarkerClick]);

  // Smoothly fit bounds to show all filtered places when places list changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !mapboxgl || places.length === 0 || selectedPlace) return;
    try {
      const bounds = new (mapboxgl as any).LngLatBounds();
      places.forEach((p) => {
        if (p.location?.coordinates) {
          bounds.extend(p.location.coordinates as [number, number]);
        }
      });
      mapRef.current.fitBounds(bounds, {
        padding: { top: 70, bottom: 70, left: 70, right: 70 },
        maxZoom: 14.5,
        duration: 900,
      });
    } catch (_) {}
  }, [places, mapLoaded, mapboxgl]);
  useEffect(() => {
    if (!mapRef.current || !selectedPlace || !mapLoaded) return;
    const [lng, lat] = selectedPlace.location.coordinates;
    mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 1200, essential: true });
    const marker = markersRef.current.get(selectedPlace._id);
    if (marker) {
      const el = marker.getElement();
      el.classList.remove('active');
      void el.offsetWidth; // reflow
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 500);
      if (marker.getPopup() && !marker.getPopup()?.isOpen()) marker.togglePopup();
    }
  }, [selectedPlace, mapLoaded]);

  // Fly to user location on first fix
  useEffect(() => {
    if (!mapRef.current || !userLocation || !mapLoaded || places.length > 0) return;
    mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14, duration: 1500 });
  }, [userLocation, mapLoaded]);

  return (
    <div ref={mapContainer} className="map-canvas" role="region" aria-label="Restaurant map" />
  );
}
