import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';

import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'CPI GO · Administration',
    template: '%s · CPI GO',
  },
  description:
    'Panneau d’administration CPI GO : prospects, représentants, téléconseillers et dossiers bancaires.',
  icons: {
    icon: [
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF7F7' },
    { media: '(prefers-color-scheme: dark)', color: '#140206' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${bricolage.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <a
          href="#contenu-principal"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
        >
          Aller au contenu principal
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
