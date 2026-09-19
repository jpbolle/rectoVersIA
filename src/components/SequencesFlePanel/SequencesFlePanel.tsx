'use client';

// Mes Ressources › Modules FLE › SÉQUENCES DE COURS (demande JP, 2026-09-19).
//
// Les activités « Séquence FLE » du prof. Elles restent AUSSI au tableau de
// bord (décision JP) : c'est là que la classe les reçoit, et qu'on les ouvre
// aux élèves. Ici, c'est l'atelier où on les compose — un clic sur la carte
// (`ActiviteRessourceCard`, au gabarit des Ressources, sans interrupteurs)
// ouvre le serpentin en grand (`SequenceAtelier`), et non les copies.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClasses } from '@/hooks/useClasses';
import { useDevoirs } from '@/hooks/useDevoirs';
import { useGrilleTypes } from '@/hooks/useEvaluations';
import CreationForm from '@/components/CreationForm/CreationForm';
import ActiviteRessourceCard from '@/components/ActiviteRessourceCard/ActiviteRessourceCard';
import CreateOeuvreCard from '@/components/OeuvreCard/CreateOeuvreCard';
import EditDevoirModal from '@/components/EditDevoirModal/EditDevoirModal';
import EmptyState from '@/components/EmptyState/EmptyState';
import { donneesDeCopie } from '@/lib/devoir-copie';
import { ATELIER_SEQUENCE_FLE } from '@/types/didactique';
import type { CreateDevoirData, Devoir } from '@/types/devoir';
import SequenceAtelier from './SequenceAtelier';
import styles from '@/components/ModuleFlePanel/ModuleFlePanel.module.css';

export default function SequencesFlePanel() {
  const { getAuthHeaders } = useAuth();
  const {
    devoirs,
    isLoading,
    createDevoir,
    updateDevoir,
    toggleArchive,
    refetch,
  } = useDevoirs();
  const { grilleTypes, grilles } = useGrilleTypes();
  const { classes } = useClasses();
  const classeNames = classes
    .filter((c) => !c.archive)
    .map((c) => c.nom)
    .sort((a, b) => a.localeCompare(b));

  const [creation, setCreation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);
  // Remonte l'atelier sur la séquence relue en base (après ses réglages ✏️)
  const [version, setVersion] = useState(0);
  const [enEdition, setEnEdition] = useState<Devoir | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sequences = useMemo(() => devoirs.filter((d) => d.typeTravail === 'sequence'), [devoirs]);
  const actives = sequences.filter((d) => !d.archive);
  const archivees = sequences.filter((d) => d.archive);
  const sequenceOuverte = ouverte ? sequences.find((d) => d.id === ouverte) ?? null : null;

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
        const json = await createDevoir(data);
        setCreation(false);
        // Une séquence se compose aussitôt : on ouvre son atelier
        const id = json?.data?.id as string | undefined;
        if (id && data.typeTravail === 'sequence') setOuverte(id);
      } catch (e) {
        signaler(e);
      } finally {
        setEnvoi(false);
      }
    },
    [createDevoir]
  );

  const dupliquer = useCallback(
    async (d: Devoir) => {
      try {
        await createDevoir(await donneesDeCopie(d, getAuthHeaders));
        setMessage('Séquence dupliquée — sans classe : à régler avec ✏️');
      } catch (e) {
        signaler(e);
      }
    },
    [createDevoir, getAuthHeaders]
  );

  const enregistrer = useCallback(
    async (id: string, data: Partial<Devoir>, silencieux = false): Promise<boolean> => {
      try {
        await updateDevoir(id, data);
        if (!silencieux) setMessage('Modifications enregistrées');
        return true;
      } catch (e) {
        signaler(e);
        return false;
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

  if (creation) {
    return (
      <CreationForm
        atelierInitial={ATELIER_SEQUENCE_FLE}
        classeNames={classeNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isVisible
        onSubmit={creer}
        isSubmitting={envoi}
        onClose={() => setCreation(false)}
        getAuthHeaders={getAuthHeaders}
      />
    );
  }

  if (sequenceOuverte) {
    return (
      <SequenceAtelier
        key={`${sequenceOuverte.id}-${version}`}
        sequence={sequenceOuverte}
        devoirs={devoirs}
        classeNames={classeNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        enregistrerDevoir={enregistrer}
        onRetour={() => {
          setOuverte(null);
          void refetch();
        }}
        onRecharger={async () => {
          await refetch();
          setVersion((v) => v + 1);
        }}
      />
    );
  }

  const cartes = (liste: Devoir[]) =>
    liste.map((d) => (
      <ActiviteRessourceCard
        key={d.id}
        devoir={d}
        onOuvrir={(x) => setOuverte(x.id)}
        onEditer={setEnEdition}
        onDupliquer={dupliquer}
        onToggleArchive={basculer(toggleArchive)}
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
              <h2 className={styles.groupeTitre}>Mes séquences de cours</h2>
              <p className={styles.groupeAide}>
                Un clic sur une séquence ouvre sa ligne du temps : points de théorie et activités,
                dans l’ordre où l’élève les suit. Un clic sur une étape ouvre la ressource. Les
                séquences restent aussi dans Mes Activités, où la classe les reçoit.
              </p>
            </div>
            <div className={styles.grille}>
              <CreateOeuvreCard onClick={() => setCreation(true)} libelle="Créer une séquence" />
              {cartes(actives)}
            </div>
          </section>

          {archivees.length > 0 && (
            <section className={styles.groupe}>
              <div className={styles.groupeEntete}>
                <h2 className={styles.groupeTitre}>Archivées</h2>
              </div>
              <div className={styles.grille}>{cartes(archivees)}</div>
            </section>
          )}
        </>
      )}

      <EditDevoirModal
        devoir={enEdition}
        classeNames={classeNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isOpen={enEdition !== null}
        onClose={() => setEnEdition(null)}
        onSave={enregistrer}
        isSaving={false}
        getAuthHeaders={getAuthHeaders}
      />
    </div>
  );
}
