import type { Metadata } from 'next';
import { DM_Sans, Space_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

// Space Grotesk self-hosted in full (google/fonts' variable TTF as woff2, every glyph and
// feature kept): the Google Fonts copy drops the slashed zero ('zero') and the serifed
// capital I ('ss05') the design uses
const spaceGrotesk = localFont({
  src: './fonts/SpaceGrotesk-Variable.woff2',
  weight: '300 700',
  variable: '--font-space-grotesk',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-space-mono',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-dm-sans',
});

const title = 'Bleu Robotics — Teaching humanoid robots to work in factories';
const description =
  'Bleu Robotics builds the AI that lets a humanoid robot take on manual tasks on your line: taught in under an hour with a few demonstrations, and a new task at each changeover.';
// Figma 572:985 ("OG v2 For every page")
const ogImage = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Bleu Robotics — Industrial AI that learns from demonstration.',
};

export const metadata: Metadata = {
  title,
  description,
  icons: {
    // the blue mark on light grey for light browser chrome, the blue tile for dark
    icon: [
      { url: '/favicon-light.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  openGraph: { type: 'website', siteName: 'Bleu Robotics', title, description, images: [ogImage] },
  twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
