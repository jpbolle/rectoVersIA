'use client';

// Configuration didactique (UAA + gestes) côté client : un seul fetch partagé
// entre tous les composants (cache module), défauts servis en attendant.

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_DIDACTIQUE } from '@/types/didactique';
import type { DidactiqueConfig } from '@/types/didactique';

let cache: DidactiqueConfig | null = null;
let inflight: Promise<DidactiqueConfig | null> | null = null;
const listeners = new Set<(config: DidactiqueConfig) => void>();

// Utilisé par le panneau admin après un enregistrement : met à jour le cache
// et prévient les composants montés
export function setDidactiqueCache(config: DidactiqueConfig) {
  cache = config;
  listeners.forEach((fn) => fn(config));
}

export function useDidactique() {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const [config, setConfig] = useState<DidactiqueConfig>(cache ?? DEFAULT_DIDACTIQUE);
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
            const res = await fetch('/api/didactique', { headers });
            const json = await res.json();
            if (json.success && json.data) {
              cache = json.data as DidactiqueConfig;
              return cache;
            }
            return null;
          } catch (err) {
            console.error('Erreur fetch didactique:', err);
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
