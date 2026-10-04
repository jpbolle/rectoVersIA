import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SchémaKit',
  description: 'Schématiser en classe : ligne du temps, carte mentale, schéma hiérarchisé, carte conceptuelle.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
