'use client';

// Référentiel FLE côté client : un seul fetch partagé entre tous les
// composants (cache module), défauts servis en attendant. Jumeau de
// `useDidactique` — cache SÉPARÉ, pour que les deux référentiels ne se
// marchent pas dessus (gotcha consigné dans harnais/memoire/rollup_fle.md).

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_DIDACTIQUE_FLE } from '@/types/didactique-fle';
import type { DidactiqueFleConfig } from '@/types/didactique-fle';

let cache: DidactiqueFleConfig | null = null;
let inflight: Promise<DidactiqueFleConfig | null> | null = null;
const listeners = new Set<(config: DidactiqueFleConfig) => void>();

// Utilisé par le panneau admin après un enregistrement : met à jour le cache
// et prévient les composants montés
export function setDidactiqueFleCache(config: DidactiqueFleConfig) {
  cache = config;
  listeners.forEach((fn) => fn(config));
}

export function useDidactiqueFle() {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const [config, setConfig] = useState<DidactiqueFleConfig>(cache ?? DEFAULT_DIDACTIQUE_FLE);
  const [isLoading, setIsLoading] = useState(!cache);

  useEffect(() => {
    listeners.add(setConfig);
    return () => {
      listeners.delete(setConfig);
    };
  }, []);

  useEffect(() => {
    if (cache || !isAuthenticated) return;

    let cancelled = false;
    const load = async () => {
      if (!inflight) {
        inflight = (async () => {
          try {
            const headers = await getAuthHeaders();
            if (!headers) return null;
            const res = await fetch('/api/didactique-fle', { headers });
            const json = await res.json();
            if (json.success && json.data) {
              cache = json.data as DidactiqueFleConfig;
              return cache;
            }
            return null;
          } catch (err) {
            console.error('Erreur fetch didactique FLE:', err);
            return null;
          } finally {
            inflight = null;
          }
        })();
      }
      const result = await inflight;
      if (!cancelled) {
        if (result) setConfig(result);
        setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, getAuthHeaders]);

  return { config, isLoading };
}
