'use client';

// L'ACCUEIL DU PROF (JP, 2026-10-08) : trois encadrés, sur le modèle de
// l'accueil élève — À corriger · Échéances à venir · Élèves en retard — pour
// les classes de l'espace courant (classique ou FLE). Rendu par /accueil.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useEspace } from '@/context/EspaceContext';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import EmptyState from '@/components/EmptyState/EmptyState';
import type { AccueilProf as Donnees } from '@/types/accueil';
import styles from '@/app/accueil/accueil.module.css';

function echeanceLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function retardLabel(jours: number) {
  if (jours === 1) return 'hier';
  return `${jours} jours`;
}

export default function AccueilProf() {
  const { isAuthenticated, getAuthHeaders, user } = useAuth();
  const { espace, pret } = useEspace();
  const [data, setData] = useState<Donnees | null>(null);
  const [chargement, setChargement] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !pret) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/accueil-prof?espace=${espace}`, { headers });
        const json = await res.json();
        if (!annule && json.success) setData(json.data);
      } catch (err) {
        console.error('Erreur chargement accueil prof:', err);
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, getAuthHeaders, espace, pret]);

  const prenom = user?.displayName?.split(' ')[0] ?? '';

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="prof" />

      <main className={styles.main}>
        {chargement ? (
          <EmptyState icon="hourglass" message="En cours de chargement" />
        ) : (
          <>
            <h1 className={styles.hello}>Bonjour{prenom ? ` ${prenom}` : ''}</h1>
            <p className={styles.helloSub}>{espace === 'fle' ? 'Espace FLE — vos classes DASPA' : 'Espace classique — vos classes de français'}</p>

            <div className={styles.blocs}>
              <section className={`${styles.bloc} ${styles.blocRetard}`}>
                <div className={styles.blocHead}>
                  <h2 className={styles.blocTitre}>À corriger</h2>
                  <span className={styles.blocCount}>{data?.aCorriger.reduce((n, a) => n + a.nb, 0) ?? 0}</span>
                </div>
                {data?.aCorriger.length ? (
                  data.aCorriger.map((a) => (
                    <Link key={`${a.devoirId}-${a.classeNom}`} href={`/dashboard/travaux/${a.devoirId}`} className={styles.ligne}>
                      <span className={styles.ligneTitre}>
                        {a.intitule}
                        <span className={styles.ligneAtelier}>{a.classeNom}</span>
                      </span>
                      <span className={`${styles.ligneMeta} ${styles.ligneRetard}`}>
                        {a.nb} copie{a.nb > 1 ? 's' : ''}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className={styles.blocVide}>Rien à corriger.</p>
                )}
                <Link className={styles.blocLien} href="/dashboard">
                  Voir mes activités →
                </Link>
              </section>

              <section className={styles.bloc}>
                <div className={styles.blocHead}>
                  <h2 className={styles.blocTitre}>Échéances à venir</h2>
                  <span className={styles.blocCount}>{data?.echeances.length ?? 0}</span>
                </div>
                {data?.echeances.length ? (
                  data.echeances.map((e) => (
                    <Link key={`${e.devoirId}-${e.classeNom}`} href={`/dashboard/travaux/${e.devoirId}`} className={styles.ligne}>
                      <span className={styles.ligneTitre}>
                        {e.intitule}
                        <span className={styles.ligneAtelier}>
                          {e.classeNom} · {e.remises}/{e.total} remise{e.remises > 1 ? 's' : ''}
                        </span>
                      </span>
                      <span className={styles.ligneMeta}>{echeanceLabel(e.dateRemise)}</span>
                    </Link>
                  ))
                ) : (
                  <p className={styles.blocVide}>Aucune échéance dans les deux semaines.</p>
                )}
                <Link className={styles.blocLien} href="/dashboard">
                  Voir mes activités →
                </Link>
              </section>

              <section className={styles.bloc}>
                <div className={styles.blocHead}>
                  <h2 className={styles.blocTitre}>Élèves en retard</h2>
                  <span className={styles.blocCount}>{data?.retards.reduce((n, r) => n + r.eleves.length, 0) ?? 0}</span>
                </div>
                {data?.retards.length ? (
                  data.retards.map((r) => (
                    <Link key={`${r.devoirId}-${r.classeNom}`} href={`/dashboard/travaux/${r.devoirId}`} className={styles.ligne}>
                      <span className={styles.ligneTitre}>
                        {r.intitule}
                        <span className={styles.ligneAtelier}>
                          {r.classeNom} · {r.eleves.join(', ')}
                        </span>
                      </span>
                      <span className={`${styles.ligneMeta} ${styles.ligneRetard}`}>{retardLabel(r.joursDeRetard)}</span>
                    </Link>
                  ))
                ) : (
                  <p className={styles.blocVide}>Personne en retard sur les 30 derniers jours.</p>
                )}
                <Link className={styles.blocLien} href="/classes">
                  Voir mes classes →
                </Link>
              </section>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
