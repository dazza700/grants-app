import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GrantMatch - Find Government Grants That Match Your Needs',
  description: 'Discover federal and state government grants tailored to your organization. Get notified when new grants match your eligibility criteria.',
  keywords: ['government grants', 'federal grants', 'small business grants', 'nonprofit grants', 'grant notifications'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
