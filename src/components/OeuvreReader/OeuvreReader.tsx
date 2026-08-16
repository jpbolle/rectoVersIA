'use client';

// La LISEUSE — colonne de gauche d'une activité « lecture d'une œuvre ».
//
// Elle occupe la place qu'occupent l'éditeur pour l'écriture et le
// questionnaire pour la lecture : une section à la fois, chargée à la demande
// (`/api/oeuvres/[id]/sections/[sectionId]`), jamais l'œuvre entière.
//
// La navigation, elle, vit à droite (OeuvreSommaire, dans l'onglet
// « Consignes et navigation »).
//
// RÈGLE PROPRE À CET ATELIER : le corrigé est ouvert. L'élève voit la bonne
// réponse dès qu'il répond — c'est un outil pour lui, rien n'est noté. Ne pas
// reproduire ce comportement ailleurs (cf. src/lib/oeuvre-server.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { blocsDeFace } from '@/types/oeuvre';
import type { OeuvreSection, OeuvreProgression } from '@/types/oeuvre';
import type { LectureQuestion } from '@/types/lecture';
import OeuvreBlocRendu from './OeuvreBlocRendu';
import styles from './OeuvreReader.module.css';

interface OeuvreReaderProps {
  oeuvreId: string;
  sectionId: string | null;
  /** Titre affiché en tête — vient du sommaire, disponible avant le chargement */
  titreSection?: string;
  groupeSection?: string;
  progression: OeuvreProgression | null;
  /** Position dans le parcours, pour les boutons précédent / suivant */
  peutReculer: boolean;
  peutAvancer: boolean;
  onReculer: () => void;
  onAvancer: () => void;
  /** L'élève a répondu : la section compte dans son total de vérifications */
  onVerificationTerminee: (sectionId: string, reponses: Record<string, unknown>) => void;
  /** Première ouverture d'une section — sert au « lu » et à la fréquence */
  onSectionVue: (sectionId: string) => void;
  lectureSeule?: boolean;
}

export default function OeuvreReader({
  oeuvreId,
  sectionId,
  titreSection,
  groupeSection,
  progression,
  peutReculer,
  peutAvancer,
  onReculer,
  onAvancer,
  onVerificationTerminee,
  onSectionVue,
  lectureSeule = false,
}: OeuvreReaderProps) {
  const [section, setSection] = useState<OeuvreSection | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [questionnaireOuvert, setQuestionnaireOuvert] = useState(false);
  const [reponses, setReponses] = useState<Record<string, unknown>>({});
  const [devoilees, setDevoilees] = useState<Set<string>>(new Set());

  // getAuthHeaders vient d'AuthContext et n'est PAS stable : le mettre dans
  // les dépendances d'un effet relance la requête en boucle (gotcha connu du
  // projet). D'où la référence.
  const { getAuthHeaders } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;

  // ── Chargement paresseux de la section ──
  useEffect(() => {
    if (!sectionId) {
      setSection(null);
      return;
    }
    let annule = false;
    setChargement(true);
    setErreur(null);

    (async () => {
      try {
        const headers = await headersRef.current();
        const res = await fetch(`/api/oeuvres/${oeuvreId}/sections/${sectionId}`, {
          headers: headers || undefined,
        });
        const json = await res.json();
        if (annule) return;
        if (!json.success) throw new Error(json.message || 'Section introuvable');
        setSection(json.data);
        onSectionVue(sectionId);
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        if (!annule) setChargement(false);
      }
    })();

    return () => {
      annule = true;
    };
    // onSectionVue est stable côté appelant (useCallback) — l'inclure
    // relancerait le chargement à chaque rendu du parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oeuvreId, sectionId]);

  // ── Les deux faces de la liseuse ──
  // Recto « Espace textuel », verso « Espace multimédia ». Le verso n'apparaît
  // que si le prof y a déposé quelque chose : sur les 67 scènes de Molière,
  // un onglet vide en permanence ne serait que du bruit.
  const [face, setFace] = useState<'recto' | 'verso'>('recto');
  const blocsRecto = useMemo(() => blocsDeFace(section?.blocs ?? [], 'recto'), [section]);
  const blocsVerso = useMemo(() => blocsDeFace(section?.blocs ?? [], 'verso'), [section]);
  const aUnVerso = blocsVerso.length > 0;

  // Repartir d'un questionnaire propre — et du recto — à chaque changement de
  // scène : on ouvre toujours une scène par son texte.
  useEffect(() => {
    const dejaFait = sectionId ? progression?.sections[sectionId]?.reponses : null;
    setReponses((dejaFait as Record<string, unknown>) || {});
    setDevoilees(new Set(dejaFait ? Object.keys(dejaFait) : []));
    setQuestionnaireOuvert(false);
    setFace('recto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const dejaTerminee = !!(sectionId && progression?.sections[sectionId]?.termineLe);
  const questions = useMemo(() => section?.questions ?? [], [section]);

  const repondre = useCallback((questionId: string, valeur: unknown) => {
    setReponses((r) => ({ ...r, [questionId]: valeur }));
    setDevoilees((d) => new Set(d).add(questionId));
  }, []);

  const terminer = useCallback(() => {
    if (sectionId) onVerificationTerminee(sectionId, reponses);
    setQuestionnaireOuvert(false);
  }, [sectionId, reponses, onVerificationTerminee]);

  if (!sectionId) {
    return (
      <div className={styles.vide}>
        <p>Choisis une scène dans « Consignes et navigation », à droite.</p>
      </div>
    );
  }

  return (
    <div className={styles.liseuse}>
      <header className={styles.entete}>
        {(section?.groupe || groupeSection) && (
          <div className={styles.surtitre}>{section?.groupe || groupeSection}</div>
        )}
        <h2 className={styles.titre}>{section?.titre || titreSection || '…'}</h2>

        {/* Les deux faces — même geste que le recto/verso de l'espace de
            rédaction (FlipEditor). Absentes tant que le prof n'a rien déposé
            au verso : l'immense majorité des scènes n'a que du texte. */}
        {aUnVerso && (
          <div className={styles.faces} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={face === 'recto'}
              className={`${styles.face} ${face === 'recto' ? styles.faceActive : ''}`}
              onClick={() => setFace('recto')}
            >
              Espace textuel
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={face === 'verso'}
              className={`${styles.face} ${face === 'verso' ? styles.faceActive : ''}`}
              onClick={() => setFace('verso')}
            >
              Espace multimédia
              <span className={styles.faceCompteur}>{blocsVerso.length}</span>
            </button>
          </div>
        )}
      </header>

      <div className={styles.corps}>
        {chargement && <p className={styles.info}>Chargement…</p>}
        {erreur && <p className={styles.erreur}>{erreur}</p>}

        {section && face === 'recto' && (
          <>
            {section.chapeau && <p className={styles.chapeau}>{section.chapeau}</p>}

            <div className={section.colonnes === 2 ? styles.texteDeuxColonnes : undefined}>
              {blocsRecto.map((bloc) => (
                <OeuvreBlocRendu key={bloc.id} bloc={bloc} />
              ))}
            </div>
          </>
        )}

        {section && face === 'verso' && (
          // Le verso ne suit jamais les colonnes du texte : une vidéo dans une
          // demi-colonne de Chromebook est inregardable.
          <div className={styles.verso}>
            <p className={styles.versoIntro}>
              Les compléments déposés par ton professeur pour cette scène.
            </p>
            {blocsVerso.map((bloc) => (
              <OeuvreBlocRendu key={bloc.id} bloc={bloc} />
            ))}
          </div>
        )}

        {/* ── Ligne d'actions : forme imposée du projet, deux traits qui
            encadrent les boutons (cf. VocabulaireActivity, LectureQuizActivity).
            Navigation et vérification y tiennent ensemble. ── */}
        <div className={styles.bottomActions}>
          <span className={styles.bottomActionsLine} />
          <div className={styles.bottomActionsRow}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={onReculer}
              disabled={!peutReculer}
            >
              ← Précédent
            </button>

            {questions.length > 0 && (
              <button
                type="button"
                className={`${styles.actionBtn} ${dejaTerminee ? styles.actionBtnFaite : ''}`}
                onClick={() => setQuestionnaireOuvert(true)}
              >
                {dejaTerminee ? '✓ Vérification faite' : 'Vérification de lecture'}
              </button>
            )}

            <button
              type="button"
              className={styles.navBtn}
              onClick={onAvancer}
              disabled={!peutAvancer}
            >
              Suivant →
            </button>
          </div>
          <span className={styles.bottomActionsLine} />
        </div>

        {questions.length > 0 && (
          <p className={styles.indiceActions}>
            {dejaTerminee
              ? 'Déjà complétée — tu peux la rouvrir quand tu veux.'
              : 'Cette scène compte pour ton total de vérifications.'}
          </p>
        )}
      </div>

      {questionnaireOuvert && section && (
        <QuestionnairePopup
          section={section}
          questions={questions}
          reponses={reponses}
          devoilees={devoilees}
          lectureSeule={lectureSeule}
          onRepondre={repondre}
          onFermer={() => setQuestionnaireOuvert(false)}
          onTerminer={terminer}
        />
      )}
    </div>
  );
}

// ─────────────────────────── Le questionnaire en popup ───────────────────────────
//
// En popup et non dans le flux : le texte de la scène reste la page, la
// vérification est un geste qu'on ouvre et qu'on referme — comme les exercices
// de vocabulaire.

interface PopupProps {
  section: OeuvreSection;
  questions: LectureQuestion[];
  reponses: Record<string, unknown>;
  devoilees: Set<string>;
  lectureSeule: boolean;
  onRepondre: (questionId: string, valeur: unknown) => void;
  onFermer: () => void;
  onTerminer: () => void;
}

function QuestionnairePopup({
  section,
  questions,
  reponses,
  devoilees,
  lectureSeule,
  onRepondre,
  onFermer,
  onTerminer,
}: PopupProps) {
  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div className={styles.popup} role="dialog" aria-modal="true">
        <header className={styles.popupEntete}>
          <div>
            <h3>Vérification de lecture</h3>
            <p className={styles.popupSurtitre}>
              {section.groupe ? `${section.groupe} · ` : ''}
              {section.titre}
            </p>
          </div>
          <button type="button" className={styles.popupFermer} onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </header>

        <div className={styles.popupCorps}>
          {questions.map((question, index) => (
            <div key={question.id} className={styles.question}>
              <p className={styles.enonce}>
                {index + 1}. {question.enonce}
              </p>

              {question.document && (
                <div
                  className={styles.documentJoint}
                  dangerouslySetInnerHTML={{ __html: question.document }}
                />
              )}

              {question.type === 'qcm' && (
                <div className={styles.choix}>
                  {(question.choices || []).map((choix, i) => {
                    const choisi = reponses[question.id] === i;
                    const devoile = devoilees.has(question.id);
                    const juste = i === question.correctIndex;
                    let classe = styles.choixItem;
                    if (devoile && juste) classe += ` ${styles.choixJuste}`;
                    else if (devoile && choisi) classe += ` ${styles.choixFaux}`;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={classe}
                        disabled={lectureSeule}
                        onClick={() => onRepondre(question.id, i)}
                      >
                        <span className={styles.choixLettre}>{String.fromCharCode(65 + i)}.</span>
                        <span>{choix}</span>
                        {devoile && (juste || choisi) && (
                          <span className={styles.choixMarque}>{juste ? '✓' : '✕'}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {(question.type === 'texte-court' || question.type === 'texte-long') && (
                <>
                  <textarea
                    className={styles.zoneTexte}
                    rows={question.type === 'texte-long' ? 6 : 3}
                    placeholder="Ta réponse…"
                    disabled={lectureSeule}
                    value={(reponses[question.id] as string) || ''}
                    onChange={(e) =>
                      // On enregistre sans dévoiler : c'est le bouton qui dévoile
                      onRepondre(question.id, e.target.value)
                    }
                  />
                  {question.reponseIdeale && !devoilees.has(question.id) && (
                    <button
                      type="button"
                      className={styles.navBtn}
                      onClick={() => onRepondre(question.id, reponses[question.id] ?? '')}
                    >
                      Voir la réponse attendue
                    </button>
                  )}
                </>
              )}

              {/* Le corrigé, ouvert — décision assumée pour cet atelier */}
              {devoilees.has(question.id) && question.reponseIdeale && (
                <div className={styles.corrige}>
                  <span className={styles.corrigeLabel}>Réponse du professeur</span>
                  <p>{question.reponseIdeale}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <footer className={styles.popupPied}>
          <span className={styles.popupNote}>Corrigé ouvert · aucune note</span>
          <button type="button" className={styles.actionBtn} onClick={onTerminer} disabled={lectureSeule}>
            Terminer
          </button>
        </footer>
      </div>
    </div>
  );
}
