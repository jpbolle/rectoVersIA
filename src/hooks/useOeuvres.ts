'use client';

// La bibliothèque d'œuvres, côté prof : les miennes, celles marquées comme
// exemples, et celles des collègues (qu'on peut dupliquer pour les remanier).
//
// Le chargement est CONDITIONNEL : `actif` à faux, on ne demande rien. Le
// formulaire de création appelle ce hook sans condition — règle des hooks —
// mais ne paie la requête que si l'atelier « lecture d'une œuvre » est choisi.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Oeuvre } from '@/types/oeuvre';

export function useOeuvres(actif = true) {
  const [oeuvres, setOeuvres] = useState<Oeuvre[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // getAuthHeaders est instable (AuthContext) : passer par une référence, sans
  // quoi l'effet se relance à chaque rendu.
  const { getAuthHeaders } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await headersRef.current();
      const res = await fetch('/api/oeuvres', { headers: headers || undefined });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Chargement impossible');
      // Les trois paniers dans un seul tableau : à la création d'activité, un
      // prof veut voir tout ce qu'il peut donner, pas trois listes.
      const toutes: Oeuvre[] = [
        ...(json.data || []),
        ...(json.shared || []),
        ...(json.otherProfs || []),
      ];
      setOeuvres(toutes.filter((o) => !o.archive));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!actif) return;
    charger();
  }, [actif, charger]);

  return { oeuvres, loading, error, recharger: charger };
}
