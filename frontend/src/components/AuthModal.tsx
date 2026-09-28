'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccess,
}: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (res.success) {
          onSuccess?.();
          onClose();
        } else {
          setError(res.error || 'Invalid credentials');
        }
      } else {
        if (!name.trim()) {
          setError('Please enter your name');
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters long');
          setLoading(false);
          return;
        }
        if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
          setError('Password must contain at least one letter and one number');
          setLoading(false);
          return;
        }
        const res = await register(name, email, password);
        if (res.success) {
          onSuccess?.();
          onClose();
        } else {
          setError(res.error || 'Registration failed');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        {/* Header with App Logo */}
        <div className="auth-header">
          <div className="auth-logo-icon">
            <span style={{ fontSize: '28px' }}>🧭</span>
          </div>
          <h2 id="auth-modal-title" className="auth-title">
            {mode === 'login' ? 'Welcome Back!' : 'Create an Account'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Sign in to access your saved spots, custom food preferences, and reviews.'
              : 'Join CraveCompass to discover and bookmark the best food near you.'}
          </p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-error-alert" role="alert">
            <span style={{ fontSize: '15px' }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="auth-name" className="auth-label">
                Full Name
              </label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">👤</span>
                <input
                  id="auth-name"
                  type="text"
                  required
                  placeholder="e.g. Fardin Kamran"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input"
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email" className="auth-label">
              Email Address
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">✉️</span>
              <input
                id="auth-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password" className="auth-label">
              Password
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">🔒</span>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={mode === 'register' ? 'At least 8 characters (letters & numbers)' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {mode === 'register' && (
              <span className="auth-hint">
                Must be at least 8 characters with at least one letter and one number.
              </span>
            )}
          </div>

          <button
            type="submit"
            className={`auth-submit-btn ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <span className="submit-spinner" />
            ) : mode === 'login' ? (
              'Sign In →'
            ) : (
              'Create Account →'
            )}
          </button>
        </form>

        {/* Security Footer Note */}
        <div className="auth-security-note">
          <span style={{ fontSize: '13px' }}>🛡️</span>
          <span>Encrypted with bcrypt & secure stateless JWT authentication.</span>
        </div>
      </div>
    </div>
  );
}
