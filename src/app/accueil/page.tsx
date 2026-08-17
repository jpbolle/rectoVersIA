'use client';

// Page d'ouverture de l'élève.
//
// Trois blocs qui répondent à trois questions, dans cet ordre : qu'est-ce que
// j'ai laissé passer, qu'est-ce qui arrive, où j'en suis. Puis la ROUE des
// ceintures — la progression de l'année, UAA par UAA.
//
// Tout vient d'un seul appel (/api/accueil), calculé à la lecture : rien n'est
// stocké, donc rien ne peut se désynchroniser d'un basculement de disponibilité.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import EmptyState from '@/components/EmptyState/EmptyState';
import CeinturesRoue, { CeinturesLegende } from '@/components/CeinturesRoue/CeinturesRoue';
import { atelierLabel } from '@/types/didactique';
import type { Accueil, ActiviteAccueil } from '@/types/accueil';
import styles from './accueil.module.css';

function scoreColor(percent: number) {
  if (percent < 35) return 'var(--c-danger)';
  if (percent < 60) return 'var(--c-accent)';
  return 'var(--c-primary)';
}

// « 3 jours », « hier », « aujourd'hui » — un nombre de jours nu se relit mal
function retardLabel(jours: number) {
  if (jours === 1) return 'hier';
  if (jours > 1) return `${jours} jours`;
  return 'aujourd’hui';
}

function echeanceLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function LigneActivite({ item, retard }: { item: ActiviteAccueil; retard: boolean }) {
  return (
    <Link href={`/activites/${item.devoirId}`} className={styles.ligne}>
      <span className={styles.ligneTitre}>
        {item.intitule}
        <span className={styles.ligneAtelier}>{atelierLabel(item.atelier, true)}</span>
      </span>
      <span className={`${styles.ligneMeta} ${retard ? styles.ligneRetard : ''}`}>
        {retard ? retardLabel(item.joursDeRetard) : echeanceLabel(item.dateRemise)}
      </span>
    </Link>
  );
}

export default function AccueilPage() {
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();
  const { classes, isLoading: classesLoading } = useStudentClasses();

  const [data, setData] = useState<Accueil | null>(null);
  const [chargement, setChargement] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Garde de redirection : sans le state `redirecting`, la page boucle
  // (gotcha AGENTS.md)
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
    if (role === 'eleve' && !classesLoading && classes.length === 0) {
      setRedirecting(true);
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, role, classes, classesLoading, router, redirecting]);

  useEffect(() => {
    if (!isAuthenticated || role !== 'eleve') return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/accueil', { headers });
        const json = await res.json();
        if (!annule && json.success) setData(json.data);
      } catch (err) {
        console.error('Erreur chargement accueil:', err);
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, role, getAuthHeaders]);

  if ((authLoading && !isAuthenticated) || redirecting) return null;


  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="student" />

      <main className={styles.main}>
        {chargement ? (
          <EmptyState icon="hourglass" message="En cours de chargement" />
        ) : (
          <>
            <h1 className={styles.hello}>
              Bonjour{data?.prenom ? ` ${data.prenom}` : ''}
            </h1>
            {data && data.classes.length > 0 && (
              <p className={styles.helloSub}>{data.classes.join(' · ')}</p>
            )}

            <div className={styles.blocs}>
              <section className={`${styles.bloc} ${styles.blocRetard}`}>
                <div className={styles.blocHead}>
                  <h2 className={styles.blocTitre}>Travaux et lectures en retard</h2>
                  <span className={styles.blocCount}>{data?.retards.length ?? 0}</span>
                </div>
                {data?.retards.length ? (
                  data.retards.map((item) => (
                    <LigneActivite key={item.devoirId} item={item} retard />
                  ))
                ) : (
                  <p className={styles.blocVide}>Rien en retard. </p>
                )}
                <Link className={styles.blocLien} href="/activites">
                  Voir mes activités →
                </Link>
              </section>

              <section className={styles.bloc}>
                <div className={styles.blocHead}>
                  <h2 className={styles.blocTitre}>Échéances à venir</h2>
                  <span className={styles.blocCount}>{data?.echeances.length ?? 0}</span>
                </div>
                {data?.echeances.length ? (
                  data.echeances.map((item) => (
                    <LigneActivite key={item.devoirId} item={item} retard={false} />
                  ))
                ) : (
                  <p className={styles.blocVide}>Aucune échéance annoncée.</p>
                )}
                <Link className={styles.blocLien} href="/activites">
                  Voir mes activités →
                </Link>
              </section>

              <section className={styles.bloc}>
                <div className={styles.blocHead}>
                  <h2 className={styles.blocTitre}>Derniers résultats</h2>
                  <span className={styles.blocCount}>{data?.resultats.length ?? 0}</span>
                </div>
                {data?.resultats.length ? (
                  data.resultats.map((r) => (
                    <Link
                      key={r.devoirId}
                      href={`/activites/${r.devoirId}`}
                      className={styles.ligne}
                    >
                      <span className={styles.ligneTitre}>{r.intitule}</span>
                      <span
                        className={styles.pastille}
                        style={{ color: scoreColor(r.percent) }}
                      >
                        {r.percent} %
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className={styles.blocVide}>Aucune correction rendue pour l’instant.</p>
                )}
                <Link className={styles.blocLien} href="/profil">
                  Voir mon profil →
                </Link>
              </section>
            </div>

            {/* La roue n'est pas un quatrième bloc : c'est le fond du tableau.
                Elle s'affiche TOUJOURS — la ceinture blanche étant acquise dès
                l'entrée dans le parcours, aucune branche n'est vide, et c'est
                au premier jour qu'elle est le plus utile : elle annonce l'année
                à venir. */}
            {data && data.roue.length > 0 && (
              <section className={styles.roue}>
                <div className={styles.roueHead}>
                  <h2 className={styles.roueTitre}>Mes ceintures par UAA</h2>
                  <p className={styles.roueSub}>
                    Chaque certification réussie fait avancer d’une ceinture. La noire vaut
                    réussite de l’UAA et fait apparaître son badge.
                  </p>
                </div>
                <div className={styles.roueBody}>
                  <CeinturesRoue uaa={data.roue} />
                </div>
                <CeinturesLegende />
                <p className={styles.roueNote}>
                  La ceinture blanche est acquise dès l’entrée dans le parcours : chaque
                  certification réussie fait avancer d’un cran vers l’extérieur. Le détail de
                  chaque certification se lit dans{' '}
                  <Link href="/profil" className={styles.lien}>
                    Mon Profil
                  </Link>
                  , onglet Général.
                </p>
              </section>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
