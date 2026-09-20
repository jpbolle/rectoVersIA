'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import UserAvatar from '@/components/UserAvatar';
import type { Devoir } from '@/types/devoir';
import type { Travail } from '@/types/travail';
import type { Correction } from '@/types/correction';
import type { Grille } from '@/types/grille';
import { LEVEL_PERCENTAGES } from '@/types/grille';
import type { NavigKidQuestion } from '@/types/navigkid';
import { SANS_CLASSE } from '@/types/session';
import type { Session } from '@/types/session';
import { parseLectureAnswers } from '@/types/lecture';
import { scoreLectureQuiz } from '@/lib/lecture-scoring';
import type { LectureScore } from '@/lib/lecture-scoring';
import { calculateSchoolYear } from '@/lib/auth-utils';
import SessionsListe from '@/components/SessionsListe/SessionsListe';
import Toggle from '@/components/Toggle/Toggle';
import Link from 'next/link';
import Footer from '@/components/Footer/Footer';
import OeuvreSuivi from '@/components/OeuvreSuivi/OeuvreSuivi';
import styles from './travaux.module.css';

export default function TravauxPage() {
  const params = useParams();
  const router = useRouter();
  const devoirId = params.devoirId as string;

  const { isAuthenticated, role, user, isLoading: authLoading, getAuthHeaders } = useAuth();
  // `user` est un objet instable : on ne garde que son identifiant pour les
  // dépendances d'effet (règle AGENTS.md)
  const uid = user?.uid;
  const [devoir, setDevoir] = useState<Devoir | null>(null);
  const [travauxBruts, setTravaux] = useState<Travail[]>([]);
  // ── LES SESSIONS D'ABORD, LES ÉLÈVES ENSUITE ──
  // Une activité peut viser plusieurs classes et resservir d'une année sur
  // l'autre : ouvrir la page sur la liste des copies mélangeait la 4C de cette
  // année avec la 4B de l'an dernier. On choisit donc une session, et tout ce
  // qui suit (statistiques comprises) ne parle que d'elle.
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionActive, setSessionActive] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Map<string, Correction>>(new Map());
  const [grille, setGrille] = useState<Grille | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEcritureStats, setShowEcritureStats] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<NavigKidQuestion[] | null>(null);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  // Copies qu'aucune session ne réclame : élève supprimé, classe effacée,
  // travail antérieur aux sessions, ou élève d'une autre classe venu par une
  // SÉQUENCE FLE. Sans ce panier, elles disparaîtraient de l'écran du prof sans
  // que rien ne le dise — le pire des silences.
  const orphelines = useMemo(
    () => travauxBruts.filter((t) => !t.sessionId),
    [travauxBruts]
  );

  // Une seule session (ou aucune) : rien à choisir, on va droit aux copies.
  // Un écran intermédiaire d'une seule ligne serait un clic pour rien — SAUF
  // s'il y a des copies sans classe : la session unique ouverte d'office les
  // cachait, sans aucun chemin pour y arriver (trouvé le 2026-09-19).
  const plusieursPaniers = sessions.length > 1 || (sessions.length === 1 && orphelines.length > 0);
  const choixNecessaire = plusieursPaniers && !sessionActive;

  const travaux = useMemo(() => {
    if (!sessionActive) return travauxBruts;
    if (sessionActive === SANS_CLASSE) return orphelines;
    return travauxBruts.filter((t) => t.sessionId === sessionActive);
  }, [travauxBruts, sessionActive, orphelines]);

  // ── La session choisie doit survivre au retour arrière ──
  // Elle ne vivait que dans un state : revenir d'une copie ramenait le prof à
  // l'écran de choix des classes au lieu de ses trois colonnes (signalé le
  // 2026-09-20). On la pose donc dans l'URL de l'entrée d'historique courante.
  // Lecture une seule fois au montage, par `window.location` : c'est le motif
  // retenu dans `/grilles`, `useSearchParams` imposant une frontière Suspense
  // pour un seul paramètre.
  useEffect(() => {
    const demandee = new URLSearchParams(window.location.search).get('session');
    if (demandee) setSessionActive(demandee);
  }, []);

  // `replaceState` plutôt qu'une navigation Next : on ne change pas de page,
  // on annote celle-ci pour que le navigateur la retrouve telle quelle.
  const choisirSession = useCallback((id: string | null) => {
    setSessionActive(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('session', id);
    else url.searchParams.delete('session');
    window.history.replaceState(null, '', url);
  }, []);

  // La classe ouverte, quand c'en est une : le panier « sans classe » n'a pas
  // de session, donc rien à ouvrir ni à fermer.
  const sessionOuverte = useMemo(
    () =>
      sessionActive && sessionActive !== SANS_CLASSE
        ? (sessions.find((s) => s.id === sessionActive) ?? null)
        : null,
    [sessions, sessionActive]
  );

  const [corrigeEnCours, setCorrigeEnCours] = useState(false);

  const basculerCorrige = useCallback(
    async (valeur: boolean) => {
      if (!sessionOuverte) return;
      const id = sessionOuverte.id;
      setCorrigeEnCours(true);
      // Optimiste : une bascule qui n'obéit pas tout de suite se reclique.
      setSessions((liste) =>
        liste.map((s) => (s.id === id ? { ...s, corrigeDisponible: valeur } : s))
      );
      try {
        const headers = await getAuthHeaders();
        if (!headers) throw new Error('Session expirée — rechargez la page');
        const res = await fetch(`/api/sessions/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ corrigeDisponible: valeur }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Enregistrement impossible');
      } catch (e) {
        setSessions((liste) =>
          liste.map((s) => (s.id === id ? { ...s, corrigeDisponible: !valeur } : s))
        );
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setCorrigeEnCours(false);
      }
    },
    [sessionOuverte, getAuthHeaders]
  );

  useEffect(() => {
    if (role && role !== 'prof') {
      router.replace('/dashboard');
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    async function fetchData() {
      const headers = await getAuthHeaders();
      // Sortir ici sans rien faire laissait l'écran sur son spinner pour
      // toujours : l'effet ne se rejoue pas tout seul. On rend la main.
      if (!headers) {
        setIsLoading(false);
        setError('Session expirée — reconnectez-vous.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const devoirRes = await fetch(`/api/devoirs/${devoirId}`, { headers });
        const devoirJson = await devoirRes.json();

        if (devoirJson.success) {
          setDevoir(devoirJson.data);

          if (devoirJson.data.typeTravail === 'rechercher' && devoirJson.data.questionnaireId) {
            const qRes = await fetch(`/api/navigkid/questionnaire?id=${devoirJson.data.questionnaireId}`, { headers });
            const qJson = await qRes.json();
            if (qJson.success) setQuestionnaire(qJson.data.questions || []);
          }

          if (devoirJson.data.grille) {
            const grilleRes = await fetch(`/api/grilles/${encodeURIComponent(devoirJson.data.grille)}`, { headers });
            const grilleJson = await grilleRes.json();
            if (grilleJson.success) setGrille(grilleJson.data);
          }
        } else {
          setError('Devoir non trouve');
          return;
        }

        const [travauxRes, correctionsRes, sessionsRes] = await Promise.all([
          fetch(`/api/travaux?devoirId=${devoirId}`, { headers }),
          fetch(`/api/corrections?devoirId=${devoirId}`, { headers }),
          fetch(`/api/sessions?devoirId=${devoirId}`, { headers }),
        ]);

        const travauxJson = await travauxRes.json();
        const copies: Travail[] = travauxJson.success ? travauxJson.data : [];
        if (travauxJson.success) setTravaux(copies);

        const sessionsJson = await sessionsRes.json();
        if (sessionsJson.success) {
          const liste = sessionsJson.data as Session[];
          setSessions(liste);
          // Une seule classe, et aucune copie hors classe : on l'ouvre d'office
          if (liste.length === 1 && !copies.some((t) => !t.sessionId)) setSessionActive(liste[0].id);
        }

        const correctionsJson = await correctionsRes.json();
        if (correctionsJson.success && Array.isArray(correctionsJson.data)) {
          const map = new Map<string, Correction>();
          for (const c of correctionsJson.data) map.set(c.travailId, c);
          setCorrections(map);
        }
      } catch (err) {
        console.error('Erreur fetch data:', err);
        setError('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    }

    // `user` est ATTENDU, pas seulement `isAuthenticated` : au rechargement
    // complet d'une page (un lien <a> depuis la scénarisation, par exemple),
    // le rôle est restauré du cache de session avant que Firebase n'ait rendu
    // l'utilisateur. Partir à ce moment-là donnait un jeton nul, donc un
    // chargement qui n'aboutissait jamais. L'effet repart quand l'UID arrive.
    if (isAuthenticated && role === 'prof' && uid) fetchData();
  }, [isAuthenticated, role, uid, devoirId, getAuthHeaders]);

  const isLate = useCallback(
    (travail: Travail) => {
      if (!devoir?.dateRemise || !travail.submittedAt) return false;
      const deadline = new Date(devoir.dateRemise);
      deadline.setHours(23, 59, 59, 999);
      return new Date(travail.submittedAt) > deadline;
    },
    [devoir]
  );

  const isNotOpened = useCallback((travail: Travail) => {
    return travail.status === 'draft' && travail.content === '';
  }, []);

  // ── « Corrigé » veut dire « plus rien n'attend le professeur » ──
  // Un questionnaire de lecture ne range JAMAIS son total en base : il se
  // recalcule à l'affichage (cf. `lecture-scoring.ts`), et `correction.score`
  // reste donc à 0 pour toujours. Trier les colonnes sur ce score laissait
  // TOUTES les copies de lecture dans « À corriger », même entièrement notées
  // et rendues visibles (signalé le 2026-09-20).
  //
  // Le bon critère : le prof a noté toutes les questions qui réclamaient SON
  // intervention — c'est exactement `aNoter === 0`. Corollaire assumé : une
  // copie entièrement auto-corrigeable (que des QCM) est corrigée d'emblée,
  // puisque le prof n'a rien à y faire. La visibilité pour l'élève ne joue
  // pas : on peut avoir corrigé sans encore vouloir montrer.
  //
  // ⚠ Le questionnaire utilisé ici est celui de la BIBLIOTHÈQUE, pas celui
  // figé par la session — la liste des sessions ne transporte pas `quizFige`,
  // et c'est délibéré (un questionnaire entier par session). L'écart possible
  // ne déplace qu'une carte de colonne, il ne touche jamais une note.
  const scoresLecture = useMemo(() => {
    const parTravail = new Map<string, LectureScore>();
    if (devoir?.typeTravail !== 'lire' || !devoir.lectureQuiz) return parTravail;
    for (const t of travaux) {
      parTravail.set(
        t.id,
        scoreLectureQuiz(
          devoir.lectureQuiz,
          parseLectureAnswers(t.content)?.answers ?? {},
          corrections.get(t.id)?.questionScores
        )
      );
    }
    return parTravail;
  }, [travaux, corrections, devoir]);

  const { travauxNonOuverts, travauxNonCorriges, travauxCorriges } = useMemo(() => {
    const nonOuverts: Travail[] = [];
    const nonCorriges: Travail[] = [];
    const corriges: Travail[] = [];

    for (const t of travaux) {
      const correction = corrections.get(t.id);
      const lecture = scoresLecture.get(t.id);
      // Copie marquée « non rendu » : plus rien à corriger → colonne Corrigés
      if (t.nonRendu) corriges.push(t);
      else if (isNotOpened(t)) nonOuverts.push(t);
      else if (lecture ? lecture.aNoter === 0 : !!correction && correction.score > 0) corriges.push(t);
      else nonCorriges.push(t);
    }

    nonOuverts.sort((a, b) => a.studentName.localeCompare(b.studentName));
    nonCorriges.sort((a, b) => {
      const aLate = isLate(a) ? 1 : 0;
      const bLate = isLate(b) ? 1 : 0;
      if (aLate !== bLate) return aLate - bLate;
      return a.studentName.localeCompare(b.studentName);
    });
    corriges.sort((a, b) => a.studentName.localeCompare(b.studentName));

    return { travauxNonOuverts: nonOuverts, travauxNonCorriges: nonCorriges, travauxCorriges: corriges };
  }, [travaux, corrections, scoresLecture, isLate, isNotOpened]);

  const stats = useMemo(() => {
    // Copies marquées « non rendu » : les justifiées sortent des statistiques,
    // les non justifiées comptent comme un 0 (cote finale disciplinaire)
    const nonRenduIds = new Set(travaux.filter((t) => t.nonRendu).map((t) => t.id));
    const excusedCount = travaux.filter((t) => t.nonRendu === 'justifie').length;
    const sanctionedCount = travaux.filter((t) => t.nonRendu === 'nonJustifie').length;

    const submittedCount = travaux.filter((t) => t.status === 'submitted' && !t.nonRendu).length;
    const remiseTotal = travaux.length - excusedCount;
    const tauxRemise = remiseTotal > 0 ? Math.round((submittedCount / remiseTotal) * 100) : null;

    // Les copies qui comptent : celles de la session ouverte, non marquées
    // « non rendu ». ⚠ On partait auparavant de TOUTES les corrections de
    // l'activité, donc de toutes les classes mélangées — ce que la page
    // promet justement de ne plus faire.
    const retenues = travaux.filter((t) => !nonRenduIds.has(t.id));

    // La note d'une copie. Pour l'écriture, celle de la grille. Pour un
    // questionnaire de lecture, le total RECALCULÉ — rien n'est rangé en base
    // (cf. le tri des colonnes plus haut), d'où des statistiques qui restaient
    // désespérément vides (signalé le 2026-09-20). Une copie encore en cours
    // de correction n'entre pas dans les moyennes.
    const noteDe = (travailId: string): number | null => {
      const lecture = scoresLecture.get(travailId);
      if (lecture) return lecture.aNoter === 0 ? lecture.percent : null;
      const c = corrections.get(travailId);
      return c && c.score > 0 ? c.score : null;
    };

    // Réservé aux moyennes par critère : la grille, elle, n'existe que pour
    // l'écriture.
    const correctedOnes = retenues
      .map((t) => corrections.get(t.id))
      .filter((c): c is Correction => !!c && c.score > 0);

    const allScores = [
      ...retenues.map((t) => noteDe(t.id)).filter((s): s is number => s !== null),
      ...Array(sanctionedCount).fill(0) as number[],
    ];
    const successCount = allScores.filter((s) => s >= 50).length;
    const failureCount = allScores.filter((s) => s < 50).length;

    const sortedScores = [...allScores].sort((a, b) => a - b);
    const n = sortedScores.length;
    const moyenne = n > 0 ? Math.round(sortedScores.reduce((s, v) => s + v, 0) / n) : null;
    const mediane = n === 0 ? null
      : n % 2 === 0
        ? Math.round((sortedScores[n / 2 - 1] + sortedScores[n / 2]) / 2)
        : sortedScores[Math.floor(n / 2)];

    // Distribution par tranches (les 0 disciplinaires comptent en « faible »)
    const distribution = {
      faible: allScores.filter((s) => s < 45).length,
      insuffisant: allScores.filter((s) => s >= 45 && s < 65).length,
      reussi: allScores.filter((s) => s >= 65).length,
    };

    // 3 critères les plus faibles
    const weakestCriteria: { name: string; avgPct: number }[] = [];
    if (grille && correctedOnes.length > 0) {
      for (const criterion of grille.criteria) {
        const levels = correctedOnes
          .map((c) => c.evaluation[criterion.id])
          .filter((l) => l !== undefined) as number[];
        if (levels.length === 0) continue;
        const avgPct = Math.round(
          levels.reduce((s, l) => s + (LEVEL_PERCENTAGES[l as keyof typeof LEVEL_PERCENTAGES] ?? 0), 0) / levels.length
        );
        weakestCriteria.push({ name: criterion.name, avgPct });
      }
      weakestCriteria.sort((a, b) => a.avgPct - b.avgPct);
    }
    const top3Weak = weakestCriteria.slice(0, 3);

    // Statistiques d'écriture (ortho / ponctu / syntaxe)
    const orthoStudents: string[] = [];
    const ponctuStudents: string[] = [];
    const syntaxeStudents: string[] = [];
    const multipleIssuesStudents: string[] = [];

    if (grille) {
      const orthoCrits = grille.criteria.filter((c) => /orthograph/i.test(c.name));
      const ponctuCrits = grille.criteria.filter((c) => /ponctuat/i.test(c.name));
      const syntaxeCrits = grille.criteria.filter((c) => /syntaxe|syntact/i.test(c.name));

      for (const [travailId, correction] of corrections) {
        if (correction.score === 0) continue;
        const travail = travaux.find((t) => t.id === travailId);
        if (!travail) continue;

        const hasOrtho = orthoCrits.some((c) => correction.evaluation[c.id] !== undefined && correction.evaluation[c.id] <= 2);
        const hasPonctu = ponctuCrits.some((c) => correction.evaluation[c.id] !== undefined && correction.evaluation[c.id] <= 2);
        const hasSyntaxe = syntaxeCrits.some((c) => correction.evaluation[c.id] !== undefined && correction.evaluation[c.id] <= 2);

        if (hasOrtho) orthoStudents.push(travail.studentName);
        if (hasPonctu) ponctuStudents.push(travail.studentName);
        if (hasSyntaxe) syntaxeStudents.push(travail.studentName);
        if ([hasOrtho, hasPonctu, hasSyntaxe].filter(Boolean).length >= 2)
          multipleIssuesStudents.push(travail.studentName);
      }

      orthoStudents.sort((a, b) => a.localeCompare(b));
      ponctuStudents.sort((a, b) => a.localeCompare(b));
      syntaxeStudents.sort((a, b) => a.localeCompare(b));
      multipleIssuesStudents.sort((a, b) => a.localeCompare(b));
    }

    return {
      tauxRemise, submittedCount,
      successCount, failureCount,
      moyenne, mediane,
      distribution, top3Weak,
      orthoStudents, ponctuStudents, syntaxeStudents, multipleIssuesStudents,
    };
  }, [corrections, travaux, scoresLecture, grille]);

  const scoreClass = (val: number | null) => {
    if (val === null) return styles.statValue;
    if (val < 50) return styles.statValueDanger;
    if (val < 60) return styles.statValueWarning;
    return styles.statValueSuccess;
  };

  // Une activité FLE vit dans Mes Ressources › Modules FLE, pas au tableau de bord :
  // le retour ramène là d'où le prof est venu
  const handleBack = () =>
    router.push(devoir?.referentiel === 'fle' ? '/grilles?onglet=fle&section=activites' : '/dashboard');

  if ((authLoading && !isAuthenticated) || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span>Chargement...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <span>⚠️</span>
        <h2>Erreur</h2>
        <p>{error}</p>
        <button onClick={handleBack} className={styles.backButton}>Retour au tableau de bord</button>
      </div>
    );
  }

  const totalCorriges = stats.successCount + stats.failureCount;

  // ── Lecture d'une œuvre : un autre écran, pas une variante de celui-ci ──
  // Rien ne s'y remet, rien ne s'y corrige : taux de remise, moyenne, critères
  // faibles et les trois colonnes ne décriraient AUCUNE réalité. Le prof y
  // cherche qui lit, où il en est, et ce qu'il a compris.
  const isOeuvre = !!devoir?.oeuvreId;

  const renderCard = (travail: Travail) => {
    const correction = corrections.get(travail.id);
    // Même raison qu'au tri des colonnes : la lecture n'a pas de `score` en
    // base, son pourcentage se recalcule.
    const lecture = scoresLecture.get(travail.id);
    const pourcentage = lecture
      ? lecture.percent
      : correction && correction.score > 0
        ? correction.score
        : null;
    const late = isLate(travail);
    const notOpened = isNotOpened(travail);

    return (
      <div
        key={travail.id}
        className={`${styles.travailCard} ${notOpened ? styles.travailCardNotOpened : ''}`}
        onClick={() => router.push(`/dashboard/travaux/${devoirId}/${travail.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && router.push(`/dashboard/travaux/${devoirId}/${travail.id}`)}
      >
        <div className={styles.travailHeader}>
          <div className={styles.headerTags}>
            <span className={styles.studentName}>{travail.studentName}</span>
            {notOpened ? (
              <span className={`${styles.statusBadge} ${styles.statusNotOpened}`}>Non ouvert</span>
            ) : (
              <span className={`${styles.statusBadge} ${travail.status === 'submitted' ? styles.statusSubmitted : styles.statusDraft}`}>
                {travail.status === 'submitted' ? 'Remis' : 'Brouillon'}
              </span>
            )}
            {late && <span className={styles.lateBadge}>En retard</span>}
            {travail.nonRendu && (
              <span className={`${styles.statusBadge} ${styles.statusNonRendu}`}>
                {travail.nonRendu === 'justifie' ? 'Non rendu — justifié' : 'Non fait — 0'}
              </span>
            )}
          </div>
          {pourcentage !== null && <span className={styles.scoreBubble}>{pourcentage}%</span>}
        </div>
        {!notOpened && (
          <div className={styles.travailMeta}>
            <span className={styles.date}>
              {travail.submittedAt
                ? `Remis le ${new Date(travail.submittedAt).toLocaleDateString('fr-BE')}`
                : `Modifié le ${new Date(travail.updatedAt).toLocaleDateString('fr-BE')}`}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderStudentList = (names: string[]) => {
    if (names.length === 0) return <span className={styles.autresStatsNone}>Aucun élève</span>;
    return (
      <div className={styles.autresStatsList}>
        {names.map((name) => (
          <span key={name} className={styles.autresStatsChip}>{name}</span>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.logoLink}>
            <img src="/logoRecto.png" alt="Recto-VersIA" className={styles.logoImg} />
          </Link>
          <button className={styles.backBtn} onClick={handleBack}>←</button>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>{devoir?.intitule || 'Travaux'}</h1>
            <p className={styles.subtitle}>
              {choixNecessaire
                ? 'Choisissez une classe'
                : isOeuvre
                  ? 'Suivi de lecture'
                  : sessionActive && plusieursPaniers
                    ? `Travaux des élèves — ${
                        sessionActive === SANS_CLASSE
                          ? 'sans classe'
                          : (sessions.find((s) => s.id === sessionActive)?.classeNom ?? '')
                      }`
                    : 'Travaux des élèves'}
            </p>
          </div>
        </div>
        <div className={styles.headerRight}><UserAvatar /></div>
      </header>

      {questionnaire && (
        <div className={styles.questionnairePanel}>
          <button className={styles.questionnairePanelToggle} onClick={() => setShowQuestionnaire((v) => !v)}>
            📋 Questionnaire ({questionnaire.length} question{questionnaire.length > 1 ? 's' : ''})
            <span>{showQuestionnaire ? '▲' : '▼'}</span>
          </button>
          {showQuestionnaire && (
            <ol className={styles.questionnaireList}>
              {questionnaire.map((q, i) => (
                <li key={i} className={styles.questionnaireItem}>
                  <span className={styles.questionnaireTexte}>{q.texte}</span>
                  <span className={styles.questionnaireType}>{q.type === 'qcm' ? 'QCM' : 'Texte libre'}</span>
                  {q.type === 'qcm' && q.options && (
                    <ul className={styles.questionnaireOptions}>
                      {q.options.map((opt, j) => (
                        <li key={j} className={q.correctes?.includes(j) ? styles.correctOption : ''}>
                          {opt}{q.correctes?.includes(j) && ' ✓'}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.reponseAttendue && <p className={styles.questionnaireCorrige}><em>Corrigé : {q.reponseAttendue}</em></p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.barreClasse}>
          {/* Retour à la liste des classes — seulement quand il y a un choix à
              refaire, sinon le bouton renverrait sur un écran d'une seule ligne */}
          {sessionActive && plusieursPaniers && (
            <button
              type="button"
              className={styles.retourSessions}
              onClick={() => choisirSession(null)}
            >
              ← Toutes les classes
            </button>
          )}

          {/* ── Le corrigé, classe par classe ──
              Le réglage existait déjà, mais enterré dans la popup des sessions
              de la carte. Il est ici parce que c'est ici qu'on vient de
              corriger : on ouvre le corrigé de la classe qu'on vient de finir,
              pas des autres (demande JP, 2026-09-20). */}
          {sessionOuverte && (
            <div className={styles.corrigeToggle}>
              <Toggle
                checked={sessionOuverte.corrigeDisponible}
                onChange={basculerCorrige}
                disabled={corrigeEnCours}
                labelOn={`Corrigé visible pour ${sessionOuverte.classeNom}`}
                labelOff={`Corrigé caché pour ${sessionOuverte.classeNom}`}
              />
            </div>
          )}
        </div>

        {choixNecessaire ? (
          <section className={styles.section}>
            <SessionsListe
              sessions={sessions}
              anneeCourante={calculateSchoolYear()}
              compte={(id) => {
                const copies = travauxBruts.filter((t) => t.sessionId === id);
                return {
                  remises: copies.filter((t) => t.status === 'submitted' && !t.nonRendu).length,
                  total: copies.length,
                };
              }}
              onOuvrir={(s) => choisirSession(s.id)}
              orphelines={orphelines.length}
              onOuvrirOrphelines={() => choisirSession(SANS_CLASSE)}
            />
          </section>
        ) : isOeuvre ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Où en est chacun</h2>
            <OeuvreSuivi
              devoirId={devoirId}
              titreActivite={devoir?.intitule}
              sessionId={sessionActive}
            />
          </section>
        ) : (
        <>
        {/* ── Section Statistiques ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Statistiques</h2>

          {/* Ligne 1 : 4 encadrés principaux */}
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <span className={scoreClass(stats.tauxRemise)}>
                {stats.tauxRemise !== null ? `${stats.tauxRemise}%` : '—'}
              </span>
              <span className={styles.statLabel}>
                Taux de remise
                <span className={styles.statSub}>{stats.submittedCount} / {travaux.length}</span>
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValueSuccess}>{stats.successCount}</span>
              <span className={styles.statLabel}>Réussites ≥ 50%</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValueDanger}>{stats.failureCount}</span>
              <span className={styles.statLabel}>Échecs &lt; 50%</span>
            </div>
            <div className={styles.statCard}>
              <span className={scoreClass(stats.moyenne)}>
                {stats.moyenne !== null ? `${stats.moyenne}%` : '—'}
              </span>
              <span className={styles.statLabel}>Moyenne</span>
            </div>
            <div className={styles.statCard}>
              <span className={scoreClass(stats.mediane)}>
                {stats.mediane !== null ? `${stats.mediane}%` : '—'}
              </span>
              <span className={styles.statLabel}>
                Médiane
                <span className={styles.tooltipWrapper}>
                  <span className={styles.tooltipIcon}>ⓘ</span>
                  <span className={styles.tooltip}>
                    La médiane est la valeur centrale : la moitié des élèves est au-dessus, l&apos;autre moitié en dessous. Moins sensible aux scores extrêmes que la moyenne.
                  </span>
                </span>
              </span>
            </div>
          </div>

          {/* Ligne 2 : critères faibles + distribution */}
          {totalCorriges > 0 && grille && (
            <div className={styles.statsRow2}>
              {/* 3 critères les plus faibles */}
              <div className={`${styles.statCard} ${styles.statCardWide}`}>
                <span className={styles.statCardTitle}>3 critères les plus faibles</span>
                {stats.top3Weak.length === 0 ? (
                  <span className={styles.autresStatsNone}>Pas encore de données</span>
                ) : (
                  <div className={styles.weakCriteriaList}>
                    {stats.top3Weak.map((c, i) => (
                      <div key={i} className={styles.weakCriterionRow}>
                        <span className={styles.weakCriterionName}>{c.name}</span>
                        <div className={styles.weakCriterionBar}>
                          <div
                            className={styles.weakCriterionFill}
                            style={{
                              width: `${c.avgPct}%`,
                              background: c.avgPct < 35 ? 'var(--c-danger)' : c.avgPct < 60 ? 'var(--c-accent)' : 'var(--c-success)',
                            }}
                          />
                        </div>
                        <span className={styles.weakCriterionPct}>{c.avgPct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Distribution par tranches */}
              <div className={`${styles.statCard} ${styles.statCardWide}`}>
                <span className={styles.statCardTitle}>Distribution des résultats</span>
                <div className={styles.distrib}>
                  {[
                    { label: '0–44%', count: stats.distribution.faible, color: 'var(--c-danger)' },
                    { label: '45–64%', count: stats.distribution.insuffisant, color: 'var(--c-accent)' },
                    { label: '65–100%', count: stats.distribution.reussi, color: 'var(--c-primary)' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className={styles.distribRow}>
                      <span className={styles.distribLabel}>{label}</span>
                      <div className={styles.distribBarTrack}>
                        <div
                          className={styles.distribBarFill}
                          style={{
                            width: totalCorriges > 0 ? `${Math.round((count / totalCorriges) * 100)}%` : '0%',
                            background: color,
                          }}
                        />
                      </div>
                      <span className={styles.distribCount}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Statistiques d'écriture (collapsible) */}
          {grille && (
            <div className={styles.autresStats}>
              <button className={styles.autresStatsToggle} onClick={() => setShowEcritureStats((v) => !v)}>
                <span>Statistiques d&apos;écriture</span>
                <span className={styles.autresStatsChevron}>{showEcritureStats ? '▲' : '▼'}</span>
              </button>
              {showEcritureStats && (
                <div className={styles.autresStatsContent}>
                  <div className={styles.autresStatsRow}>
                    <div className={`${styles.autresStatsGroup} ${styles.autresStatsGroupAlert}`}>
                      <span className={styles.autresStatsGroupTitle}>
                        ⚠️ 2 soucis d&apos;écriture ou plus
                        <span className={styles.autresStatsBadge}>{stats.multipleIssuesStudents.length}</span>
                      </span>
                      {renderStudentList(stats.multipleIssuesStudents)}
                    </div>
                  </div>
                  <div className={styles.autresStatsRow}>
                    <div className={styles.autresStatsGroup}>
                      <span className={styles.autresStatsGroupTitle}>
                        Orthographe
                        <span className={styles.autresStatsBadge}>{stats.orthoStudents.length}</span>
                      </span>
                      {renderStudentList(stats.orthoStudents)}
                    </div>
                    <div className={styles.autresStatsGroup}>
                      <span className={styles.autresStatsGroupTitle}>
                        Ponctuation
                        <span className={styles.autresStatsBadge}>{stats.ponctuStudents.length}</span>
                      </span>
                      {renderStudentList(stats.ponctuStudents)}
                    </div>
                    <div className={styles.autresStatsGroup}>
                      <span className={styles.autresStatsGroupTitle}>
                        Syntaxe
                        <span className={styles.autresStatsBadge}>{stats.syntaxeStudents.length}</span>
                      </span>
                      {renderStudentList(stats.syntaxeStudents)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Section Résultats ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Résultats</h2>

          {travaux.length === 0 ? (
            <div className={styles.empty}>
              <span>📝</span>
              <p>Aucun élève dans les classes de ce devoir.</p>
            </div>
          ) : (
            <div className={styles.columns}>
              <div className={styles.column}>
                <h3 className={`${styles.columnTitle} ${styles.columnTitleNotOpened}`}>
                  🔒 Non ouvert par l&apos;élève
                  <span className={styles.columnCount}>{travauxNonOuverts.length}</span>
                </h3>
                {travauxNonOuverts.length === 0 ? (
                  <p className={styles.columnEmpty}>Tous les élèves ont ouvert leur copie.</p>
                ) : (
                  <div className={styles.travauxList}>{travauxNonOuverts.map(renderCard)}</div>
                )}
              </div>

              <div className={styles.column}>
                <h3 className={styles.columnTitle}>
                  📝 À corriger
                  <span className={styles.columnCount}>{travauxNonCorriges.length}</span>
                </h3>
                {travauxNonCorriges.length === 0 ? (
                  <p className={styles.columnEmpty}>Aucun travail à corriger.</p>
                ) : (
                  <div className={styles.travauxList}>{travauxNonCorriges.map(renderCard)}</div>
                )}
              </div>

              <div className={styles.column}>
                <h3 className={`${styles.columnTitle} ${styles.columnTitleCorrected}`}>
                  ✅ Corrigés
                  <span className={styles.columnCount}>{travauxCorriges.length}</span>
                </h3>
                {travauxCorriges.length === 0 ? (
                  <p className={styles.columnEmpty}>Aucun travail corrigé pour l&apos;instant.</p>
                ) : (
                  <div className={styles.travauxList}>{travauxCorriges.map(renderCard)}</div>
                )}
              </div>
            </div>
          )}
        </section>
        </>
        )}
      </main>
      <Footer />
    </div>
  );
}
