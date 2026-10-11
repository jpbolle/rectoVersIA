'use client';

// GESTION DE L'AFFICHAGE côté client : un seul fetch partagé entre tous les
// composants (cache module, patron `useDidactique`). En attendant la réponse,
// tout est visible — un atelier masqué peut apparaître un instant au premier
// chargement, jamais l'inverse.
//
// Usage : `const { vue } = useAffichage(); const v = vue('atelier:portfolio');`
// puis `v.bloque` (grisé / absent), `v.enTest` (badge), `v.masqueAuxProfs`
// (étiquette pour l'admin et les testeurs), `v.note` (survol).

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { vueAffichage, type AffichageResolu, type VueAffichage } from '@/types/affichage';

// Le cache vaut pour UN utilisateur (`voitMasque` dépend de qui il est) :
// changement de compte dans l'onglet = cache vidé
let cache: AffichageResolu | null = null;
let cacheUid: string | null = null;
let inflight: Promise<AffichageResolu | null> | null = null;
const listeners = new Set<(a: AffichageResolu) => void>();

// Le panneau admin, après un enregistrement : met à jour le cache et prévient
// les composants montés
export function setAffichageCache(a: AffichageResolu) {
  cache = a;
  listeners.forEach((fn) => fn(a));
}

export function useAffichage() {
  const { getAuthHeaders, isAuthenticated, user } = useAuth();
  const uid = user?.uid ?? null;
  if (cacheUid !== uid) {
    cache = null;
    cacheUid = uid;
  }
  const [affichage, setAffichage] = useState<AffichageResolu | null>(cache);

  useEffect(() => {
    listeners.add(setAffichage);
    return () => {
      listeners.delete(setAffichage);
    };
  }, []);

  useEffect(() => {
    if (cache || !isAuthenticated) return;
    let annule = false;
    (async () => {
      if (!inflight) {
        inflight = (async () => {
          try {
            const headers = await getAuthHeaders();
            if (!headers) return null;
            const res = await fetch('/api/affichage', { headers });
            const json = await res.json();
            if (json.success && json.data && cacheUid === uid) {
              cache = json.data as AffichageResolu;
              return cache;
            }
            return null;
          } catch (err) {
            console.error('Erreur fetch affichage:', err);
            return null;
          } finally {
            inflight = null;
          }
        })();
      }
      const resultat = await inflight;
      if (!annule && resultat) setAffichage(resultat);
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, getAuthHeaders, uid]);

  const vue = useCallback((cle: string): VueAffichage => vueAffichage(affichage, cle), [affichage]);
  return { affichage, vue };
}
