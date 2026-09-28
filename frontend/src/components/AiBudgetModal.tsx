'use client';

import { useState, useEffect, useRef } from 'react';
import type { AiBudgetRecommendation, AiBudgetResponse, Place } from '@/types';
import { getAiBudgetSuggestions } from '@/lib/api';

interface AiBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCoords: { lat: number; lng: number } | null;
  locationName: string;
  onSelectPlace: (place: Place) => void;
  onApplyRecommendations: (places: Place[], budgetText: string) => void;
  initialBudget?: number | null;
}

const PRESET_BUDGETS = [
  { amount: 150, label: '৳150', tag: 'Street Food & Cha', icon: '🍢' },
  { amount: 250, label: '৳250', tag: 'Food Court Meal', icon: '🍱' },
  { amount: 400, label: '৳400', tag: 'Casual Burgers & Combos', icon: '🍔' },
  { amount: 600, label: '৳600', tag: 'Biryani Feast & Cafes', icon: '🍚' },
  { amount: 1200, label: '৳1200+', tag: 'Buffet & Upscale', icon: '🥩' },
];

const CRAVING_TAGS = [
  '🍱 Food Courts',
  '🍚 Biryani & Kacchi',
  '🍔 Burgers & Fries',
  '🍢 Street Food / Chaap',
  '☕ Coffee & Desserts',
  '🍕 Cheesy Pizza',
  '🍛 Bangladeshi Desi',
];

export default function AiBudgetModal({
  isOpen,
  onClose,
  activeCoords,
  locationName,
  onSelectPlace,
  onApplyRecommendations,
  initialBudget,
}: AiBudgetModalProps) {
  const [budget, setBudget] = useState<number | string>(initialBudget || 300);
  const [partySize, setPartySize] = useState<number>(1);
  const [craving, setCraving] = useState<string>('');
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiBudgetResponse | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState<number>(0);

  const cardRef = useRef<HTMLDivElement>(null);

  const LOADING_MESSAGES = [
    `Analyzing food courts & restaurants in ${locationName || 'Dhaka'}...`,
    `Calculating meal combinations under ৳${budget} per person...`,
    'Gemini AI is finding the highest value dishes & combos...',
    'Matching authentic ratings and nearby walking distances...',
  ];

  // Update budget when initialBudget prop changes
  useEffect(() => {
    if (initialBudget && initialBudget > 0) {
      setBudget(initialBudget);
    }
  }, [initialBudget]);

  // Load saved API key from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cravecompass_gemini_key');
      if (saved) setUserApiKey(saved);
    } catch (_) {}
  }, []);

  // Cycle loading messages
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleSaveApiKey = (key: string) => {
    setUserApiKey(key);
    try {
      if (key.trim()) {
        localStorage.setItem('cravecompass_gemini_key', key.trim());
      } else {
        localStorage.removeItem('cravecompass_gemini_key');
      }
    } catch (_) {}
  };

  const handleAskGemini = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const numBudget = parseFloat(String(budget));
    if (isNaN(numBudget) || numBudget < 40) {
      setError('Please enter a valid budget amount (minimum ৳40)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await getAiBudgetSuggestions({
        budget: numBudget,
        partySize,
        craving: craving.trim(),
        lat: activeCoords?.lat,
        lng: activeCoords?.lng,
        apiKey: userApiKey.trim() || undefined,
      });

      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to consult Gemini AI. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAll = () => {
    if (!result || !result.recommendations) return;
    const placesToApply: Place[] = [];

    result.recommendations.forEach((rec) => {
      if (rec.fullPlace) {
        placesToApply.push(rec.fullPlace);
      } else {
        // Construct place object from recommendation
        placesToApply.push({
          _id: rec.placeId || `ai_place_${Math.random()}`,
          name: rec.name,
          cuisine: [rec.cuisine],
          priceLevel: rec.priceLevel || 1,
          rating: rec.rating || 4.5,
          location: {
            type: 'Point',
            coordinates: activeCoords ? [activeCoords.lng, activeCoords.lat] : [90.3742, 23.7461],
          },
          address: { formatted: rec.address || locationName || 'Dhaka' },
          categories: ['restaurant', 'food_court'],
          photos: rec.primaryPhoto ? [{ url: rec.primaryPhoto }] : [],
          primaryPhoto: rec.primaryPhoto,
          reviews: [],
          tags: [rec.budgetTag, 'ai_suggested', 'budget_friendly'],
          popularityScore: 100,
          isFeatured: true,
          source: 'seed',
        });
      }
    });

    onApplyRecommendations(placesToApply, `AI Suggestions (৳${result.perPersonBudget}/person)`);
    onClose();
  };

  const handleSelectRecommendation = (rec: AiBudgetRecommendation) => {
    if (rec.fullPlace) {
      onSelectPlace(rec.fullPlace);
      onClose();
    } else {
      const synthesizedPlace: Place = {
        _id: rec.placeId || `ai_place_${Date.now()}`,
        name: rec.name,
        cuisine: [rec.cuisine],
        priceLevel: rec.priceLevel || 1,
        rating: rec.rating || 4.5,
        location: {
          type: 'Point',
          coordinates: activeCoords ? [activeCoords.lng, activeCoords.lat] : [90.3742, 23.7461],
        },
        address: { formatted: rec.address || locationName || 'Dhaka' },
        categories: ['restaurant', 'food_court'],
        photos: rec.primaryPhoto ? [{ url: rec.primaryPhoto }] : [],
        primaryPhoto: rec.primaryPhoto,
        reviews: [
          { author: 'Gemini AI Recommendation', rating: 5, text: `${rec.reason} • Suggested Order: ${rec.suggestedOrder}` },
        ],
        tags: [rec.budgetTag, 'ai_suggested'],
        popularityScore: 120,
        isFeatured: true,
        source: 'seed',
      };
      onSelectPlace(synthesizedPlace);
      onClose();
    }
  };

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
      aria-labelledby="ai-modal-title"
    >
      <div className="ai-budget-modal-card" ref={cardRef}>
        {/* Close Button */}
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close AI budget modal"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="ai-modal-header">
          <div className="ai-badge-header">
            <span className="ai-sparkle-icon">✨</span>
            <span>Gemini AI Budget Advisor</span>
            <span className="ai-free-tier-pill">Free Tier</span>
          </div>
          <h2 id="ai-modal-title" className="ai-modal-title">
            Find What to Eat Within Your Budget
          </h2>
          <p className="ai-modal-subtitle">
            Enter how much you want to spend in Bangladeshi Taka (৳). Gemini AI calculates the best food courts,
            street stalls & restaurants with exact meal combos tailored to your wallet.
          </p>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleAskGemini} className="ai-modal-form">
          {/* Preset Buttons */}
          <div className="ai-form-group">
            <label className="ai-input-label">Quick Budget Presets</label>
            <div className="ai-presets-grid">
              {PRESET_BUDGETS.map((p) => {
                const isSelected = Number(budget) === p.amount;
                return (
                  <button
                    key={p.amount}
                    type="button"
                    className={`ai-preset-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => setBudget(p.amount)}
                  >
                    <span className="ai-preset-icon">{p.icon}</span>
                    <span className="ai-preset-amount">{p.label}</span>
                    <span className="ai-preset-tag">{p.tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Budget & Party Size */}
          <div className="ai-inputs-row">
            <div className="ai-form-group" style={{ flex: 1.3 }}>
              <label htmlFor="ai-budget-input" className="ai-input-label">
                Your Exact Budget (in ৳ BDT)
              </label>
              <div className="ai-currency-input-wrapper">
                <span className="ai-currency-prefix">৳</span>
                <input
                  id="ai-budget-input"
                  type="number"
                  min="40"
                  max="25000"
                  step="10"
                  className="ai-currency-input"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 300"
                  required
                />
                <span className="ai-currency-suffix">Taka</span>
              </div>
            </div>

            <div className="ai-form-group" style={{ flex: 1 }}>
              <label className="ai-input-label">Number of People</label>
              <div className="ai-party-selector">
                {[1, 2, 4].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`ai-party-btn ${partySize === size ? 'active' : ''}`}
                    onClick={() => setPartySize(size)}
                  >
                    {size === 1 ? '👤 1 Person' : size === 2 ? '👥 2 People' : '👨‍👩‍👧 4+ Group'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Craving / Preference */}
          <div className="ai-form-group">
            <label htmlFor="ai-craving-input" className="ai-input-label">
              Craving or Specific Cuisine (Optional)
            </label>
            <input
              id="ai-craving-input"
              type="text"
              className="ai-text-input"
              value={craving}
              onChange={(e) => setCraving(e.target.value)}
              placeholder='e.g. "Food court combo", "Kacchi biryani", "Cheesy burger", or "Khichuri"'
            />
            {/* Quick tags */}
            <div className="ai-tags-row">
              {CRAVING_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="ai-craving-pill"
                  onClick={() => setCraving(tag.replace(/^[^\s]+\s*/, ''))}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* API Key Toggle Section */}
          <div className="ai-api-key-toggle-container">
            <button
              type="button"
              className="ai-toggle-key-btn"
              onClick={() => setShowKeyInput(!showKeyInput)}
            >
              <span className="key-icon">🔑</span>
              <span>
                {userApiKey
                  ? 'Custom Gemini Key Set (Click to edit)'
                  : 'Use Free Google AI Studio API Key (Optional)'}
              </span>
              <span className="toggle-chevron">{showKeyInput ? '▲' : '▼'}</span>
            </button>

            {showKeyInput && (
              <div className="ai-api-key-box">
                <p className="ai-api-key-help">
                  By default, CraveCompass uses its free tier & local food reasoning engine. You can also paste your personal 100% free Gemini API key from Google AI Studio:
                </p>
                <div className="ai-api-key-input-row">
                  <input
                    type="password"
                    className="ai-key-input"
                    value={userApiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    placeholder="AIzaSy... (Paste Gemini API Key)"
                  />
                  {userApiKey && (
                    <button
                      type="button"
                      className="ai-clear-key-btn"
                      onClick={() => handleSaveApiKey('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ai-get-key-link"
                >
                  ↗ Get a free Gemini API key in 30 seconds at Google AI Studio
                </a>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="ai-error-box" role="alert">
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            className={`ai-submit-btn ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <div className="ai-loading-indicator">
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="30 60" />
                </svg>
                <span>{LOADING_MESSAGES[loadingMsgIdx]}</span>
              </div>
            ) : (
              <div className="ai-btn-content">
                <span className="sparkle-stars">✨</span>
                <span>Ask Gemini AI for Best Places within ৳{budget}</span>
                <span className="arrow-right">→</span>
              </div>
            )}
          </button>
        </form>

        {/* Results Presentation */}
        {result && (
          <div className="ai-results-container">
            {/* Overview Banner */}
            <div className="ai-overview-card">
              <div className="ai-overview-badge">
                <span>✨</span>
                <strong>
                  {result.source === 'gemini' ? 'Gemini AI Recommendation' : 'CraveCompass Smart Advisor'}
                </strong>
                <span className="ai-source-pill">
                  {result.source === 'gemini' ? 'Gemini 1.5 Flash' : 'Dhaka Smart Engine'}
                </span>
              </div>
              <p className="ai-analysis-text">{result.budgetAnalysis}</p>
              <div className="ai-budget-stat-pills">
                <span className="stat-pill">
                  💵 Total: <strong>৳{result.totalBudget}</strong>
                </span>
                <span className="stat-pill">
                  👤 Per Person: <strong>৳{result.perPersonBudget}</strong> ({result.partySize}{' '}
                  {result.partySize > 1 ? 'people' : 'person'})
                </span>
                <span className="stat-pill highlight">
                  🎯 Found {result.recommendations?.length || 0} Matches
                </span>
              </div>
            </div>

            {/* Recommendations List */}
            <div className="ai-recommendations-list">
              {result.recommendations.map((rec, idx) => (
                <div key={idx} className="ai-rec-card">
                  <div className="ai-rec-card-header">
                    <div className="ai-rec-info">
                      <span className="ai-rec-tag">{rec.budgetTag}</span>
                      <h3 className="ai-rec-name">{rec.name}</h3>
                      <div className="ai-rec-meta">
                        <span className="ai-rec-cuisine">{rec.cuisine}</span>
                        <span className="ai-rec-rating">⭐ {rec.rating}</span>
                        <span className="ai-rec-address">📍 {rec.address}</span>
                      </div>
                    </div>
                    <div className="ai-rec-cost-badge">
                      <span className="cost-label">Est. Cost</span>
                      <span className="cost-value">{rec.estimatedCost}</span>
                    </div>
                  </div>

                  {/* Suggested Order */}
                  <div className="ai-suggested-order-box">
                    <div className="suggested-order-label">
                      <span>🍽️</span>
                      <strong>Suggested Order:</strong>
                    </div>
                    <div className="suggested-order-text">{rec.suggestedOrder}</div>
                  </div>

                  {/* AI Match Reason */}
                  <p className="ai-rec-reason">
                    <strong>Why it matches:</strong> {rec.reason}
                  </p>

                  {/* Action Button */}
                  <div className="ai-rec-actions">
                    <button
                      type="button"
                      className="ai-view-place-btn"
                      onClick={() => handleSelectRecommendation(rec)}
                    >
                      <span>🗺️ View Details & Locate</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Budget Tips */}
            {result.budgetTips && result.budgetTips.length > 0 && (
              <div className="ai-budget-tips-box">
                <h4 className="tips-title">💡 Dhaka Budget Hacks & Tips</h4>
                <ul className="tips-list">
                  {result.budgetTips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Apply All Action */}
            <div className="ai-results-footer">
              <button
                type="button"
                className="ai-apply-all-btn"
                onClick={handleApplyAll}
              >
                <span>✨ Apply These {result.recommendations.length} Places to Map & List</span>
              </button>
              <button
                type="button"
                className="ai-reset-btn"
                onClick={() => setResult(null)}
              >
                Try Another Budget
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
