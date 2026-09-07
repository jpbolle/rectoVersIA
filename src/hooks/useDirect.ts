'use client';

// Mode Compétition, côté navigateur : interroger le serveur une fois par
// seconde, et n'afficher la question qu'à l'heure DITE par le serveur.
//
// ── Pourquoi ce n'est pas juste un `setInterval` de fetch ──
//
// Le serveur ne répond pas « voici la question, affiche-la » mais « elle
// démarre à 20 h 14 min 03,120 s ». Chaque navigateur l'a donc en main une
// seconde ou deux AVANT son départ, et l'affiche à l'heure convenue : le
// décalage de l'interrogation devient invisible, et les 25 chronos de la
// classe partent ensemble. C'est ce qui rend le podium honnête sans avoir
// besoin d'une ligne réseau poussée (SSE) — écartée le 2026-09-07 parce
// qu'un proxy du VPS peut la mettre en tampon sans rien dire.
//
// Reste le décalage des HORLOGES : un Chromebook peut être à trois secondes
// de l'heure du serveur. On ne s'y fie donc jamais — `serverNow`, renvoyé à
// chaque interrogation, sert à mesurer l'écart et à le retrancher.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { MancheSommaireItem, MancheVue } from '@/types/manche';

/** Rythme de l'interrogation, en millisecondes. */
const PERIODE_MS = 1000;

export interface EtatDirect {
  /** Ce que le serveur dit — `null` tant qu'aucune manche n'est ouverte */
  vue: MancheVue | null;
  /**
   * Pourquoi il n'y a rien à montrer. « refuse » veut dire que la partie
   * EXISTE mais qu'elle n'est pas pour cet utilisateur (mauvaise classe,
   * collègue qui n'en est pas l'auteur) — à ne surtout pas confondre avec
   * « aucune », qui est l'état normal hors partie.
   */
  motif: 'aucune' | 'refuse' | null;
  /** Prof : la liste des questions, chargée UNE FOIS (elle ne bouge pas) */
  sommaire: MancheSommaireItem[];
  /** La question a-t-elle DÉMARRÉ ? (faux pendant le compte à rebours) */
  demarree: boolean;
  /** Secondes restantes au chrono, arrondies vers le haut ; 0 hors question */
  reste: number;
  /** Secondes avant le départ, pendant le compte à rebours (3, 2, 1) */
  avantDepart: number;
  isLoading: boolean;
}

interface Options {
  sessionId?: string;
  /** Côté élève : sa classe désigne la session, il n'a pas à la connaître */
  devoirId?: string;
  /** Suspendre l'interrogation (onglet en arrière-plan, partie finie) */
  actif?: boolean;
}

export function useDirect({ sessionId, devoirId, actif = true }: Options): EtatDirect & {
  piloter: (action: string, options?: { chronoSec?: number; index?: number }) => Promise<void>;
  repondre: (
    questionId: string,
    answer: unknown
  ) => Promise<{ accepte: boolean; motif?: string }>;
} {
  const { getAuthHeaders } = useAuth();
  const [vue, setVue] = useState<MancheVue | null>(null);
  const [motif, setMotif] = useState<'aucune' | 'refuse' | null>(null);
  const [sommaire, setSommaire] = useState<MancheSommaireItem[]>([]);
  // Le sommaire ne se demande qu'une fois : trente-neuf énoncés n'ont rien à
  // faire dans une requête qui part chaque seconde.
  const sommaireDemande = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  // Un tic local à 10 Hz : il fait vivre le chrono à l'écran entre deux
  // interrogations, sans demander quoi que ce soit au serveur.
  const [, tic] = useState(0);

  /** Horloge du serveur − horloge locale, en millisecondes. */
  const decalageRef = useRef(0);

  const query = sessionId
    ? `sessionId=${encodeURIComponent(sessionId)}`
    : devoirId
    ? `devoirId=${encodeURIComponent(devoirId)}`
    : null;

  const lire = useCallback(async () => {
    if (!query) {
      setIsLoading(false);
      return;
    }
    const headers = await getAuthHeaders();
    // ⚠ Piège maison (INIT.md, « spinner infini ») : sortir ici SANS éteindre
    // le chargement laisse l'écran sur « Chargement… » pour toujours — c'est
    // exactement ce qui arrive dans une fenêtre où personne n'est connecté.
    // On éteint TOUJOURS, et c'est à l'écran de dire qu'il faut se connecter.
    if (!headers) {
      setIsLoading(false);
      return;
    }
    try {
      const veutSommaire = !sommaireDemande.current;
      const res = await fetch(
        `/api/direct/etat?${query}${veutSommaire ? '&sommaire=1' : ''}`,
        { headers, cache: 'no-store' }
      );
      const json = await res.json();
      if (!json.success) return;
      const data = json.data as MancheVue | null;
      if (data) decalageRef.current = new Date(data.serverNow).getTime() - Date.now();
      setVue(data);
      setMotif(data ? null : (json.motif ?? 'aucune'));
      if (data?.sommaire) {
        setSommaire(data.sommaire);
        sommaireDemande.current = true;
      }
    } catch {
      // Une interrogation perdue n'est pas un incident : la suivante arrive
      // dans une seconde. Surtout ne rien effacer à l'écran entre-temps.
    } finally {
      setIsLoading(false);
    }
  }, [query, getAuthHeaders]);

  useEffect(() => {
    if (!actif || !query) return;
    lire();
    const t = setInterval(lire, PERIODE_MS);
    return () => clearInterval(t);
  }, [actif, query, lire]);

  // Le chrono affiché avance tout seul entre deux réponses du serveur
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => tic((n) => n + 1), 100);
    return () => clearInterval(t);
  }, [actif]);

  const piloter = useCallback(
    async (action: string, options?: { chronoSec?: number; index?: number }) => {
      if (!sessionId) return;
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/direct/pilote', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action, ...options }),
      });
      const json = await res.json();
      // On applique la réponse du pilotage sans attendre l'interrogation
      // suivante : le prof vient de cliquer, son écran doit répondre.
      if (json.success && json.data) setVue(json.data as MancheVue);
    },
    [sessionId, getAuthHeaders]
  );

  const repondre = useCallback(
    async (questionId: string, answer: unknown) => {
      const headers = await getAuthHeaders();
      if (!headers) return { accepte: false };
      const res = await fetch('/api/direct/reponse', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, devoirId, questionId, answer }),
      });
      const json = await res.json();
      // ⚠ On ne marque « a répondu » que si le serveur a VRAIMENT accepté.
      // Le faire dans tous les cas fermait l'écran sur un refus (chrono
      // expiré, réponse vide) : l'élève croyait avoir répondu, et rien n'était
      // parti.
      const accepte = json.success && json.data?.ok === true;
      if (accepte) setVue((v) => (v ? { ...v, aRepondu: true } : v));
      // Le MOTIF remonte jusqu'à l'écran : « ça n'est pas parti » sans dire
      // pourquoi laisse l'élève recliquer, et nous chercher à l'aveugle.
      return { accepte, motif: json.data?.motif as string | undefined };
    },
    [sessionId, devoirId, getAuthHeaders]
  );

  // ── Le calcul qui fait tout : où en est-on de la question ? ──
  const maintenant = Date.now() + decalageRef.current;
  const debut = vue?.debutAt ? new Date(vue.debutAt).getTime() : null;
  const enQuestion = vue?.phase === 'question' && debut !== null;
  const demarree = enQuestion && maintenant >= debut!;
  const avantDepart = enQuestion && !demarree ? Math.ceil((debut! - maintenant) / 1000) : 0;
  const reste =
    demarree && vue
      ? Math.max(0, Math.ceil((debut! + vue.chronoSec * 1000 - maintenant) / 1000))
      : 0;

  // Une question relancée doit rendre la main à l'élève : le sommaire dit ce
  // qui a déjà été posé, la vue dit ce qui court.
  return { vue, motif, sommaire, demarree, reste, avantDepart, isLoading, piloter, repondre };
}
