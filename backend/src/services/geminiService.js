/**
 * CraveCompass — Gemini Free API AI Service
 * Powered by Google Gemini 1.5 Flash (Free Tier)
 * Provides budget-aware food court and restaurant recommendations in Dhaka
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * Format a list of candidate places for prompt grounding
 */
function formatPlacesForPrompt(places = []) {
  return places.slice(0, 15).map((p, idx) => {
    const cuisine = Array.isArray(p.cuisine) ? p.cuisine.join(', ') : p.cuisine || 'Various';
    const area = p.address?.city || p.address?.formatted || 'Dhaka';
    const priceStr = p.priceLevel === 1 ? 'Under ৳250 (Budget/Food Court)' :
                     p.priceLevel === 2 ? '৳250-৳600 (Mid-Range)' :
                     p.priceLevel === 3 ? '৳600-৳1500 (Upscale)' : '৳1500+ (Luxury)';
    return `${idx + 1}. [ID: ${p._id || p.googlePlaceId}] "${p.name}" (${cuisine}) | Area: ${area} | Tier: ${priceStr} | Rating: ⭐${p.rating || 4.2}`;
  }).join('\n');
}

/**
 * Intelligent local fallback advisor when Gemini API key is not configured or network fails
 */
function generateLocalBudgetRecommendations({ budget, partySize = 1, craving = '', places = [], area = 'Dhaka' }) {
  const numericBudget = Math.max(parseFloat(budget) || 250, 50);
  const perPersonBudget = Math.round(numericBudget / Math.max(partySize, 1));

  // Determine target price levels
  const targetLevels = perPersonBudget < 250 ? [1] :
                       perPersonBudget <= 600 ? [1, 2] :
                       perPersonBudget <= 1500 ? [2, 3] : [3, 4];

  // Filter candidates
  let matchingPlaces = places.filter((p) => targetLevels.includes(p.priceLevel || 1));
  if (craving && craving.trim()) {
    const cr = craving.toLowerCase().trim();
    const cravingMatches = matchingPlaces.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const cuisines = (Array.isArray(p.cuisine) ? p.cuisine : [p.cuisine]).join(' ').toLowerCase();
      const tags = (Array.isArray(p.tags) ? p.tags : []).join(' ').toLowerCase();
      return name.includes(cr) || cuisines.includes(cr) || tags.includes(cr);
    });
    if (cravingMatches.length > 0) matchingPlaces = cravingMatches;
  }

  // If no direct matches, use all matching tier places or fallback candidates
  if (matchingPlaces.length === 0) matchingPlaces = places.slice(0, 5);

  const samplePlaces = matchingPlaces.slice(0, 4);

  const recommendations = samplePlaces.map((p) => {
    let suggestedOrder = '';
    let estimatedCost = '';
    let budgetTag = 'Best Value';

    if (perPersonBudget < 250) {
      suggestedOrder = 'Food Court Daily Special Set (Khichuri / Chowmein) + Cold Beverage';
      estimatedCost = `৳${Math.min(perPersonBudget, 220)}`;
      budgetTag = 'Pocket Friendly (< ৳250)';
    } else if (perPersonBudget <= 450) {
      suggestedOrder = 'Signature Meal Combo (Main Dish + Side + Drink)';
      estimatedCost = `৳${Math.min(perPersonBudget, 380)}`;
      budgetTag = 'High Value Combo';
    } else if (perPersonBudget <= 800) {
      suggestedOrder = 'Platter Special + Dessert / Fresh Juice';
      estimatedCost = `৳${Math.min(perPersonBudget, 650)}`;
      budgetTag = 'Satisfying Feast';
    } else {
      suggestedOrder = 'Chef Specialty Platter & Premium Beverage';
      estimatedCost = `৳${perPersonBudget}`;
      budgetTag = 'Gourmet Selection';
    }

    return {
      placeId: p._id ? String(p._id) : p.googlePlaceId,
      name: p.name,
      cuisine: Array.isArray(p.cuisine) ? p.cuisine.join(', ') : p.cuisine || 'Fast Food / Dining',
      rating: p.rating || 4.5,
      priceLevel: p.priceLevel || 1,
      estimatedCost,
      suggestedOrder,
      reason: `Matches your budget of ৳${perPersonBudget}/person perfectly in ${p.address?.city || area}. Great portions and authentic flavors.`,
      budgetTag,
      address: p.address?.formatted || p.address?.city || 'Dhaka',
    };
  });

  return {
    source: 'fallback',
    budgetAnalysis: `For ৳${numericBudget} total (৳${perPersonBudget} per person for ${partySize} ${partySize > 1 ? 'people' : 'person'}), here are top recommendations and food courts in ${area} tailored to your budget.`,
    totalBudget: numericBudget,
    perPersonBudget,
    partySize,
    recommendations,
    budgetTips: [
      'Food courts in malls (like Shimanto Square & Jamuna Future Park) offer great sharing platters under ৳250.',
      'Order combo sets during lunch hours for maximum savings and drinks included.',
      'Traditional Bangla eateries (bhaat-curry) offer the best nutrition-to-taka ratio in town.',
    ],
  };
}

/**
 * Call Gemini 1.5 Flash API to generate budget-optimized food recommendations
 */
async function getGeminiBudgetSuggestions({
  budget,
  partySize = 1,
  craving = '',
  places = [],
  area = 'Dhaka',
  userApiKey = '',
}) {
  const apiKey = userApiKey?.trim() || process.env.GEMINI_API_KEY;

  const numericBudget = Math.max(parseFloat(budget) || 250, 50);
  const perPerson = Math.round(numericBudget / Math.max(partySize, 1));

  // If no Gemini API key is provided, use the intelligent Dhaka food expert fallback
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return generateLocalBudgetRecommendations({
      budget: numericBudget,
      partySize,
      craving,
      places,
      area,
    });
  }

  const placesContext = formatPlacesForPrompt(places);

  const systemPrompt = `You are "CraveCompass AI", a knowledgeable, savvy food explorer and budget advisor in Dhaka, Bangladesh.
Your goal is to suggest the best places to eat (restaurants, food courts, street food hubs, or cafes) based on the user's specific budget in Bangladeshi Taka (BDT / ৳).

USER CRITERIA:
- Total Budget: ৳${numericBudget} BDT
- Party Size: ${partySize} person(s)
- Budget Per Person: ~৳${perPerson} BDT
- Desired Craving / Cuisine: ${craving ? craving : 'Open to anything delicious'}
- Location / Area: ${area}

CANDIDATE PLACES IN DATABASE:
${placesContext || 'Dhaka food courts, biryani houses, street food stalls, and cafes.'}

TASK & OUTPUT RULES:
1. Recommend 3 to 5 matching food courts or eateries from the candidate list (or well-known genuine Dhaka food spots if candidates are sparse).
2. For each place, suggest a realistic order/dish combo that stays under or at the per-person budget of ৳${perPerson}.
3. Give an estimated cost in ৳ BDT, a catchy budget tag, and a 1-sentence rationale.
4. Provide 2-3 genuine Dhaka food budget hacks.
5. Return ONLY a valid JSON object matching this exact schema:
{
  "budgetAnalysis": "Friendly 1-2 sentence overview of what this budget can achieve in Dhaka",
  "totalBudget": ${numericBudget},
  "perPersonBudget": ${perPerson},
  "partySize": ${partySize},
  "recommendations": [
    {
      "placeId": "ID from candidate list if matched, or null",
      "name": "Restaurant / Food Court Name",
      "cuisine": "e.g. Biryani / Food Court / Fast Food",
      "rating": 4.5,
      "priceLevel": 1,
      "estimatedCost": "e.g. ৳220",
      "suggestedOrder": "Specific dish or combo to order within this budget",
      "reason": "Why this place is an unbeatable pick for this budget",
      "budgetTag": "e.g. Best Value Food Court",
      "address": "Area name e.g. Dhanmondi, Dhaka"
    }
  ],
  "budgetTips": [
    "Tip 1",
    "Tip 2"
  ]
}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: systemPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('Gemini API call returned non-200 status:', response.status, errText);
      return generateLocalBudgetRecommendations({
        budget: numericBudget,
        partySize,
        craving,
        places,
        area,
      });
    }

    const data = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return generateLocalBudgetRecommendations({
        budget: numericBudget,
        partySize,
        craving,
        places,
        area,
      });
    }

    // Parse the JSON response from Gemini
    const cleaned = rawContent.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // Link placeId with actual DB places if matching by name
    if (Array.isArray(parsed.recommendations)) {
      parsed.recommendations = parsed.recommendations.map((rec) => {
        const found = places.find(
          (p) => p.name.toLowerCase() === rec.name.toLowerCase() ||
                 p.name.toLowerCase().includes(rec.name.toLowerCase()) ||
                 rec.name.toLowerCase().includes(p.name.toLowerCase())
        );
        return {
          ...rec,
          placeId: found ? String(found._id || found.googlePlaceId) : rec.placeId,
          rating: found?.rating || rec.rating || 4.4,
          priceLevel: found?.priceLevel || rec.priceLevel || 1,
          primaryPhoto: found?.primaryPhoto || undefined,
          address: found?.address?.formatted || rec.address || area,
          location: found?.location || undefined,
        };
      });
    }

    return {
      source: 'gemini',
      ...parsed,
    };
  } catch (err) {
    console.error('Gemini API execution error, falling back to local advisor:', err.message);
    return generateLocalBudgetRecommendations({
      budget: numericBudget,
      partySize,
      craving,
      places,
      area,
    });
  }
}

module.exports = {
  getGeminiBudgetSuggestions,
  generateLocalBudgetRecommendations,
};
