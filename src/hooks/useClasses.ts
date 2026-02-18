'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Classe, Eleve, CreateClasseData, CreateEleveData } from '@/types/classe';

export function useClasses() {
  const { user, isAuthenticated } = useAuth();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async () => {
    if (!user) return null;
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [user]);

  const fetchClasses = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/classes', { headers });
      const json = await res.json();

      if (json.success) {
        setClasses(json.data);
      } else {
        setError(json.message || 'Erreur lors du chargement');
      }
    } catch (err) {
      console.error('Erreur fetchClasses:', err);
      setError('Erreur lors du chargement des classes');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  const createClasse = useCallback(
    async (data: CreateClasseData): Promise<Classe> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch('/api/classes', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        setClasses((prev) => [...prev, json.data].sort((a, b) => a.nom.localeCompare(b.nom)));
        return json.data;
      } else {
        throw new Error(json.message || 'Erreur lors de la création');
      }
    },
    [getAuthHeaders]
  );

  const updateClasse = useCallback(
    async (id: string, data: Partial<Classe>): Promise<Classe> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch(`/api/classes/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        setClasses((prev) =>
          prev
            .map((c) => (c.id === id ? json.data : c))
            .sort((a, b) => a.nom.localeCompare(b.nom))
        );
        return json.data;
      } else {
        throw new Error(json.message || 'Erreur lors de la mise à jour');
      }
    },
    [getAuthHeaders]
  );

  const deleteClasse = useCallback(
    async (id: string): Promise<void> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch(`/api/classes/${id}`, {
        method: 'DELETE',
        headers,
      });

      const json = await res.json();

      if (json.success) {
        setClasses((prev) => prev.filter((c) => c.id !== id));
      } else {
        throw new Error(json.message || 'Erreur lors de la suppression');
      }
    },
    [getAuthHeaders]
  );

  const toggleArchive = useCallback(
    async (id: string, archive: boolean): Promise<void> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch(`/api/classes/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ archive }),
      });

      const json = await res.json();

      if (json.success) {
        setClasses((prev) =>
          prev.map((c) => (c.id === id ? { ...c, archive } : c))
        );
      } else {
        throw new Error(json.message || 'Erreur lors de la mise à jour');
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchClasses();
    }
  }, [isAuthenticated, fetchClasses]);

  return {
    classes,
    isLoading,
    error,
    createClasse,
    updateClasse,
    deleteClasse,
    toggleArchive,
    refetch: fetchClasses,
  };
}

export function useEleves(classeId?: string) {
  const { user, isAuthenticated } = useAuth();
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async () => {
    if (!user) return null;
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [user]);

  const fetchEleves = useCallback(async () => {
    if (!classeId) {
      setEleves([]);
      return;
    }

    const headers = await getAuthHeaders();
    if (!headers) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/eleves?classeId=${classeId}`, { headers });
      const json = await res.json();

      if (json.success) {
        setEleves(json.data);
      } else {
        setError(json.message || 'Erreur lors du chargement');
      }
    } catch (err) {
      console.error('Erreur fetchEleves:', err);
      setError('Erreur lors du chargement des élèves');
    } finally {
      setIsLoading(false);
    }
  }, [classeId, getAuthHeaders]);

  const createEleve = useCallback(
    async (data: Omit<CreateEleveData, 'classeId'>): Promise<Eleve> => {
      if (!classeId) throw new Error('Aucune classe sélectionnée');

      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch('/api/eleves', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...data, classeId }),
      });

      const json = await res.json();

      if (json.success) {
        setEleves((prev) =>
          [...prev, json.data].sort((a, b) => a.nom.localeCompare(b.nom))
        );
        return json.data;
      } else {
        throw new Error(json.message || 'Erreur lors de la création');
      }
    },
    [classeId, getAuthHeaders]
  );

  const updateEleve = useCallback(
    async (id: string, data: Partial<Eleve>): Promise<Eleve> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch(`/api/eleves/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        setEleves((prev) =>
          prev
            .map((e) => (e.id === id ? json.data : e))
            .sort((a, b) => a.nom.localeCompare(b.nom))
        );
        return json.data;
      } else {
        throw new Error(json.message || 'Erreur lors de la mise à jour');
      }
    },
    [getAuthHeaders]
  );

  const deleteEleve = useCallback(
    async (id: string): Promise<void> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch(`/api/eleves/${id}`, {
        method: 'DELETE',
        headers,
      });

      const json = await res.json();

      if (json.success) {
        setEleves((prev) => prev.filter((e) => e.id !== id));
      } else {
        throw new Error(json.message || 'Erreur lors de la suppression');
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    if (isAuthenticated && classeId) {
      fetchEleves();
    }
  }, [isAuthenticated, classeId, fetchEleves]);

  return {
    eleves,
    isLoading,
    error,
    createEleve,
    updateEleve,
    deleteEleve,
    refetch: fetchEleves,
  };
}
