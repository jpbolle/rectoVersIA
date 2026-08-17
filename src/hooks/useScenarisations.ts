'use client';

// Scénarisations didactiques du prof connecté.
//
// L'écran d'encodage modifie beaucoup et souvent (chaque frappe dans une
// cellule) : l'état vit ici, et l'enregistrement part en différé.
//
// PERTE DE DONNÉES — trois trous rebouchés (incident du 2026-08-14) :
//  1. `charger()` écrasait l'état local par la version du serveur. Au retour
//     sur l'onglet, le GET pouvait doubler un PUT encore en vol : l'écran
//     revenait en arrière, et la modification suivante réécrivait cette
//     version périmée. La scénarisation en cours d'édition n'est donc plus
//     jamais remplacée par le serveur.
//  2. `enAttente` était vidé AVANT la réponse du serveur : un envoi qui
//     échouait perdait la modification sans rien dire. Elle n'est maintenant
//     libérée qu'une fois l'écriture confirmée.
//  3. Rien ne partait si l'onglet se fermait avant la fin du délai. Le délai
//     est raccourci, les actions structurelles écrivent aussitôt, et le
//     navigateur prévient s'il reste quelque chose en file.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import type { Scenarisation } from '@/types/scenarisation';
import { dupliquerScenarisation, normaliserScenarisation } from '@/types/scenarisation';
import { DEFAULT_SEMAINES } from '@/types/scenarisation-defaults';

// Frappe au clavier : on laisse le temps de finir un mot, pas davantage.
const SAVE_DELAY = 1200;

export function useScenarisations() {
  const { getAuthHeaders } = useAuth();
  const [scenarisations, setScenarisations] = useState<Scenarisation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<NodeJS.Timeout | null>(null);
  const enAttente = useRef<Scenarisation | null>(null);
  // Version envoyée au serveur mais pas encore confirmée
  const enVol = useRef<Scenarisation | null>(null);
  // true tant qu'une modification n'est pas confirmée par le serveur
  const [dirty, setDirty] = useState(false);

  const charger = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch('/api/scenarisations', { headers });
      const json = await res.json();
      if (json.success) {
        // Conversion des documents d'avant le 2026-08-14 (certifications à
        // part) : l'écran ne connaît qu'un modèle, des modules à trois genres
        const data = (json.data as Scenarisation[]).map(normaliserScenarisation);
        // Une scénarisation dont l'écriture n'est pas confirmée garde sa
        // version locale : le serveur en renverrait une plus ancienne.
        const locale = enAttente.current ?? enVol.current;
        setScenarisations(locale ? data.map((s) => (s.id === locale.id ? locale : s)) : data);
      } else setError(json.message || 'Chargement impossible');
    } catch {
      setError('Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    charger();
  }, [charger]);

  const enregistrerMaintenant = useCallback(
    async (scen: Scenarisation, keepalive = false) => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      enVol.current = scen;
      setIsSaving(true);
      try {
        const res = await fetch(`/api/scenarisations/${scen.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(scen),
          keepalive, // survit à la fermeture de l'onglet
        });
        const json = await res.json();
        if (!json.success) setError(json.message || 'Enregistrement impossible');
        else {
          setError(null);
          // Confirmé : on ne libère que SI rien n'a été retapé entre-temps
          if (enVol.current === scen) {
            enVol.current = null;
            if (!enAttente.current) setDirty(false);
          }
        }
      } catch {
        setError('Erreur réseau — modification non enregistrée');
      } finally {
        setIsSaving(false);
      }
    },
    [getAuthHeaders]
  );

  // Modification locale immédiate, écriture différée.
  // `immediat` : les gestes structurels (ajout, suppression, case cochée, menu
  // déroulant) n'attendent pas — seule la frappe au clavier mérite un délai.
  const modifier = useCallback(
    (scen: Scenarisation, immediat = false) => {
      setScenarisations((prev) => prev.map((s) => (s.id === scen.id ? scen : s)));
      enAttente.current = scen;
      setDirty(true);
      if (timer.current) clearTimeout(timer.current);
      if (immediat) {
        enAttente.current = null;
        enregistrerMaintenant(scen);
        return;
      }
      timer.current = setTimeout(() => {
        const attendu = enAttente.current;
        enAttente.current = null;
        if (attendu) enregistrerMaintenant(attendu);
      }, SAVE_DELAY);
    },
    [enregistrerMaintenant]
  );

  // Écrit sans attendre ce qui est en file — au changement de scénarisation,
  // quand on quitte un champ, ou à la fermeture de la page
  const vider = useCallback(
    (keepalive = false) => {
      if (timer.current) clearTimeout(timer.current);
      const attendu = enAttente.current;
      enAttente.current = null;
      if (attendu) enregistrerMaintenant(attendu, keepalive);
    },
    [enregistrerMaintenant]
  );

  useEffect(() => () => vider(), [vider]);

  // Fermeture ou rechargement de l'onglet : on tente l'envoi (keepalive) et on
  // laisse le navigateur demander confirmation s'il reste quelque chose.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!enAttente.current && !enVol.current) return;
      vider(true);
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [vider]);

  const creer = useCallback(
    async (nom: string, anneeScolaire?: string): Promise<Scenarisation | null> => {
      const headers = await getAuthHeaders();
      if (!headers) return null;
      try {
        const res = await fetch('/api/scenarisations', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            nom,
            anneeScolaire,
            dureePeriodeMin: 90,
            heuresParSemaine: 5,
            semaines: DEFAULT_SEMAINES,
            chapitres: [],
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.message || 'Création impossible');
          return null;
        }
        const creee = normaliserScenarisation(json.data as Scenarisation);
        setScenarisations((prev) => [creee, ...prev]);
        return creee;
      } catch {
        setError('Erreur réseau');
        return null;
      }
    },
    [getAuthHeaders]
  );

  // Copie complète d'un parcours — préparer l'année suivante sans tout
  // ressaisir. La transformation vit dans `dupliquerScenarisation` (types) :
  // c'est elle qui régénère les identifiants et détache les activités.
  const dupliquer = useCallback(
    async (
      source: Scenarisation,
      nom: string,
      anneeScolaire: string
    ): Promise<Scenarisation | null> => {
      const headers = await getAuthHeaders();
      if (!headers) return null;
      try {
        const res = await fetch('/api/scenarisations', {
          method: 'POST',
          headers,
          body: JSON.stringify(dupliquerScenarisation(source, nom, anneeScolaire)),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.message || 'Duplication impossible');
          return null;
        }
        const copie = normaliserScenarisation(json.data as Scenarisation);
        setScenarisations((prev) => [copie, ...prev]);
        return copie;
      } catch {
        setError('Erreur réseau');
        return null;
      }
    },
    [getAuthHeaders]
  );

  const supprimer = useCallback(
    async (id: string) => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      await fetch(`/api/scenarisations/${id}`, { method: 'DELETE', headers });
      setScenarisations((prev) => prev.filter((s) => s.id !== id));
    },
    [getAuthHeaders]
  );

  return {
    scenarisations,
    isLoading,
    isSaving,
    dirty,
    error,
    modifier,
    creer,
    dupliquer,
    supprimer,
    vider,
    refetch: charger,
  };
}
