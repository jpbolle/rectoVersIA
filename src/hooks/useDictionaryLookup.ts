'use client';

import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { DictionaryAction } from '@/types/dictionary';

// Cache client partagé entre l'éditeur, le panneau latéral et le bloc dictionnaire
const clientCache = new Map<string, string[]>();

export function useDictionaryLookup() {
  const { getAuthHeaders } = useAuth();

  const lookup = useCallback(
    async (word: string, action: DictionaryAction): Promise<string[]> => {
      const normalized = word.trim().toLowerCase();
      const key = `${action}:${normalized}`;
      const cached = clientCache.get(key);
      if (cached) return cached;

      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');
      const res = await fetch(
        `/api/dictionary?word=${encodeURIComponent(normalized)}&action=${action}`,
        { headers }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erreur dictionnaire');
      clientCache.set(key, json.data.items);
      return json.data.items;
    },
    [getAuthHeaders]
  );

  return { lookup };
}
