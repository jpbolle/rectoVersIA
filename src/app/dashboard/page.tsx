'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useDevoirs } from '@/hooks/useDevoirs';
import { useGrilleTypes } from '@/hooks/useEvaluations';
import { useClasses } from '@/hooks/useClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import CreationForm from '@/components/CreationForm/CreationForm';
import DevoirCard from '@/components/DevoirCard/DevoirCard';
import CreateDevoirCard from '@/components/CreateDevoirCard/CreateDevoirCard';
import AtelierChoiceModal from '@/components/AtelierChoiceModal/AtelierChoiceModal';
import SequencesFlePanel from '@/components/SequencesFlePanel/SequencesFlePanel';
import { useEspace } from '@/context/EspaceContext';
import { estClasseFle } from '@/types/classe';
import EditDevoirModal from '@/components/EditDevoirModal/EditDevoirModal';
import LoadingOverlay from '@/components/LoadingOverlay/LoadingOverlay';
import MessageBox from '@/components/MessageBox/MessageBox';
import EmptyState from '@/components/EmptyState/EmptyState';
import OngletsBarre from '@/components/OngletsBarre/OngletsBarre';
import ActivitesEtiquettes from '@/components/ActivitesEtiquettes/ActivitesEtiquettes';
import { atelierLabel, atelierParDispositif } from '@/types/didactique';
import type { Dispositif } from '@/types/didactique';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { donneesDeCopie } from '@/lib/devoir-copie';
import type { CreateDevoirData, Devoir } from '@/types/devoir';
import styles from './dashboard.module.css';

// Le TYPE d'une activité : son atelier, ou celui que son dispositif désigne
// pour les activités créées avant l'existence du champ. Même règle que
// l'étiquette de `DevoirCard` — les deux doivent dire la même chose.
function atelierDe(d: { atelier?: string; typeTravail?: string }): string {
  return d.atelier || atelierParDispositif(d.typeTravail as Dispositif).id;
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();
  const {
    devoirs: tousLesDevoirs,
    devoirsPartages,
    isLoading: devoirsLoading,
    createDevoir,
    updateDevoir,
    deleteDevoir,
    toggleDisponible,
    toggleArchive,
    toggleCorrige,
    toggleCorrigeDisponible,
  } = useDevoirs();
  // Les ACTIVITÉS FLE vivent dans Mes Ressources › Modules FLE, pas ici : le tableau
  // de bord n'en montre que la séquence (décision JP, 2026-09-19). Filtré
  // AVANT tout le reste — années comprises, sinon une année ne contenant que
  // des activités FLE apparaîtrait vide dans le menu.
  // Les SÉQUENCES FLE non plus : elles ont leur panneau, en tête du tableau de
  // bord en espace FLE (2026-10-08, soir).
  const { grilleTypes, grilles } = useGrilleTypes();
  const { classes, classesPartagees } = useClasses();
  // DEUX ESPACES (2026-10-08) : une classe FLE suffit pour qu'une activité
  // soit FLE — elle n'apparaît alors QUE dans l'espace FLE, même si elle est
  // aussi donnée à une classe de français (« plus rien de FLE en classique »,
  // JP). En classique : les activités sans aucune classe FLE.
  const { espace } = useEspace();
  const nomsFle = useMemo(
    () => new Set([...classes, ...classesPartagees].filter((c) => estClasseFle(c)).map((c) => c.nom)),
    [classes, classesPartagees]
  );
  const dansEspace = useCallback(
    (d: Devoir) => {
      const aUneClasseFle = d.classes.some((nom) => nomsFle.has(nom));
      return espace === 'fle' ? aUneClasseFle : !aUneClasseFle;
    },
    [espace, nomsFle]
  );
  const devoirs = useMemo(
    () => tousLesDevoirs.filter((d) => d.referentiel !== 'fle' && d.typeTravail !== 'sequence' && dansEspace(d)),
    [tousLesDevoirs, dansEspace]
  );

  // Noms des classes actives (non archivees), triees
  const activeClasseNames = classes
    .filter((c) => !c.archive)
    .map((c) => c.nom)
    .sort((a, b) => a.localeCompare(b));

  const [isReady, setIsReady] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  // Créer une activité : d'abord la popup de choix du type (2026-10-04), puis
  // le formulaire ouvert sur l'atelier choisi.
  const [choixAtelierVisible, setChoixAtelierVisible] = useState(false);
  const [atelierChoisi, setAtelierChoisi] = useState<string | undefined>(undefined);
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
  const TOUS = '__tous__';
  const SANS_EVAL = '__sans_eval__';

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

  // L'ANNÉE ne filtre que le bloc « Activités classées » (JP, 2026-10-09) : le
  // bloc « en cours » est, par définition, celui de l'année en cours.
  const deLAnnee = (d: Devoir, annee: string) =>
    annee === TOUTES || (d.anneeScolaire || SANS_ANNEE) === annee;

  // ── Filtres par type d'activité et par nature de l'évaluation ──
  // Le filtre par année ne suffisait plus : une année de français, c'est des
  // dizaines d'activités de toutes sortes (demande JP, 2026-09-20).
  const [typeFiltre, setTypeFiltre] = useState<string>(TOUS);
  const [evalFiltre, setEvalFiltre] = useState<string>(TOUS);

  // On ne propose que les types réellement présents : un menu qui offre des
  // choix vides se lit comme une panne (même parti que pour les années).
  const typesDisponibles = useMemo(() => {
    const vus = new Set<string>();
    devoirs.forEach((d) => vus.add(atelierDe(d)));
    return [...vus].sort((a, b) => atelierLabel(a, true).localeCompare(atelierLabel(b, true)));
  }, [devoirs]);

  // ── Tri par échéance, la plus proche d'abord ──
  // Une activité sans échéance ferme la marche : elle n'attend rien de
  // personne, elle n'a pas à passer devant celle de demain.
  const devoirsTries = useMemo(() => {
    const retenus = devoirs.filter(
      (d) =>
        (typeFiltre === TOUS || atelierDe(d) === typeFiltre) &&
        (evalFiltre === TOUS || (d.evaluation || SANS_EVAL) === evalFiltre)
    );
    return [...retenus].sort((a, b) => {
      if (!a.dateRemise && !b.dateRemise) return a.intitule.localeCompare(b.intitule);
      if (!a.dateRemise) return 1;
      if (!b.dateRemise) return -1;
      return a.dateRemise.localeCompare(b.dateRemise);
    });
  }, [devoirs, typeFiltre, evalFiltre]);

  // ── Les activités d'un collègue sur mes classes partagées (2026-10-04) ──
  // Mêmes filtres que les miennes, rangées à part : je n'en suis pas l'auteur.
  // Leur `archive` est celui de MES sessions (calculé par le serveur).
  const partagesTries = useMemo(
    () =>
      devoirsPartages
        .filter(
          (d) =>
            d.referentiel !== 'fle' &&
            d.typeTravail !== 'sequence' &&
            dansEspace(d) &&
            (typeFiltre === TOUS || atelierDe(d) === typeFiltre) &&
            (evalFiltre === TOUS || (d.evaluation || SANS_EVAL) === evalFiltre)
        )
        .sort((a, b) => a.intitule.localeCompare(b.intitule)),
    [devoirsPartages, typeFiltre, evalFiltre, dansEspace]
  );
  const partagesActuels = partagesTries.filter((d) => !d.archive && deLAnnee(d, anneeCourante));
  const partagesArchives = partagesTries.filter((d) => d.archive && deLAnnee(d, anneeFiltre));

  // En cours = l'année en cours, sans autre choix ; classées et archivées
  // suivent le menu des années du second bloc
  const devoirsActuels = devoirsTries.filter((d) => !d.archive && !d.corrige && deLAnnee(d, anneeCourante));
  const devoirsCorreges = devoirsTries.filter((d) => !d.archive && d.corrige && deLAnnee(d, anneeFiltre));
  const devoirsArchives = devoirsTries.filter((d) => d.archive && deLAnnee(d, anneeFiltre));
  // Une activité d'une année PASSÉE ni classée ni archivée n'apparaît plus
  // dans « en cours » : on la montre ici, pour qu'elle puisse être rangée.
  const devoirsOublies =
    anneeFiltre === anneeCourante
      ? []
      : devoirsTries.filter((d) => !d.archive && !d.corrige && deLAnnee(d, anneeFiltre) && (d.anneeScolaire || SANS_ANNEE) !== anneeCourante);

  // Le bloc « Activités classées » et ses onglets — même construction que la
  // page des activités de l'élève (JP, 2026-10-09) ; s'ouvre sur Classées
  type OngletClasse = 'toutes' | 'classees' | 'archivees';
  const [ongletClasse, setOngletClasse] = useState<OngletClasse>('classees');
  const archivees = [...devoirsArchives, ...partagesArchives];
  const ongletsClasses: { id: OngletClasse; label: string; n: number }[] = [
    { id: 'toutes', label: 'Toutes', n: devoirsCorreges.length + archivees.length + devoirsOublies.length },
    { id: 'classees', label: 'Classées', n: devoirsCorreges.length },
    { id: 'archivees', label: 'Archivées', n: archivees.length },
  ];

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
        await createDevoir(await donneesDeCopie(devoir, getAuthHeaders));
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

        {choixAtelierVisible && (
          <AtelierChoiceModal
            onClose={() => setChoixAtelierVisible(false)}
            onChoose={(id) => {
              setAtelierChoisi(id);
              setChoixAtelierVisible(false);
              setIsFormVisible(true);
            }}
          />
        )}

        {isFormVisible && (
          <section className={styles.creationSection}>
            <CreationForm
              key={atelierChoisi ?? 'ecriture'}
              atelierInitial={atelierChoisi}
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

        {/* Créer une activité occupe TOUTE la page : la liste « Mes Activités »
            s'efface derrière le formulaire et revient une fois l'activité créée
            (ou le formulaire fermé). Deux blocs empilés faisaient une interface
            lourde — demande JP du 2026-09-14. Même parti que le détail d'une
            classe dans Mes Classes. */}
        {/* Espace FLE : les parcours (séquences) d'abord, les activités ensuite */}
        {!isFormVisible && espace === 'fle' && (
          <section className={styles.evaluationsSection}>
            <SequencesFlePanel />
          </section>
        )}

        {!isFormVisible && (
        <section className={styles.evaluationsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{espace === 'fle' ? 'Mes activités FLE en cours' : 'Mes activités en cours'}</h2>
            <div className={styles.headerActions}>
              {/* Type d'activité — le même vocabulaire que l'étiquette de la
                  carte, pour qu'on retrouve ce qu'on a filtré. */}
              {typesDisponibles.length > 1 && (
                <select
                  className={styles.anneeSelect}
                  value={typeFiltre}
                  onChange={(e) => setTypeFiltre(e.target.value)}
                  title="Type d'activité"
                >
                  <option value={TOUS}>Tous les types</option>
                  {typesDisponibles.map((t) => (
                    <option key={t} value={t}>
                      {atelierLabel(t, true)}
                    </option>
                  ))}
                </select>
              )}

              <select
                className={styles.anneeSelect}
                value={evalFiltre}
                onChange={(e) => setEvalFiltre(e.target.value)}
                title="Nature de l'évaluation"
              >
                <option value={TOUS}>Formatif et certificatif</option>
                <option value="formatif">Formatif</option>
                <option value="certificatif">Certificatif</option>
                <option value={SANS_EVAL}>Non précisé</option>
              </select>
            </div>
          </div>

              {/* Travaux en cours */}
              <div className={styles.evaluationsGrid}>
                {devoirsLoading ? (
                  <EmptyState icon="hourglass" message="En cours de chargement" />
                ) : (
                  <>
                    <CreateDevoirCard onClick={() => setChoixAtelierVisible(true)} />
                    {devoirsActuels.length === 0 ? (
                      <p className={styles.emptySubSection}>Aucune activité en cours</p>
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

              {/* Activités d'un collègue sur mes classes partagées */}
              {partagesActuels.length > 0 && (
                <>
                  <h3 className={styles.subSectionTitle}>👥 Activités de mes classes partagées</h3>
                  <div className={styles.evaluationsGrid}>
                    {partagesActuels.map((devoir) => (
                      <DevoirCard
                        key={devoir.id}
                        devoir={devoir}
                        variant="prof"
                        onDuplicate={handleDuplicateDevoir}
                      />
                    ))}
                  </div>
                </>
              )}
        </section>
        )}

        {/* ── Activités classées : le même bloc à onglets que chez l'élève ── */}
        {!isFormVisible && (
        <section className={`${styles.evaluationsSection} ${styles.classeesSection}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Activités classées</h2>
            <div className={styles.headerActions}>
              {/* L'année ne concerne que ce bloc : le bloc « en cours » est celui
                  de l'année en cours (JP, 2026-10-09). Les années passées restent
                  accessibles, mais il faut aller les chercher. */}
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

            </div>
          </div>
          <OngletsBarre onglets={ongletsClasses} actif={ongletClasse} onChange={setOngletClasse} />
          {devoirsLoading ? (
            <EmptyState icon="hourglass" message="En cours de chargement" />
          ) : (
            <>
              {(ongletClasse === 'classees' || ongletClasse === 'toutes') &&
                (devoirsCorreges.length === 0 ? (
                  <p className={styles.ongletVide}>Aucune activité classée pour le moment.</p>
                ) : (
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
                ))}
              {ongletClasse === 'toutes' && (
                <ActivitesEtiquettes
                  devoirs={devoirsOublies}
                  hrefDe={(d) => `/dashboard/travaux/${d.id}`}
                  vide=""
                  titre="Ni classées ni archivées"
                  note="Cliquer pour ouvrir les copies"
                />
              )}
              {(ongletClasse === 'archivees' || ongletClasse === 'toutes') && (
                <>
                  <ActivitesEtiquettes
                    devoirs={archivees}
                    hrefDe={(d) => `/dashboard/travaux/${d.id}`}
                    vide="Aucune activité archivée."
                    titre={ongletClasse === 'toutes' ? 'Archivées' : undefined}
                    note="Cliquer pour ouvrir les copies"
                  />
                  {/* Désarchiver, supprimer : la page des archives garde les cartes complètes */}
                  {archivees.length > 0 && (
                    <Link href="/archives" className={styles.archivesLien}>
                      Gérer les archives →
                    </Link>
                  )}
                </>
              )}
            </>
          )}
        </section>
        )}

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
