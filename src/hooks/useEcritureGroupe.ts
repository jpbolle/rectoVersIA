'use client';

// LA COPIE DE GROUPE côté élève (plan 2026-10-11-ecriture-collective-portfolio,
// phase 2 — option A « la main tourne », serveur : `ecriture-groupe-server.ts`).
//
//  - interroge `GET /api/travaux/groupe` toutes les 3 s (en pause quand
//    l'onglet est caché) : texte commun + qui a la main ;
//  - celui qui A LA MAIN écrit dans son texte local, envoyé 1,5 s après sa
//    dernière frappe ; l'interrogation ne l'écrase jamais ;
//  - les autres lisent le texte du serveur, éditeur figé ;
//  - en quittant la page, la main est rendue.
//
// `actif === false` : l'activité n'est pas une copie de groupe pour cet
// élève (étape personnelle, pas de groupe accepté, travail seul) — la page
// garde la copie individuelle.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';

const PERIODE_MS = 3000;
const DEBOUNCE_MS = 1500;

export interface EtatEcritureGroupe {
  actif: true;
  contenu: string;
  version: number;
  main: { nom: string; moi: boolean } | null;
  membres: string[];
  remise: boolean;
}

export function useEcritureGroupe(devoirId: string | null, enabled: boolean) {
  const { getAuthHeaders } = useAuthContext();
  const [etat, setEtat] = useState<EtatEcritureGroupe | null>(null);
  const [inactif, setInactif] = useState(false);
  // Le texte de celui qui a la main — `null` quand on ne l'a pas
  const [local, setLocal] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const enAttente = useRef<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Le texte local, lisible dans les rappels sans les recréer à chaque frappe
  const localRef = useRef<string | null>(null);
  useEffect(() => {
    localRef.current = local;
  }, [local]);

  const appel = useCallback(
    async (action: string, contenu?: string): Promise<EtatEcritureGroupe | null> => {
      if (!devoirId) return null;
      const headers = await getAuthHeaders();
      if (!headers) return null;
      const res = await fetch('/api/travaux/groupe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ devoirId, action, contenu }),
        keepalive: action === 'rendre',
      });
      const json = await res.json();
      return json.data && json.data.actif ? (json.data as EtatEcritureGroupe) : null;
    },
    [devoirId, getAuthHeaders]
  );

  // Recevoir un état : on perd la main → le texte local s'efface (il est déjà
  // enregistré, sauf les dernières secondes si un camarade l'a reprise)
  const recevoir = useCallback((e: EtatEcritureGroupe | null) => {
    if (!e) return;
    setEtat(e);
    if (!e.main?.moi && localRef.current !== null) {
      setLocal(null);
      enAttente.current = null;
    }
  }, []);

  // L'interrogation régulière
  useEffect(() => {
    if (!enabled || !devoirId) return;
    let annule = false;
    let t: ReturnType<typeof setInterval> | null = null;
    const lire = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const json = await (await fetch(`/api/travaux/groupe?devoirId=${encodeURIComponent(devoirId)}`, { headers })).json();
        if (annule || !json.success) return;
        if (!json.data?.actif) {
          // Copie individuelle : plus rien à interroger
          setInactif(true);
          if (t) clearInterval(t);
          return;
        }
        recevoir(json.data as EtatEcritureGroupe);
      } catch {
        // Réseau capricieux : on réessaie au tour suivant
      }
    };
    t = setInterval(lire, PERIODE_MS);
    void lire();
    return () => {
      annule = true;
      if (t) clearInterval(t);
    };
  }, [enabled, devoirId, getAuthHeaders, recevoir]);

  const envoyer = useCallback(async () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    const texte = enAttente.current;
    if (texte === null) return;
    enAttente.current = null;
    try {
      const e = await appel('ecrire', texte);
      if (e && !e.main?.moi) setMessage(`${e.main?.nom ?? 'Un camarade'} a pris la main.`);
      recevoir(e);
    } catch {
      // Le texte reste à l'écran ; il repartira à la prochaine frappe
      enAttente.current = texte;
    }
  }, [appel, recevoir]);

  /** Une frappe de celui qui a la main. */
  const ecrire = useCallback(
    (contenu: string) => {
      if (localRef.current === null) return;
      setLocal(contenu);
      enAttente.current = contenu;
      if (minuteur.current) clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => void envoyer(), DEBOUNCE_MS);
    },
    [envoyer]
  );

  /** Prendre la main (clic dans le texte). */
  const prendre = useCallback(async () => {
    setMessage(null);
    const e = await appel('prendre');
    if (!e) return;
    setEtat(e);
    if (e.main?.moi) {
      localRef.current = e.contenu;
      setLocal(e.contenu);
    }
    else if (e.main) setMessage(`${e.main.nom} écrit en ce moment.`);
  }, [appel]);

  /** Rendre la main — ce qui n'est pas encore parti part d'abord. */
  const rendre = useCallback(async () => {
    await envoyer();
    recevoir(await appel('rendre'));
    setLocal(null);
  }, [appel, envoyer, recevoir]);

  /** Remettre la copie pour tout le groupe. */
  const remettre = useCallback(async (): Promise<boolean> => {
    await envoyer();
    const e = await appel('remettre');
    if (!e) return false;
    setLocal(null);
    setEtat(e);
    return true;
  }, [appel, envoyer]);

  // En quittant la page : envoyer le reste et rendre la main
  const jAiLaMain = !!etat?.main?.moi;
  useEffect(() => {
    if (!jAiLaMain) return;
    const quitter = () => {
      void envoyer().finally(() => void appel('rendre'));
    };
    window.addEventListener('pagehide', quitter);
    return () => {
      window.removeEventListener('pagehide', quitter);
    };
  }, [jAiLaMain, envoyer, appel]);
  useEffect(
    () => () => {
      if (localRef.current !== null) void appel('rendre');
    },
    [appel]
  );

  const actif = !!etat && !inactif;
  return {
    actif,
    etat,
    jAiLaMain: actif && jAiLaMain,
    // Ce que montre l'éditeur : mon texte si j'ai la main, sinon celui du groupe
    contenu: local ?? etat?.contenu ?? '',
    message,
    ecrire,
    prendre,
    rendre,
    remettre,
  };
}
