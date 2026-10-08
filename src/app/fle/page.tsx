'use client';

// « Mon profil FLE » (ex « Mon cours FLE », 2026-10-09) — la page d'ouverture de l'élève FLE (DASPA).
//
// Dépouillée, à dessein : gros pictogrammes, peu de texte, jamais le lexique
// « écrilecteur / ceinture / geste ». Depuis le 2026-10-08, deux CARDS en
// tête :
//  · PARCOURS — le travail donné par le prof à sa classe FLE (séquences FLE et
//    activités ordinaires données à cette classe — et RIEN d'une autre classe) ;
//  · LECTURES — ses lectures de cours, avec le bouton « Importer un cours ».
// Un clic sur une card DÉPLIE son contenu juste en dessous, sur la même page
// (JP, 2026-10-09 : « je ne veux pas que l'on passe à une nouvelle page ») ;
// la card s'allume, un second clic — ou « Fermer » — replie. L'adresse garde
// `?vue=` pour qu'un retour depuis une lecture rouvre le même volet.
// Sous les cards : son radar CECR et ses objectifs du mois.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { aUneClasseFle, espaceFleSeulement, useStudentClasses } from '@/hooks/useStudentClasses';
import { atelierLabel } from '@/types/didactique';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import EmptyState from '@/components/EmptyState/EmptyState';
import NiveauFlePanel from '@/components/NiveauFlePanel/NiveauFlePanel';
import ImportCoursModal from '@/components/ImportCoursModal/ImportCoursModal';
import type { Devoir, TypeTravail } from '@/types/devoir';
import { libelleSource } from '@/types/lecture-cours';
import type { LectureCoursResume } from '@/types/lecture-cours';
import { labelTypeEvaluation } from '@/types/evaluation-fle';
import type { EvaluationFle } from '@/types/evaluation-fle';
import styles from './fle.module.css';

type Vue = 'accueil' | 'parcours' | 'lectures' | 'evaluations';

// Un pictogramme par dispositif : la page parle en images, pas en lexique
const PICTO_PAR_TYPE: Partial<Record<TypeTravail, string>> = {
  sequence: '🧭',
  lire: '📖',
  ecrire: '✍️',
  rechercher: '🔎',
  vocabulaire: '🔤',
  schematiser: '🗺️',
  autoevaluation: '🪞',
};

// Sous le titre : le nombre d'étapes d'une séquence, l'atelier pour le reste
function metaActivite(d: Devoir): string {
  if (d.typeTravail === 'sequence') {
    const n = d.sequenceFle?.etapes.length ?? 0;
    return `${n} étape${n > 1 ? 's' : ''}`;
  }
  return d.atelier ? atelierLabel(d.atelier, true) : '';
}

function dateCourte(iso: string): string {
  return iso ? new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' }) : '';
}

export default function FlePage() {
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();
  const { classes, isLoading: classesLoading } = useStudentClasses();

  const [prenom, setPrenom] = useState('');
  // Niveau global déduit du radar (« A2 »), servi par /api/niveaux-fle
  const [niveau, setNiveau] = useState('');
  // Mes activités ouvertes — servies par la liste habituelle (classes,
  // sessions et élèves choisis déjà filtrés côté serveur)
  const [activites, setActivites] = useState<Devoir[] | null>(null);
  const [lectures, setLectures] = useState<LectureCoursResume[] | null>(null);
  // Les évaluations que le prof a glissées dans ma classe FLE
  const [evaluations, setEvaluations] = useState<EvaluationFle[] | null>(null);
  // `?vue=lectures` : retour depuis une lecture
  const [vue, setVue] = useState<Vue>(() => {
    if (typeof window === 'undefined') return 'accueil';
    const v = new URLSearchParams(window.location.search).get('vue');
    return v === 'parcours' || v === 'lectures' || v === 'evaluations' ? v : 'accueil';
  });
  const [importOuvert, setImportOuvert] = useState(false);
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
      setRedirecting(true);
      router.replace('/login');
      return;
    }
    if (role === 'prof') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
      setRedirecting(true);
      router.replace('/accueil');
      return;
    }
    if (role === 'eleve' && !classesLoading) {
      if (classes.length === 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
        setRedirecting(true);
        router.replace('/login');
        return;
      }
      // Pas de classe FLE : cette page n'est pas la sienne
      if (!aUneClasseFle(classes)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
        setRedirecting(true);
        router.replace('/accueil');
      }
    }
  }, [isAuthenticated, authLoading, role, classes, classesLoading, router, redirecting]);

  // Le prénom et le niveau, servis par la route du positionnement
  useEffect(() => {
    if (!isAuthenticated || role !== 'eleve') return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/niveaux-fle', { headers });
        const json = await res.json();
        if (!annule && json.success) {
          setPrenom(json.data.prenom || '');
          setNiveau(json.data.niveauGlobal?.label || '');
        }
      } catch {
        // Le bonjour se passe de prénom
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, role, getAuthHeaders]);

  // La liste des activités de l'élève, telle quelle — on n'écarte que l'archivé
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
          setActivites(json.success ? (json.data as Devoir[]).filter((d) => !d.archive) : []);
        }
      } catch {
        if (!annule) setActivites([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, role, getAuthHeaders]);

  // Mes lectures de cours
  useEffect(() => {
    if (!isAuthenticated || role !== 'eleve') return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/fle/lectures', { headers });
        const json = await res.json();
        if (!annule) setLectures(json.success ? (json.data as LectureCoursResume[]) : []);
      } catch {
        if (!annule) setLectures([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, role, getAuthHeaders]);

  // Mes évaluations
  useEffect(() => {
    if (!isAuthenticated || role !== 'eleve') return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/fle/evaluations', { headers });
        const json = await res.json();
        if (!annule) setEvaluations(json.success ? (json.data as EvaluationFle[]) : []);
      } catch {
        if (!annule) setEvaluations([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, role, getAuthHeaders]);

  // Un PDF d'évaluation se sert avec le jeton : on le lit puis on l'ouvre
  const ouvrirPdf = async (fichierId: string) => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`/api/fle/evaluations/fichier/${encodeURIComponent(fichierId)}`, { headers });
    if (!res.ok) return;
    window.open(URL.createObjectURL(await res.blob()), '_blank', 'noopener');
  };

  if ((authLoading && !isAuthenticated) || redirecting) return null;

  const classesFle = classes.filter((c) => !c.archive && c.type === 'fle');
  // Seul le travail donné à une classe FLE a sa place ici : un élève qui
  // suit aussi un cours de français ordinaire retrouve le reste sur /accueil.
  // (`Devoir.classes` porte des noms de classes, comme `classes.nom`.)
  const nomsFle = new Set(classesFle.map((c) => c.nom));
  const travailFle =
    activites === null ? null : activites.filter((d) => d.classes.some((nom) => nomsFle.has(nom)));

  // Un second clic sur la card ouverte la replie
  const changerVue = (v: Vue) => {
    const cible = v !== 'accueil' && v === vue ? 'accueil' : v;
    setVue(cible);
    window.history.replaceState(null, '', cible === 'accueil' ? '/fle' : `/fle?vue=${cible}`);
  };
  const classeCard = (v: Vue) => `${styles.card} ${vue === v ? styles.cardActive : ''}`;

  // ── Les listes ──
  const listeParcours = (liste: Devoir[]) => (
    <div className={styles.sequences}>
      {liste.map((s) => (
        <Link key={s.id} href={`/activites/${s.id}`} className={styles.sequence}>
          <span className={styles.sequencePicto} aria-hidden="true">
            {PICTO_PAR_TYPE[s.typeTravail] ?? '📝'}
          </span>
          <span className={styles.sequenceTexte}>
            <span className={styles.sequenceTitre}>{s.intitule}</span>
            <span className={styles.sequenceMeta}>
              {[metaActivite(s), s.dateRemise ? `pour le ${dateCourte(s.dateRemise)}` : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span className={styles.sequenceFleche} aria-hidden="true">→</span>
        </Link>
      ))}
    </div>
  );

  const listeLectures = (liste: LectureCoursResume[]) => (
    <div className={styles.sequences}>
      {liste.map((l) => (
        <Link key={l.id} href={`/fle/lectures/${l.id}`} className={styles.sequence}>
          <span className={styles.sequencePicto} aria-hidden="true">📚</span>
          <span className={styles.sequenceTexte}>
            <span className={styles.sequenceTitre}>{l.titre}</span>
            <span className={styles.sequenceMeta}>
              {[
                libelleSource(l.source),
                dateCourte(l.createdAt),
                l.sectionsPretes < 6 ? `${l.sectionsPretes}/6 prêtes` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span className={styles.sequenceFleche} aria-hidden="true">→</span>
        </Link>
      ))}
    </div>
  );

  const STATUT_EVAL: Record<string, string> = {
    'non-commence': 'à faire',
    'en-cours': 'en cours',
    remis: 'remise',
    corrige: 'corrigée',
  };

  const listeEvaluations = (liste: EvaluationFle[]) => (
    <div className={styles.sequences}>
      {liste.map((e) => {
        const meta = [labelTypeEvaluation(e.type), dateCourte(e.createdAt), e.statut ? STATUT_EVAL[e.statut] : ''].filter(Boolean).join(' · ');
        const contenu = (
          <>
            <span className={styles.sequencePicto} aria-hidden="true">
              {e.source.kind === 'activite' ? '📝' : e.source.kind === 'pdf' ? '📄' : '🔗'}
            </span>
            <span className={styles.sequenceTexte}>
              <span className={styles.sequenceTitre}>{e.titre}</span>
              <span className={styles.sequenceMeta}>{meta}</span>
            </span>
            <span className={styles.sequenceFleche} aria-hidden="true">→</span>
          </>
        );
        if (e.source.kind === 'activite') {
          return (
            <Link key={e.id} href={`/activites/${e.source.devoirId}`} className={styles.sequence}>
              {contenu}
            </Link>
          );
        }
        if (e.source.kind === 'lien') {
          return (
            <a key={e.id} href={e.source.url} target="_blank" rel="noopener noreferrer" className={styles.sequence}>
              {contenu}
            </a>
          );
        }
        const fichierId = e.source.fichierId;
        return (
          <button key={e.id} type="button" className={styles.sequence} onClick={() => ouvrirPdf(fichierId)}>
            {contenu}
          </button>
        );
      })}
    </div>
  );

  const boutonImporter = (
    <button type="button" className={styles.importBtn} onClick={() => setImportOuvert(true)}>
      📥 Importer un cours
    </button>
  );

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      {/* Classes mixtes : « Accueil » ramène à toutes ses activités */}
      <Header variant="fle" avecAccueil={!espaceFleSeulement(classes)} />

      <main className={styles.main}>
        {classesLoading ? (
          <EmptyState icon="hourglass" message="En cours de chargement" />
        ) : (
          <>
            <h1 className={styles.hello}>
              <span className={styles.helloPicto} aria-hidden="true">👋</span>
              Bonjour{prenom ? ` ${prenom}` : ''}
              {niveau && <span className={styles.helloNiveau}>{niveau}</span>}
            </h1>
            {classesFle.length > 0 && (
              <p className={styles.helloSub}>{classesFle.map((c) => c.nom).join(' · ')}</p>
            )}

            {/* Les trois cards : un clic déplie le contenu juste en dessous */}
            <div className={styles.cards}>
              <button
                type="button"
                className={classeCard('parcours')}
                aria-expanded={vue === 'parcours'}
                onClick={() => changerVue('parcours')}
              >
                <span className={styles.cardPicto} aria-hidden="true">🎒</span>
                <span className={styles.cardTitre}>Mes parcours</span>
                <span className={styles.cardSous}>Le travail donné par mon professeur</span>
                <span className={styles.cardCompte}>
                  {travailFle === null
                    ? '…'
                    : travailFle.length === 0
                      ? 'Rien pour l’instant'
                      : `${travailFle.length} à faire`}
                </span>
              </button>
              <button
                type="button"
                className={classeCard('lectures')}
                aria-expanded={vue === 'lectures'}
                onClick={() => changerVue('lectures')}
              >
                <span className={styles.cardPicto} aria-hidden="true">📚</span>
                <span className={styles.cardTitre}>Mes lectures de cours</span>
                <span className={styles.cardSous}>Un cours importé, expliqué à mon niveau</span>
                <span className={styles.cardCompte}>
                  {lectures === null
                    ? '…'
                    : lectures.length === 0
                      ? 'Importe ton premier cours'
                      : `${lectures.length} lecture${lectures.length > 1 ? 's' : ''}`}
                </span>
              </button>
              <button
                type="button"
                className={classeCard('evaluations')}
                aria-expanded={vue === 'evaluations'}
                onClick={() => changerVue('evaluations')}
              >
                <span className={styles.cardPicto} aria-hidden="true">🎯</span>
                <span className={styles.cardTitre}>Mes évaluations</span>
                <span className={styles.cardSous}>Ce que mon professeur me demande de faire</span>
                <span className={styles.cardCompte}>
                  {evaluations === null
                    ? '…'
                    : evaluations.length === 0
                      ? 'Rien pour l’instant'
                      : `${evaluations.length} évaluation${evaluations.length > 1 ? 's' : ''}`}
                </span>
              </button>
            </div>

            {/* Le volet de la card ouverte, sur place */}
            {vue !== 'accueil' && (
            <section className={`${styles.bloc} ${styles.volet}`}>
              <div className={styles.blocHead}>
                <span className={styles.blocPicto} aria-hidden="true">
                  {vue === 'parcours' ? '🎒' : vue === 'lectures' ? '📚' : '🎯'}
                </span>
                <h2 className={styles.blocTitre}>
                  {vue === 'parcours' ? 'Mes parcours' : vue === 'lectures' ? 'Mes lectures de cours' : 'Mes évaluations'}
                </h2>
                <span className={styles.blocAction}>
                  {vue === 'lectures' && boutonImporter}
                  <button type="button" className={styles.fermer} onClick={() => changerVue('accueil')}>
                    Fermer ✕
                  </button>
                </span>
              </div>
              {vue === 'parcours' ? (
                travailFle === null ? (
                  <p className={styles.blocVide}>Chargement…</p>
                ) : travailFle.length === 0 ? (
                  <p className={styles.blocVide}>Rien pour l’instant. Bravo !</p>
                ) : (
                  listeParcours(travailFle)
                )
              ) : vue === 'evaluations' ? (
                evaluations === null ? (
                  <p className={styles.blocVide}>Chargement…</p>
                ) : evaluations.length === 0 ? (
                  <p className={styles.blocVide}>Aucune évaluation pour l’instant.</p>
                ) : (
                  listeEvaluations(evaluations)
                )
              ) : lectures === null ? (
                <p className={styles.blocVide}>Chargement…</p>
              ) : lectures.length === 0 ? (
                <div className={styles.lecturesVide}>
                  <p className={styles.blocVide}>
                    Tu as un cours difficile à lire ? Importe-le : tu auras un résumé dans ta langue, le
                    vocabulaire, des questions, et plus encore.
                  </p>
                  {boutonImporter}
                </div>
              ) : (
                listeLectures(lectures)
              )}
            </section>
            )}

            {/* Le radar et les objectifs du mois */}
            <section className={styles.bloc}>
              <div className={styles.blocHead}>
                <span className={styles.blocPicto} aria-hidden="true">🧭</span>
                <h2 className={styles.blocTitre}>Où j’en suis</h2>
              </div>
              <NiveauFlePanel compact />
            </section>

            {/* Pas de bloc « Mes classes » : l'en-tête a déjà son bouton (JP, 2026-10-09) */}
          </>
        )}
      </main>

      <ImportCoursModal
        isOpen={importOuvert}
        onClose={() => setImportOuvert(false)}
        onImported={(id) => {
          setImportOuvert(false);
          router.push(`/fle/lectures/${id}`);
        }}
      />

      <Footer />
    </div>
  );
}
