# CraveCompass 🧭🍽️

**Location-Based Food Discovery Website** — Find restaurants near you with an interactive map, NLP search, and real-time filters.

## Tech Stack

| Layer     | Tech                           |
|-----------|--------------------------------|
| Frontend  | Next.js 15, TypeScript, CSS    |
| Backend   | Node.js, Express               |
| Database  | MongoDB + Mongoose (2dsphere)  |
| Map       | Mapbox GL JS                   |
| Food Data | Google Places API              |
| Search    | Natural language query parser  |

---

## Quick Start

### 1. Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`)
- Mapbox account → [mapbox.com](https://mapbox.com) (free token)
- Google Places API key → [Google Cloud Console](https://console.cloud.google.com)

### 2. Configure Environment Variables

**Backend** — edit `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cravecompass
GOOGLE_PLACES_API_KEY=YOUR_KEY_HERE
CLIENT_URL=http://localhost:3000
```

**Frontend** — edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_MAPBOX_TOKEN=YOUR_MAPBOX_TOKEN_HERE
```

### 3. Install Dependencies
```bash
npm run install:all
```

### 4. Seed the Database (optional — loads demo restaurants)
```bash
npm run seed
```

### 5. Start Development Servers

**Terminal 1 — Backend:**
```bash
cd backend && npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Features

### 🔍 NLP Search
Type natural language like:
- `"cheap sushi near me"`
- `"best coffee open now"`
- `"romantic seafood dinner"`
- `"vegan food under $15"`

The query parser extracts: cuisine, price range, open-now, ambience, and rating preferences.

### 🗺️ Interactive Map
- Cuisine-specific emoji markers (🍣🍕🌮☕...)
- Click markers to see popups with ratings and status
- Animated fly-to when selecting a restaurant
- User location blue dot

### 🏷️ Filter Bar
- **Open Now** — only show open restaurants
- **Top Rated** — 4.0+ rating
- **Cuisine chips** — Sushi, Pizza, Burgers, Coffee, Vegan, Mexican, Korean, Indian
- **Price tiers** — $ Budget / $$ Mid / $$$ Upscale
- **Sort** — Nearest / Best Rated / Trending

### 📍 Geolocation
- Browser Geolocation API with permission handling
- Automatic nearby restaurant loading
- Reverse geocoding (city name display)

### 🗃️ MongoDB
- GeoJSON `2dsphere` index for `$near` queries
- Full-text search index on name, cuisine, tags
- Google Places result caching on first search
- Popularity scoring per page view

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/search` | NLP search with geo filter |
| `GET` | `/api/search/suggestions` | Autocomplete |
| `GET` | `/api/places/nearby` | Geospatial nearby |
| `GET` | `/api/places/:id` | Place details |
| `GET` | `/api/location/reverse-geocode` | Lat/lng → city |
| `GET` | `/api/health` | Health check |

---

## Project Structure

```
CraveCompass/
├── backend/
│   ├── src/
│   │   ├── index.js          # Entry point
│   │   ├── app.js            # Express app
│   │   ├── config/
│   │   │   └── database.js   # MongoDB connection
│   │   ├── models/
│   │   │   ├── Place.js      # Restaurant schema
│   │   │   └── SearchHistory.js
│   │   ├── routes/
│   │   │   ├── places.js     # Place CRUD + nearby
│   │   │   ├── search.js     # NLP search
│   │   │   └── location.js   # Reverse geocode
│   │   ├── services/
│   │   │   ├── googlePlaces.js  # Google API
│   │   │   └── queryParser.js   # NLP parser
│   │   └── scripts/
│   │       └── seed.js       # Demo data
│   └── .env
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx    # Root layout + SEO
    │   │   ├── page.tsx      # Main page
    │   │   └── globals.css   # Design system
    │   ├── components/
    │   │   ├── MapView.tsx       # Mapbox map
    │   │   ├── SearchBar.tsx     # Search input
    │   │   ├── FilterBar.tsx     # Filter chips
    │   │   ├── PlaceCard.tsx     # Result card
    │   │   └── PlaceDetailPanel.tsx
    │   ├── hooks/
    │   │   ├── useGeolocation.ts
    │   │   └── useSearch.ts
    │   ├── lib/
    │   │   └── api.ts        # API client
    │   └── types/
    │       └── index.ts      # TypeScript types
    └── .env.local
```
