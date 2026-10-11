'use client';

// « UTILISER POUR UNE CLASSE » depuis une card de Mes Ressources (plan
// 2026-10-11 « uniformisation des cards ») : le formulaire de création
// d'activité, ouvert sur le bon atelier, la ressource déjà choisie. Il prend
// la place du panneau (une page, pas une popup en cascade) ; l'activité créée
// rejoint Mes Activités.

import { useCallback, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClasses } from '@/hooks/useClasses';
import { useDevoirs } from '@/hooks/useDevoirs';
import { useGrilleTypes } from '@/hooks/useEvaluations';
import CreationForm, { type PreselectionRessource } from '@/components/CreationForm/CreationForm';
import type { CreateDevoirData } from '@/types/devoir';

export interface DemandeUtilisation {
  atelier: string;
  preselection: PreselectionRessource;
}

interface Props {
  demande: DemandeUtilisation;
  onFermer: () => void;
  /** Activité créée : le panneau affiche son message */
  onCree: (message: string) => void;
}

export default function UtiliserRessource({ demande, onFermer, onCree }: Props) {
  const { getAuthHeaders } = useAuth();
  const { createDevoir } = useDevoirs();
  const { grilleTypes, grilles } = useGrilleTypes();
  const { classes } = useClasses();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const classeNames = classes
    .filter((c) => !c.archive)
    .map((c) => c.nom)
    .sort((a, b) => a.localeCompare(b));

  const creer = useCallback(
    async (data: CreateDevoirData) => {
      setEnvoi(true);
      setErreur(null);
      try {
        await createDevoir(data);
        onCree(`Activité « ${data.intitule} » créée — elle est dans Mes Activités`);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Création impossible');
      } finally {
        setEnvoi(false);
      }
    },
    [createDevoir, onCree]
  );

  return (
    <>
      {erreur && <p role="alert" style={{ color: '#b42318', margin: '0 0 12px' }}>{erreur}</p>}
      <CreationForm
        atelierInitial={demande.atelier}
        preselection={demande.preselection}
        classeNames={classeNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isVisible
        onSubmit={creer}
        isSubmitting={envoi}
        onClose={onFermer}
        getAuthHeaders={getAuthHeaders}
      />
    </>
  );
}
