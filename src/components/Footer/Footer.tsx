import Image from 'next/image';
import { APP_VERSION } from '@/lib/version';
import styles from './Footer.module.css';

interface FooterProps {
  // Laissée pour les rares écrans qui voudraient afficher autre chose ; en
  // pratique, tout le monde prend APP_VERSION.
  version?: string;
}

// Date du dernier build (posée par next.config.ts) = date du dernier déploiement,
// puisque le VPS reconstruit à chaque mise en ligne. Fuseau fixé pour que le
// serveur (UTC) et le navigateur affichent le même jour.
function dateDeMiseAJour(): string | null {
  const brute = process.env.NEXT_PUBLIC_BUILD_DATE;
  if (!brute) return null;
  const date = new Date(brute);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Brussels',
  });
}

export default function Footer({ version = APP_VERSION }: FooterProps) {
  const miseAJour = dateDeMiseAJour();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerLeft}>Version {version}</div>
      <div className={styles.footerCenter}>
        <div>Mars 2023</div>
        {miseAJour && <div className={styles.footerMaj}>Application mise à jour le {miseAJour}</div>}
      </div>
      <div className={styles.footerRight}>
        {/* Nouvel onglet : un élève en pleine rédaction ne doit pas quitter sa page */}
        <a
          href="https://www.pedagokit.be/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLogoLien}
          title="PedagokIT — site"
        >
          <Image
            src="/logo copie.png"
            alt="PedagokIT"
            width={70}
            height={70}
            className={styles.footerLogo}
          />
        </a>
      </div>
    </footer>
  );
}
