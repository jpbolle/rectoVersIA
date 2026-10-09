'use client';

// Le portfolio côté ÉLÈVE : le parcours (étapes, renvois résolus), le contenu
// de la copie, l'étape ouverte, et les gestes — déposer un texte, cocher une
// étape sans trace, aller à une étape. Partagé par la colonne 1
// (`PortfolioActivity`) et le rail (`PortfolioSommaire`), qui doivent voir la
// même étape courante.
//
// Chaque geste écrit UN champ (`patchPortfolio`), jamais la copie entière :
// c'est ce qui prépare la co-édition d'équipe (étape 3 du chantier) sans tout
// réécrire. La frappe dans un champ est différée de 800 ms.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  CONTENU_ELEVE_VIDE,
  fermee,
  indexDepart,
  lireContenuEleve,
  type ParcoursPortfolio,
} from '@/lib/portfolio-etat';
import { aUnDepotGroupe, cleChamp, type CamaradeVue, type GroupeVue, type PortfolioContenuEleve } from '@/types/portfolio';
import type { PortfolioPatch } from '@/types/travail';

const DELAI_FRAPPE_MS = 800;

interface Options {
  devoirId: string | null;
  content: string | null | undefined;
  patchPortfolio?: (patch: PortfolioPatch) => Promise<boolean>;
  lectureSeule?: boolean;
}

export function usePortfolioEleve({ devoirId, content, patchPortfolio, lectureSeule = false }: Options) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [parcours, setParcours] = useState<ParcoursPortfolio | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Rechargé quand l'élève revient sur l'onglet : il a peut-être remis une
  // activité renvoyée entre-temps
  const [fraicheur, setFraicheur] = useState(0);
  useEffect(() => {
    const auRetour = () => setFraicheur((n) => n + 1);
    window.addEventListener('focus', auRetour);
    return () => window.removeEventListener('focus', auRetour);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !devoirId) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/devoirs/${devoirId}/parcours-portfolio`, { headers });
        const json = await res.json();
        if (annule) return;
        if (json.success) setParcours(json.data as ParcoursPortfolio);
        else setErreur(json.message || 'Impossible de charger le portfolio.');
      } catch {
        if (!annule) setErreur('Impossible de charger le portfolio.');
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, getAuthHeaders, devoirId, fraicheur]);

  // ── Le groupe (dépôt « groupe ») : chargé seulement si une étape en porte un ──
  const [groupe, setGroupe] = useState<GroupeVue | null>(null);
  const [camarades, setCamarades] = useState<CamaradeVue[]>([]);
  const [groupeErreur, setGroupeErreur] = useState<string | null>(null);
  const [groupeChargement, setGroupeChargement] = useState(false);
  const aGroupe = !!parcours && aUnDepotGroupe(parcours.etapes);
  const chargerGroupe = useCallback(async () => {
    if (!devoirId) return;
    setGroupeChargement(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/portfolio/groupe?devoirId=${encodeURIComponent(devoirId)}`, { headers });
      const json = await res.json();
      if (json.success) {
        setGroupe((json.data?.groupe as GroupeVue | null) ?? null);
        setCamarades((json.data?.camarades as CamaradeVue[]) ?? []);
      }
    } catch {
      // Le groupe reste tel qu'il était
    } finally {
      setGroupeChargement(false);
    }
  }, [devoirId, getAuthHeaders]);
  useEffect(() => {
    if (aGroupe && !lectureSeule) void chargerGroupe();
  }, [aGroupe, lectureSeule, chargerGroupe, fraicheur]);

  const appelGroupe = useCallback(
    async (method: 'POST' | 'PATCH', body: Record<string, unknown>) => {
      setGroupeErreur(null);
      try {
        const headers = await getAuthHeaders();
        if (!headers) return false;
        const res = await fetch('/api/portfolio/groupe', { method, headers, body: JSON.stringify(body) });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Action impossible');
        setGroupe((json.data as GroupeVue | null) ?? null);
        return true;
      } catch (e) {
        setGroupeErreur(e instanceof Error ? e.message : 'Action impossible');
        return false;
      }
    },
    [getAuthHeaders]
  );
  const declarerGroupe = useCallback(
    (membres: string[]) => appelGroupe('POST', { devoirId, membres }),
    [appelGroupe, devoirId]
  );
  const repondreGroupe = useCallback(
    (groupeId: string, action: 'confirmer' | 'decliner' | 'quitter') => appelGroupe('PATCH', { groupeId, action }),
    [appelGroupe]
  );

  // Le contenu de la copie, avec les frappes pas encore envoyées par-dessus,
  // et le statut du groupe (dérivé) pour que `faite()` lise un dépôt « groupe »
  const contenuBase = useMemo(() => lireContenuEleve(content), [content]);
  const [brouillon, setBrouillon] = useState<Record<string, string>>({});
  const contenu: PortfolioContenuEleve = useMemo(
    () => ({ ...contenuBase, reponses: { ...contenuBase.reponses, ...brouillon }, groupeStatut: groupe?.statut ?? null }),
    [contenuBase, brouillon, groupe]
  );

  // L'étape ouverte : là où l'élève en était, tant qu'il n'en choisit pas une autre
  const [choix, setChoix] = useState<string | null>(null);
  const etapes = useMemo(() => parcours?.etapes ?? [], [parcours]);
  const index = useMemo(() => {
    if (etapes.length === 0) return 0;
    if (choix) {
      const i = etapes.findIndex((e) => e.id === choix);
      if (i >= 0) return i;
    }
    return indexDepart(etapes, contenu);
    // Le départ ne se recalcule pas à chaque frappe : seulement quand le
    // parcours ou le choix change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapes, choix]);

  // ── Les gestes ──
  const minuteries = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const allerA = useCallback(
    (etapeId: string) => {
      const i = etapes.findIndex((e) => e.id === etapeId);
      if (i < 0 || fermee(etapes, i, contenu)) return;
      setChoix(etapeId);
      if (!lectureSeule && patchPortfolio) void patchPortfolio({ derniereEtape: etapeId });
    },
    [etapes, contenu, lectureSeule, patchPortfolio]
  );

  const deposer = useCallback(
    (etapeId: string, depotId: string, texte: string) => {
      if (lectureSeule || !patchPortfolio) return;
      const cle = cleChamp(etapeId, depotId);
      setBrouillon((b) => ({ ...b, [cle]: texte }));
      const m = minuteries.current;
      const existante = m.get(cle);
      if (existante) clearTimeout(existante);
      m.set(
        cle,
        setTimeout(async () => {
          m.delete(cle);
          const ok = await patchPortfolio({ reponses: { [cle]: texte } });
          // Envoyé (ou refusé) : la copie fait foi, le brouillon s'efface
          if (ok) setBrouillon((b) => {
            const { [cle]: _envoye, ...reste } = b;
            void _envoye;
            return reste;
          });
        }, DELAI_FRAPPE_MS)
      );
    },
    [lectureSeule, patchPortfolio]
  );

  // Envoi forcé des frappes en attente quand l'écran disparaît
  useEffect(() => {
    const m = minuteries.current;
    return () => {
      m.forEach((t) => clearTimeout(t));
    };
  }, []);

  const cocher = useCallback(
    (etapeId: string, coche: boolean) => {
      if (lectureSeule || !patchPortfolio) return;
      const cochees = coche
        ? [...new Set([...contenu.cochees, etapeId])]
        : contenu.cochees.filter((c) => c !== etapeId);
      void patchPortfolio({ cochees });
    },
    [lectureSeule, patchPortfolio, contenu.cochees]
  );

  return {
    parcours,
    erreur,
    etapes,
    contenu: parcours ? contenu : CONTENU_ELEVE_VIDE,
    index,
    etape: etapes[index] ?? null,
    allerA,
    deposer,
    cocher,
    recharger: () => setFraicheur((n) => n + 1),
    // Le groupe
    groupe,
    camarades,
    groupeErreur,
    groupeChargement,
    declarerGroupe,
    repondreGroupe,
  };
}

export type PortfolioEleve = ReturnType<typeof usePortfolioEleve>;
