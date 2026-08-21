import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: 'Amplify — Video Amplification Platform',
    template: '%s | Amplify',
  },
  description: 'Amplify your videos across every platform. AI-powered optimization, cross-platform distribution, and real-time analytics — all self-hosted, zero API costs.',
  keywords: [
    'video marketing',
    'social media automation',
    'content amplification',
    'cross-platform posting',
    'video optimization',
    'AI video tools',
    'self-hosted',
  ],
  authors: [{ name: 'Amplify Team' }],
  creator: 'Amplify',
  publisher: 'Amplify',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Amplify',
    title: 'Amplify — Video Amplification Platform',
    description: 'Amplify your videos across every platform. AI-powered optimization, cross-platform distribution, and real-time analytics.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Amplify Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Amplify — Video Amplification Platform',
    description: 'Amplify your videos across every platform. AI-powered optimization, cross-platform distribution, and real-time analytics.',
    images: ['/og-image.png'],
    creator: '@amplify',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen bg-background font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}