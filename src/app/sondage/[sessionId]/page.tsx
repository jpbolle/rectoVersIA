'use client';

// L'écran du SONDAGE en direct du professeur, pour UNE session (activité ×
// classe). Même cadre que l'écran de compétition (`/direct/[sessionId]`), dont
// il reprend les styles : bandeau vert, deux cartes séparées par une poignée.
// Le sondage lui-même vit dans `SondagePilote`.

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import UserAvatar from '@/components/UserAvatar/UserAvatar';
import SondagePilote from '@/components/Sondage/SondagePilote';
import styles from '@/app/direct/[sessionId]/page.module.css';

export default function SondagePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const { role, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const cadre = (contenu: React.ReactNode) => (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button type="button" className={styles.backButton} onClick={() => router.push('/dashboard')}>
            ← Retour
          </button>
          <h1 className={styles.headerTitle}>Sondage en direct</h1>
        </div>
        <UserAvatar />
      </header>
      {contenu}
    </div>
  );

  if (isLoading) return cadre(<div className={styles.message}>Chargement…</div>);

  if (!isAuthenticated) {
    return cadre(
      <div className={styles.message}>
        Tu n’es pas connecté dans cette fenêtre. Connecte-toi, puis reviens à cette adresse.
      </div>
    );
  }

  if (role !== 'prof') {
    return cadre(
      <div className={styles.message}>
        Le sondage se joue depuis ton activité, dans « Mes Activités ».
      </div>
    );
  }

  return cadre(
    <main className={styles.main}>
      <SondagePilote sessionId={sessionId} />
    </main>
  );
}
