export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Jazz | Handset Portal',
  description: 'Jazz Experience Centers ? handset catalog and administration',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
