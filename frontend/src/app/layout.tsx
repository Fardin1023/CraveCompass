import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CraveCompass — Discover Food Near You',
  description:
    'Find the best restaurants, cafes, and eateries near your location. Search by cuisine, mood, or budget with real-time map pins.',
  keywords: 'restaurant discovery, food near me, map, cuisine, dining, local restaurants',
  icons: {
    icon: '/logo.jpg',
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
  openGraph: {
    title: 'CraveCompass — Discover Food Near You',
    description: 'Find the best restaurants near you with an interactive map.',
    type: 'website',
    images: [{ url: '/logo.jpg' }],
  },
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
        <link rel="icon" href="/logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
        {/* Mapbox GL CSS */}
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
