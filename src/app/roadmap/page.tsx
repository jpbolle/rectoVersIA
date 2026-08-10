'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/auth-utils';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import styles from './roadmap.module.css';

interface NouveauteRelease {
  date: string;
  items: string[];
}

interface FutureItemData {
  titre: string;
  description: string;
}

interface FutureGroup {
  priorite: string;
  items: FutureItemData[];
}

interface RoadmapData {
  nouveautes: NouveauteRelease[];
  aVenir: FutureGroup[];
}

const DEFAULT_DATA: RoadmapData = {
  nouveautes: [
    {
      date: '5 mai 2026',
      items: [
        'Choix recto/verso de l\'espace d\'écriture : le prof décide ce qui apparaît au recto (rédaction par défaut) et au verso (planification), avec un sélecteur dans le formulaire de création/modification',
        'Sidebar élève harmonisée : nouvel ordre Consignes → Ressources → Aide IA → Remarques → Recherche → Évaluation, et masquage de l\'onglet Remarques pour les activités de vocabulaire (tout y est automatisé)',
        'Renommage « devoir » → « activité » dans les formulaires',
        'Vocabulaire : le diagnostic intermédiaire se lance directement (suppression de l\'écran intermédiaire)',
        'Vocabulaire : nouvelle barre d\'actions en fin de diagnostic intermédiaire avec 3 boutons (Évaluation, Retour à la liste, État de mes connaissances)',
        'Vocabulaire : barre d\'actions en fin de session d\'apprentissage harmonisée — bouton « Diagnostic » renommé « Diagnostic intermédiaire » et ajout du bouton « État de mes connaissances »',
        'Convention de couleurs des boutons d\'action : vert pour les boutons qui génèrent du contenu, ambre pour ceux qui affichent ou naviguent',
      ],
    },
    {
      date: '4 mai 2026',
      items: [
        'Refonte de l\'espace de travail élève : nouvelle barre d\'icônes verticale à droite (Consignes, Ressources, Évaluation, Aide IA, Remarques, Recherche)',
        'Panneau d\'assistance redimensionnable : ouverture par défaut sur Consignes au quart de l\'écran, élargissable jusqu\'aux deux tiers',
        'Largeur du panneau mémorisée d\'une session à l\'autre',
        'Le panneau peut être réduit à la simple barre d\'icônes pour maximiser la zone de rédaction',
      ],
    },
    {
      date: '1er mai 2026',
      items: [
        'Page « Mes Ressources » : onglets Grilles d\'évaluation + Listes de vocabulaire',
        'CRUD complet des listes de vocabulaire : cards, tableau éditable (terme, définition, exemple, synonymes, antonymes, proxémie)',
        'Séparation Mes listes / Listes des professeurs (duplication, lecture seule)',
        'Popup formulaire pour l\'ajout de mots',
        'Bouton « Créer avec l\'IA » : suggestions de mots par thème + import sélectif avec enrichissement automatique',
        'En-tête de tableau fixe au scroll',
        'Script d\'enrichissement IA des 326 mots existants (synonymes, antonymes, proxémie, exemples pour ados de 15 ans)',
        'Vocabulaire v2 : création simplifiée (dropdown série lexicale + mode Apprendre/Diagnostic)',
        'Interface recto/verso avec flip 3D : mots en étiquettes au recto, exercices IA au verso',
        '5 types d\'exercices IA + mode diagnostic optionnel',
      ],
    },
    {
      date: '21 mars 2026',
      items: [
        'Tableau de bord des travaux : statistiques de classe en temps réel (taux de remise, réussites, échecs, moyenne, médiane)',
        'Distribution des résultats par tranches et 3 critères les plus faibles de la classe',
        'Statistiques d\'écriture (orthographe, ponctuation, syntaxe) dépliables',
        'Header fixe sur la page de listing des travaux',
      ],
    },
    {
      date: '20 mars 2026',
      items: [
        'Intégration NavigKid : recherche guidée web dans Recto-versIA',
        'Type de travail : Écrire, Lire ou Rechercher',
        'Constructeur de questionnaire avec génération IA',
        'Extension Chrome NavigKid avec authentification Google',
        'Vue correction prof pour activités de recherche (sources, passages, stats)',
        'Aide IA pour les élèves : vérification des sources, mots-clés et réponses',
      ],
    },
    {
      date: '15 mars 2026',
      items: [
        'Multi-professeurs : chaque prof a son propre espace (classes, devoirs, grilles)',
        'Accès temporaire pour les nouveaux professeurs (1 jour, 1 semaine)',
        'Grilles partagées : grilles exemples et duplication entre professeurs',
        'Visualisation des grilles des collègues avant duplication',
        'Statistiques d\'utilisation dans l\'administration',
        'Page Roadmap accessible à tous',
      ],
    },
    {
      date: '14 mars 2026',
      items: [
        'Système de classes avec codes d\'accès (rejoindre une classe)',
        'Import en masse des élèves (CSV / texte)',
        'Suppression d\'élève avec cascade (travaux et corrections conservés)',
      ],
    },
    {
      date: '15 mars 2026',
      items: [
        'Authentification centralisée (getAuthHeaders)',
        'Correction des boucles infinies d\'authentification',
        'Panneau latéral redimensionnable',
      ],
    },
    {
      date: '28 février 2026',
      items: [
        'ContentLock fiable en production',
        'Design system Classica',
        'Import en masse des élèves',
      ],
    },
  ],
  aVenir: [
    {
      priorite: 'Prochainement',
      items: [
        {
          titre: 'Contraction de texte',
          description: 'Corriger la correction IA et le résumé / plan de texte produit par les élèves',
        },
        {
          titre: 'Choix du type de plan (activité d\'écriture)',
          description: 'À la création d\'une activité d\'écriture, le prof choisit le type de plan proposé aux élèves (CRC, plan hiérarchique, brouillon libre)',
        },
        {
          titre: 'Recherche : refonte aide IA et interface',
          description: 'Auditer et améliorer l\'aide IA dans les activités de recherche guidée (NavigKid) ainsi que l\'interface élève',
        },
        {
          titre: 'Aide IA aux plans',
          description: 'Étendre l\'aide IA à la génération et à la correction de plans d\'écriture',
        },
        {
          titre: 'Statistiques générales',
          description: 'Tableau de bord prof avec métriques transverses (usage IA, progression élèves, mots difficiles récurrents)',
        },
      ],
    },
    {
      priorite: 'Planifié',
      items: [
        {
          titre: 'Avis critique entre pairs (CRC)',
          description: 'L\'élève lit et rédige un avis sur le CRC d\'un autre élève. Attribution aléatoire et anonyme',
        },
        {
          titre: 'Grille de métacognition',
          description: 'Écart auto-évaluation / correction prof, évolution du texte entre versions',
        },
        {
          titre: 'Finalisation des corrections',
          description: 'Versioning des corrections, verrouillage après envoi à l\'élève',
        },
        {
          titre: 'Commentaires prof améliorés',
          description: 'Assistance IA pour la rédaction des commentaires + dictée vocale',
        },
        {
          titre: 'Immersive Reader',
          description: 'Synthèse vocale et découpage syllabique pour les élèves en difficulté (Microsoft Azure)',
        },
      ],
    },
    {
      priorite: 'En réflexion',
      items: [
        {
          titre: 'Chiffrement des données élèves',
          description: 'Conformité RGPD — chiffrement des données personnelles dans Firestore',
        },
        {
          titre: 'Écart visuel prof/élève',
          description: 'Comparaison détaillée dans la grille entre l\'évaluation du prof et l\'auto-évaluation',
        },
      ],
    },
  ],
};

export default function RoadmapPage() {
  const { user, isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [data, setData] = useState<RoadmapData>(DEFAULT_DATA);
  const admin = isAdmin(user?.email || '');

  // Formulaires inline
  const [addingNouveauteIndex, setAddingNouveauteIndex] = useState<number | null>(null);
  const [newNouveauteText, setNewNouveauteText] = useState('');
  const [addingNewRelease, setAddingNewRelease] = useState(false);
  const [newReleaseDate, setNewReleaseDate] = useState(''); // format YYYY-MM-DD
  const [newReleaseItem, setNewReleaseItem] = useState('');

  const todayIso = () => new Date().toISOString().slice(0, 10);

  const formatDateFr = (iso: string): string => {
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString('fr-BE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const [addingItemToGroup, setAddingItemToGroup] = useState<number | null>(null);
  const [newItemTitre, setNewItemTitre] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [addingNewGroup, setAddingNewGroup] = useState(false);
  const [newGroupPriorite, setNewGroupPriorite] = useState('');

  // Drag state pour "À venir"
  const dragItem = useRef<{ groupIdx: number; itemIdx: number } | null>(null);
  const dragOverGroup = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, authLoading, router]);

  // Charger depuis Firestore
  useEffect(() => {
    fetch('/api/roadmap')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) setData(json.data);
      })
      .catch(() => {});
  }, []);

  const save = useCallback(async (updated: RoadmapData) => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    await fetch('/api/roadmap', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }, [getAuthHeaders]);

  const updateAndSave = useCallback((updated: RoadmapData) => {
    setData(updated);
    save(updated);
  }, [save]);

  // ── Nouveautés ──

  const addNouveauteItem = (releaseIdx: number) => {
    if (!newNouveauteText.trim()) return;
    const updated = { ...data, nouveautes: data.nouveautes.map((r, i) =>
      i === releaseIdx ? { ...r, items: [newNouveauteText.trim(), ...r.items] } : r
    )};
    updateAndSave(updated);
    setNewNouveauteText('');
    setAddingNouveauteIndex(null);
  };

  const addNewRelease = () => {
    if (!newReleaseDate.trim() || !newReleaseItem.trim()) return;
    const updated = { ...data, nouveautes: [
      { date: formatDateFr(newReleaseDate), items: [newReleaseItem.trim()] },
      ...data.nouveautes,
    ]};
    updateAndSave(updated);
    setNewReleaseDate('');
    setNewReleaseItem('');
    setAddingNewRelease(false);
  };

  const removeNouveauteItem = (releaseIdx: number, itemIdx: number) => {
    const release = data.nouveautes[releaseIdx];
    const newItems = release.items.filter((_, i) => i !== itemIdx);
    const updated = {
      ...data,
      nouveautes: newItems.length > 0
        ? data.nouveautes.map((r, i) => i === releaseIdx ? { ...r, items: newItems } : r)
        : data.nouveautes.filter((_, i) => i !== releaseIdx),
    };
    updateAndSave(updated);
  };

  // ── À venir ──

  const addFutureItem = (groupIdx: number) => {
    if (!newItemTitre.trim()) return;
    const updated = { ...data, aVenir: data.aVenir.map((g, i) =>
      i === groupIdx ? { ...g, items: [{ titre: newItemTitre.trim(), description: newItemDesc.trim() }, ...g.items] } : g
    )};
    updateAndSave(updated);
    setNewItemTitre('');
    setNewItemDesc('');
    setAddingItemToGroup(null);
  };

  const addNewGroup = () => {
    if (!newGroupPriorite.trim()) return;
    const updated = { ...data, aVenir: [...data.aVenir, { priorite: newGroupPriorite.trim(), items: [] }] };
    updateAndSave(updated);
    setNewGroupPriorite('');
    setAddingNewGroup(false);
  };

  const removeFutureItem = (groupIdx: number, itemIdx: number) => {
    const group = data.aVenir[groupIdx];
    const newItems = group.items.filter((_, i) => i !== itemIdx);
    const updated = {
      ...data,
      aVenir: newItems.length > 0 || data.aVenir.length > 1
        ? data.aVenir.map((g, i) => i === groupIdx ? { ...g, items: newItems } : g)
        : data.aVenir.filter((_, i) => i !== groupIdx),
    };
    updateAndSave(updated);
  };

  // ── Drag & drop ──

  const handleDragStart = (groupIdx: number, itemIdx: number) => {
    dragItem.current = { groupIdx, itemIdx };
  };

  const handleDrop = (targetGroupIdx: number) => {
    if (!dragItem.current) return;
    const { groupIdx: fromGroup, itemIdx: fromItem } = dragItem.current;
    const item = data.aVenir[fromGroup].items[fromItem];

    const newAVenir = data.aVenir.map((g, gi) => {
      if (gi === fromGroup && gi === targetGroupIdx) {
        // même groupe : déjà en place (simple drop)
        return g;
      }
      if (gi === fromGroup) {
        return { ...g, items: g.items.filter((_, i) => i !== fromItem) };
      }
      if (gi === targetGroupIdx) {
        return { ...g, items: [item, ...g.items] };
      }
      return g;
    });

    dragItem.current = null;
    dragOverGroup.current = null;
    updateAndSave({ ...data, aVenir: newAVenir });
  };

  // Convertit une tâche « À venir » en ligne de nouveauté
  const futureItemToText = (item: FutureItemData) =>
    item.description ? `${item.titre} : ${item.description}` : item.titre;

  // Retire la tâche déplacée de sa colonne d'origine
  const removeDraggedFromAVenir = (fromGroup: number, fromItem: number) =>
    data.aVenir.map((g, gi) =>
      gi === fromGroup ? { ...g, items: g.items.filter((_, ii) => ii !== fromItem) } : g
    );

  // Dépose sur une release précise des Nouveautés
  const handleDropOnRelease = (releaseIdx: number) => {
    if (!dragItem.current) return;
    const { groupIdx: fromGroup, itemIdx: fromItem } = dragItem.current;
    const text = futureItemToText(data.aVenir[fromGroup].items[fromItem]);

    dragItem.current = null;
    dragOverGroup.current = null;
    updateAndSave({
      ...data,
      nouveautes: data.nouveautes.map((r, i) =>
        i === releaseIdx ? { ...r, items: [text, ...r.items] } : r
      ),
      aVenir: removeDraggedFromAVenir(fromGroup, fromItem),
    });
  };

  // Dépose sur la colonne Nouveautés (hors carte) : release du jour, créée au besoin
  const handleDropOnNouveautes = () => {
    if (!dragItem.current) return;
    const { groupIdx: fromGroup, itemIdx: fromItem } = dragItem.current;
    const text = futureItemToText(data.aVenir[fromGroup].items[fromItem]);
    const today = formatDateFr(todayIso());

    const existingIdx = data.nouveautes.findIndex((r) => r.date === today);
    const nouveautes =
      existingIdx >= 0
        ? data.nouveautes.map((r, i) =>
            i === existingIdx ? { ...r, items: [text, ...r.items] } : r
          )
        : [{ date: today, items: [text] }, ...data.nouveautes];

    dragItem.current = null;
    dragOverGroup.current = null;
    updateAndSave({ ...data, nouveautes, aVenir: removeDraggedFromAVenir(fromGroup, fromItem) });
  };

  if (authLoading && !isAuthenticated) return null;

  const headerVariant = role === 'prof' ? 'prof' : 'student';

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant={headerVariant} />

      <main className={styles.mainContent}>
        <h1 className={styles.pageTitle}>Roadmap</h1>
        <p className={styles.pageSubtitle}>Suivez l&apos;évolution de Recto-versIA</p>

        <div className={styles.columns}>
          {/* ── Colonne gauche : Nouveautés ── */}
          <section
            className={styles.column}
            onDragOver={(e) => { if (admin && dragItem.current) e.preventDefault(); }}
            onDrop={handleDropOnNouveautes}
          >
            <div className={styles.columnHeader}>
              <h2 className={styles.columnTitle}>Nouveautés</h2>
              {admin && (
                <button
                  type="button"
                  className={styles.addCardBtn}
                  onClick={() => { setAddingNewRelease(true); setNewReleaseDate(todayIso()); setNewReleaseItem(''); }}
                  title="Ajouter une nouvelle release"
                >
                  +
                </button>
              )}
            </div>

            {/* Formulaire nouvelle release */}
            {admin && addingNewRelease && (
              <div className={styles.addCard}>
                <input
                  type="date"
                  className={styles.addInput}
                  value={newReleaseDate}
                  onChange={(e) => setNewReleaseDate(e.target.value)}
                  autoFocus
                />
                <input
                  className={styles.addInput}
                  placeholder="Premier élément..."
                  value={newReleaseItem}
                  onChange={(e) => setNewReleaseItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addNewRelease()}
                />
                <div className={styles.addActions}>
                  <button type="button" className={styles.addConfirmBtn} onClick={addNewRelease}>Ajouter</button>
                  <button type="button" className={styles.addCancelBtn} onClick={() => { setAddingNewRelease(false); setNewReleaseDate(''); setNewReleaseItem(''); }}>Annuler</button>
                </div>
              </div>
            )}

            {data.nouveautes.map((release, releaseIdx) => (
              <div
                key={releaseIdx}
                className={styles.releaseCard}
                onDragOver={(e) => { if (admin && dragItem.current) e.preventDefault(); }}
                onDrop={(e) => { e.stopPropagation(); handleDropOnRelease(releaseIdx); }}
              >
                <div className={styles.releaseHeader}>
                  <span className={styles.releaseDate}>{release.date}</span>
                  {admin && (
                    <button
                      type="button"
                      className={styles.addInlineBtn}
                      onClick={() => { setAddingNouveauteIndex(releaseIdx); setNewNouveauteText(''); }}
                      title="Ajouter un élément"
                    >
                      +
                    </button>
                  )}
                </div>

                {/* Formulaire ajout item dans une release */}
                {admin && addingNouveauteIndex === releaseIdx && (
                  <div className={styles.addItemForm}>
                    <input
                      className={styles.addInput}
                      placeholder="Nouvelle fonctionnalité..."
                      value={newNouveauteText}
                      onChange={(e) => setNewNouveauteText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addNouveauteItem(releaseIdx)}
                      autoFocus
                    />
                    <div className={styles.addActions}>
                      <button type="button" className={styles.addConfirmBtn} onClick={() => addNouveauteItem(releaseIdx)}>Ajouter</button>
                      <button type="button" className={styles.addCancelBtn} onClick={() => setAddingNouveauteIndex(null)}>Annuler</button>
                    </div>
                  </div>
                )}

                <ul className={styles.itemList}>
                  {release.items.map((item, itemIdx) => (
                    <li key={itemIdx} className={styles.item}>
                      <span className={styles.checkIcon}>&#10003;</span>
                      <span className={styles.itemText}>{item}</span>
                      {admin && (
                        <button
                          type="button"
                          className={styles.removeItemBtn}
                          onClick={() => removeNouveauteItem(releaseIdx, itemIdx)}
                          title="Supprimer"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          {/* ── Colonne droite : À venir ── */}
          <section className={styles.column}>
            <div className={styles.columnHeader}>
              <h2 className={styles.columnTitle}>À venir</h2>
              {admin && (
                <button
                  type="button"
                  className={styles.addCardBtn}
                  onClick={() => setAddingNewGroup(true)}
                  title="Ajouter un groupe"
                >
                  +
                </button>
              )}
            </div>

            {/* Formulaire nouveau groupe */}
            {admin && addingNewGroup && (
              <div className={styles.addCard}>
                <input
                  className={styles.addInput}
                  placeholder="Nom du groupe (ex : Urgent)"
                  value={newGroupPriorite}
                  onChange={(e) => setNewGroupPriorite(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addNewGroup()}
                  autoFocus
                />
                <div className={styles.addActions}>
                  <button type="button" className={styles.addConfirmBtn} onClick={addNewGroup}>Ajouter</button>
                  <button type="button" className={styles.addCancelBtn} onClick={() => { setAddingNewGroup(false); setNewGroupPriorite(''); }}>Annuler</button>
                </div>
              </div>
            )}

            {data.aVenir.map((group, groupIdx) => (
              <div
                key={groupIdx}
                className={styles.futureCard}
                onDragOver={(e) => { e.preventDefault(); dragOverGroup.current = groupIdx; }}
                onDrop={() => handleDrop(groupIdx)}
              >
                <div className={styles.futureCardHeader}>
                  <h3 className={styles.prioriteLabel}>{group.priorite}</h3>
                  {admin && (
                    <button
                      type="button"
                      className={styles.addInlineBtn}
                      onClick={() => { setAddingItemToGroup(groupIdx); setNewItemTitre(''); setNewItemDesc(''); }}
                      title="Ajouter une tâche"
                    >
                      +
                    </button>
                  )}
                </div>

                {/* Formulaire ajout item dans un groupe */}
                {admin && addingItemToGroup === groupIdx && (
                  <div className={styles.addItemForm}>
                    <input
                      className={styles.addInput}
                      placeholder="Titre..."
                      value={newItemTitre}
                      onChange={(e) => setNewItemTitre(e.target.value)}
                      autoFocus
                    />
                    <textarea
                      className={`${styles.addInput} ${styles.addTextarea}`}
                      placeholder="Description (optionnelle)..."
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      rows={2}
                    />
                    <div className={styles.addActions}>
                      <button type="button" className={styles.addConfirmBtn} onClick={() => addFutureItem(groupIdx)}>Ajouter</button>
                      <button type="button" className={styles.addCancelBtn} onClick={() => setAddingItemToGroup(null)}>Annuler</button>
                    </div>
                  </div>
                )}

                {group.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className={`${styles.futureItem} ${admin ? styles.futureItemDraggable : ''}`}
                    draggable={admin}
                    onDragStart={() => admin && handleDragStart(groupIdx, itemIdx)}
                  >
                    {admin && <span className={styles.dragHandle}>⠿</span>}
                    <div className={styles.futureItemContent}>
                      <h4 className={styles.futureTitle}>{item.titre}</h4>
                      {item.description && <p className={styles.futureDesc}>{item.description}</p>}
                    </div>
                    {admin && (
                      <button
                        type="button"
                        className={styles.removeItemBtn}
                        onClick={() => removeFutureItem(groupIdx, itemIdx)}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {group.items.length === 0 && (
                  <p className={styles.emptyGroup}>Glissez des tâches ici</p>
                )}
              </div>
            ))}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
