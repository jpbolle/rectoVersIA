'use client';

// Mes Ressources › Modules FLE › ACTIVITÉS — les activités FLE du prof.
//
// Décision de JP (2026-09-19) : elles vivent ICI SEULEMENT. Le tableau de bord
// n'en montre que la séquence. Une activité FLE (`referentiel: 'fle'`) naît
// sans classe et FERMÉE : c'est une séquence FLE qui l'ouvre aux élèves
// (`ouvertParSequence`). Le reste est celui de toute activité : même
// formulaire (en mode FLE), même popup ✏️ ; la carte est celle des Ressources
// (`ActiviteRessourceCard`) — un clic mène aux copies, comme au tableau de bord.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDevoirs } from '@/hooks/useDevoirs';
import { useGrilleTypes } from '@/hooks/useEvaluations';
import CreationForm from '@/components/CreationForm/CreationForm';
import ActiviteRessourceCard from '@/components/ActiviteRessourceCard/ActiviteRessourceCard';
import CreateOeuvreCard from '@/components/OeuvreCard/CreateOeuvreCard';
import EditDevoirModal from '@/components/EditDevoirModal/EditDevoirModal';
import EmptyState from '@/components/EmptyState/EmptyState';
import { donneesDeCopie } from '@/lib/devoir-copie';
import type { CreateDevoirData, Devoir } from '@/types/devoir';
import styles from '@/components/ModuleFlePanel/ModuleFlePanel.module.css';

export default function ActiviteFlePanel() {
  const { getAuthHeaders } = useAuth();
  const router = useRouter();
  const {
    devoirs,
    isLoading,
    createDevoir,
    updateDevoir,
    toggleArchive,
    toggleCorrigeDisponible,
  } = useDevoirs();
  const { grilleTypes, grilles } = useGrilleTypes();

  const [creation, setCreation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [enEdition, setEnEdition] = useState<Devoir | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activitesFle = useMemo(() => devoirs.filter((d) => d.referentiel === 'fle'), [devoirs]);
  const actives = activitesFle.filter((d) => !d.archive);
  const archivees = activitesFle.filter((d) => d.archive);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);

  const signaler = (e: unknown) => setMessage(e instanceof Error ? e.message : 'Erreur');

  const creer = useCallback(
    async (data: CreateDevoirData) => {
      setEnvoi(true);
      try {
        await createDevoir({ ...data, referentiel: 'fle' });
        setMessage('Activité FLE créée — ajoute-la à une séquence avec le « + » de sa ligne du temps.');
        setCreation(false);
      } catch (e) {
        signaler(e);
      } finally {
        setEnvoi(false);
      }
    },
    [createDevoir]
  );

  // Aperçu : enregistre puis ouvre la vraie page élève (le prof y est en mode aperçu)
  const apercu = useCallback(
    async (data: CreateDevoirData) => {
      setEnvoi(true);
      try {
        const json = await createDevoir({ ...data, referentiel: 'fle' });
        const id = json?.data?.id;
        if (id) router.push(`/activites/${id}`);
      } catch (e) {
        signaler(e);
      } finally {
        setEnvoi(false);
      }
    },
    [createDevoir, router]
  );

  const dupliquer = useCallback(
    async (d: Devoir) => {
      try {
        await createDevoir(await donneesDeCopie(d, getAuthHeaders));
        setMessage('Activité dupliquée');
      } catch (e) {
        signaler(e);
      }
    },
    [createDevoir, getAuthHeaders]
  );

  const enregistrer = useCallback(
    async (id: string, data: Partial<Devoir>, silencieux = false): Promise<boolean> => {
      setEnregistrement(true);
      try {
        await updateDevoir(id, data);
        if (!silencieux) setMessage('Activité modifiée');
        return true;
      } catch (e) {
        signaler(e);
        return false;
      } finally {
        setEnregistrement(false);
      }
    },
    [updateDevoir]
  );

  const basculer =
    (action: (id: string, v: boolean) => Promise<unknown>) => async (id: string, v: boolean) => {
      try {
        await action(id, v);
      } catch (e) {
        signaler(e);
      }
    };

  // Le formulaire occupe tout le panneau, comme au tableau de bord
  if (creation) {
    return (
      <CreationForm
        modeFle
        classeNames={[]}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isVisible
        onSubmit={creer}
        onPreview={apercu}
        isSubmitting={envoi}
        onClose={() => setCreation(false)}
        getAuthHeaders={getAuthHeaders}
      />
    );
  }

  const cartes = (liste: Devoir[]) =>
    liste.map((d) => (
      <ActiviteRessourceCard
        key={d.id}
        devoir={d}
        onOuvrir={(x) => router.push(`/dashboard/travaux/${x.id}`)}
        onEditer={setEnEdition}
        onDupliquer={dupliquer}
        onToggleArchive={basculer(toggleArchive)}
        onToggleCorrigeDisponible={basculer(toggleCorrigeDisponible)}
      />
    ));

  return (
    <div className={styles.panneau}>
      {message && (
        <div className={styles.message} onClick={() => setMessage(null)} role="status">
          {message}
        </div>
      )}

      {isLoading ? (
        <EmptyState icon="hourglass" message="En cours de chargement" />
      ) : (
        <>
          <section className={styles.groupe}>
            <div className={styles.groupeEntete}>
              <h2 className={styles.groupeTitre}>Mes activités FLE</h2>
              <p className={styles.groupeAide}>
                Des activités sans classe : c’est la « Séquence FLE » (Mes Activités) qui les ouvre à
                ses élèves, étape après étape. Elles n’apparaissent pas au tableau de bord. Un clic
                sur une carte ouvre les copies.
              </p>
            </div>
            <div className={styles.grille}>
              <CreateOeuvreCard onClick={() => setCreation(true)} libelle="Créer une activité FLE" />
              {cartes(actives)}
            </div>
          </section>

          {archivees.length > 0 && (
            <section className={styles.groupe}>
              <div className={styles.groupeEntete}>
                <h2 className={styles.groupeTitre}>Archivées</h2>
                <p className={styles.groupeAide}>
                  Retirées de la liste, mais toujours ouvertes par les séquences qui les contiennent.
                </p>
              </div>
              <div className={styles.grille}>{cartes(archivees)}</div>
            </section>
          )}
        </>
      )}

      <EditDevoirModal
        devoir={enEdition}
        classeNames={[]}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isOpen={enEdition !== null}
        onClose={() => setEnEdition(null)}
        onSave={enregistrer}
        isSaving={enregistrement}
        getAuthHeaders={getAuthHeaders}
      />
    </div>
  );
}
