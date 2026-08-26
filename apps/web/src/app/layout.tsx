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
    default: 'ViralBoost Creator — Private Media Adaptation',
    template: '%s | ViralBoost Creator',
  },
  description: 'An invite-only creator workflow for private media adaptation, transparent review, creator-owned approval, and evidence-based learning.',
  keywords: [
    'creator media adaptation',
    'private creator workflow',
    'non-destructive video editing',
    'creator approval',
    'evidence-based creator analytics',
  ],
  authors: [{ name: 'ViralBoost Creator' }],
  creator: 'ViralBoost Creator',
  publisher: 'ViralBoost Creator',
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
    siteName: 'ViralBoost Creator',
    title: 'ViralBoost Creator — Private Media Adaptation',
    description: 'Private source intake, transparent platform-native drafts, creator approval, and evidence-based learning.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ViralBoost Creator workspace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ViralBoost Creator — Private Media Adaptation',
    description: 'Private source intake, transparent drafts, creator approval, and evidence-based learning.',
    images: ['/og-image.png'],
    creator: '@viralboostcreator',
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
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen bg-background font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
