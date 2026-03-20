'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import styles from './roadmap.module.css';

const NOUVEAUTES = [
  {
    version: 'v3.1',
    date: 'Mars 2026',
    items: [
      'Intégration NavigKid : recherche guidée web dans Recto-versIA',
      'Type de travail : Écrire, Lire ou Rechercher',
      'Constructeur de questionnaire avec génération IA',
      'Extension Chrome NavigKid avec authentification Google',
      'Vue correction prof pour activités de recherche (sources, passages, stats)',
      'Aide IA pour les élèves : vérification des sources, mots-clés et réponses',
    ],
  },
  {
    version: 'v3.0',
    date: 'Mars 2026',
    items: [
      'Multi-professeurs : chaque prof a son propre espace (classes, devoirs, grilles)',
      'Accès temporaire pour les nouveaux professeurs (1 jour, 1 semaine)',
      'Grilles partagées : grilles exemples et duplication entre professeurs',
      'Visualisation des grilles des collègues avant duplication',
      'Statistiques d\'utilisation dans l\'administration',
      'Page Roadmap accessible à tous',
      'Formulaires de création positionnés en haut de page',
    ],
  },
  {
    version: 'v2.9',
    date: 'Mars 2026',
    items: [
      'Système de classes avec codes d\'accès (rejoindre une classe)',
      'Import en masse des élèves (CSV / texte)',
      'Suppression d\'élève avec cascade (travaux et corrections conservés)',
    ],
  },
  {
    version: 'v2.8',
    date: 'Février 2026',
    items: [
      'Authentification centralisée (getAuthHeaders)',
      'Correction des boucles infinies d\'authentification',
      'Panneau latéral redimensionnable',
    ],
  },
  {
    version: 'v2.6',
    date: 'Février 2026',
    items: [
      'ContentLock fiable en production',
      'Design system Classica',
      'Import en masse des élèves',
    ],
  },
];

const A_VENIR = [
  {
    priorite: 'Prochainement',
    items: [
      {
        titre: 'Avis critique entre pairs (CRC)',
        description: 'L\'élève lit et rédige un avis sur le CRC d\'un autre élève. Attribution aléatoire et anonyme',
      },
    ],
  },
  {
    priorite: 'Planifié',
    items: [
      {
        titre: 'Grille de métacognition',
        description: 'Écart auto-évaluation / correction prof, évolution du texte entre versions',
      },
      {
        titre: 'Finalisation des corrections',
        description: 'Versioning des corrections, verrouillage après envoi à l\'élève',
      },
      {
        titre: 'Commentaires prof améliorés',
        description: 'Assistance IA pour la rédaction des commentaires + dictée vocale',
      },
      {
        titre: 'Immersive Reader',
        description: 'Synthèse vocale et découpage syllabique pour les élèves en difficulté (Microsoft Azure)',
      },
    ],
  },
  {
    priorite: 'En réflexion',
    items: [
      {
        titre: 'Chiffrement des données élèves',
        description: 'Conformité RGPD — chiffrement des données personnelles dans Firestore',
      },
      {
        titre: 'Écart visuel prof/élève',
        description: 'Comparaison détaillée dans la grille entre l\'évaluation du prof et l\'auto-évaluation',
      },
    ],
  },
];

export default function RoadmapPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading && !isAuthenticated) return null;

  const headerVariant = role === 'prof' ? 'prof' : 'student';

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant={headerVariant} />

      <main className={styles.mainContent}>
        <h1 className={styles.pageTitle}>Roadmap</h1>
        <p className={styles.pageSubtitle}>
          Suivez l&apos;évolution de Recto-versIA
        </p>

        <div className={styles.columns}>
          {/* Colonne gauche : Nouveautes */}
          <section className={styles.column}>
            <h2 className={styles.columnTitle}>Nouveautés</h2>

            {NOUVEAUTES.map((release) => (
              <div key={release.version} className={styles.releaseCard}>
                <div className={styles.releaseHeader}>
                  <span className={styles.versionBadge}>{release.version}</span>
                  <span className={styles.releaseDate}>{release.date}</span>
                </div>
                <ul className={styles.itemList}>
                  {release.items.map((item, i) => (
                    <li key={i} className={styles.item}>
                      <span className={styles.checkIcon}>&#10003;</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          {/* Colonne droite : A venir */}
          <section className={styles.column}>
            <h2 className={styles.columnTitle}>À venir</h2>

            {A_VENIR.map((group) => (
              <div key={group.priorite} className={styles.futureCard}>
                <h3 className={styles.prioriteLabel}>{group.priorite}</h3>
                {group.items.map((item, i) => (
                  <div key={i} className={styles.futureItem}>
                    <h4 className={styles.futureTitle}>{item.titre}</h4>
                    <p className={styles.futureDesc}>{item.description}</p>
                  </div>
                ))}
              </div>
            ))}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
