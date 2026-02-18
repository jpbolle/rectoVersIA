import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import { PreferencesProvider } from '@/context/PreferencesContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Recto-VersIA',
  description: 'Aide à l\'écriture avec assistance IA',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logoRecto.png', type: 'image/png' }
    ],
    shortcut: '/logoRecto.png',
    apple: '/logoRecto.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.cdnfonts.com/css/opendyslexic"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <PreferencesProvider>{children}</PreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
