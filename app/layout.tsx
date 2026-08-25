import type { Metadata } from 'next';
import { Geist, Geist_Mono, Instrument_Serif, Noto_Sans_Thai } from 'next/font/google';
import './globals.css';

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans-next',
  display: 'swap',
});

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display-next',
  display: 'swap',
});

const thai = Noto_Sans_Thai({
  subsets: ['thai'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-thai-next',
  display: 'swap',
});

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono-next',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CT',
  description: 'Crown Tether private desk',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${sans.variable} ${display.variable} ${thai.variable} ${mono.variable} antialiased`}>
      <body className="min-h-screen bg-bg text-fg">{children}</body>
    </html>
  );
}
