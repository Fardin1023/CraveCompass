'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string, icon?: string) => void;
}

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Foodie',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Explorer',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Chef',
  'https://api.dicebear.com/7.x/bottts/svg?seed=BurgerKing',
  'https://api.dicebear.com/7.x/bottts/svg?seed=PizzaLover',
  'https://api.dicebear.com/7.x/bottts/svg?seed=BiryaniMaster',
  'https://api.dicebear.com/7.x/bottts/svg?seed=CoffeeAddict',
  'https://api.dicebear.com/7.x/bottts/svg?seed=SweetTooth',
];

const DIETARY_OPTIONS = [
  { id: 'halal', label: 'Halal 🥩', desc: 'Permissible under Islamic dietary guidelines' },
  { id: 'vegetarian', label: 'Vegetarian 🥦', desc: 'No meat, poultry, or fish' },
  { id: 'vegan', label: 'Vegan 🌱', desc: '100% plant-based' },
  { id: 'gluten-free', label: 'Gluten-Free 🌾', desc: 'No wheat, barley, or rye' },
  { id: 'dairy-free', label: 'Dairy-Free 🥛', desc: 'No milk or dairy products' },
];

const CUISINE_OPTIONS = [
  { id: 'biryani', label: 'Biryani 🍚' },
  { id: 'burger', label: 'Burgers 🍔' },
  { id: 'pizza', label: 'Pizza 🍕' },
  { id: 'kabab', label: 'Kabab 🍢' },
  { id: 'street_food', label: 'Street Food & Carts 🍢' },
  { id: 'bangladeshi', label: 'Bangladeshi 🍛' },
  { id: 'coffee', label: 'Coffee & Cafe ☕' },
  { id: 'chicken', label: 'Chicken 🍗' },
  { id: 'sushi', label: 'Sushi 🍣' },
  { id: 'thai', label: 'Thai 🍜' },
  { id: 'seafood', label: 'Seafood 🦞' },
  { id: 'dessert', label: 'Dessert 🍰' },
];

export default function UserProfileModal({
  isOpen,
  onClose,
  onToast,
}: UserProfileModalProps) {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'settings' | 'security'>('profile');

  // Profile Form State
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');

  // Preferences State
  const [dietary, setDietary] = useState<string[]>([]);
  const [favoriteCuisines, setFavoriteCuisines] = useState<string[]>([]);

  // Settings State
  const [mapDefaultStyle, setMapDefaultStyle] = useState<'dark' | 'standard'>('dark');
  const [locationSharing, setLocationSharing] = useState(true);

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // Sync state when user updates
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setAvatar(user.avatar || AVATAR_PRESETS[0]);
      setDietary(user.preferences?.dietary || []);
      setFavoriteCuisines(user.preferences?.favoriteCuisines || ['biryani', 'burger', 'pizza']);
      setMapDefaultStyle(user.settings?.mapDefaultStyle || 'dark');
      setLocationSharing(user.settings?.locationSharing ?? true);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  // Toggle dietary tag
  const toggleDietary = (id: string) => {
    setDietary((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  // Toggle cuisine tag
  const toggleCuisine = (id: string) => {
    setFavoriteCuisines((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  // Save General Profile or Preferences or Settings
  const handleSaveProfile = async () => {
    setSaving(true);
    const res = await updateProfile({
      name,
      bio,
      avatar,
      preferences: {
        dietary,
        favoriteCuisines,
      },
      settings: {
        mapDefaultStyle,
        locationSharing,
      },
    });
    setSaving(false);

    if (res.success) {
      onToast('Settings saved successfully!', '✅');
    } else {
      onToast(res.error || 'Failed to save settings', '⚠️');
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Please provide your current password');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      setPasswordError('New password must contain both letters and numbers');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setSaving(true);
    const res = await changePassword(currentPassword, newPassword);
    setSaving(false);

    if (res.success) {
      onToast('Password changed successfully!', '🔒');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordError(res.error || 'Failed to change password');
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div
        className="profile-modal-card"
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

        {/* User Card Top Banner */}
        <div className="profile-banner">
          <div className="profile-avatar-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar || user.avatar} alt={user.name} className="profile-avatar-img" />
          </div>
          <div className="profile-user-info">
            <h2 id="profile-modal-title" className="profile-name">
              {user.name}
            </h2>
            <p className="profile-email">{user.email}</p>
            <span className="profile-badge">
              ❤️ {user.favorites?.length || 0} Saved Places
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="profile-tabs">
          <button
            type="button"
            className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 Profile
          </button>
          <button
            type="button"
            className={`profile-tab ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            🍽️ Food Preferences
          </button>
          <button
            type="button"
            className={`profile-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ App & Map
          </button>
          <button
            type="button"
            className={`profile-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            🔒 Security
          </button>
        </div>

        {/* Tab Content */}
        <div className="profile-tab-content">
          {/* TAB 1: Profile Details */}
          {activeTab === 'profile' && (
            <div className="tab-pane">
              <div className="profile-field">
                <label className="profile-label">Choose Avatar</label>
                <div className="avatar-grid">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`avatar-option ${avatar === preset ? 'selected' : ''}`}
                      onClick={() => setAvatar(preset)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preset} alt={`Avatar option ${idx + 1}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="profile-field">
                <label htmlFor="user-name-input" className="profile-label">
                  Display Name
                </label>
                <input
                  id="user-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="profile-input"
                  placeholder="Your Name"
                />
              </div>

              <div className="profile-field">
                <label htmlFor="user-bio-input" className="profile-label">
                  Bio / Food Philosophy
                </label>
                <textarea
                  id="user-bio-input"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="profile-textarea"
                  placeholder="Tell us what you love to eat, favorite local spots, or foodie moods..."
                  rows={3}
                  maxLength={250}
                />
                <span className="field-hint">{250 - bio.length} characters remaining</span>
              </div>

              <button
                type="button"
                className="profile-save-btn"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? 'Saving Changes…' : 'Save Profile Changes'}
              </button>
            </div>
          )}

          {/* TAB 2: Food & Cuisine Preferences */}
          {activeTab === 'preferences' && (
            <div className="tab-pane">
              <div className="profile-field">
                <label className="profile-label">Dietary Preferences</label>
                <p className="profile-hint">
                  Helps CraveCompass highlight dishes and restaurants suited for your lifestyle.
                </p>
                <div className="dietary-list">
                  {DIETARY_OPTIONS.map((item) => {
                    const isChecked = dietary.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`dietary-item ${isChecked ? 'active' : ''}`}
                        onClick={() => toggleDietary(item.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="dietary-checkbox"
                        />
                        <div>
                          <div className="dietary-title">{item.label}</div>
                          <div className="dietary-desc">{item.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="profile-field" style={{ marginTop: '20px' }}>
                <label className="profile-label">Favorite Cuisines</label>
                <p className="profile-hint">
                  Select your go-to cravings for quick discovery.
                </p>
                <div className="cuisines-chip-grid">
                  {CUISINE_OPTIONS.map((c) => {
                    const isFav = favoriteCuisines.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`pref-cuisine-chip ${isFav ? 'active' : ''}`}
                        onClick={() => toggleCuisine(c.id)}
                      >
                        {c.label} {isFav ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                className="profile-save-btn"
                onClick={handleSaveProfile}
                disabled={saving}
                style={{ marginTop: '16px' }}
              >
                {saving ? 'Saving Changes…' : 'Save Food Preferences'}
              </button>
            </div>
          )}

          {/* TAB 3: App & Map Settings */}
          {activeTab === 'settings' && (
            <div className="tab-pane">
              <div className="profile-field">
                <label className="profile-label">Default OpenStreetMap Style</label>
                <p className="profile-hint">Choose your preferred map appearance on startup.</p>
                <div className="map-style-selector">
                  <div
                    className={`style-option ${mapDefaultStyle === 'dark' ? 'selected' : ''}`}
                    onClick={() => setMapDefaultStyle('dark')}
                  >
                    <span style={{ fontSize: '24px' }}>🌙</span>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--cream)' }}>OSM Dark Mode</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Deep forest earth-tone theme
                      </div>
                    </div>
                  </div>
                  <div
                    className={`style-option ${mapDefaultStyle === 'standard' ? 'selected' : ''}`}
                    onClick={() => setMapDefaultStyle('standard')}
                  >
                    <span style={{ fontSize: '24px' }}>🗺️</span>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--cream)' }}>OSM Standard</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Classic OpenStreetMap colors
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="profile-field" style={{ marginTop: '20px' }}>
                <label className="profile-label">Location Privacy</label>
                <div
                  className="setting-toggle-row"
                  onClick={() => setLocationSharing(!locationSharing)}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--cream)' }}>
                      Automatic Local Discovery
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Request device GPS to find nearest food carts and eateries
                    </div>
                  </div>
                  <div className={`switch-toggle ${locationSharing ? 'on' : 'off'}`}>
                    <div className="switch-handle" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="profile-save-btn"
                onClick={handleSaveProfile}
                disabled={saving}
                style={{ marginTop: '16px' }}
              >
                {saving ? 'Saving Changes…' : 'Save App Settings'}
              </button>
            </div>
          )}

          {/* TAB 4: Security & Password */}
          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="tab-pane">
              {passwordError && (
                <div className="auth-error-alert" style={{ marginBottom: '14px' }}>
                  <span>⚠️</span>
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="profile-field">
                <label htmlFor="curr-pass-input" className="profile-label">
                  Current Password
                </label>
                <input
                  id="curr-pass-input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="profile-input"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="profile-field">
                <label htmlFor="new-pass-input" className="profile-label">
                  New Password
                </label>
                <input
                  id="new-pass-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="profile-input"
                  placeholder="At least 8 characters (letters & numbers)"
                  required
                />
                <span className="field-hint">
                  Minimum 8 characters with at least one letter and one number.
                </span>
              </div>

              <div className="profile-field">
                <label htmlFor="confirm-pass-input" className="profile-label">
                  Confirm New Password
                </label>
                <input
                  id="confirm-pass-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="profile-input"
                  placeholder="Re-type new password"
                  required
                />
              </div>

              <button
                type="submit"
                className="profile-save-btn"
                disabled={saving}
                style={{ marginTop: '10px' }}
              >
                {saving ? 'Updating Password…' : 'Update Password Securely 🔒'}
              </button>

              <div className="logout-section">
                <button
                  type="button"
                  className="danger-signout-btn"
                  onClick={() => {
                    logout();
                    onClose();
                    onToast('You have been signed out.', '👋');
                  }}
                >
                  🚪 Sign Out of CraveCompass
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
