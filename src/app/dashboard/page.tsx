'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDevoirs } from '@/hooks/useDevoirs';
import { useGrilleTypes } from '@/hooks/useEvaluations';
import { useClasses } from '@/hooks/useClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import CreationForm from '@/components/CreationForm/CreationForm';
import DevoirCard from '@/components/DevoirCard/DevoirCard';
import CreateDevoirCard from '@/components/CreateDevoirCard/CreateDevoirCard';
import EditDevoirModal from '@/components/EditDevoirModal/EditDevoirModal';
import LoadingOverlay from '@/components/LoadingOverlay/LoadingOverlay';
import MessageBox from '@/components/MessageBox/MessageBox';
import EmptyState from '@/components/EmptyState/EmptyState';
import { calculateSchoolYear } from '@/lib/auth-utils';
import type { CreateDevoirData, Devoir } from '@/types/devoir';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();
  const {
    devoirs,
    isLoading: devoirsLoading,
    createDevoir,
    updateDevoir,
    deleteDevoir,
    toggleDisponible,
    toggleArchive,
    toggleCorrige,
    toggleCorrigeDisponible,
  } = useDevoirs();
  const { grilleTypes, grilles } = useGrilleTypes();
  const { classes } = useClasses();

  // Noms des classes actives (non archivees), triees
  const activeClasseNames = classes
    .filter((c) => !c.archive)
    .map((c) => c.nom)
    .sort((a, b) => a.localeCompare(b));

  const [isReady, setIsReady] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Edition modal
  const [editingDevoir, setEditingDevoir] = useState<Devoir | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Filtre par année scolaire ──
  // Sans lui, une activité restait au tableau de bord indéfiniment : le tri ne
  // portait que sur `archive` et `corrige`, jamais sur l'année — d'où des
  // activités de l'an dernier mêlées à celles de la rentrée.
  const SANS_ANNEE = '__sans_annee__';
  const TOUTES = '__toutes__';

  // Les années réellement présentes, la plus récente d'abord. On ne propose
  // jamais une année vide : un menu qui montre des choix sans contenu se lit
  // comme une panne.
  const anneesDisponibles = useMemo(() => {
    const vues = new Set<string>();
    devoirs.forEach((d) => vues.add(d.anneeScolaire || SANS_ANNEE));
    return [...vues].sort((a, b) => {
      // « Sans année » ferme la marche : ce sont des documents anciens
      if (a === SANS_ANNEE) return 1;
      if (b === SANS_ANNEE) return -1;
      return b.localeCompare(a);
    });
  }, [devoirs]);

  // `null` = le prof n'a pas encore choisi. On calcule alors le défaut à
  // chaque rendu plutôt que de le poser dans un useEffect : écrire un state
  // depuis un effet qui dépend des devoirs, c'est la boucle assurée.
  const [anneeChoisie, setAnneeChoisie] = useState<string | null>(null);
  const anneeCourante = calculateSchoolYear();
  const anneeFiltre =
    anneeChoisie ??
    (anneesDisponibles.includes(anneeCourante)
      ? anneeCourante
      : anneesDisponibles[0] ?? anneeCourante);

  const devoirsAnnee = useMemo(
    () =>
      anneeFiltre === TOUTES
        ? devoirs
        : devoirs.filter((d) => (d.anneeScolaire || SANS_ANNEE) === anneeFiltre),
    [devoirs, anneeFiltre]
  );

  // Devoirs non archivés, séparés en "en cours" et "corrigés"
  const devoirsActuels = devoirsAnnee.filter((d) => !d.archive && !d.corrige);
  const devoirsCorreges = devoirsAnnee.filter((d) => !d.archive && d.corrige);
  const devoirsArchives = devoirsAnnee.filter((d) => d.archive);

  // Onglet actif
  const [activeTab, setActiveTab] = useState<'actuels' | 'archives'>('actuels');

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if ((authLoading && !isAuthenticated) || redirecting) return;
    if (!isAuthenticated) {
      setRedirecting(true);
      router.replace('/login');
    } else if (role !== 'prof') {
      setRedirecting(true);
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, role, router, redirecting]);

  const handleCreateDevoir = useCallback(
    async (data: CreateDevoirData) => {
      setIsSubmitting(true);
      try {
        await createDevoir(data);
        setMessage({ text: 'Devoir créé avec succès !', type: 'success' });
        setIsFormVisible(false);
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la creation',
          type: 'error',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [createDevoir]
  );

  // Prévisualisation : crée l'activité (non disponible) puis ouvre la page élève
  // — un prof sur /activites/[id] est automatiquement en mode aperçu
  const handlePreviewDevoir = useCallback(
    async (data: CreateDevoirData) => {
      setIsSubmitting(true);
      try {
        const json = await createDevoir(data);
        const id = json?.data?.id;
        setMessage({ text: 'Activité enregistrée (non disponible) — ouverture de l’aperçu…', type: 'success' });
        if (id) router.push(`/activites/${id}`);
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la creation',
          type: 'error',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [createDevoir, router]
  );

  const handleToggleDisponible = useCallback(
    async (id: string, disponible: boolean) => {
      try {
        await toggleDisponible(id, disponible);
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la mise a jour',
          type: 'error',
        });
      }
    },
    [toggleDisponible]
  );

  const handleToggleArchive = useCallback(
    async (id: string, archive: boolean) => {
      try {
        await toggleArchive(id, archive);
        if (archive) {
          setMessage({ text: 'Devoir archivé', type: 'success' });
        }
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de l\'archivage',
          type: 'error',
        });
      }
    },
    [toggleArchive]
  );

  const handleToggleCorrige = useCallback(
    async (id: string, corrige: boolean) => {
      try {
        await toggleCorrige(id, corrige);
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la mise à jour',
          type: 'error',
        });
      }
    },
    [toggleCorrige]
  );

  const handleToggleCorrigeDisponible = useCallback(
    async (id: string, corrigeDisponible: boolean) => {
      try {
        await toggleCorrigeDisponible(id, corrigeDisponible);
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la mise à jour',
          type: 'error',
        });
      }
    },
    [toggleCorrigeDisponible]
  );

  // --- Sélection multiple supprimée ---

  const handleEditDevoir = useCallback((devoir: Devoir) => {
    setEditingDevoir(devoir);
  }, []);

  const handleDeleteDevoir = useCallback(
    async (devoir: Devoir) => {
      if (!confirm(`Supprimer le devoir "${devoir.intitule}" ? Cette action est irréversible.`)) {
        return;
      }
      try {
        await deleteDevoir(devoir.id);
        setMessage({ text: 'Devoir supprimé avec succès', type: 'success' });
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la suppression',
          type: 'error',
        });
      }
    },
    [deleteDevoir]
  );

  const handleDuplicateDevoir = useCallback(
    async (devoir: Devoir) => {
      try {
        // Récupérer le questionnaire si type rechercher
        let questionnaire: CreateDevoirData['questionnaire'] | undefined;
        if (devoir.typeTravail === 'rechercher' && devoir.questionnaireId) {
          const headers = await getAuthHeaders();
          if (headers) {
            const qRes = await fetch(`/api/navigkid/questionnaire?id=${devoir.questionnaireId}`, { headers });
            const qJson = await qRes.json();
            if (qJson.success) {
              questionnaire = {
                themes: qJson.data.theme || '',
                questions: qJson.data.questions || [],
              };
            }
          }
        }

        await createDevoir({
          intitule: `COPIE - ${devoir.intitule}`,
          grille: devoir.grille,
          classes: [],
          dateRemise: devoir.dateRemise,
          consignes: devoir.consignes || '',
          accesIA: devoir.accesIA,
          disponible: false,
          ressources: devoir.ressources || null,
          typeTravail: devoir.typeTravail || 'ecrire',
          evaluation: devoir.evaluation ?? 'formatif',
          questionnaire,
          // Le verso doit suivre le recto. Sans ces champs, dupliquer une
          // activité de lecture rendait une coquille vide : le questionnaire,
          // les habiletés et le corrigé restaient sur l'original.
          modePrincipal: devoir.modePrincipal,
          atelier: devoir.atelier,
          habiletes: devoir.habiletes ?? null,
          hiddenCriteria: devoir.hiddenCriteria,
          autoEvaluation: devoir.autoEvaluation,
          flipInverted: devoir.flipInverted,
          corrigeReference: devoir.corrigeReference ?? null,
          ressourcesToIA: devoir.ressourcesToIA,
          lectureQuiz: devoir.lectureQuiz ?? null,
          autoEvalQuiz: devoir.autoEvalQuiz ?? null,
          // L'œuvre n'est pas recopiée : elle vit dans la bibliothèque et la
          // copie y renvoie, comme l'original.
          oeuvreId: devoir.oeuvreId ?? null,
          oeuvreChapitres: devoir.oeuvreChapitres ?? null,
          oeuvreMinimum: devoir.oeuvreMinimum ?? null,
          vocabulaireConfig: devoir.vocabulaireThemes
            ? { themes: devoir.vocabulaireThemes, diagnostic: devoir.vocabulaireDiagnostic }
            : undefined,
        });
        setMessage({ text: 'Devoir dupliqué avec succès !', type: 'success' });
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la duplication',
          type: 'error',
        });
      }
    },
    [createDevoir, getAuthHeaders]
  );

  /**
   * Enregistre une activité modifiée. Ne ferme PAS la popup : c'est elle qui
   * décide, puisqu'elle s'enregistre aussi toute seule pendant la composition.
   *
   * `silencieux` : enregistrement automatique. Pas de message — il s'afficherait
   * derrière la fenêtre ouverte, et rien ne justifie d'annoncer toutes les
   * deux secondes ce que le pied de la popup dit déjà.
   */
  const handleSaveEdit = useCallback(
    async (id: string, data: Partial<Devoir>, silencieux = false): Promise<boolean> => {
      setIsSaving(true);
      try {
        await updateDevoir(id, data);
        if (!silencieux) {
          setMessage({ text: 'Devoir modifié avec succès !', type: 'success' });
        }
        return true;
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la modification',
          type: 'error',
        });
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [updateDevoir]
  );

  if ((authLoading && !isAuthenticated) || redirecting) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="prof" />

      <main className={styles.mainContent}>
        <MessageBox
          message={message?.text || null}
          type={message?.type || 'success'}
          onDismiss={() => setMessage(null)}
        />

        {isFormVisible && (
          <section className={styles.creationSection}>
            <CreationForm
              classeNames={activeClasseNames}
              grilleTypes={grilleTypes}
              grilles={grilles}
              isVisible={isFormVisible}
              onSubmit={handleCreateDevoir}
              onPreview={handlePreviewDevoir}
              isSubmitting={isSubmitting}
              onClose={() => setIsFormVisible(false)}
              getAuthHeaders={getAuthHeaders}
            />
          </section>
        )}

        <section className={styles.evaluationsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Mes Activités</h2>
            <div className={styles.headerActions}>
              {/* Le tableau de bord s'ouvre sur l'année en cours. Les années
                  passées restent accessibles, mais il faut aller les chercher. */}
              <select
                className={styles.anneeSelect}
                value={anneeFiltre}
                onChange={(e) => setAnneeChoisie(e.target.value)}
                title="Année scolaire affichée"
              >
                {anneesDisponibles.map((a) => (
                  <option key={a} value={a}>
                    {a === SANS_ANNEE ? 'Année non précisée' : a}
                  </option>
                ))}
                {anneesDisponibles.length > 1 && (
                  <option value={TOUTES}>Toutes les années</option>
                )}
              </select>
              <div className={styles.tabs}>
                <button
                  type="button"
                  className={`${styles.tab} ${activeTab === 'actuels' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('actuels')}
                >
                  Travaux actuels
                </button>
                <button
                  type="button"
                  className={`${styles.tab} ${activeTab === 'archives' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('archives')}
                >
                  Travaux archivés
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'actuels' ? (
            <>
              {/* Travaux en cours */}
              <h3 className={styles.subSectionTitle}>📝 Travaux en cours</h3>
              <div className={styles.evaluationsGrid}>
                {devoirsLoading ? (
                  <EmptyState icon="hourglass" message="En cours de chargement" />
                ) : (
                  <>
                    <CreateDevoirCard onClick={() => setIsFormVisible(true)} />
                    {devoirsActuels.length === 0 && devoirsCorreges.length === 0 ? null : devoirsActuels.length === 0 ? (
                      <p className={styles.emptySubSection}>Aucun travail en cours</p>
                    ) : (
                      devoirsActuels.map((devoir) => (
                        <DevoirCard
                          key={devoir.id}
                          devoir={devoir}
                          variant="prof"
                          onEdit={handleEditDevoir}
                          onDelete={handleDeleteDevoir}
                          onDuplicate={handleDuplicateDevoir}
                          onToggleDisponible={handleToggleDisponible}
                          onToggleArchive={handleToggleArchive}
                          onToggleCorrige={handleToggleCorrige}
                          onToggleCorrigeDisponible={handleToggleCorrigeDisponible}
                        />
                      ))
                    )}
                  </>
                )}
              </div>

              {/* Travaux corrigés */}
              {devoirsCorreges.length > 0 && (
                <>
                  <h3 className={`${styles.subSectionTitle} ${styles.subSectionTitleCorrige}`}>✅ Travaux corrigés</h3>
                  <div className={styles.evaluationsGrid}>
                    {devoirsCorreges.map((devoir) => (
                      <DevoirCard
                        key={devoir.id}
                        devoir={devoir}
                        variant="prof"
                        onEdit={handleEditDevoir}
                        onDelete={handleDeleteDevoir}
                        onDuplicate={handleDuplicateDevoir}
                        onToggleDisponible={handleToggleDisponible}
                        onToggleArchive={handleToggleArchive}
                        onToggleCorrige={handleToggleCorrige}
                        onToggleCorrigeDisponible={handleToggleCorrigeDisponible}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            /* Onglet Archives */
            <div className={styles.evaluationsGrid}>
              {devoirsLoading ? (
                <EmptyState icon="hourglass" message="En cours de chargement" />
              ) : devoirsArchives.length === 0 ? (
                <EmptyState icon="🗃️" message="Aucun devoir archivé" />
              ) : (
                devoirsArchives.map((devoir) => (
                  <DevoirCard
                    key={devoir.id}
                    devoir={devoir}
                    variant="prof"
                    onEdit={handleEditDevoir}
                    onDelete={handleDeleteDevoir}
                    onDuplicate={handleDuplicateDevoir}
                    onToggleDisponible={handleToggleDisponible}
                    onToggleArchive={handleToggleArchive}
                    onToggleCorrige={handleToggleCorrige}
                    onToggleCorrigeDisponible={handleToggleCorrigeDisponible}
                  />
                ))
              )}
            </div>
          )}
        </section>

      </main>

      <Footer />

      <EditDevoirModal
        devoir={editingDevoir}
        classeNames={activeClasseNames}
        grilleTypes={grilleTypes}
        grilles={grilles}
        isOpen={editingDevoir !== null}
        onClose={() => setEditingDevoir(null)}
        onSave={handleSaveEdit}
        isSaving={isSaving}
        getAuthHeaders={getAuthHeaders}
      />

      <LoadingOverlay isVisible={isNavigating} message="Chargement de l'interface..." />
    </div>
  );
}
