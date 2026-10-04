'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Classe, Eleve, CreateClasseData, CreateEleveData } from '@/types/classe';

export function useClasses() {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [classes, setClasses] = useState<Classe[]>([]);
  // Classes qu'un collègue m'a partagées (coprofesseur, 2026-10-04) — à part,
  // pour qu'aucun écran ne les reçoive dans `classes` sans l'avoir voulu
  const [classesPartagees, setClassesPartagees] = useState<Classe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setClassesPartagees(Array.isArray(json.partagees) ? json.partagees : []);
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
    classesPartagees,
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
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const bulkCreateEleves = useCallback(
    async (data: { nom: string; prenom: string; email: string }[]): Promise<number> => {
      if (!classeId) throw new Error('Aucune classe sélectionnée');

      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch('/api/eleves/bulk', {
        method: 'POST',
        headers,
        body: JSON.stringify({ classeId, eleves: data }),
      });

      const json = await res.json();

      if (json.success) {
        // Rafraîchir la liste complète
        await fetchEleves();
        return json.data.imported as number;
      } else {
        throw new Error(json.message || "Erreur lors de l'import");
      }
    },
    [classeId, getAuthHeaders, fetchEleves]
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
    bulkCreateEleves,
    refetch: fetchEleves,
  };
}

/**
 * Les classes partagées EN ÉCRITURE qu'on peut donner à une activité
 * (coprofesseur, 2026-10-04), prêtes pour `ClassesDropdown`.
 *
 * Une activité nomme ses classes par leur NOM : une classe partagée qui porte
 * le nom d'une des miennes serait indiscernable — elle part dans
 * `indisponibles`, grisée avec la raison, au lieu d'être tue.
 */
export function classesPartageesPourActivite(
  mesClasses: Classe[],
  partagees: Classe[]
): {
  noms: string[];
  precisions: Record<string, string>;
  indisponibles: { nom: string; raison: string }[];
} {
  const miennes = new Set(mesClasses.map((c) => c.nom));
  const enEcriture = partagees.filter((c) => c.monAcces === 'edition' && !c.archive);
  const precisions: Record<string, string> = {};
  const noms: string[] = [];
  const indisponibles: { nom: string; raison: string }[] = [];
  enEcriture.forEach((c) => {
    const de = c.titulaireNom ? `classe de ${c.titulaireNom}` : 'classe partagée';
    const homonymesPartagees = enEcriture.filter((x) => x.nom === c.nom).length;
    if (miennes.has(c.nom)) {
      indisponibles.push({ nom: c.nom, raison: `${de} — même nom qu’une de tes classes` });
    } else if (homonymesPartagees > 1) {
      // Deux collègues t'ont partagé une classe de ce nom : indiscernables
      indisponibles.push({ nom: c.nom, raison: `${de} — un autre collègue t’a partagé une classe du même nom` });
    } else if (!noms.includes(c.nom)) {
      noms.push(c.nom);
      precisions[c.nom] = de;
    }
  });
  return { noms: noms.sort((a, b) => a.localeCompare(b)), precisions, indisponibles };
}
