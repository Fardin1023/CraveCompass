import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'CraveCompass — Discover Food Near You',
  description:
    'Find the best restaurants, cafes, and eateries near your location. Search by cuisine, mood, or budget with real-time map pins.',
  keywords: 'restaurant discovery, food near me, map, cuisine, dining, local restaurants',
  icons: {
    icon: '/brand-mark.svg',
    shortcut: '/brand-mark.svg',
  },
  openGraph: {
    title: 'CraveCompass — Discover Food Near You',
    description: 'Find the best restaurants near you with an interactive map.',
    type: 'website',
    images: [{ url: '/logo.jpg' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#3A2D28',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/brand-mark.svg" type="image/svg+xml" />
        {/* Leaflet CSS for OpenStreetMap */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
