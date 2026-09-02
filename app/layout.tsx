import type { Metadata } from 'next';
import { Geist, Geist_Mono, Noto_Sans_Thai_Looped, Orbitron } from 'next/font/google';
import './globals.css';
import './queue-desk.css';
import './sum-desk.css';
import './slip-card.css';
import './desk-board.css';
import { GrokPreviewBridge } from '@/components/ct/GrokPreviewBridge';

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans-next',
  display: 'swap',
});

const thai = Noto_Sans_Thai_Looped({
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

const ops = Orbitron({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-ops-next',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CT',
  description: 'Crown Tether private desk',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" data-thai="looped" className={`${sans.variable} ${thai.variable} ${mono.variable} ${ops.variable} antialiased`}>
      <body className="min-h-screen bg-bg text-fg">
        <GrokPreviewBridge />
        {children}
      </body>
    </html>
  );
}
