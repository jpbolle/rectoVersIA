'use client';

// La comparaison IA d'une copie de schéma (prof) : chargée, lancée, décidée.
// Partagée par le tableau de l'onglet « Aide IA » et par le schéma de l'élève
// (colonne de gauche), où chaque proposition non décidée apparaît en
// PASTILLE PÂLE avec sa justification au survol (option A de JP, 2026-10-11).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { marqueDeLigne, type ComparaisonSchema, type Decision, type LigneComparaison } from '@/lib/schema-comparaison';
import type { SuggestionsMarques } from '@/components/Diagram/Pastilles';
import type { SchemaMarques } from '@/types/correction';

export function useSchemaComparaison(
  travailId: string | null,
  actif: boolean,
  poserMarques: (transformer: (actuelles: SchemaMarques) => SchemaMarques) => void
) {
  const { getAuthHeaders } = useAuth();
  const [comparaison, setComparaison] = useState<ComparaisonSchema | null | undefined>(undefined);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // La référence suit l'état : deux décisions rapprochées partent du bon état
  const ref = useRef<ComparaisonSchema | null | undefined>(undefined);
  useEffect(() => {
    ref.current = comparaison;
  }, [comparaison]);

  useEffect(() => {
    if (!actif || !travailId) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/ai/schema-comparaison?travailId=${encodeURIComponent(travailId)}`, { headers });
        const json = await res.json();
        if (!annule) setComparaison(json.success ? (json.data as ComparaisonSchema | null) : null);
      } catch {
        if (!annule) setComparaison(null);
      }
    })();
    return () => {
      annule = true;
    };
  }, [actif, travailId, getAuthHeaders]);

  const comparer = useCallback(async () => {
    if (!travailId) return;
    if (ref.current && !window.confirm('Relancer la comparaison ? Vos ✓ et ✗ seront perdus (les pastilles restent).')) return;
    setEnCours(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée');
      const res = await fetch('/api/ai/schema-comparaison', { method: 'POST', headers, body: JSON.stringify({ travailId }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Comparaison impossible');
      setComparaison(json.data as ComparaisonSchema);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Comparaison impossible');
    } finally {
      setEnCours(false);
    }
  }, [travailId, getAuthHeaders]);

  const decider = useCallback(
    async (ligneId: string, decision: Decision | null) => {
      const c = ref.current;
      const ligne = c?.lignes.find((l) => l.id === ligneId);
      if (!c || !ligne || !travailId) return;
      const avant = c.decisions[ligneId];
      const decisions = { ...c.decisions };
      if (decision) decisions[ligneId] = decision;
      else delete decisions[ligneId];
      const suivante = { ...c, decisions };
      ref.current = suivante;
      setComparaison(suivante);
      // La pastille suit : ✓ la pose ; retirer le ✓ ou refuser l'enlève (si c'est bien la sienne)
      const m = marqueDeLigne(ligne, c.type);
      if (m && (decision === 'accepte' || avant === 'accepte')) {
        poserMarques((actuelles) => {
          const dico = { ...(actuelles[m.genre] ?? {}) };
          if (decision === 'accepte') dico[m.id] = m.valeur;
          else if (dico[m.id] === m.valeur) delete dico[m.id];
          return { ...actuelles, [m.genre]: dico };
        });
      }
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        await fetch('/api/ai/schema-comparaison', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ travailId, ligneId, decision }),
        });
      } catch {
        setErreur('La décision n’a pas pu être enregistrée.');
      }
    },
    [travailId, getAuthHeaders, poserMarques]
  );

  // Pour le schéma : les propositions (non refusées) par élément visé
  const suggestions = useMemo<SuggestionsMarques | undefined>(() => {
    if (!comparaison) return undefined;
    const out: SuggestionsMarques = { boites: {}, liens: {} };
    for (const l of comparaison.lignes) {
      const d = comparaison.decisions[l.id];
      if (d === 'refuse') continue;
      const m = marqueDeLigne(l, comparaison.type);
      if (!m) continue;
      out[m.genre][m.id] = { valeur: m.valeur, texte: texteDeLigne(l), ligneId: l.id, acceptee: d === 'accepte' };
    }
    return out;
  }, [comparaison]);

  return { comparaison, enCours, erreur, comparer, decider, suggestions };
}

const STATUTS: Record<string, string> = {
  present: 'Présent',
  absent: 'Absent',
  en_trop: 'En trop',
  juste: 'Juste',
  faux: 'Faux',
};

/**
 * La justification d'une ligne, au survol (🤖 du tableau) — sans répéter le
 * statut, déjà affiché en étiquette (JP, 2026-10-11). null : rien à dire de
 * plus que l'étiquette, donc pas d'icône.
 */
export function justificationDeLigne(l: LigneComparaison): string | null {
  const morceaux: string[] = [];
  if (l.statut === 'faux' && l.corrige) morceaux.push(`attendu : ${l.corrige}`);
  if (l.statut === 'present' && l.corrige && l.eleve && l.corrige.toLowerCase() !== l.eleve.toLowerCase()) {
    morceaux.push(`dans le corrigé : ${l.corrige}`);
  }
  if (l.commentaire) morceaux.push(l.commentaire);
  return morceaux.length ? `Corrigé IA : ${morceaux.join(' — ')}` : null;
}

/** Au survol d'une pastille du schéma : la justification, ou à défaut le statut. */
export function texteDeLigne(l: LigneComparaison): string {
  return justificationDeLigne(l) ?? `Corrigé IA : ${STATUTS[l.statut] ?? l.statut}`;
}
