'use client';

// L'écran de jeu du professeur, pour UNE session (activité × classe).
//
// La page ne fait qu'une chose : le cadre. Elle reprend le gabarit de l'écran
// de correction — bandeau vert, puis deux cartes séparées par une poignée —
// parce que c'est le système du projet côté professeur. Le jeu lui-même vit
// dans `CompetitionPilote`.

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import UserAvatar from '@/components/UserAvatar/UserAvatar';
import CompetitionPilote from '@/components/Competition/CompetitionPilote';
import styles from './page.module.css';

export default function DirectPage({ params }: { params: Promise<{ sessionId: string }> }) {
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
          <h1 className={styles.headerTitle}>Compétition</h1>
        </div>
        <UserAvatar />
      </header>
      {contenu}
    </div>
  );

  if (isLoading) return cadre(<div className={styles.message}>Chargement…</div>);

  // Personne n'est connecté dans cette fenêtre : on le DIT. Une page qui reste
  // sur son « Chargement… » est le défaut le plus coûteux de ce projet.
  if (!isAuthenticated) {
    return cadre(
      <div className={styles.message}>
        Tu n’es pas connecté dans cette fenêtre. Connecte-toi, puis reviens à cette adresse.
      </div>
    );
  }

  // Cet écran est celui du PROF. L'élève, lui, joue depuis son activité — il
  // n'a aucun identifiant de session à connaître.
  if (role !== 'prof') {
    return cadre(
      <div className={styles.message}>
        La partie se joue depuis ton activité, dans « Mes Activités ».
      </div>
    );
  }

  return cadre(
    <main className={styles.main}>
      <CompetitionPilote sessionId={sessionId} />
    </main>
  );
}
