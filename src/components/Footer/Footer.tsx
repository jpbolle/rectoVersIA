import Image from 'next/image';
import styles from './Footer.module.css';

interface FooterProps {
  version?: string;
}

export default function Footer({ version = '2.2' }: FooterProps) {
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
