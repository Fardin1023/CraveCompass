'use client';

import { useState, useCallback, useRef } from 'react';

interface GeolocationState {
  coords: { lat: number; lng: number } | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    error: null,
    loading: false,
  });

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'Geolocation is not supported by your browser.' }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          error: null,
          loading: false,
        });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Location permission was denied.',
          2: 'Location information is unavailable.',
          3: 'Location request timed out.',
        };
        setState({
          coords: null,
          error: messages[error.code] || 'Unknown geolocation error.',
          loading: false,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  }, []);

  return { ...state, getLocation };
}
