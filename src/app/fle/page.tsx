'use client';

// « Mon cours » — la page d'ouverture de l'élève FLE (DASPA).
//
// Dépouillée, à dessein : gros pictogrammes, peu de texte, jamais le lexique
// « écrilecteur / ceinture / geste ». Trois choses seulement :
//  1. son radar CECR et ses objectifs du mois (le regard du prof) ;
//  2. le travail à faire — vide tant que les séquences n'existent pas
//     (étapes 4-5 du plan espace FLE) ;
//  3. un accès à ses classes.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { aUneClasseFle, useStudentClasses } from '@/hooks/useStudentClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import EmptyState from '@/components/EmptyState/EmptyState';
import NiveauFlePanel from '@/components/NiveauFlePanel/NiveauFlePanel';
import type { Devoir } from '@/types/devoir';
import styles from './fle.module.css';

export default function FlePage() {
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();
  const { classes, isLoading: classesLoading } = useStudentClasses();

  const [prenom, setPrenom] = useState('');
  // Mes séquences FLE ouvertes (des activités de type « sequence », servies
  // par la liste habituelle — classes, sessions et élèves choisis déjà filtrés)
  const [sequences, setSequences] = useState<Devoir[] | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Garde de redirection avec le state `redirecting` (gotcha AGENTS.md)
  useEffect(() => {
    if ((authLoading && !isAuthenticated) || redirecting) return;
    if (!isAuthenticated) {
      setRedirecting(true);
      router.replace('/login');
      return;
    }
    if (role === 'prof') {
      setRedirecting(true);
      router.replace('/dashboard');
      return;
    }
    if (role === 'eleve' && !classesLoading) {
      if (classes.length === 0) {
        setRedirecting(true);
        router.replace('/login');
        return;
      }
      // Pas de classe FLE : cette page n'est pas la sienne
      if (!aUneClasseFle(classes)) {
        setRedirecting(true);
        router.replace('/accueil');
      }
    }
  }, [isAuthenticated, authLoading, role, classes, classesLoading, router, redirecting]);

  // Le prénom, pour le bonjour — servi par la même route que le positionnement
  useEffect(() => {
    if (!isAuthenticated || role !== 'eleve') return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/niveaux-fle', { headers });
        const json = await res.json();
        if (!annule && json.success) setPrenom(json.data.prenom || '');
      } catch {
        // Le bonjour se passe de prénom
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, role, getAuthHeaders]);

  // Les séquences : la liste des activités de l'élève, filtrée sur le dispositif
  useEffect(() => {
    if (!isAuthenticated || role !== 'eleve') return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/devoirs', { headers });
        const json = await res.json();
        if (!annule) {
          setSequences(
            json.success
              ? (json.data as Devoir[]).filter((d) => d.typeTravail === 'sequence' && !d.archive)
              : []
          );
        }
      } catch {
        if (!annule) setSequences([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, role, getAuthHeaders]);

  if ((authLoading && !isAuthenticated) || redirecting) return null;

  const classesFle = classes.filter((c) => !c.archive && c.type === 'fle');

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="fle" />

      <main className={styles.main}>
        {classesLoading ? (
          <EmptyState icon="hourglass" message="En cours de chargement" />
        ) : (
          <>
            <h1 className={styles.hello}>
              <span className={styles.helloPicto} aria-hidden="true">👋</span>
              Bonjour{prenom ? ` ${prenom}` : ''}
            </h1>
            {classesFle.length > 0 && (
              <p className={styles.helloSub}>{classesFle.map((c) => c.nom).join(' · ')}</p>
            )}

            {/* 1. Le travail à faire — en premier : c'est la question du jour */}
            <section className={styles.bloc}>
              <div className={styles.blocHead}>
                <span className={styles.blocPicto} aria-hidden="true">🎒</span>
                <h2 className={styles.blocTitre}>Mon travail à faire</h2>
              </div>
              {sequences === null ? (
                <p className={styles.blocVide}>Chargement…</p>
              ) : sequences.length === 0 ? (
                <p className={styles.blocVide}>Rien pour l’instant. Bravo !</p>
              ) : (
                <div className={styles.sequences}>
                  {sequences.map((s) => (
                    <Link key={s.id} href={`/activites/${s.id}`} className={styles.sequence}>
                      <span className={styles.sequencePicto} aria-hidden="true">🧭</span>
                      <span className={styles.sequenceTexte}>
                        <span className={styles.sequenceTitre}>{s.intitule}</span>
                        <span className={styles.sequenceMeta}>
                          {s.sequenceFle?.etapes.length ?? 0} étape
                          {(s.sequenceFle?.etapes.length ?? 0) > 1 ? 's' : ''}
                          {s.dateRemise ? ` · pour le ${new Date(s.dateRemise).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' })}` : ''}
                        </span>
                      </span>
                      <span className={styles.sequenceFleche} aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* 2. Le radar et les objectifs du mois */}
            <section className={styles.bloc}>
              <div className={styles.blocHead}>
                <span className={styles.blocPicto} aria-hidden="true">🧭</span>
                <h2 className={styles.blocTitre}>Où j’en suis</h2>
              </div>
              <NiveauFlePanel compact />
            </section>

            {/* 3. Les classes */}
            <section className={styles.bloc}>
              <div className={styles.blocHead}>
                <span className={styles.blocPicto} aria-hidden="true">🏫</span>
                <h2 className={styles.blocTitre}>Mes classes</h2>
              </div>
              <div className={styles.classes}>
                {classesFle.map((c) => (
                  <Link key={c.id} href="/mes-classes" className={styles.classeCarte}>
                    {c.nom}
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
