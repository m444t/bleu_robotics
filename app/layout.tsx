import type { Metadata } from 'next';
import { DM_Sans, Space_Grotesk, Space_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
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

export const metadata: Metadata = {
  title: 'Bleu Robotics — Teaching humanoid robots to work in factories',
  description:
    'Bleu Robotics builds the AI that lets a humanoid robot take on manual tasks on your line: taught in under an hour with a few demonstrations, and a new task at each changeover.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
