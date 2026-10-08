'use client';

// Une lecture de cours (élève FLE) — plan du 2026-10-08.
//
// MÊME ESPACE DE TRAVAIL que les activités (/activites/[id], demande JP du
// 2026-10-08) : la barre du haut (`WorkTopBar`), la COLONNE DE TRAVAIL à gauche
// (six sections en accordéon, la première ouverte) et, à droite, le RAIL
// d'icônes avec son panneau redimensionnable (`WorkspaceRail`) : « Le cours »
// (le texte importé, mots cliquables = dictionnaire) et « Consignes ».
// Les sections se génèrent l'une après l'autre dès l'ouverture ; les réponses
// (questions, exercices, passerelle) partent au serveur au fil de l'eau.
//
// `?eleveId=` : un prof ouvre la lecture d'un élève de sa classe FLE, en
// lecture seule (rien ne se génère depuis son poste).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import WorkTopBar from '@/components/WorkTopBar/WorkTopBar';
import WorkspaceRail from '@/components/WorkspaceRail';
import type { RailTab } from '@/components/WorkspaceRail';
import DictionaryClickLayer from '@/components/DictionaryClickLayer/DictionaryClickLayer';
import EmptyState from '@/components/EmptyState/EmptyState';
import Accordeon from '@/components/Accordeon/Accordeon';
import type { Volet } from '@/components/Accordeon/Accordeon';
import {
  BoutonLu,
  EvaluationLecture,
  Paragraphes,
  raisonBlocage,
  sectionFaite,
  SectionGrammaire,
  SectionPasserelle,
  SectionReformulation,
  SectionResume,
  SectionResumeEleve,
  SectionSaillants,
  SectionVocabulaire,
} from '@/components/LectureCoursSections';
import type { CleCorrection } from '@/components/LectureCoursSections';
import { SECTIONS_GENEREES, SECTIONS_ORDRE, SECTION_LIBELLES, libelleSource } from '@/types/lecture-cours';
import type {
  ContenuGrammaire,
  ContenuPasserelle,
  ContenuReformulation,
  ContenuResume,
  ContenuSaillants,
  ContenuVocabulaire,
  LectureCours,
  SectionCle,
  SectionLecture,
} from '@/types/lecture-cours';
import { langueLabel } from '@/types/niveaux-fle';
import styles from './lecture.module.css';

const DELAI_ENREGISTREMENT = 700;

// Les mêmes icônes que le rail des activités
const ICON_COURS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
// Évaluation : les barres du rail des activités
const ICON_GRILLE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="20" x2="20" y2="20" />
    <rect x="6" y="12" width="3.5" height="6" rx="1" />
    <rect x="12" y="8" width="3.5" height="10" rx="1" />
    <rect x="17" y="4" width="3.5" height="14" rx="1" />
  </svg>
);
const ICON_CONSIGNES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
);

type OngletRail = 'cours' | 'consignes' | 'evaluation';

export default function LectureCoursPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();

  const [lecture, setLectureState] = useState<LectureCours | null>(null);
  // Le dernier état connu, pour la chaîne de génération (qui enchaîne hors
  // du cycle de rendu et doit lire les sections à jour)
  const lectureRef = useRef<LectureCours | null>(null);
  const setLecture = useCallback((maj: (l: LectureCours | null) => LectureCours | null) => {
    lectureRef.current = maj(lectureRef.current);
    setLectureState(lectureRef.current);
  }, []);
  const [erreur, setErreur] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [dernierEnregistrement, setDernierEnregistrement] = useState<Date | null>(null);
  // Le rail : onglet actif et panneau ouvert (le cours, par défaut)
  const [ongletActif, setOngletActif] = useState<OngletRail>('cours');
  const [panneauOuvert, setPanneauOuvert] = useState(true);
  const [dictionnaire, setDictionnaire] = useState(true);
  // Prof en lecture seule : l'id de la fiche élève, lu dans l'URL
  const [eleveIdProf] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('eleveId')
  );

  useEffect(() => {
    if ((authLoading && !isAuthenticated) || redirecting) return;
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
      setRedirecting(true);
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router, redirecting]);

  // ── La chaîne de génération : une section à la fois, dans l'ordre ──
  const enGeneration = useRef(false);

  const genererSection = useCallback(
    async (cle: SectionCle) => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      setLecture((l) =>
        l ? { ...l, sections: { ...l.sections, [cle]: { ...l.sections[cle], statut: 'en-cours', erreur: null } } } : l
      );
      try {
        const res = await fetch(`/api/fle/lectures/${encodeURIComponent(id)}/sections/${cle}`, {
          method: 'POST',
          headers,
        });
        const json = await res.json();
        setLecture((l) => {
          if (!l) return l;
          const section: SectionLecture = json.success
            ? (json.data.section as SectionLecture)
            : { ...l.sections[cle], statut: 'erreur', erreur: json.message || 'Génération impossible.' };
          return { ...l, sections: { ...l.sections, [cle]: section } };
        });
      } catch {
        setLecture((l) =>
          l
            ? {
                ...l,
                sections: {
                  ...l.sections,
                  [cle]: { ...l.sections[cle], statut: 'erreur', erreur: 'Connexion perdue pendant la préparation.' },
                },
              }
            : l
        );
      }
    },
    [getAuthHeaders, id, setLecture]
  );

  // Enchaîne les sections encore à faire, dans l'ordre. Une section en
  // erreur attend « Réessayer » ; une seule chaîne à la fois.
  const enchainer = useCallback(
    async (premiere?: SectionCle) => {
      if (enGeneration.current) return;
      enGeneration.current = true;
      try {
        if (premiere) await genererSection(premiere);
        for (;;) {
          const l = lectureRef.current;
          const suivante = l
            ? SECTIONS_GENEREES.find((c) => ['a-faire', 'en-cours'].includes(l.sections[c].statut))
            : undefined;
          if (!suivante) break;
          await genererSection(suivante);
        }
      } finally {
        enGeneration.current = false;
      }
    },
    [genererSection]
  );

  // Chargement, puis la chaîne (côté élève seulement)
  useEffect(() => {
    if (!isAuthenticated || !id) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/fle/lectures/${encodeURIComponent(id)}`, { headers });
        const json = await res.json();
        if (annule) return;
        if (!json.success) {
          setErreur(json.message || 'Lecture introuvable.');
          return;
        }
        setLecture(() => json.data as LectureCours);
        if (role === 'eleve' && !eleveIdProf) enchainer();
      } catch {
        if (!annule) setErreur('Impossible de charger la lecture.');
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, id, getAuthHeaders, role, eleveIdProf, setLecture, enchainer]);

  const reessayer = (cle: string) => {
    enchainer(cle as SectionCle);
  };

  // ── Les réponses de l'élève : état local tout de suite, serveur un peu après ──
  const enAttente = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const envoyerReponses = useCallback(async () => {
    const paquet = enAttente.current;
    enAttente.current = {};
    if (Object.keys(paquet).length === 0) return;
    setEnregistrement(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/fle/lectures/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reponses: paquet }),
      });
      const json = await res.json();
      if (json.success) setDernierEnregistrement(new Date());
    } catch {
      // L'indicateur reste sur le dernier enregistrement réussi
    } finally {
      setEnregistrement(false);
    }
  }, [getAuthHeaders, id]);

  const repondre = useCallback(
    (cle: string, valeur: unknown) => {
      setLecture((l) => (l ? { ...l, reponses: { ...l.reponses, [cle]: valeur } } : l));
      enAttente.current[cle] = valeur;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(envoyerReponses, DELAI_ENREGISTREMENT);
    },
    [setLecture, envoyerReponses]
  );

  // Le bouton IA : le texte part au serveur, le verdict revient dans `reponses`
  const corriger = useCallback(
    async (cle: CleCorrection, texte: string) => {
      // Ce qui est en attente part d'abord (le texte lui-même, surtout)
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      await envoyerReponses();
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Connexion perdue : reconnecte-toi.');
      const res = await fetch(`/api/fle/lectures/${encodeURIComponent(id)}/corriger`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cle, texte }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Correction impossible.');
      const cleResultat = cle === 'passerelle' ? 'passerelle_correction' : 'resume_eleve_avis';
      setLecture((l) => (l ? { ...l, reponses: { ...l.reponses, [cleResultat]: json.data.resultat } } : l));
    },
    [envoyerReponses, getAuthHeaders, id, setLecture]
  );

  // Ce qui attend encore part quand on quitte la page
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        envoyerReponses();
      }
    },
    [envoyerReponses]
  );

  const modeProf = role === 'prof';

  const volets: Volet[] = useMemo(() => {
    if (!lecture) return [];
    const commun = {
      reponses: lecture.reponses,
      onReponse: modeProf ? undefined : repondre,
      onCorriger: modeProf ? undefined : corriger,
      readOnly: modeProf,
    };
    const rendre = (cle: SectionCle, s: SectionLecture) => {
      // « Mon résumé » n'a pas de contenu généré : c'est l'élève qui écrit
      if (cle === 'resumeEleve') return <SectionResumeEleve {...commun} />;
      if (s.statut !== 'prete' || !s.contenu) return null;
      const corps = (() => {
        switch (cle) {
          case 'resume':
            return <SectionResume contenu={s.contenu as ContenuResume} />;
          case 'saillants':
            return <SectionSaillants contenu={s.contenu as ContenuSaillants} />;
          case 'vocabulaire':
            return (
              <SectionVocabulaire contenu={s.contenu as ContenuVocabulaire} langue={lecture.langue} niveau={lecture.niveau} {...commun} />
            );
          case 'reformulation':
            return <SectionReformulation contenu={s.contenu as ContenuReformulation} {...commun} />;
          case 'grammaire':
            return <SectionGrammaire contenu={s.contenu as ContenuGrammaire} />;
          case 'passerelle':
            return <SectionPasserelle contenu={s.contenu as ContenuPasserelle} {...commun} />;
        }
      })();
      // Le bouton « je continue », à droite, dans chaque section
      const lecturePure = cle === 'resume' || cle === 'saillants' || cle === 'grammaire';
      return (
        <>
          {corps}
          <BoutonLu
            cle={cle}
            libelle={lecturePure ? 'J’ai lu, je continue' : 'J’ai vu, je continue'}
            bloque={raisonBlocage(cle, lecture)}
            {...commun}
          />
        </>
      );
    };
    // Chaque section attend que la précédente soit FAITE (le prof voit tout)
    return SECTIONS_ORDRE.map((cle, i) => {
      const s = lecture.sections[cle];
      const lib = SECTION_LIBELLES[cle];
      const precedente = i > 0 ? SECTIONS_ORDRE[i - 1] : null;
      const verrouille = !modeProf && !!precedente && !sectionFaite(precedente, lecture);
      return {
        cle,
        picto: lib.picto,
        titre: lib.titre,
        sousTitre: lib.sousTitre,
        etat: s.statut,
        erreur: s.erreur,
        contenu: rendre(cle, s),
        verrouille,
        verrouMessage: precedente ? `termine d’abord « ${SECTION_LIBELLES[precedente].titre} »` : undefined,
        fait: sectionFaite(cle, lecture),
      };
    });
  }, [lecture, modeProf, repondre, corriger]);

  if ((authLoading && !isAuthenticated) || redirecting) return null;

  const railTabs: RailTab[] = [
    { id: 'cours', label: 'Le cours', icon: ICON_COURS },
    { id: 'consignes', label: 'Consignes', icon: ICON_CONSIGNES },
  ];
  // Le prof a l'ÉVALUATION : chiffres et retours sur tout ce que l'élève a fait
  if (modeProf) railTabs.push({ id: 'evaluation', label: 'Évaluation', icon: ICON_GRILLE });
  const panelTitle = ongletActif === 'cours' ? 'Le cours' : ongletActif === 'consignes' ? 'Consignes' : 'Évaluation';
  const pretes = lecture ? SECTIONS_GENEREES.filter((c) => lecture.sections[c].statut === 'prete').length : 0;

  return (
    <div className={styles.page}>
      <WorkTopBar
        title={lecture?.titre ?? 'Lecture de cours'}
        status="draft"
        isSaving={enregistrement}
        lastSaved={dernierEnregistrement}
        onSubmit={() => {}}
        hideSubmit
        backHref={modeProf ? '/classes' : '/fle?vue=lectures'}
      />

      <main className={styles.main}>
        {/* Colonne 1 : zone de travail */}
        <div className={styles.colonneTravail}>
          <div className={styles.editorSection}>
            <div className={styles.editorHeader}>
              <h2>Mon travail</h2>
              {lecture && (
                <>
                  <span className={styles.headerAvancement}>
                    {pretes}/{SECTIONS_GENEREES.length} sections prêtes
                  </span>
                  <span className={styles.headerMeta}>
                    {lecture.niveau.toUpperCase()}
                    {lecture.langue ? ` · ${langueLabel(lecture.langue)}` : ''}
                  </span>
                </>
              )}
            </div>
            <div className={styles.editorContent}>
              {erreur ? (
                <EmptyState icon="🔍" message={erreur} />
              ) : !lecture ? (
                <EmptyState icon="hourglass" message="En cours de chargement" />
              ) : (
                <Accordeon volets={volets} ouvertsInitiaux={['resume']} onReessayer={modeProf ? undefined : reessayer} />
              )}
            </div>
          </div>
        </div>

        {/* Colonne 2 (panneau redimensionnable) + rail d'icônes à droite */}
        <WorkspaceRail
          tabs={railTabs}
          activeTab={ongletActif}
          onActiveTabChange={(t) => setOngletActif(t as OngletRail)}
          isOpen={panneauOuvert}
          onIsOpenChange={setPanneauOuvert}
          panelTitle={panelTitle}
          storageKey="lecture-cours-rail-width"
          defaultWidthPercent={36}
        >
          {ongletActif === 'cours' ? (
            // Le texte du cours : chaque mot se cherche dans le dictionnaire de
            // l'app, comme dans la colonne de droite des activités
            <DictionaryClickLayer enabled={dictionnaire && !modeProf}>
              <div className={styles.panneau}>
                {lecture ? (
                  <>
                    <div className={styles.panneauSource}>
                      <span>📄 {libelleSource(lecture.source)}</span>
                      {lecture.source.url && (
                        <a className={styles.panneauLien} href={lecture.source.url} target="_blank" rel="noopener noreferrer">
                          Ouvrir l’original ↗
                        </a>
                      )}
                      {!modeProf && (
                        <label className={styles.panneauLien} title="Clique un mot du cours pour le chercher dans le dictionnaire">
                          <input type="checkbox" checked={dictionnaire} onChange={(e) => setDictionnaire(e.target.checked)} /> dictionnaire
                        </label>
                      )}
                    </div>
                    <Paragraphes texte={lecture.texte} />
                  </>
                ) : (
                  <p className={styles.vide}>Chargement…</p>
                )}
              </div>
            </DictionaryClickLayer>
          ) : ongletActif === 'evaluation' ? (
            <div className={styles.panneau}>
              {lecture ? <EvaluationLecture lecture={lecture} /> : <p className={styles.vide}>Chargement…</p>}
            </div>
          ) : (
            <div className={styles.panneau}>
              <p className={styles.ligne}>
                Ce cours a été écrit pour des élèves francophones. Les six sections de ta colonne de travail
                te le rendent lisible, à ton niveau, avec les mots difficiles expliqués entre parenthèses.
                Elles se préparent l’une après l’autre : commence par la première.
              </p>
              <ul className={styles.consigneListe}>
                {SECTIONS_ORDRE.map((cle) => (
                  <li key={cle} className={styles.consigneItem}>
                    <span className={styles.consignePicto} aria-hidden="true">
                      {SECTION_LIBELLES[cle].picto}
                    </span>
                    <span>
                      <span className={styles.consigneTitre}>{SECTION_LIBELLES[cle].titre}</span>
                      <span className={styles.consigneSous}>{SECTION_LIBELLES[cle].sousTitre}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </WorkspaceRail>
      </main>
    </div>
  );
}
