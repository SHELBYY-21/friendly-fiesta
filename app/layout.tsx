import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CE Vault · USDT Ledger',
  description: 'CE Vault — ระบบบันทึกธุรกรรม USDT Arbitrage / P2P',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">
        <div className="aurora" aria-hidden />
        {children}

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Ffriendlyf4587back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.20" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></body>
    </html>
  );
}
