'use client';

// Mes Ressources › CONCEPTUALISATIONS (2026-10-11) — la bibliothèque des
// CORRIGÉS du prof : des schémas (pas des activités) qu'il choisit ensuite
// comme corrigé d'un atelier de conceptualisation (« Contenus de l'activité »,
// le schéma y est copié). Stockés avec les schémas personnels
// (`schemasPersonnels`, drapeau `prof`), édités dans la même page plein écran.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useClasses } from '@/hooks/useClasses';
import { useDevoirs } from '@/hooks/useDevoirs';
import { useGrilleTypes } from '@/hooks/useEvaluations';
import CreationForm from '@/components/CreationForm/CreationForm';
import CreateOeuvreCard from '@/components/OeuvreCard/CreateOeuvreCard';
import RessourceCard from '@/components/RessourceCard/RessourceCard';
import EmptyState from '@/components/EmptyState/EmptyState';
import { ATELIER_CONCEPTUALISATION } from '@/types/didactique';
import { DIAGRAM_TYPE_LABELS } from '@/types/diagram';
import type { CreateDevoirData, SchemaCorrige } from '@/types/devoir';
import type { SchemaPersonnelMeta } from '@/lib/schemas-personnels';
import base from '@/components/Portfolio/Portfolio.module.css';

export default function ConceptualisationsPanel() {
  const router = useRouter();
  const { getAuthHeaders } = useAuth();
  const { createDevoir } = useDevoirs();
  const { grilleTypes, grilles } = useGrilleTypes();
  const { classes } = useClasses();
  const classeNames = classes
    .filter((c) => !c.archive)
    .map((c) => c.nom)
    .sort((a, b) => a.localeCompare(b));

  const [schemas, setSchemas] = useState<SchemaPersonnelMeta[] | null>(null);
  // Les corrigés des collègues (bloc « des professeurs », toujours présent)
  const [autres, setAutres] = useState<SchemaPersonnelMeta[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // « Utiliser pour une classe » : le formulaire d'activité, corrigé déjà choisi
  const [utiliser, setUtiliser] = useState<SchemaCorrige | null>(null);

  const charger = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/schemas/personnel', { headers });
      const json = await res.json();
      setSchemas(json.success ? (json.data as SchemaPersonnelMeta[]) : []);
      setAutres(json.success && Array.isArray(json.autres) ? (json.autres as SchemaPersonnelMeta[]) : []);
    } catch {
      setSchemas([]);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);

  const signaler = (e: unknown) => setMessage(e instanceof Error ? e.message : 'Erreur');

  const dupliquer = async (s: SchemaPersonnelMeta) => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée');
      const res = await fetch('/api/schemas/personnel', { method: 'POST', headers, body: JSON.stringify({ duplicateOf: s.id }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || json.error || 'Duplication impossible');
      setMessage('Corrigé dupliqué');
      await charger();
    } catch (e) {
      signaler(e);
    }
  };

  const archiver = async (s: SchemaPersonnelMeta) => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée');
      const res = await fetch(`/api/schemas/personnel/${s.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ archive: !s.archive }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || json.error || 'Modification impossible');
      await charger();
    } catch (e) {
      signaler(e);
    }
  };

  // Le schéma entier est lu au moment de l'utiliser : il sera copié dans l'activité
  const preparerActivite = async (s: SchemaPersonnelMeta) => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée');
      const res = await fetch(`/api/schemas/personnel/${s.id}`, { headers });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Corrigé introuvable');
      setUtiliser({ sourceId: s.id, titre: json.data.titre || s.titre, diagram: json.data.diagram });
    } catch (e) {
      signaler(e);
    }
  };

  const creerActivite = useCallback(
    async (data: CreateDevoirData) => {
      setEnvoi(true);
      try {
        await createDevoir(data);
        setUtiliser(null);
        setMessage(`Activité « ${data.intitule} » créée — elle est dans Mes Activités`);
      } catch (e) {
        signaler(e);
      } finally {
        setEnvoi(false);
      }
    },
    [createDevoir]
  );

  if (utiliser) {
    return (
      <CreationForm
        atelierInitial={ATELIER_CONCEPTUALISATION}
        schemaCorrigeInitial={utiliser}
        classeNames={classeNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isVisible
        onSubmit={creerActivite}
        isSubmitting={envoi}
        onClose={() => setUtiliser(null)}
        getAuthHeaders={getAuthHeaders}
      />
    );
  }

  const actifs = (schemas ?? []).filter((s) => !s.archive);
  const archives = (schemas ?? []).filter((s) => s.archive);

  // La carte commune de Mes Ressources (RessourceCard, 2026-10-11)
  const carte = (s: SchemaPersonnelMeta, lectureSeule = false) => (
    <RessourceCard
      key={s.id}
      icone="🧩"
      titre={s.titre}
      visuel={
        s.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette en data URL
          <img src={s.thumbnail} alt="" />
        ) : undefined
      }
      etiquettes={[DIAGRAM_TYPE_LABELS[s.type], ...(s.archive ? ['Archivé'] : [])]}
      archivee={s.archive}
      onOuvrir={lectureSeule ? undefined : () => router.push(`/mes-ressources/schemas/${s.id}`)}
      onDupliquer={() => dupliquer(s)}
      onArchiver={lectureSeule ? undefined : () => archiver(s)}
      principale={lectureSeule ? undefined : { libelle: 'Utiliser pour une classe', onClick: () => preparerActivite(s) }}
      // Corrigé d'un collègue : dupliquer est la seule action
      lectureSeule={lectureSeule}
    />
  );

  return (
    <div className={base.panneau}>
      {message && (
        <div className={base.message} onClick={() => setMessage(null)} role="status">
          {message}
        </div>
      )}

      {schemas === null ? (
        <EmptyState icon="hourglass" message="En cours de chargement" />
      ) : (
        <>
          <section className={base.groupe}>
            <div className={base.groupeEntete}>
              <h2 className={base.groupeTitre}>Mes corrigés</h2>
              <p className={base.groupeAide}>
                Vos schémas de référence. Dans un atelier de conceptualisation, « Contenus de l’activité » en
                choisit un comme corrigé : il y est copié, l’élève le découvre une fois sa copie corrigée.
              </p>
            </div>
            <div className={base.grille}>
              <CreateOeuvreCard onClick={() => router.push('/mes-ressources/schemas/nouveau')} libelle="Créer un corrigé" />
              {actifs.map((s) => carte(s))}
            </div>
          </section>

          {/* Le second bloc, TOUJOURS présent — même vide (JP, 2026-10-09) */}
          <section className={base.groupe}>
            <div className={base.groupeEntete}>
              <h2 className={base.groupeTitre}>Corrigés des professeurs</h2>
              <p className={base.groupeAide}>À dupliquer pour les modifier — la copie devient la vôtre.</p>
            </div>
            {autres.length === 0 ? (
              <p className={base.groupeAide}>Aucun corrigé de collègue pour l’instant.</p>
            ) : (
              <div className={base.grille}>{autres.map((s) => carte(s, true))}</div>
            )}
          </section>

          {archives.length > 0 && (
            <section className={base.groupe}>
              <div className={base.groupeEntete}>
                <h2 className={base.groupeTitre}>Archivés</h2>
              </div>
              <div className={base.grille}>{archives.map((s) => carte(s))}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
