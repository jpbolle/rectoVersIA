'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Devoir, CreateDevoirData } from '@/types/devoir';

export function useDevoirs() {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [devoirs, setDevoirs] = useState<Devoir[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevoirs = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/devoirs', { headers });
      const json = await res.json();

      if (json.success) {
        setDevoirs(json.data);
      } else {
        setError(json.message || 'Erreur lors du chargement');
      }
    } catch (err) {
      console.error('Erreur fetchDevoirs:', err);
      setError('Erreur lors du chargement des devoirs');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  const createDevoir = useCallback(
    async (data: CreateDevoirData) => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifie');

      const res = await fetch('/api/devoirs', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        await fetchDevoirs();
        return json;
      } else {
        throw new Error(json.message || 'Erreur lors de la creation');
      }
    },
    [getAuthHeaders, fetchDevoirs]
  );

  const updateDevoir = useCallback(
    async (id: string, data: Partial<Devoir>) => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifie');

      const res = await fetch(`/api/devoirs/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        await fetchDevoirs();
        return json;
      } else {
        throw new Error(json.message || 'Erreur lors de la mise a jour');
      }
    },
    [getAuthHeaders, fetchDevoirs]
  );

  const toggleDisponible = useCallback(
    async (id: string, disponible: boolean) => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifie');

      // Mise a jour optimiste
      setDevoirs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, disponible } : d))
      );

      try {
        const res = await fetch(`/api/devoirs/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ disponible }),
        });

        const json = await res.json();
        if (!json.success) {
          // Rollback en cas d'erreur
          await fetchDevoirs();
          throw new Error(json.message);
        }
      } catch (err) {
        await fetchDevoirs();
        throw err;
      }
    },
    [getAuthHeaders, fetchDevoirs]
  );

  const toggleAccesIA = useCallback(
    async (id: string, accesIA: boolean) => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifie');

      // Mise a jour optimiste
      setDevoirs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, accesIA } : d))
      );

      try {
        const res = await fetch(`/api/devoirs/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ accesIA }),
        });

        const json = await res.json();
        if (!json.success) {
          await fetchDevoirs();
          throw new Error(json.message);
        }
      } catch (err) {
        await fetchDevoirs();
        throw err;
      }
    },
    [getAuthHeaders, fetchDevoirs]
  );

  const toggleArchive = useCallback(
    async (id: string, archive: boolean) => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifie');

      // Mise a jour optimiste
      setDevoirs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, archive } : d))
      );

      try {
        const res = await fetch(`/api/devoirs/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ archive }),
        });

        const json = await res.json();
        if (!json.success) {
          await fetchDevoirs();
          throw new Error(json.message);
        }
      } catch (err) {
        await fetchDevoirs();
        throw err;
      }
    },
    [getAuthHeaders, fetchDevoirs]
  );

  const toggleCorrige = useCallback(
    async (id: string, corrige: boolean) => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifie');

      setDevoirs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, corrige } : d))
      );

      try {
        const res = await fetch(`/api/devoirs/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ corrige }),
        });

        const json = await res.json();
        if (!json.success) {
          await fetchDevoirs();
          throw new Error(json.message);
        }
      } catch (err) {
        await fetchDevoirs();
        throw err;
      }
    },
    [getAuthHeaders, fetchDevoirs]
  );

  const toggleCorrigeDisponible = useCallback(
    async (id: string, corrigeDisponible: boolean) => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifie');

      setDevoirs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, corrigeDisponible } : d))
      );

      try {
        const res = await fetch(`/api/devoirs/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ corrigeDisponible }),
        });

        const json = await res.json();
        if (!json.success) {
          await fetchDevoirs();
          throw new Error(json.message);
        }
      } catch (err) {
        await fetchDevoirs();
        throw err;
      }
    },
    [getAuthHeaders, fetchDevoirs]
  );

  const deleteDevoir = useCallback(
    async (id: string) => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifie');

      const res = await fetch(`/api/devoirs/${id}`, {
        method: 'DELETE',
        headers,
      });

      const json = await res.json();

      if (json.success) {
        setDevoirs((prev) => prev.filter((d) => d.id !== id));
        return json;
      } else {
        throw new Error(json.message || 'Erreur lors de la suppression');
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchDevoirs();
    }
  }, [isAuthenticated, fetchDevoirs]);

  return {
    devoirs,
    isLoading,
    error,
    createDevoir,
    updateDevoir,
    toggleDisponible,
    toggleAccesIA,
    toggleArchive,
    toggleCorrige,
    toggleCorrigeDisponible,
    deleteDevoir,
    refetch: fetchDevoirs,
  };
}

