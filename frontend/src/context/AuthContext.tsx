'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Place } from '@/types';
import {
  loginUser,
  registerUser,
  getCurrentUser,
  updateUserProfile,
  changeUserPassword,
  togglePlaceFavorite,
} from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  register: (name: string, email: string, pass: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; message?: string; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  toggleFavorite: (placeId: string) => Promise<{ isFavorite: boolean; message: string }>;
  isFavorite: (placeId: string) => boolean;
  favoritesCount: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'cravecompass_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage on client mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) {
      setLoading(false);
      return;
    }

    setToken(savedToken);
    getCurrentUser(savedToken)
      .then((res) => {
        if (res.success && res.user) {
          setUser(res.user);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, pass: string) => {
    try {
      const res = await loginUser({ email, password: pass });
      if (res.success && res.token && res.user) {
        localStorage.setItem(TOKEN_KEY, res.token);
        setToken(res.token);
        setUser(res.user);
        return { success: true, message: res.message };
      }
      return { success: false, error: 'Login failed. Please check credentials.' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, pass: string) => {
    try {
      const res = await registerUser({ name, email, password: pass });
      if (res.success && res.token && res.user) {
        localStorage.setItem(TOKEN_KEY, res.token);
        setToken(res.token);
        setUser(res.user);
        return { success: true, message: res.message };
      }
      return { success: false, error: 'Registration failed.' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
      if (!token) return { success: false, error: 'Not authenticated' };
      try {
        const res = await updateUserProfile(updates, token);
        if (res.success && res.user) {
          setUser(res.user);
          return { success: true, message: res.message };
        }
        return { success: false, error: 'Profile update failed' };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Profile update failed';
        return { success: false, error: message };
      }
    },
    [token]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token) return { success: false, error: 'Not authenticated' };
      try {
        const res = await changeUserPassword({ currentPassword, newPassword }, token);
        return { success: res.success, message: res.message };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Password change failed';
        return { success: false, error: message };
      }
    },
    [token]
  );

  const toggleFavorite = useCallback(
    async (placeId: string) => {
      if (!token || !user) {
        throw new Error('Please sign in to save favorite restaurants!');
      }

      const res = await togglePlaceFavorite(placeId, token);
      if (res.success) {
        // Refresh local user favorites list
        setUser((prev) => {
          if (!prev) return prev;
          const currentFavorites = (prev.favorites || []).map((f) =>
            typeof f === 'string' ? f : f._id
          );
          let newFavorites: (Place | string)[];

          if (res.isFavorite) {
            newFavorites = [...currentFavorites, placeId];
          } else {
            newFavorites = currentFavorites.filter((id) => id !== placeId);
          }

          return { ...prev, favorites: newFavorites };
        });

        return { isFavorite: res.isFavorite, message: res.message };
      }
      throw new Error('Failed to update favorite');
    },
    [token, user]
  );

  const isFavorite = useCallback(
    (placeId: string) => {
      if (!user || !user.favorites) return false;
      return user.favorites.some((f) => {
        const id = typeof f === 'string' ? f : f._id;
        return id === placeId;
      });
    },
    [user]
  );

  const favoritesCount = user?.favorites?.length || 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        loading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        toggleFavorite,
        isFavorite,
        favoritesCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
