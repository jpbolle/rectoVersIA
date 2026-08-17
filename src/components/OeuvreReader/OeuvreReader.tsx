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
import { blocsDeFace, estCouverture } from '@/types/oeuvre';
import type { OeuvreSection, OeuvreProgression } from '@/types/oeuvre';
import {
  estAutoCorrigeable,
  partReussite,
  reponseLiseuseVersAnswer,
} from '@/types/lecture';
import type { LectureAnswer, LectureQuestion } from '@/types/lecture';
import ChampManipule, { estTypeManipule } from '@/components/QuestionInteractions';
import OeuvreBlocRendu from './OeuvreBlocRendu';
import styles from './OeuvreReader.module.css';

interface OeuvreReaderProps {
  oeuvreId: string;
  sectionId: string | null;
  /** Titre affiché en tête — vient du sommaire, disponible avant le chargement */
  titreSection?: string;
  groupeSection?: string;
  /** L'œuvre elle-même — servent à composer la page de couverture */
  titreOeuvre?: string;
  auteurOeuvre?: string;
  couverture?: { url: string; fileId: string } | null;
  progression: OeuvreProgression | null;
  /** Position dans le parcours, pour les boutons précédent / suivant */
  peutReculer: boolean;
  peutAvancer: boolean;
  onReculer: () => void;
  onAvancer: () => void;
  /** L'élève a répondu : la section compte dans son total de vérifications */
  onVerificationTerminee: (sectionId: string, reponses: Record<string, unknown>) => void;
  /**
   * L'élève a FAIT quelque chose sur cette scène — consulté le verso, ouvert
   * un commentaire du professeur. Le clic dictionnaire, lui, est signalé
   * depuis la page (la couche du dictionnaire enveloppe toute la colonne).
   * Fait passer la pastille du sommaire au orange.
   */
  onActivite?: (sectionId: string) => void;
  /** Première ouverture d'une section — sert au « lu » et à la fréquence */
  onSectionVue: (sectionId: string) => void;
  /**
   * L'élève a ouvert un commentaire du professeur. Tracé (demande de JP) :
   * ce qu'un élève va chercher renseigne plus que le fait qu'il ait tourné
   * la page.
   */
  onCommentaireOuvert?: (sectionId: string, commentaireId: string) => void;
  lectureSeule?: boolean;
}

export default function OeuvreReader({
  oeuvreId,
  sectionId,
  titreSection,
  groupeSection,
  titreOeuvre,
  auteurOeuvre,
  couverture = null,
  progression,
  peutReculer,
  peutAvancer,
  onReculer,
  onAvancer,
  onVerificationTerminee,
  onSectionVue,
  onCommentaireOuvert,
  onActivite,
  lectureSeule = false,
}: OeuvreReaderProps) {
  const [section, setSection] = useState<OeuvreSection | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [questionnaireOuvert, setQuestionnaireOuvert] = useState(false);
  const [reponses, setReponses] = useState<Record<string, unknown>>({});
  const [devoilees, setDevoilees] = useState<Set<string>>(new Set());
  // ── Les deux faces de la liseuse ──
  // Recto « Espace textuel », verso « Espace multimédia ». Le verso n'apparaît
  // que si le prof y a déposé quelque chose : sur les 67 scènes de Molière,
  // un onglet vide en permanence ne serait que du bruit. Déclaré ICI, avant le
  // chargement : c'est lui qui choisit la face d'arrivée.
  const [face, setFace] = useState<'recto' | 'verso'>('recto');

  // getAuthHeaders vient d'AuthContext et n'est PAS stable : le mettre dans
  // les dépendances d'un effet relance la requête en boucle (gotcha connu du
  // projet). D'où la référence.
  const { getAuthHeaders } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;

  // ── Chargement paresseux de la section ──
  useEffect(() => {
    // La couverture n'est pas une section : rien à charger, et surtout rien à
    // écrire dans la progression — on ne « travaille » pas une couverture.
    if (!sectionId || estCouverture(sectionId)) {
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
        // L'espace d'arrivée est celui que le prof a choisi — à condition
        // qu'il ait quelque chose à montrer : ouvrir sur un multimédia vide
        // donnerait une page blanche pour toute entrée en matière.
        const versoPeuple = blocsDeFace(json.data?.blocs ?? [], 'verso').length > 0;
        setFace(json.data?.facesInversees && versoPeuple ? 'verso' : 'recto');
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

  // ── Le commentaire ouvert ──
  // Un seul à la fois, et sa lecture est un signal d'activité : c'est le 3ᵉ
  // déclencheur de la pastille orange, celui qui manquait.
  const [commentaireOuvert, setCommentaireOuvert] = useState<string | null>(null);
  const ouvrirCommentaire = useCallback(
    (id: string) => {
      setCommentaireOuvert(id);
      if (!sectionId) return;
      onCommentaireOuvert?.(sectionId, id);
      onActivite?.(sectionId);
    },
    [sectionId, onCommentaireOuvert, onActivite]
  );
  const commentaire = useMemo(
    () => (section?.commentaires ?? []).find((c) => c.id === commentaireOuvert) ?? null,
    [section, commentaireOuvert]
  );

  // ── LA COUVERTURE : la première page du livre ──
  // L'élève l'ouvre en arrivant et la tourne comme une page. Elle n'a ni
  // vérification ni face multimédia : c'est un seuil, pas une scène.
  if (estCouverture(sectionId)) {
    return (
      <div className={styles.couverturePage}>
        {couverture && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={couverture.url} alt="" className={styles.couvertureImage} />
        )}
        <h2 className={styles.couvertureTitre}>{titreOeuvre}</h2>
        {auteurOeuvre && <p className={styles.couvertureAuteur}>{auteurOeuvre}</p>}
        {peutAvancer && (
          <button type="button" className={styles.couvertureBouton} onClick={onAvancer}>
            Commencer la lecture →
          </button>
        )}
      </div>
    );
  }

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
            au verso : l'immense majorité des scènes n'a que du texte.
            L'ORDRE suit le choix du prof (`facesInversees`) : une scène qu'on
            aborde par un extrait filmé présente le multimédia en premier. */}
        {aUnVerso && (
          <div className={styles.faces} role="tablist">
            {(section?.facesInversees ? ['verso', 'recto'] : ['recto', 'verso']).map((f) =>
              f === 'recto' ? (
                <button
                  key="recto"
                  type="button"
                  role="tab"
                  aria-selected={face === 'recto'}
                  className={`${styles.face} ${face === 'recto' ? styles.faceActive : ''}`}
                  onClick={() => setFace('recto')}
                >
                  Espace textuel
                </button>
              ) : (
                <button
                  key="verso"
                  type="button"
                  role="tab"
                  aria-selected={face === 'verso'}
                  className={`${styles.face} ${face === 'verso' ? styles.faceActive : ''}`}
                  onClick={() => {
                    setFace('verso');
                    // Aller voir les compléments, c'est travailler la scène —
                    // la pastille du sommaire passe à l'orange.
                    if (sectionId) onActivite?.(sectionId);
                  }}
                >
                  Espace multimédia
                  <span className={styles.faceCompteur}>{blocsVerso.length}</span>
                </button>
              )
            )}
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
                <OeuvreBlocRendu
                  key={bloc.id}
                  bloc={bloc}
                  commentaires={section.commentaires}
                  onCommentaire={ouvrirCommentaire}
                />
              ))}
            </div>
          </>
        )}

        {section && face === 'verso' && (
          // Le verso ne suit jamais les colonnes du texte : une vidéo dans une
          // demi-colonne de Chromebook est inregardable.
          <div className={styles.verso}>
            {/* Quand le multimédia ouvre la scène, c'est lui qui porte la
                phrase de présentation : sans elle, l'élève arriverait sur une
                vidéo sans savoir ce qu'il regarde. */}
            {section.facesInversees && section.chapeau && (
              <p className={styles.chapeau}>{section.chapeau}</p>
            )}
            <p className={styles.versoIntro}>
              {section.facesInversees
                ? 'À voir avant de lire la scène.'
                : 'Les compléments déposés par ton professeur pour cette scène.'}
            </p>
            {blocsVerso.map((bloc) => (
              <OeuvreBlocRendu
                key={bloc.id}
                bloc={bloc}
                commentaires={section.commentaires}
                onCommentaire={ouvrirCommentaire}
              />
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

      {/* ── Le commentaire du professeur ──
          En popup, comme le dictionnaire : c'est le même geste (je bute sur
          quelque chose, j'ouvre, je referme, je reprends ma lecture) et
          l'élève le connaît déjà. */}
      {commentaire && (
        <div
          className={styles.cmtOverlay}
          onClick={(e) => e.target === e.currentTarget && setCommentaireOuvert(null)}
        >
          <div className={styles.cmtFenetre} role="dialog" aria-modal="true">
            <header className={styles.cmtEntete}>
              <span className={styles.cmtMots}>« {commentaire.mots} »</span>
              <button
                type="button"
                className={styles.cmtFermer}
                onClick={() => setCommentaireOuvert(null)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </header>
            <p className={styles.cmtTexte}>{commentaire.texte}</p>
          </div>
        </div>
      )}

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
                  {question.multiple && (
                    <p className={styles.popupSurtitre}>Plusieurs réponses possibles.</p>
                  )}
                  {(question.choices || []).map((choix, i) => {
                    // Réponses multiples : la valeur stockée est un tableau
                    // d'index au lieu d'un index. Le reste ne change pas.
                    const dejaCoches = Array.isArray(reponses[question.id])
                      ? (reponses[question.id] as number[])
                      : [];
                    const choisi = question.multiple
                      ? dejaCoches.includes(i)
                      : reponses[question.id] === i;
                    const devoile = devoilees.has(question.id);
                    const juste = question.multiple
                      ? (question.correctIndexes ?? []).includes(i)
                      : i === question.correctIndex;
                    let classe = styles.choixItem;
                    if (devoile && juste) classe += ` ${styles.choixJuste}`;
                    else if (devoile && choisi) classe += ` ${styles.choixFaux}`;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={classe}
                        disabled={lectureSeule}
                        onClick={() => {
                          if (!question.multiple) return onRepondre(question.id, i);
                          const set = new Set(dejaCoches);
                          if (set.has(i)) set.delete(i);
                          else set.add(i);
                          onRepondre(question.id, [...set].sort((a, b) => a - b));
                        }}
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

              {/* Les types manipulés — même socle que le questionnaire de
                  lecture. Leur réponse n'est pas une valeur simple (un index,
                  un texte) mais un objet `LectureAnswer` : `reponses` est
                  volontairement typé `unknown`, il l'accueille tel quel.

                  `showCorrection` est TOUJOURS vrai ici : dans l'atelier
                  Œuvre le corrigé est ouvert (règle en tête de
                  `oeuvre-server.ts`). Ne pas « corriger » ce comportement. */}
              {(estTypeManipule(question.type) ||
                (question.type === 'fluorage' && !!question.fluoCategories?.length)) && (
                <ChampManipule
                  question={question}
                  answer={(reponses[question.id] as LectureAnswer) ?? {}}
                  onAnswerChange={(partial) =>
                    onRepondre(question.id, {
                      ...((reponses[question.id] as LectureAnswer) ?? {}),
                      ...partial,
                    })
                  }
                  disabled={lectureSeule}
                  showCorrection
                />
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
                  {(question.reponseIdeale || estAutoCorrigeable(question)) &&
                    !devoilees.has(question.id) && (
                      <button
                        type="button"
                        className={styles.navBtn}
                        onClick={() => onRepondre(question.id, reponses[question.id] ?? '')}
                      >
                        Voir la réponse attendue
                      </button>
                    )}

                  {/* Réponse courte auto-corrigée : dans cet atelier le corrigé
                      est ouvert, l'élève voit donc tout de suite si sa réponse
                      est reconnue — et sinon, ce qui était attendu. */}
                  {devoilees.has(question.id) && estAutoCorrigeable(question) && (
                    <p
                      className={
                        partReussite(
                          question,
                          reponseLiseuseVersAnswer(question, reponses[question.id])
                        ) === 1
                          ? styles.verdictJuste
                          : styles.verdictFaux
                      }
                    >
                      {partReussite(
                        question,
                        reponseLiseuseVersAnswer(question, reponses[question.id])
                      ) === 1
                        ? '✅ Réponse juste'
                        : `❌ Attendu : ${(question.reponsesAcceptees ?? []).join(' · ')}`}
                    </p>
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
