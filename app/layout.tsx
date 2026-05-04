import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tablo — Hospitality, orchestrated',
  description: 'The operating system for modern restaurants.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
