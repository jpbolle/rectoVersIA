
'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import SchemaActivity from '@/components/SchemaActivity/SchemaActivity';
import { basculerMarque, type GenreMarque } from '@/components/Diagram/Pastilles';
import SchemaAideIA from '@/components/SchemaAideIA/SchemaAideIA';
import { useSchemaComparaison } from '@/hooks/useSchemaComparaison';
import PortfolioLecture from '@/components/Portfolio/PortfolioLecture';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAffichage } from '@/hooks/useAffichage';
import { useGrille } from '@/hooks/useGrille';
import { useCorrection, calculateScore } from '@/hooks/useCorrection';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAiGridEvaluation } from '@/hooks/useAiGridEvaluation';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';
import { getDraftType } from '@/lib/draft-utils';
import { blobToDataUrl } from '@/lib/firebase/audio-storage';
import Link from 'next/link';
import AssistancePanel from '@/components/AssistancePanel';
import UserAvatar from '@/components/UserAvatar';
import type { Travail, NonRenduStatus } from '@/types/travail';
import type { Devoir } from '@/types/devoir';
import type { DraftType } from '@/types/travail';
import type { Correction, DraftItemAnnotation } from '@/types/correction';
import { copieCorrigee } from '@/lib/correction-etat';
import { SANS_CLASSE } from '@/types/session';
import RechercheResponseViewer from '@/components/RechercheResponseViewer/RechercheResponseViewer';
import VocabulaireListReadOnly from '@/components/VocabulaireListReadOnly/VocabulaireListReadOnly';
import LectureQuizReview from '@/components/LectureQuizReview/LectureQuizReview';
import AutoEvalReview from '@/components/AutoEvalReview/AutoEvalReview';
import ResizableSplit from '@/components/ResizableSplit/ResizableSplit';
import type { NavigKidQuestion, NavigKidReponse } from '@/types/navigkid';
import styles from './travail-detail.module.css';
import flipStyles from '@/components/FlipEditor/FlipEditor.module.css';

const AnnotationEditor = dynamic(
  () => import('@/components/AnnotationEditor'),
  { ssr: false }
);

const DraftEditor = dynamic(
  () => import('@/components/DraftEditor/DraftEditor'),
  { ssr: false }
);

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function isSuccessLevel(level: number): boolean {
  return level >= 3;
}

export default function TravailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { devoirId, travailId } = params as { devoirId: string; travailId: string };

  const { isAuthenticated, role, user, isLoading: authLoading, getAuthHeaders } = useAuth();
  const { vue: vueAffichage } = useAffichage();
  const iaProfMasquee = vueAffichage('outil:aide-ia-prof').bloque;
  // `user` est un objet instable : on ne garde que son identifiant pour les
  // dépendances d'effet (règle AGENTS.md)
  const uid = user?.uid;
  const [travail, setTravail] = useState<Travail | null>(null);
  const [devoir, setDevoir] = useState<Devoir | null>(null);
  const [travaux, setTravaux] = useState<Travail[]>([]);
  // ⚠ Les corrections des AUTRES copies, lues une seule fois au chargement et
  // jamais rafraîchies — c'est délibéré. Elles servent à ranger le menu
  // déroulant ; si elles suivaient la correction en cours, la copie qu'on vient
  // de noter changerait de place sous la souris et « suivant » ne voudrait plus
  // rien dire. L'ordre se remet à jour au retour sur l'écran.
  const [correctionsCopies, setCorrectionsCopies] = useState<Map<string, Correction>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState(false);

  // NavigKid (type rechercher)
  const [nkQuestions, setNkQuestions] = useState<NavigKidQuestion[]>([]);
  const [nkReponse, setNkReponse] = useState<NavigKidReponse | null>(null);

  const {
    grille,
    isLoading: grilleLoading,
    error: grilleError,
  } = useGrille(devoir?.grille || null);

  // Copie vue EN LECTURE (coprofesseur, 2026-10-04) : la copie et la
  // correction se lisent, rien ne s'enregistre. C'est le droit sur CETTE copie
  // (sa classe) qui décide — une même activité peut viser une classe partagée
  // en écriture et une autre en lecture.
  const lectureSeule = travail?.monAcces === 'lecture';

  const {
    correction,
    isSaving: correctionSaving,
    updateEvaluation,
    updateAnnotatedContent,
    updateAudioAnnotations,
    updateDraftAnnotations,
    updateCommentaireGeneral,
    updateCommentaireGeneralAudio,
    updateQuestionScore,
    updateRechercheScore,
    updateAutoEvalProf,
    updateSchemaMarques,
    toggleVisibility,
  } = useCorrection(
    travailId || null,
    devoirId || null,
    travail?.studentId || null,
    grille,
    lectureSeule
  );

  // IA grille — charger l'évaluation IA (et permettre au prof de la déclencher si pas encore faite)
  const {
    result: aiGridResult,
    isRequesting: aiGridRequesting,
    error: aiGridError,
    requestEvaluation: requestAiGridEval,
  } = useAiGridEvaluation(
    devoir?.accesIA ? travailId : undefined,
    devoir?.accesIA ? devoirId : undefined,
    devoir?.accesIA && grille?.id ? grille.id : undefined,
  );

  const handleProfRequestAiGrid = useCallback(async () => {
    if (!travail?.content) return;
    await requestAiGridEval(travail.content);
  }, [travail?.content, requestAiGridEval]);

  // IA suggestions de réécriture — lecture seule côté prof
  const {
    suggestions: aiSuggestions,
    usedTypes: aiUsedTypes,
  } = useAiSuggestions(
    devoir?.accesIA ? travailId : undefined,
    devoir?.accesIA ? devoirId : undefined,
  );

  // Flip state (recto = face affichee a l'ouverture, swap selon devoir.flipInverted)
  type FlipSide = 'recto' | 'verso';
  const [flipSide, setFlipSide] = useState<FlipSide>('recto');
  const [flipPhase, setFlipPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [isFlipping, setIsFlipping] = useState(false);

  // Selon flipInverted : false → recto = redaction / verso = planification ; true = inverse
  const rectoIsRedaction = !(devoir?.flipInverted ?? false);
  const showingRedaction = rectoIsRedaction ? flipSide === 'recto' : flipSide === 'verso';

  const draftType: DraftType = useMemo(() => getDraftType(grille), [grille]);
  const hasDraft = !!travail?.draftContent;

  const handleFlip = useCallback(() => {
    if (isFlipping) return;
    setIsFlipping(true);
    setFlipPhase('out');
    setTimeout(() => {
      setFlipSide(s => s === 'recto' ? 'verso' : 'recto');
      setFlipPhase('in');
      setTimeout(() => {
        setFlipPhase('idle');
        setIsFlipping(false);
      }, 280);
    }, 280);
  }, [isFlipping]);

  // Draft annotations — enregistrement vocal
  const { isRecording: isDraftRecording, recordingDuration: draftRecordingDuration, startRecording: startDraftRecording, stopRecording: stopDraftRecording } = useAudioRecorder();
  const [draftRecordingItemId, setDraftRecordingItemId] = useState<string | null>(null);

  // Commentaire général — enregistrement vocal
  const { isRecording: isCommentRecording, recordingDuration: commentRecordingDuration, startRecording: startCommentRecording, stopRecording: stopCommentRecording } = useAudioRecorder();
  const [isPlayingComment, setIsPlayingComment] = useState(false);
  const commentAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleDraftAnnotationChange = useCallback((itemId: string, annotation: DraftItemAnnotation) => {
    const current = correction?.draftAnnotations || {};
    const updated = { ...current, [itemId]: annotation };
    // Nettoyer les annotations vides
    if (!annotation.status && !annotation.audio) {
      delete updated[itemId];
    }
    updateDraftAnnotations(updated);
  }, [correction?.draftAnnotations, updateDraftAnnotations]);

  const handleStartDraftRecording = useCallback((itemId: string) => {
    setDraftRecordingItemId(itemId);
    startDraftRecording();
  }, [startDraftRecording]);

  const handleStopDraftRecording = useCallback(async () => {
    const blob = await stopDraftRecording();
    if (blob && draftRecordingItemId) {
      const dataUrl = await blobToDataUrl(blob);
      const current = correction?.draftAnnotations || {};
      const existing = current[draftRecordingItemId] || {};
      const updated = { ...current, [draftRecordingItemId]: { ...existing, audio: dataUrl } };
      updateDraftAnnotations(updated);
    }
    setDraftRecordingItemId(null);
  }, [stopDraftRecording, draftRecordingItemId, correction?.draftAnnotations, updateDraftAnnotations]);

  // Commentaire général — handlers audio
  const handleStopCommentRecording = useCallback(async () => {
    const blob = await stopCommentRecording();
    if (blob) {
      const dataUrl = await blobToDataUrl(blob);
      await updateCommentaireGeneralAudio(dataUrl);
    }
  }, [stopCommentRecording, updateCommentaireGeneralAudio]);

  const handlePlayComment = useCallback(() => {
    if (!correction?.commentaireGeneralAudio) return;
    if (commentAudioRef.current) {
      commentAudioRef.current.pause();
    }
    const audio = new Audio(correction.commentaireGeneralAudio);
    commentAudioRef.current = audio;
    setIsPlayingComment(true);
    audio.onended = () => setIsPlayingComment(false);
    audio.play();
  }, [correction?.commentaireGeneralAudio]);

  const handleStopPlayComment = useCallback(() => {
    if (commentAudioRef.current) {
      commentAudioRef.current.pause();
      commentAudioRef.current.currentTime = 0;
    }
    setIsPlayingComment(false);
  }, []);

  const handleDeleteCommentAudio = useCallback(async () => {
    await updateCommentaireGeneralAudio(undefined);
    if (commentAudioRef.current) {
      commentAudioRef.current.pause();
    }
    setIsPlayingComment(false);
  }, [updateCommentaireGeneralAudio]);

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
        const travailRes = await fetch(`/api/travaux/${travailId}`, { headers });
        const travailJson = await travailRes.json();

        if (travailJson.success) {
          setTravail(travailJson.data);
        } else {
          setError('Travail non trouvé');
          return;
        }

        // Le questionnaire suit la SESSION de cette copie : c'est ce que
        // l'élève a réellement eu sous les yeux, et non la version courante
        // du questionnaire dans Mes Ressources.
        const sessionDeLaCopie = travailJson.data.sessionId;
        const devoirRes = await fetch(
          `/api/devoirs/${devoirId}${sessionDeLaCopie ? `?sessionId=${encodeURIComponent(sessionDeLaCopie)}` : ''}`,
          { headers }
        );
        const devoirJson = await devoirRes.json();

        if (devoirJson.success) {
          setDevoir(devoirJson.data);

          // Si type rechercher, charger le questionnaire et la réponse élève
          if (devoirJson.data.typeTravail === 'rechercher' && devoirJson.data.questionnaireId) {
            try {
              const qRes = await fetch(
                `/api/navigkid/questionnaire?id=${devoirJson.data.questionnaireId}`,
                { headers }
              );
              const qJson = await qRes.json();
              if (qJson.success && qJson.data?.questions) {
                setNkQuestions(qJson.data.questions);
              }

              // Réponse élève depuis la sous-collection
              const rRes = await fetch(
                `/api/navigkid/reponse?questionnaireId=${devoirJson.data.questionnaireId}&eleveId=${travailJson.data.studentId}`,
                { headers }
              );
              const rJson = await rRes.json();
              if (rJson.success && rJson.data) {
                setNkReponse(rJson.data);
              }
            } catch (err) {
              console.error('Erreur fetch navigkid:', err);
            }
          }
        } else {
          setError('Devoir non trouvé');
          return;
        }

        const [travauxRes, correctionsRes] = await Promise.all([
          fetch(`/api/travaux?devoirId=${devoirId}`, { headers }),
          fetch(`/api/corrections?devoirId=${devoirId}`, { headers }),
        ]);
        const travauxJson = await travauxRes.json();

        if (travauxJson.success) {
          setTravaux(travauxJson.data);
        }

        const correctionsJson = await correctionsRes.json();
        if (correctionsJson.success && Array.isArray(correctionsJson.data)) {
          const map = new Map<string, Correction>();
          for (const c of correctionsJson.data) map.set(c.travailId, c);
          setCorrectionsCopies(map);
        }
      } catch (err) {
        console.error('Erreur fetch data:', err);
        setError('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    }

    // `uid` est attendu, pas seulement `isAuthenticated` : au rechargement
    // complet de la page, le rôle vient du cache de session avant que Firebase
    // n'ait rendu l'utilisateur — le jeton était alors nul et le chargement
    // n'aboutissait jamais.
    if (isAuthenticated && role === 'prof' && uid) {
      fetchData();
    }
  }, [isAuthenticated, role, uid, devoirId, travailId, getAuthHeaders]);

  const handleBack = () => {
    // ── Rendre au prof la classe d'où il vient ──
    // Sans le paramètre `session`, la liste des copies rouvre sur l'écran de
    // choix des classes : le prof qui vient de corriger doit re-sélectionner
    // sa 4C à chaque copie (signalé le 2026-09-20). Une copie sans session
    // vient forcément du panier « sans classe » — c'est ce qui le définit.
    const session = travail ? (travail.sessionId ?? SANS_CLASSE) : null;
    router.push(
      `/dashboard/travaux/${devoirId}${session ? `?session=${encodeURIComponent(session)}` : ''}`
    );
  };

  // ── Le menu des copies : celles de la MÊME classe, les non corrigées d'abord ──
  // Une activité peut viser plusieurs classes : passer de la 4C à la 4D d'un
  // coup de flèche n'avait aucun sens (demande JP, 2026-09-20). Une copie sans
  // session vient du panier « sans classe » et n'y côtoie que ses pareilles.
  const copiesTriees = useMemo(() => {
    if (!travail) return travaux;
    const session = travail.sessionId ?? null;
    const memeClasse = travaux.filter((t) => (t.sessionId ?? null) === session);
    // Les mêmes trois états que les colonnes de la liste des copies, pour que
    // les symboles veuillent dire la même chose des deux côtés.
    const rang = (t: Travail): number => {
      if (t.nonRendu) return 2;
      if (t.status === 'draft' && !t.content) return 1;
      return copieCorrigee(devoir, t, correctionsCopies.get(t.id)) ? 2 : 0;
    };
    return [...memeClasse].sort(
      (a, b) => rang(a) - rang(b) || a.studentName.localeCompare(b.studentName)
    );
  }, [travaux, travail, devoir, correctionsCopies]);

  const puceCopie = (t: Travail): string => {
    if (t.nonRendu) return '✅';
    if (t.status === 'draft' && !t.content) return '🔒';
    return copieCorrigee(devoir, t, correctionsCopies.get(t.id)) ? '✅' : '📝';
  };

  const currentIndex = copiesTriees.findIndex(t => t.id === travailId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < copiesTriees.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      const prevTravail = copiesTriees[currentIndex - 1];
      router.push(`/dashboard/travaux/${devoirId}/${prevTravail.id}`);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      const nextTravail = copiesTriees[currentIndex + 1];
      router.push(`/dashboard/travaux/${devoirId}/${nextTravail.id}`);
    }
  };

  const handleSelectTravail = (id: string) => {
    router.push(`/dashboard/travaux/${devoirId}/${id}`);
  };

  // Marquer le travail « non rendu » (justifié / non justifié) — toggle de
  // l'onglet grille d'évaluation
  const handleNonRenduChange = useCallback(async (nonRendu: NonRenduStatus | null) => {
    if (!travail) return;
    setTravail((prev) => (prev ? { ...prev, nonRendu } : prev));
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      await fetch(`/api/travaux/${travail.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ nonRendu }),
      });
    } catch (err) {
      console.error('Erreur enregistrement non rendu:', err);
    }
  }, [travail, getAuthHeaders]);

  // RENDRE VISIBLE = copie RENDUE (2026-10-11) : le serveur la passe en
  // « remis » (cf. PATCH /api/corrections/[id]) ; on suit ici, pour que
  // « Remettre la copie à l'élève » apparaisse sans recharger
  const rendreVisible = async () => {
    const devientVisible = !correction?.visibleParEleve;
    await toggleVisibility();
    const conteneur = devoir?.typeTravail === 'sequence';
    if (devientVisible && !conteneur && travail && travail.status !== 'submitted' && !travail.nonRendu) {
      setTravail((prev) =>
        prev ? { ...prev, status: 'submitted', submittedAt: prev.submittedAt || new Date().toISOString() } : null
      );
    }
  };

  // Pastille du schéma : le clic fait tourner rien → juste → faux → rien
  const poserMarque = useCallback(
    (genre: GenreMarque, id: string) => {
      updateSchemaMarques((actuelles) => basculerMarque(actuelles, genre, id));
    },
    [updateSchemaMarques]
  );

  // Aide IA du prof (atelier de conceptualisation) : un seul état pour le
  // tableau de l'onglet et les pastilles pâles du schéma
  const aideIa = useSchemaComparaison(
    travailId || null,
    devoir?.typeTravail === 'schematiser',
    updateSchemaMarques
  );
  const deciderIa = aideIa.decider;
  const validerSuggestion = useCallback((ligneId: string) => void deciderIa(ligneId, 'accepte'), [deciderIa]);

  // ═══ ÉTAT DE LA COPIE — triple bouton (écriture, conceptualisation,
  // portfolio — JP, 2026-10-11) ═══
  //   Renvoyer pour réécriture : copie MODIFIABLE, corrections visibles,
  //                              onglet « Corrigé » fermé ;
  //   En mode correction       : rien de visible chez l'élève — le prof y
  //                              travaille. Allumé quand la copie est rendue,
  //                              ou, copie pas encore rendue, dès que le prof
  //                              a commencé à corriger ou à évaluer, ou qu'il
  //                              l'a verrouillée (JP) ;
  //   Rendre comme corrigé     : copie rendue, corrections visibles, onglet
  //                              « Corrigé » ouvert.
  // Lu sur deux données existantes : `correction.visibleParEleve` et
  // `travail.status` — aucune donnée neuve.
  // Copie pas encore rendue : « Verrouiller la copie », sous le triple bouton,
  // empêche l'élève de la modifier sans la compter comme rendue.
  type EtatCopie = 'reecriture' | 'correction' | 'corrige';
  const tripleEtat =
    devoir?.typeTravail === 'ecrire' || devoir?.typeTravail === 'schematiser' || devoir?.typeTravail === 'portfolio';
  const profACorrige =
    !!correction &&
    (!!correction.annotatedContent?.replace(/<[^>]*>/g, '').trim() ||
      Object.keys(correction.evaluation ?? {}).length > 0 ||
      !!correction.commentaireGeneral?.trim() ||
      !!correction.commentaireGeneralAudio ||
      Object.keys(correction.schemaMarques?.boites ?? {}).length > 0 ||
      Object.keys(correction.schemaMarques?.liens ?? {}).length > 0);
  const etatCopie: EtatCopie | null =
    correction?.visibleParEleve && travail?.status === 'submitted'
      ? 'corrige'
      : correction?.visibleParEleve && !travail?.verrouille
        ? 'reecriture'
        : travail?.status === 'submitted' || profACorrige || travail?.verrouille
          ? 'correction'
          : null;
  const [changementEtat, setChangementEtat] = useState(false);

  const patchStatut = async (status: 'draft' | 'submitted') => {
    const headers = await getAuthHeaders();
    if (!headers || !travail) throw new Error('Session expirée');
    const res = await fetch(`/api/travaux/${travail.id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Changement impossible');
    setTravail((prev) =>
      prev
        ? { ...prev, status, submittedAt: status === 'draft' ? null : prev.submittedAt || new Date().toISOString() }
        : null
    );
  };

  const patchVerrou = async (verrouille: boolean) => {
    const headers = await getAuthHeaders();
    if (!headers || !travail) throw new Error('Session expirée');
    const res = await fetch(`/api/travaux/${travail.id}`, { method: 'PATCH', headers, body: JSON.stringify({ verrouille }) });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Changement impossible');
    setTravail((prev) => (prev ? { ...prev, verrouille } : null));
  };

  // Verrouiller = reprendre la copie EN MODE CORRECTION : une copie renvoyée
  // pour réécriture perd aussi la vue sur la correction (JP, 2026-10-11)
  const basculerVerrou = async () => {
    if (!travail || changementEtat) return;
    setChangementEtat(true);
    try {
      const verrouiller = !travail.verrouille;
      await patchVerrou(verrouiller);
      if (verrouiller && correction?.visibleParEleve) await toggleVisibility();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Changement impossible');
    } finally {
      setChangementEtat(false);
    }
  };

  const changerEtatCopie = async (cible: EtatCopie) => {
    if (!travail || cible === etatCopie || changementEtat) return;
    setChangementEtat(true);
    try {
      const visible = !!correction?.visibleParEleve;
      if (cible === 'correction') {
        // Ne rend pas la copie : pour l'empêcher d'y toucher, « Verrouiller la copie »
        if (visible) await toggleVisibility();
      } else if (cible === 'corrige') {
        // Publier rend la copie, côté serveur (PATCH /api/corrections/[id]) ;
        // déjà publiée (réécriture), on la rend nous-mêmes
        if (!visible) await rendreVisible();
        else if (travail.status !== 'submitted') await patchStatut('submitted');
      } else {
        // Publier D'ABORD (le serveur rendrait la copie), rouvrir ENSUITE
        if (!visible) await toggleVisibility();
        await patchStatut('draft');
        if (travail.verrouille) await patchVerrou(false);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Changement impossible');
    } finally {
      setChangementEtat(false);
    }
  };

  const handleReturnForCorrection = async () => {
    if (!travail) return;

    const confirmed = window.confirm(
      `Remettre la copie à ${travail.studentName} ? Il pourra de nouveau la modifier, en voyant vos corrections ; le corrigé lui sera refermé jusqu'à la prochaine publication.`
    );

    if (!confirmed) return;

    setIsReturning(true);

    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/travaux/${travail.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'draft' }),
      });

      const json = await res.json();

      if (json.success) {
        setTravail(prev => prev ? { ...prev, status: 'draft', submittedAt: null } : null);
        alert('La copie est remise à l\'élève : il peut de nouveau la modifier.');
      } else {
        alert('Erreur : ' + (json.message || 'Impossible de renvoyer le travail'));
      }
    } catch (err) {
      console.error('Erreur handleReturnForCorrection:', err);
      alert('Erreur lors du renvoi du travail');
    } finally {
      setIsReturning(false);
    }
  };

  // Gestion du clic prof sur un niveau
  const handleProfLevelClick = useCallback((criterionId: string, level: number) => {
    const currentEval = correction?.evaluation || {};
    const newEval = { ...currentEval };

    // Toggle: si deja selectionne, deselectionner
    if (newEval[criterionId] === level) {
      delete newEval[criterionId];
    } else {
      newEval[criterionId] = level;
    }

    updateEvaluation(newEval);
  }, [correction, updateEvaluation]);

  // Score affiché dans le bandeau, à côté du titre. Il ne vaut que pour les
  // dispositifs notés par une GRILLE : lecture, recherche et auto-évaluation
  // portent leur total en tête de leur onglet Évaluation, et l'afficher aussi
  // ici le montrerait deux fois à trente centimètres d'écart.
  const profScore = useMemo<number | null>(() => {
    if (!devoir || !grille || !correction?.evaluation) return null;
    if (devoir.typeTravail !== 'ecrire') return null;
    return calculateScore(correction.evaluation, grille);
  }, [devoir, grille, correction]);

  // Travail remis en retard ?
  const isLate = useMemo(() => {
    if (!devoir?.dateRemise || !travail?.submittedAt) return false;
    const deadline = new Date(devoir.dateRemise);
    deadline.setHours(23, 59, 59, 999);
    return new Date(travail.submittedAt) > deadline;
  }, [devoir?.dateRemise, travail?.submittedAt]);

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
        <button onClick={handleBack} className={styles.backButton}>
          Retour à la liste
        </button>
      </div>
    );
  }

  if (!travail || !devoir) {
    return (
      <div className={styles.errorContainer}>
        <span>📋</span>
        <h2>Données introuvables</h2>
        <button onClick={handleBack} className={styles.backButton}>
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.logoLink}>
            <img src="/logoRecto.png" alt="RectoVerso" className={styles.logoImg} />
          </Link>
          <button className={styles.backBtn} onClick={handleBack}>
            ←
          </button>

          <div className={styles.headerContent}>
            <h1 className={styles.title}>{devoir.intitule}</h1>
            <p className={styles.subtitle}>
              Travail de <strong>{travail.studentName}</strong>
            </p>
          </div>
        </div>

        {copiesTriees.length > 1 && (
          <div className={styles.navigation}>
            <button
              className={styles.navBtn}
              onClick={handlePrevious}
              disabled={!hasPrevious}
              title="Travail précédent"
            >
              ‹
            </button>
            <select
              className={styles.navSelect}
              value={travailId}
              onChange={(e) => handleSelectTravail(e.target.value)}
              title="Sélectionner un élève"
            >
              {copiesTriees.map((t) => (
                <option key={t.id} value={t.id}>
                  {puceCopie(t)} {t.studentName}
                </option>
              ))}
            </select>
            <button
              className={styles.navBtn}
              onClick={handleNext}
              disabled={!hasNext}
              title="Travail suivant"
            >
              ›
            </button>
          </div>
        )}

        <div className={styles.headerRight}>
          <div className={styles.headerActions}>
            {/* Rien à corriger pour la lecture et la recherche : l'élève répond
                à un questionnaire, il ne réécrit pas sa copie */}
            {lectureSeule && (
              <span className={styles.lectureSeuleBadge}>
                Lecture seule{devoir?.auteurNom ? ` — activité de ${devoir.auteurNom}` : ''}
              </span>
            )}
            {!lectureSeule && tripleEtat && (
              <div className={styles.etatBloc}>
              <div className={styles.etatCopie} role="group" aria-label="État de la copie">
                {(
                  [
                    ['reecriture', '↩ Renvoyer pour réécriture', 'La copie redevient modifiable ; l’élève voit vos corrections, pas le corrigé'],
                    ['correction', '✎ En mode correction', 'La copie est rendue ; l’élève ne voit encore rien de votre correction'],
                    ['corrige', '✓ Rendre comme corrigé', 'La copie est rendue ; l’élève voit vos corrections et le corrigé'],
                  ] as [EtatCopie, string, string][]
                ).map(([id, libelle, aide]) => (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.etatCopieBtn} ${etatCopie === id ? styles.etatCopieActif : ''}`}
                    aria-pressed={etatCopie === id}
                    onClick={() => void changerEtatCopie(id)}
                    disabled={changementEtat}
                    title={aide}
                  >
                    {libelle}
                  </button>
                ))}
              </div>
            {/* Copie pas encore rendue : le prof peut la figer sans la rendre */}
            {travail.status !== 'submitted' && (
              <label className={styles.verrouCopie} title="L’élève ne peut plus modifier sa copie ; elle ne compte pas comme rendue">
                <input
                  type="checkbox"
                  checked={!!travail.verrouille}
                  onChange={() => void basculerVerrou()}
                  disabled={changementEtat}
                />
                🔒 Verrouiller la copie
              </label>
            )}
              </div>
            )}
            {!lectureSeule &&
              !tripleEtat &&
              travail.status === 'submitted' &&
              devoir?.typeTravail !== 'lire' &&
              devoir?.typeTravail !== 'rechercher' && (
              <button
                className={styles.returnBtn}
                onClick={handleReturnForCorrection}
                disabled={isReturning}
                title="La copie redevient modifiable ; l'élève garde vos corrections sous les yeux, le corrigé se referme"
              >
                {isReturning ? '...' : '↩ Remettre la copie à l’élève'}
              </button>
            )}

            {!lectureSeule && !tripleEtat && (
            <label className={styles.visibilityToggleBox}>
              <span className={styles.visibilityLabel}>Rendre visible pour cet élève</span>
              <input
                type="checkbox"
                checked={correction?.visibleParEleve || false}
                onChange={rendreVisible}
                className={styles.toggleInput}
              />
              <span className={styles.toggleSwitch} />
            </label>
            )}
          </div>
          <UserAvatar />
        </div>
      </header>

      <main className={styles.main}>
        <ResizableSplit
          storageKey="correction-split"
          left={
            devoir.typeTravail === 'portfolio' ? (
              <div className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                  <h2>Portfolio de l’élève</h2>
                </div>
                {/* Lecture seule, étape par étape ; le groupe s'accepte ou se
                    refuse en tête. Pas de note ici : la grille sur le portfolio
                    entier arrive à l'étape 7 du chantier. */}
                <PortfolioLecture devoirId={devoir.id} travail={travail} getAuthHeaders={getAuthHeaders} />
              </div>
            ) : devoir.typeTravail === 'vocabulaire' ? (
              <div className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                  <h2>Progression vocabulaire</h2>
                </div>
                <VocabulaireListReadOnly
                  travailContent={travail.content}
                  themes={devoir.vocabulaireThemes}
                />
              </div>
            ) : devoir.typeTravail === 'rechercher' ? (
              <div className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                  <h2>Réponses de recherche</h2>
                </div>
                <RechercheResponseViewer
                  questions={nkQuestions}
                  reponse={nkReponse}
                  scores={correction?.rechercheScores}
                  onScoreChange={updateRechercheScore}
                />
              </div>
            ) : devoir.typeTravail === 'autoevaluation' && devoir.autoEvalQuiz ? (
              <div className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                  <h2>Auto-évaluation — vos deux regards</h2>
                </div>
                {/* Le prof répond LUI-MÊME, à l'aveugle : la réponse de
                    l'élève ne se découvre qu'ensuite, question par question. */}
                <AutoEvalReview
                  quiz={devoir.autoEvalQuiz}
                  travailContent={travail.content}
                  profAnswers={correction?.autoEvalProf}
                  onProfAnswerChange={updateAutoEvalProf}
                />
              </div>
            ) : devoir.typeTravail === 'schematiser' ? (
              <div className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                  <h2>Schéma de l’élève</h2>
                  <div className={styles.statusBadge}>
                    {travail.status === 'submitted' ? (
                      <>
                        <span className={styles.statusIcon}>✓</span>
                        <span>Remis le {new Date(travail.submittedAt!).toLocaleDateString('fr-BE')}</span>
                      </>
                    ) : (
                      <>
                        <span className={styles.statusIcon}>📝</span>
                        <span>Brouillon</span>
                      </>
                    )}
                  </div>
                </div>
                {/* Lecture seule : le prof zoome, déplace la vue, exporte ;
                    il commente dans le commentaire général (O5-A du plan) et
                    POSE SES PASTILLES d'un clic sur une boîte ou un lien :
                    rien → ✓ juste → ✗ faux → rien (étape 3, 2026-10-11). */}
                <div style={{ flex: 1, minHeight: 520, display: 'flex', flexDirection: 'column' }}>
                  <SchemaActivity
                    devoir={devoir}
                    content={travail.content}
                    readOnly
                    marques={correction?.schemaMarques ?? {}}
                    onMarque={lectureSeule ? undefined : poserMarque}
                    // Propositions de l'aide IA : pastilles pâles, justification au survol
                    suggestions={aideIa.suggestions}
                    onSuggestion={lectureSeule ? undefined : validerSuggestion}
                  />
                </div>
              </div>
            ) : devoir.typeTravail === 'lire' && devoir.lectureQuiz ? (
              <div className={styles.contentSection}>
                <div className={styles.sectionHeader}>
                  <h2>Questionnaire de lecture</h2>
                </div>
                <LectureQuizReview
                  quiz={devoir.lectureQuiz}
                  travailContent={travail.content}
                  questionScores={correction?.questionScores}
                  onQuestionScoreChange={updateQuestionScore}
                />
              </div>
            ) : (
            <div className={styles.contentSection}>
              <div className={styles.sectionHeader}>
                <h2>Contenu du travail</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isLate && <span className={styles.lateBadge}>En retard</span>}
                  <div className={styles.statusBadge}>
                    {travail.status === 'submitted' ? (
                      <>
                        <span className={styles.statusIcon}>✓</span>
                        <span>Remis le {new Date(travail.submittedAt!).toLocaleDateString('fr-BE')}</span>
                      </>
                    ) : (
                      <>
                        <span className={styles.statusIcon}>📝</span>
                        <span>Brouillon</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Flip bar — visible seulement si l'élève a un brouillon */}
              {hasDraft && (
                <div className={flipStyles.flipBar}>
                  <div className={flipStyles.flipToggle}>
                    <button
                      type="button"
                      className={`${flipStyles.flipButton} ${flipSide === 'recto' ? flipStyles.flipButtonActive : ''}`}
                      onClick={() => flipSide !== 'recto' && handleFlip()}
                      disabled={isFlipping}
                    >
                      <span className={flipStyles.flipIcon}>{rectoIsRedaction ? '✏️' : '📝'}</span>
                      <span className={flipStyles.flipLabel}>
                        {rectoIsRedaction ? 'Texte de l’élève' : 'Planification de l’élève'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`${flipStyles.flipButton} ${flipSide === 'verso' ? flipStyles.flipButtonActive : ''}`}
                      onClick={() => flipSide !== 'verso' && handleFlip()}
                      disabled={isFlipping}
                    >
                      <span className={flipStyles.flipIcon}>{rectoIsRedaction ? '📝' : '✏️'}</span>
                      <span className={flipStyles.flipLabel}>
                        {rectoIsRedaction ? 'Planification de l’élève' : 'Texte de l’élève'}
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className={flipStyles.flipAction}
                    onClick={handleFlip}
                    disabled={isFlipping}
                    title={`Retourner vers ${showingRedaction ? 'Brouillon' : 'Texte'}`}
                  >
                    <span className={`${flipStyles.flipActionIcon} ${isFlipping ? flipStyles.spinning : ''}`}>
                      🔄
                    </span>
                    <span className={flipStyles.flipActionText}>Retourner</span>
                  </button>
                </div>
              )}

              {/* Contenu avec animation flip */}
              <div className={flipStyles.flipContainer}>
                <div
                  className={`
                    ${flipStyles.flipCard}
                    ${flipPhase === 'out' ? flipStyles.flipOut : ''}
                    ${flipPhase === 'in' ? flipStyles.flipIn : ''}
                  `}
                >
                  {showingRedaction ? (
                    <div className={flipStyles.cardFace}>
                      {travail.content ? (
                        <AnnotationEditor
                          studentContent={travail.content}
                          annotatedContent={correction?.annotatedContent}
                          audioAnnotations={correction?.audioAnnotations}
                          correctionId={`CORR-${travailId}`}
                          onAnnotatedContentChange={updateAnnotatedContent}
                          onAudioAnnotationsChange={updateAudioAnnotations}
                          aiSuggestions={devoir.accesIA ? aiSuggestions : undefined}
                        />
                      ) : (
                        <div className={styles.contentBox}>
                          <p className={styles.emptyContent}>Aucun contenu rédigé</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={flipStyles.cardFace}>
                      {travail.draftContent ? (
                        <DraftEditor
                          draftType={draftType}
                          draft={travail.draftContent}
                          onChange={() => {}}
                          disabled={true}
                          draftAnnotations={correction?.draftAnnotations || {}}
                          onAnnotationChange={handleDraftAnnotationChange}
                          isRecording={isDraftRecording}
                          recordingItemId={draftRecordingItemId}
                          recordingDuration={draftRecordingDuration}
                          onStartRecording={handleStartDraftRecording}
                          onStopRecording={handleStopDraftRecording}
                        />
                      ) : (
                        <div className={styles.contentBox}>
                          <p className={styles.emptyContent}>Aucun brouillon</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )
          }
          right={
            <div className={styles.evaluationSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderTop}>
                  <div className={styles.sectionHeaderLeft}>
                    <h2>Outils d&apos;évaluation et de correction</h2>
                  </div>
                  <div className={styles.sectionHeaderRight}>
                    {correctionSaving && (
                      <span className={styles.savingIndicator}>Sauvegarde...</span>
                    )}
                    {profScore !== null && (
                      <span className={styles.scoreDisplay}>{profScore}%</span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.assistanceWrapper}>
                <AssistancePanel
                  devoir={devoir}
                  aideIaProf={
                    // Gestion de l'affichage : l'aide IA du prof peut être masquée
                    devoir.typeTravail === 'schematiser' && !iaProfMasquee ? (
                      <SchemaAideIA
                        comparaison={aideIa.comparaison}
                        enCours={aideIa.enCours}
                        erreur={aideIa.erreur}
                        comparer={() => void aideIa.comparer()}
                        decider={(ligneId, decision) => void aideIa.decider(ligneId, decision)}
                        aCorrige={!!devoir.schema?.corrige}
                        marques={correction?.schemaMarques}
                        lectureSeule={lectureSeule}
                      />
                    ) : undefined
                  }
                  grille={grille}
                  grilleLoading={grilleLoading}
                  grilleError={grilleError}
                  selfEvaluation={travail.selfEvaluation || null}
                  onSelfEvaluationChange={updateEvaluation}
                  disabled={false}
                  studentName={travail.studentName}
                  correction={correction}
                  studentContent={travail.content}
                  showRemarquesTab={false}
                  isProfessorView={true}
                  nonRendu={travail.nonRendu ?? null}
                  onNonRenduChange={lectureSeule ? undefined : handleNonRenduChange}
                  accesIA={!!devoir.accesIA}
                  showAiData={!!devoir.accesIA}
                  aiGridResult={aiGridResult}
                  aiGridRequesting={aiGridRequesting}
                  aiGridError={aiGridError}
                  onRequestAiGrid={handleProfRequestAiGrid}
                  studentRessourceAnnotations={travail.ressourceAnnotations}
                  studentRessourceImageShapes={travail.ressourceImageShapes}
                  studentRessourceNotes={travail.ressourceNotes}
                  consignesCochees={travail.consignesCochees ?? []}
                  navigkidQuestions={nkQuestions.length > 0 ? nkQuestions : undefined}
                  navigkidReponse={nkReponse}
                  vocabState={devoir.typeTravail === 'vocabulaire' && travail?.content ? (() => { try { return JSON.parse(travail.content); } catch { return null; } })() : undefined}
                />
              </div>

              {/* Commentaire général du professeur */}
              <div className={styles.commentSection}>
                <h3 className={styles.commentTitle}>Commentaire général</h3>
                <div className={styles.commentRow}>
                  <textarea
                    className={styles.commentTextarea}
                    value={correction?.commentaireGeneral || ''}
                    onChange={(e) => updateCommentaireGeneral(e.target.value)}
                    placeholder="Commentaire écrit pour l'élève..."
                    rows={3}
                  />
                  <div className={styles.commentAudioCol}>
                    {isCommentRecording ? (
                      <div className={styles.commentRecording}>
                        <span className={styles.commentRecDot} />
                        <span className={styles.commentRecTime}>
                          {Math.floor(commentRecordingDuration / 60).toString().padStart(2, '0')}:{(commentRecordingDuration % 60).toString().padStart(2, '0')}
                        </span>
                        <button
                          type="button"
                          className={styles.commentStopBtn}
                          onClick={handleStopCommentRecording}
                          title="Arrêter l'enregistrement"
                        >
                          ■
                        </button>
                      </div>
                    ) : correction?.commentaireGeneralAudio ? (
                      <div className={styles.commentAudioPlayback}>
                        <button
                          type="button"
                          className={styles.commentPlayBtn}
                          onClick={isPlayingComment ? handleStopPlayComment : handlePlayComment}
                          title={isPlayingComment ? 'Arrêter' : 'Écouter'}
                        >
                          {isPlayingComment ? '⏸' : '▶'}
                        </button>
                        <button
                          type="button"
                          className={styles.commentDeleteAudioBtn}
                          onClick={handleDeleteCommentAudio}
                          title="Supprimer"
                        >
                          🗑
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.commentMicBtn}
                        onClick={startCommentRecording}
                        title="Enregistrer un commentaire vocal"
                      >
                        🎤
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          }
        />
      </main>
    </div>
  );
}
