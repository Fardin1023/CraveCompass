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
  { amount: 150, label: '৳150', tag: 'Street & Cha', icon: '🍢', tier: 'Pocket Friendly' },
  { amount: 250, label: '৳250', tag: 'Food Courts', icon: '🍱', tier: 'High Value' },
  { amount: 400, label: '৳400', tag: 'Combos & Burgers', icon: '🍔', tier: 'Satisfying' },
  { amount: 600, label: '৳600', tag: 'Kacchi & Cafes', icon: '🍚', tier: 'Full Feast' },
  { amount: 1200, label: '৳1200+', tag: 'Gourmet & Buffet', icon: '🥩', tier: 'Luxury' },
];

const CRAVING_TAGS = [
  { label: '🍱 Food Courts', value: 'Food Courts' },
  { label: '🍚 Kacchi Biryani', value: 'Biryani' },
  { label: '🍔 Burgers & Combos', value: 'Burgers' },
  { label: '🍢 Street Food & Chaap', value: 'Street Food' },
  { label: '☕ Coffee & Desserts', value: 'Coffee' },
  { label: '🍕 Cheesy Pizza', value: 'Pizza' },
  { label: '🍛 Desi Bangla Khichuri', value: 'Bangladeshi' },
];

function getBudgetTierInfo(amount: number) {
  if (amount < 200) return { label: 'Pocket Friendly · Street Food & Cha', color: '#34d399', icon: '🍢' };
  if (amount < 450) return { label: 'Sweet Spot · Food Courts & Meal Sets', color: '#fbbf24', icon: '🍱' };
  if (amount < 900) return { label: 'Popular Choice · Kacchi Feasts & Cafes', color: '#fb923c', icon: '🍔' };
  return { label: 'Gourmet Selection · Steaks, Buffets & Premium Dining', color: '#c084fc', icon: '👑' };
}

export default function AiBudgetModal({
  isOpen,
  onClose,
  activeCoords,
  locationName,
  onSelectPlace,
  onApplyRecommendations,
  initialBudget,
}: AiBudgetModalProps) {
  const [budget, setBudget] = useState<number>(initialBudget && initialBudget > 0 ? initialBudget : 350);
  const [partySize, setPartySize] = useState<number>(1);
  const [craving, setCraving] = useState<string>('');
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiBudgetResponse | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState<number>(0);

  const cardRef = useRef<HTMLDivElement>(null);

  const perPerson = Math.max(Math.round(budget / Math.max(partySize, 1)), 1);
  const tierInfo = getBudgetTierInfo(perPerson);

  const LOADING_MESSAGES = [
    `CraveAI is scanning top food courts & restaurants in ${locationName || 'Dhaka'}...`,
    `Computing meal combinations under ৳${perPerson} per person...`,
    'CraveAI is selecting the highest-rated dishes and platters...',
    'Matching authentic portion sizes and walking distances...',
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
  }, [loading, LOADING_MESSAGES.length]);

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

  const handleStepBudget = (delta: number) => {
    setBudget((prev) => Math.min(Math.max(prev + delta, 50), 20000));
  };

  const handleAskCraveAi = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (budget < 40) {
      setError('Please enter a budget of at least ৳40');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await getAiBudgetSuggestions({
        budget,
        partySize,
        craving: craving.trim(),
        lat: activeCoords?.lat,
        lng: activeCoords?.lng,
        apiKey: userApiKey.trim() || undefined,
      });

      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to consult CraveAI. Please try again.');
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
        placesToApply.push({
          _id: rec.placeId || `crave_ai_${Math.random()}`,
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
          tags: [rec.budgetTag, 'crave_ai', 'budget_friendly'],
          popularityScore: 100,
          isFeatured: true,
          source: 'seed',
        });
      }
    });

    onApplyRecommendations(placesToApply, `CraveAI Picks (৳${result.perPersonBudget}/person)`);
    onClose();
  };

  const handleSelectRecommendation = (rec: AiBudgetRecommendation) => {
    if (rec.fullPlace) {
      onSelectPlace(rec.fullPlace);
      onClose();
    } else {
      const synthesizedPlace: Place = {
        _id: rec.placeId || `crave_ai_${Date.now()}`,
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
          { author: 'CraveAI Recommendation', rating: 5, text: `${rec.reason} • Order: ${rec.suggestedOrder}` },
        ],
        tags: [rec.budgetTag, 'crave_ai'],
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
      aria-labelledby="crave-ai-title"
    >
      <div className="crave-ai-modal-card" ref={cardRef}>
        {/* Glowing ambient background orbs */}
        <div className="crave-ambient-glow orb-1" aria-hidden="true" />
        <div className="crave-ambient-glow orb-2" aria-hidden="true" />

        {/* Close Button */}
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close CraveAI"
        >
          ✕
        </button>

        {/* Header with Futuristic Hologram Badge */}
        <div className="crave-ai-header">
          <div className="crave-ai-badge">
            <span className="crave-ai-pulse-dot" />
            <span className="crave-ai-sparkle">✨</span>
            <span className="crave-ai-brand">CraveAI™</span>
            <span className="crave-ai-tagline">Smart Taste & Budget Engine</span>
          </div>

          <h2 id="crave-ai-title" className="crave-ai-title">
            Taste Big, Spend Smart
          </h2>
          <p className="crave-ai-subtitle">
            Enter what you want to spend in Bangladeshi Taka (৳). CraveAI calculates the top food courts,
            street stalls, and eateries in Dhaka with exact meal combos tailored to your wallet.
          </p>
        </div>

        {/* Main Form */}
        <form onSubmit={handleAskCraveAi} className="crave-ai-form">
          {/* Quick Preset Buttons */}
          <div className="crave-form-section">
            <div className="crave-section-header">
              <span className="crave-section-title">⚡ Quick Budget Presets</span>
              <span className="crave-section-hint">Select a tier or type below</span>
            </div>
            <div className="crave-presets-grid">
              {PRESET_BUDGETS.map((p) => {
                const isSelected = budget === p.amount;
                return (
                  <button
                    key={p.amount}
                    type="button"
                    className={`crave-preset-card ${isSelected ? 'active' : ''}`}
                    onClick={() => setBudget(p.amount)}
                  >
                    <span className="crave-preset-icon">{p.icon}</span>
                    <span className="crave-preset-amount">{p.label}</span>
                    <span className="crave-preset-tag">{p.tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Hero Budget Cockpit Input */}
          <div className="crave-budget-hero-box">
            <div className="crave-budget-hero-top">
              <span className="crave-budget-hero-label">YOUR TOTAL BUDGET (৳ BDT)</span>
              <span className="crave-per-person-pill" style={{ color: tierInfo.color }}>
                {tierInfo.icon} {partySize > 1 ? `৳${perPerson} / person` : 'Solo Meal'}
              </span>
            </div>

            <div className="crave-budget-input-cockpit">
              <button
                type="button"
                className="crave-step-btn"
                onClick={() => handleStepBudget(-50)}
                title="Decrease ৳50"
                aria-label="Decrease budget by 50 Taka"
              >
                −50
              </button>

              <div className="crave-budget-input-display">
                <span className="crave-taka-sign">৳</span>
                <input
                  id="crave-ai-budget-input"
                  type="number"
                  min="40"
                  max="25000"
                  step="10"
                  className="crave-budget-number-input"
                  value={budget}
                  onChange={(e) => setBudget(Math.max(Number(e.target.value) || 0, 0))}
                  placeholder="350"
                  required
                />
                <span className="crave-taka-unit">BDT</span>
              </div>

              <button
                type="button"
                className="crave-step-btn"
                onClick={() => handleStepBudget(50)}
                title="Increase ৳50"
                aria-label="Increase budget by 50 Taka"
              >
                +50
              </button>
            </div>

            {/* Live Tier Insight Bar */}
            <div className="crave-tier-indicator-row">
              <span className="crave-tier-dot" style={{ background: tierInfo.color }} />
              <span className="crave-tier-text" style={{ color: tierInfo.color }}>
                {tierInfo.label}
              </span>
            </div>
          </div>

          {/* Party Size Selector */}
          <div className="crave-form-section">
            <label className="crave-section-title">👥 Group Size</label>
            <div className="crave-party-row">
              {[
                { size: 1, label: 'Solo Foodie', icon: '👤', sub: '1 person' },
                { size: 2, label: 'Duo Meal', icon: '👥', sub: '2 people' },
                { size: 4, label: 'Squad / Family', icon: '🎉', sub: '4+ group' },
              ].map((item) => (
                <button
                  key={item.size}
                  type="button"
                  className={`crave-party-card ${partySize === item.size ? 'active' : ''}`}
                  onClick={() => setPartySize(item.size)}
                >
                  <span className="crave-party-icon">{item.icon}</span>
                  <div className="crave-party-info">
                    <span className="crave-party-name">{item.label}</span>
                    <span className="crave-party-sub">{item.sub}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Craving / Cuisine Chips */}
          <div className="crave-form-section">
            <label htmlFor="crave-craving-input" className="crave-section-title">
              🍜 Desired Craving or Vibe (Optional)
            </label>
            <div className="crave-craving-input-wrapper">
              <span className="crave-search-lens">🔍</span>
              <input
                id="crave-craving-input"
                type="text"
                className="crave-craving-text-input"
                value={craving}
                onChange={(e) => setCraving(e.target.value)}
                placeholder='e.g. "Kacchi biryani", "Food court combo", "Cheesy burger"'
              />
              {craving && (
                <button
                  type="button"
                  className="crave-craving-clear-btn"
                  onClick={() => setCraving('')}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="crave-craving-tags-list">
              {CRAVING_TAGS.map((t) => {
                const isActive = craving.toLowerCase().includes(t.value.toLowerCase());
                return (
                  <button
                    key={t.value}
                    type="button"
                    className={`crave-craving-pill ${isActive ? 'active' : ''}`}
                    onClick={() => setCraving(isActive ? '' : t.value)}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Key Section */}
          <div className="crave-advanced-section">
            <button
              type="button"
              className="crave-advanced-toggle"
              onClick={() => setShowKeyInput(!showKeyInput)}
            >
              <span>🔑 Have your own AI Key? (Optional)</span>
              <span className="chevron">{showKeyInput ? '▴' : '▾'}</span>
            </button>

            {showKeyInput && (
              <div className="crave-key-drawer">
                <p className="crave-key-help">
                  CraveAI works automatically with our backend engine. If you want to use your personal quota,
                  paste your key below:
                </p>
                <div className="crave-key-row">
                  <input
                    type="password"
                    className="crave-key-input"
                    value={userApiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    placeholder="AQ.Ab... or AIzaSy..."
                  />
                  {userApiKey && (
                    <button
                      type="button"
                      className="crave-key-clear"
                      onClick={() => handleSaveApiKey('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="crave-error-alert" role="alert">
              <span className="error-icon">⚠️</span>
              <div className="error-text">{error}</div>
            </div>
          )}

          {/* Hero Submit Button */}
          <button
            type="submit"
            id="crave-ai-submit-cta"
            className={`crave-submit-cta ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <div className="crave-loading-row">
                <span className="crave-spinner" />
                <span>{LOADING_MESSAGES[loadingMsgIdx]}</span>
              </div>
            ) : (
              <div className="crave-cta-content">
                <span className="cta-sparkle">⚡</span>
                <span className="cta-text">
                  Discover with CraveAI · <strong>৳{budget}</strong>
                </span>
                <span className="cta-arrow">→</span>
              </div>
            )}
          </button>
        </form>

        {/* Results Container */}
        {result && (
          <div className="crave-results-container">
            {/* Overview Card */}
            <div className="crave-results-overview">
              <div className="crave-results-badge-row">
                <div className="crave-intel-badge">
                  <span className="pulse-sparkle">✨</span>
                  <span>CraveAI Intelligence</span>
                </div>
                <div className="crave-budget-capsule">
                  ৳{result.totalBudget} BDT Total
                </div>
              </div>

              <p className="crave-analysis-text">{result.budgetAnalysis}</p>

              <div className="crave-stat-chips">
                <span className="crave-stat-chip">
                  👤 <strong>৳{result.perPersonBudget}</strong> / person
                </span>
                <span className="crave-stat-chip">
                  👥 <strong>{result.partySize}</strong> {result.partySize > 1 ? 'people' : 'person'}
                </span>
                <span className="crave-stat-chip highlight">
                  🎯 <strong>{result.recommendations?.length || 0}</strong> Curated Picks
                </span>
              </div>
            </div>

            {/* Recommendations Grid */}
            <div className="crave-recs-grid">
              {result.recommendations.map((rec, idx) => (
                <div key={idx} className="crave-rec-card">
                  <div className="crave-rec-card-top">
                    <div className="crave-rec-meta">
                      <span className="crave-rec-budget-tag">{rec.budgetTag}</span>
                      <h3 className="crave-rec-name">{rec.name}</h3>
                      <div className="crave-rec-sub">
                        <span>{rec.cuisine}</span>
                        <span>·</span>
                        <span>⭐ {rec.rating}</span>
                        <span>·</span>
                        <span>📍 {rec.address}</span>
                      </div>
                    </div>

                    <div className="crave-rec-cost-badge">
                      <span className="cost-label">Est. Cost</span>
                      <span className="cost-val">{rec.estimatedCost}</span>
                    </div>
                  </div>

                  {/* Suggested Combo Box */}
                  <div className="crave-combo-box">
                    <div className="crave-combo-header">
                      <span>🍽️ Suggested Meal Combo:</span>
                    </div>
                    <div className="crave-combo-name">{rec.suggestedOrder}</div>
                  </div>

                  <p className="crave-rec-rationale">
                    <strong>Why CraveAI picked this:</strong> {rec.reason}
                  </p>

                  <div className="crave-rec-btn-row">
                    <button
                      type="button"
                      className="crave-rec-locate-btn"
                      onClick={() => handleSelectRecommendation(rec)}
                    >
                      <span>📍 View Place on Map</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Budget Hacks */}
            {result.budgetTips && result.budgetTips.length > 0 && (
              <div className="crave-hacks-card">
                <div className="crave-hacks-title">
                  <span>💡</span>
                  <span>Dhaka Budget & Food Court Hacks</span>
                </div>
                <ul className="crave-hacks-list">
                  {result.budgetTips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="crave-results-footer">
              <button
                type="button"
                className="crave-apply-all-cta"
                onClick={handleApplyAll}
              >
                <span>✨ Apply These {result.recommendations.length} Places to Map & List</span>
              </button>

              <button
                type="button"
                className="crave-retry-btn"
                onClick={() => setResult(null)}
              >
                Try Another Budget or Craving
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
