import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MU One | Student Command Center',
  description: "Masters' Union student portal — calendar, tasks, and mail in one place.",
  icons: {
    icon: '/logo-mu-one.png',
    shortcut: '/logo-mu-one.png',
    apple: '/logo-mu-one.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} bg-[#0A0A0A]`}>
      <body className={`${inter.className} bg-[#0A0A0A] text-white antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
