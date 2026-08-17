import Image from 'next/image';
import { APP_VERSION } from '@/lib/version';
import styles from './Footer.module.css';

interface FooterProps {
  // Laissée pour les rares écrans qui voudraient afficher autre chose ; en
  // pratique, tout le monde prend APP_VERSION.
  version?: string;
}

export default function Footer({ version = APP_VERSION }: FooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerLeft}>Version {version}</div>
      <div className={styles.footerCenter}>Mars 2023 (Révision Février 2026)</div>
      <div className={styles.footerRight}>
        <Image
          src="/logo copie.png"
          alt="PedagokIT"
          width={70}
          height={70}
          className={styles.footerLogo}
        />
      </div>
    </footer>
  );
}
