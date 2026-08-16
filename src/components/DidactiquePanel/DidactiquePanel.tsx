'use client';

// Onglet « Gestion didactique » de la page /admin.
//
// Deux parties :
//  1. UAA du programme — liste inchangée (œil / poubelle / champ + « + »)
//  2. Les habiletés, un tableau replié par type modal (gestes de lecture,
//     d'écriture, de parole, de recherche, réflexifs).
//
// Tout se modifie EN PLACE dans le tableau (geste, habileté, objet, UAA) :
// la popup ne sert qu'à créer une habileté. L'enregistrement part au blur
// (champs texte) ou immédiatement (œil, UAA, suppression) — la configuration
// entière est renvoyée à chaque fois, comme avant.
//
// Masquer (œil) retire l'élément des nouveaux formulaires sans toucher aux
// contenus qui l'utilisent déjà — préférer masquer quand l'élément a servi.

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { setDidactiqueCache } from '@/hooks/useDidactique';
import {
  ATELIER_PAR_MODE,
  ATELIERS,
  atelierLabel,
  DEFAULT_DIDACTIQUE,
  TYPES_MODAUX,
} from '@/types/didactique';
import TagInput from '@/components/TagInput/TagInput';
import type {
  DidactiqueConfig,
  DidactiqueItem,
  Habilete,
  TypeModal,
} from '@/types/didactique';
import styles from './DidactiquePanel.module.css';

function generateHabileteId(): string {
  return `H-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Valeur sentinelle du menu « geste » : bascule vers la saisie libre. */
const NOUVEAU = '__nouveau__';

const EMPTY_DRAFT = {
  geste: '',
  label: '',
  objets: [] as string[],
  uaa: [] as string[],
  ateliers: [] as string[],
};

export default function DidactiquePanel() {
  const { getAuthHeaders } = useAuth();
  const [config, setConfig] = useState<DidactiqueConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sections repliées par défaut — la page reste digeste
  const [openType, setOpenType] = useState<TypeModal | null>(null);

  // Filtres, communs à tous les tableaux
  const [query, setQuery] = useState('');
  const [filterUaa, setFilterUaa] = useState('');
  const [filterObjet, setFilterObjet] = useState('');
  const [filterAtelier, setFilterAtelier] = useState('');
  const [grouped, setGrouped] = useState(true);

  // Sélecteur à cases ouvert sur une ligne (UAA ou ateliers)
  const [picker, setPicker] = useState<{ id: string; kind: 'uaa' | 'ateliers' } | null>(null);

  // Ajout d'une UAA
  const [uaaDraft, setUaaDraft] = useState('');
  const [methodeDraft, setMethodeDraft] = useState('');

  // Popup de création d'habileté
  const [creating, setCreating] = useState<TypeModal | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  // Le geste se choisit dans une liste ; ce drapeau bascule vers la saisie
  // libre quand aucun geste existant ne convient.
  const [nouveauGeste, setNouveauGeste] = useState(false);

  // Glisser-déposer des habiletés : `dragArme` n'autorise le glisser qu'après
  // un appui sur la poignée (sinon les champs de saisie deviennent inutilisables).
  const [dragArme, setDragArme] = useState<string | null>(null);
  const [dragHab, setDragHab] = useState<string | null>(null);
  const [overHab, setOverHab] = useState<string | null>(null);
  const [overGeste, setOverGeste] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/didactique', { headers });
        const json = await res.json();
        setConfig(json.success && json.data ? json.data : DEFAULT_DIDACTIQUE);
      } catch {
        setConfig(DEFAULT_DIDACTIQUE);
        setError('Impossible de charger la configuration.');
      }
    };
    load();
  }, [getAuthHeaders]);

  // Enregistre la configuration complète (optimiste : l'état est déjà à jour)
  const persist = async (next: DidactiqueConfig) => {
    const previous = config;
    setConfig(next);
    setIsSaving(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/didactique', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDidactiqueCache(json.data);
      } else {
        setConfig(previous);
        setError(json.message || "Erreur lors de l'enregistrement.");
      }
    } catch {
      setConfig(previous);
      setError("Erreur de connexion pendant l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  // Frappe dans une cellule : état local seulement, l'enregistrement part au blur
  const edit = (id: string, patch: Partial<Habilete>) => {
    setConfig((c) =>
      c ? { ...c, habiletes: c.habiletes.map((h) => (h.id === id ? { ...h, ...patch } : h)) } : c
    );
  };

  const commit = () => {
    if (config) persist(config);
  };

  const editAndSave = (id: string, patch: Partial<Habilete>) => {
    if (!config) return;
    persist({
      ...config,
      habiletes: config.habiletes.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    });
  };

  // Renommer un geste renomme toutes les habiletés du même type qui le portent
  const renameGeste = (type: TypeModal, from: string, to: string) => {
    if (!config || !to.trim() || to === from) return;
    persist({
      ...config,
      habiletes: config.habiletes.map((h) =>
        h.type === type && h.geste === from ? { ...h, geste: to.trim() } : h
      ),
    });
  };

  const removeHabilete = (h: Habilete) => {
    if (!config) return;
    const ok = window.confirm(
      `Supprimer « ${h.label || h.geste} » ?\n\nSi cette habileté a déjà été utilisée dans des grilles ou des questionnaires, préférez la masquer (œil) : la suppression ne modifie pas les contenus existants, mais leur libellé ne sera plus retrouvé.`
    );
    if (!ok) return;
    persist({ ...config, habiletes: config.habiletes.filter((x) => x.id !== h.id) });
  };

  const createHabilete = () => {
    if (!config || !creating) return;
    if (!draft.geste.trim() || !draft.label.trim()) return;
    persist({
      ...config,
      habiletes: [
        ...config.habiletes,
        {
          id: generateHabileteId(),
          type: creating,
          geste: draft.geste.trim(),
          label: draft.label.trim(),
          objets: draft.objets,
          uaa: draft.uaa,
          ateliers: draft.ateliers,
          visible: true,
        },
      ],
    });
    setCreating(null);
    setDraft(EMPTY_DRAFT);
  };

  // ── UAA ────────────────────────────────────────────────────────────────
  const updateUaa = (items: DidactiqueItem[]) => {
    if (!config) return;
    persist({ ...config, uaa: items });
  };

  const addUaa = () => {
    if (!config) return;
    const label = uaaDraft.trim();
    if (!label) return;
    const id = String(Math.max(-1, ...config.uaa.map((u) => Number(u.id) || 0)) + 1);
    updateUaa([...config.uaa, { id, label, visible: true }]);
    setUaaDraft('');
  };

  // ── Méthodes d'enseignement ────────────────────────────────────────────
  // Alimentent la colonne « Méthode » des modules d'une scénarisation
  // (Mes Ressources → Design & scénarisation didactique).
  const updateMethodes = (items: DidactiqueItem[]) => {
    if (!config) return;
    persist({ ...config, methodes: items });
  };

  const addMethode = () => {
    if (!config) return;
    const label = methodeDraft.trim();
    if (!label) return;
    // Identifiant lisible dérivé du libellé — stable une fois posé
    const base = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const existants = new Set(config.methodes.map((m) => m.id));
    let id = base || `methode-${config.methodes.length + 1}`;
    let n = 2;
    while (existants.has(id)) id = `${base}-${n++}`;
    updateMethodes([...config.methodes, { id, label, visible: true }]);
    setMethodeDraft('');
  };

  // ── Filtrage ───────────────────────────────────────────────────────────
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (h: Habilete) => {
      if (filterUaa && !h.uaa.includes(filterUaa)) return false;
      if (filterAtelier && !h.ateliers.includes(filterAtelier)) return false;
      if (filterObjet === 'vide' && h.objets.length) return false;
      if (filterObjet === 'plein' && !h.objets.length) return false;
      if (q && !`${h.geste} ${h.label} ${h.objets.join(' ')}`.toLowerCase().includes(q)) return false;
      return true;
    };
  }, [query, filterUaa, filterObjet, filterAtelier]);

  const objetSuggestions = useMemo(
    () => [...new Set((config?.habiletes ?? []).flatMap((h) => h.objets))].sort(),
    [config]
  );
  // Suggestions du champ « geste » d'une LIGNE du tableau : cette ligne
  // appartient déjà à une famille, donc pas de filtre à appliquer ici — la
  // datalist ne sert qu'à éviter les fautes de frappe sur un nom existant.
  const gesteSuggestions = useMemo(
    () => [...new Set((config?.habiletes ?? []).map((h) => h.geste).filter(Boolean))].sort(),
    [config]
  );

  // Les gestes de la famille en cours de création — c'est cette liste-là qui
  // remplace l'ancienne liste de TOUS les gestes du projet.
  const gestesDeLaFamille = useMemo(
    () =>
      creating
        ? [
            ...new Set(
              (config?.habiletes ?? [])
                .filter((h) => h.type === creating && h.geste.trim())
                .map((h) => h.geste)
            ),
          ].sort((a, b) => a.localeCompare(b, 'fr'))
        : [],
    [config, creating]
  );

  if (!config) {
    return (
      <section className={styles.section}>
        <p className={styles.hint}>Chargement...</p>
      </section>
    );
  }

  /**
   * ── DÉPLACEMENT D'UNE HABILETÉ ──
   *
   * Un seul geste couvre les deux besoins de JP (2026-08-16) : déplacer une
   * habileté DANS son geste, ou la faire passer d'un geste à l'autre. Déposer
   * sur une ligne, c'est se placer devant elle ET adopter son geste.
   *
   * Les tableaux sont repliés par famille et un seul s'ouvre à la fois
   * (`openType`) : un glisser ne peut donc pas emmener une habileté de lecture
   * chez les gestes d'écriture. C'est voulu — la famille n'est pas un rangement
   * mais une nature.
   *
   * L'ordre affiché est celui du tableau `config.habiletes` : réordonner le
   * tableau réordonne l'affichage, dans un groupe comme entre groupes.
   */
  const deplacerHabilete = (idGlisse: string, cible: { avantId?: string; geste: string }) => {
    if (!config) return;
    const liste = [...config.habiletes];
    const iSrc = liste.findIndex((x) => x.id === idGlisse);
    if (iSrc === -1) return;
    const [item] = liste.splice(iSrc, 1);
    const deplace = item.geste === cible.geste ? item : { ...item, geste: cible.geste };

    let iDest: number;
    if (cible.avantId) {
      const i = liste.findIndex((x) => x.id === cible.avantId);
      iDest = i === -1 ? liste.length : i;
    } else {
      // Dépôt sur l'en-tête d'un geste : à la fin de ce geste, pas au début —
      // on ajoute une habileté à un geste, on ne la met pas en avant.
      const derniers = liste
        .map((x, i) => (x.type === deplace.type && x.geste === cible.geste ? i : -1))
        .filter((i) => i >= 0);
      iDest = derniers.length ? derniers[derniers.length - 1] + 1 : liste.length;
    }
    liste.splice(iDest, 0, deplace);
    persist({ ...config, habiletes: liste });
  };

  const finDeGlisser = () => {
    setDragHab(null);
    setOverHab(null);
    setOverGeste(null);
    setDragArme(null);
  };

  // Une ligne du tableau
  const renderRow = (h: Habilete) => (
    <tr
      key={h.id}
      // `draggable` n'est armé qu'au clic sur la poignée : une ligne
      // entièrement glissable empêcherait de sélectionner le texte de ses
      // champs de saisie.
      draggable={dragArme === h.id}
      onDragStart={() => setDragHab(h.id)}
      onDragEnd={finDeGlisser}
      onDragOver={(e) => {
        if (!dragHab || dragHab === h.id) return;
        e.preventDefault();
        setOverHab(h.id);
        setOverGeste(null);
      }}
      onDrop={(e) => {
        if (!dragHab || dragHab === h.id) return;
        e.preventDefault();
        deplacerHabilete(dragHab, { avantId: h.id, geste: h.geste });
        finDeGlisser();
      }}
      className={[
        h.visible ? '' : styles.rowHidden,
        dragHab === h.id ? styles.rowDragging : '',
        overHab === h.id ? styles.rowOver : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <td>
        <span
          className={styles.grip}
          title="Glisser pour déplacer — dans ce geste ou vers un autre"
          onMouseDown={() => setDragArme(h.id)}
          onMouseUp={() => setDragArme(null)}
        >
          ⣿
        </span>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => editAndSave(h.id, { visible: !h.visible })}
          title={h.visible ? 'Masquer dans les formulaires' : 'Afficher dans les formulaires'}
        >
          {h.visible ? '👁' : '🚫'}
        </button>
      </td>
      {!grouped && (
        <td className={styles.colGeste}>
          <input
            className={styles.cell}
            value={h.geste}
            onChange={(e) => edit(h.id, { geste: e.target.value })}
            onBlur={commit}
            list="didactique-gestes"
          />
        </td>
      )}
      <td>
        <input
          className={styles.cell}
          value={h.label}
          placeholder="Je suis capable de…"
          onChange={(e) => edit(h.id, { label: e.target.value })}
          onBlur={commit}
        />
      </td>
      <td>
        <TagInput
          value={h.objets}
          suggestions={objetSuggestions}
          listId="didactique-objets"
          placeholder="objet à définir…"
          onChange={(objets) => editAndSave(h.id, { objets })}
        />
      </td>
      {/* Ateliers où l'habileté se travaille — plusieurs possibles */}
      <td className={styles.uaaCellWrap}>
        <button
          type="button"
          className={styles.uaaCell}
          onClick={() =>
            setPicker(
              picker?.id === h.id && picker.kind === 'ateliers'
                ? null
                : { id: h.id, kind: 'ateliers' }
            )
          }
          title="Choisir les ateliers où elle se travaille"
        >
          {h.ateliers.length ? (
            h.ateliers.map((a) => (
              <span key={a} className={styles.uaaChip}>
                {atelierLabel(a, true)}
              </span>
            ))
          ) : (
            <span className={styles.uaaEmpty}>+ atelier</span>
          )}
        </button>
        {picker?.id === h.id && picker.kind === 'ateliers' && (
          <div className={styles.picker}>
            {ATELIERS.map((a) => (
              <label key={a.id} className={styles.pickerRow}>
                <input
                  type="checkbox"
                  checked={h.ateliers.includes(a.id)}
                  onChange={(e) =>
                    editAndSave(h.id, {
                      ateliers: e.target.checked
                        ? [...h.ateliers, a.id].sort()
                        : h.ateliers.filter((x) => x !== a.id),
                    })
                  }
                />
                <span>{a.label}</span>
              </label>
            ))}
            <button type="button" className={styles.pickerClose} onClick={() => setPicker(null)}>
              Fermer
            </button>
          </div>
        )}
      </td>
      <td className={styles.uaaCellWrap}>
        <button
          type="button"
          className={styles.uaaCell}
          onClick={() =>
            setPicker(picker?.id === h.id && picker.kind === 'uaa' ? null : { id: h.id, kind: 'uaa' })
          }
          title="Choisir les UAA visées"
        >
          {h.uaa.length ? (
            h.uaa.map((u) => (
              <span key={u} className={styles.uaaChip}>
                UAA {u}
              </span>
            ))
          ) : (
            <span className={styles.uaaEmpty}>+ UAA</span>
          )}
        </button>
        {picker?.id === h.id && picker.kind === 'uaa' && (
          <div className={styles.pickerRight}>
            {config.uaa.map((u) => (
              <label key={u.id} className={styles.pickerRow}>
                <input
                  type="checkbox"
                  checked={h.uaa.includes(u.id)}
                  onChange={(e) =>
                    editAndSave(h.id, {
                      uaa: e.target.checked
                        ? [...h.uaa, u.id].sort()
                        : h.uaa.filter((x) => x !== u.id),
                    })
                  }
                />
                <span>
                  <b>UAA {u.id}</b> — {u.label}
                </span>
              </label>
            ))}
            <button type="button" className={styles.pickerClose} onClick={() => setPicker(null)}>
              Fermer
            </button>
          </div>
        )}
      </td>
      <td className={styles.actions}>
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.iconDelete}`}
          onClick={() => removeHabilete(h)}
          title="Supprimer définitivement"
        >
          🗑
        </button>
      </td>
    </tr>
  );

  return (
    <section className={styles.section}>
      {/* Le titre de la page /admin porte déjà « Gestion didactique » */}
      {isSaving && <p className={styles.saving}>Enregistrement...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {/* Suggestions partagées par tous les champs */}
      <datalist id="didactique-objets">
        {objetSuggestions.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id="didactique-gestes">
        {gesteSuggestions.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {/* UAA et méthodes — deux listes courtes du référentiel, côte à côte dans
          un seul bloc : toujours visibles, jamais repliées */}
      <div className={`${styles.card} ${styles.card_uaa}`}>
        <div className={styles.cardHeadStatic}>
          <span className={styles.cardTitle}>Référentiel du cours</span>
          <span className={styles.cardCount}>
            {config.uaa.length} UAA · {config.methodes.length} méthode
            {config.methodes.length > 1 ? 's' : ''} d&apos;enseignement
          </span>
        </div>
        <div className={styles.twoCols}>
        <div className={styles.colBlock}>
          <p className={styles.colTitle}>
            UAA de français
            <span>Unités d&apos;acquis d&apos;apprentissage du programme</span>
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colEye} />
                <th className={styles.colNum}>N°</th>
                <th>Intitulé</th>
                <th className={styles.colAct} />
              </tr>
            </thead>
            <tbody>
              {config.uaa.map((u) => (
                <tr key={u.id} className={u.visible ? '' : styles.rowHidden}>
                  <td>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() =>
                        updateUaa(
                          config.uaa.map((x) => (x.id === u.id ? { ...x, visible: !x.visible } : x))
                        )
                      }
                      title={
                        u.visible
                          ? 'Masquer dans les formulaires'
                          : 'Afficher dans les formulaires'
                      }
                    >
                      {u.visible ? '👁' : '🚫'}
                    </button>
                  </td>
                  <td className={styles.uaaNum}>UAA {u.id}</td>
                  <td>
                    <input
                      className={styles.cell}
                      value={u.label}
                      onChange={(e) =>
                        setConfig((c) =>
                          c
                            ? {
                                ...c,
                                uaa: c.uaa.map((x) =>
                                  x.id === u.id ? { ...x, label: e.target.value } : x
                                ),
                              }
                            : c
                        )
                      }
                      onBlur={commit}
                    />
                  </td>
                  <td className={styles.actions}>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconDelete}`}
                      onClick={() => {
                        if (window.confirm(`Supprimer l'UAA ${u.id} — « ${u.label} » ?`)) {
                          updateUaa(config.uaa.filter((x) => x.id !== u.id));
                        }
                      }}
                      title="Supprimer définitivement"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.addRow}>
            <input
              className={styles.addInput}
              value={uaaDraft}
              onChange={(e) => setUaaDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addUaa();
                }
              }}
              placeholder="Intitulé de la nouvelle UAA..."
            />
            <button type="button" className={styles.addBtn} onClick={addUaa} disabled={isSaving}>
              +
            </button>
          </div>
        </div>

        {/* Méthodes d'enseignement — liste ouverte, alimentée par l'admin, lue
            par la colonne « Méthode » des modules d'une scénarisation */}
        <div className={styles.colBlock}>
          <p className={styles.colTitle}>
            Méthodes d&apos;enseignement
            <span>Proposées aux modules d&apos;une scénarisation</span>
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colEye} />
                <th>Intitulé</th>
                <th className={styles.colAct} />
              </tr>
            </thead>
            <tbody>
              {config.methodes.map((m) => (
                <tr key={m.id} className={m.visible ? '' : styles.rowHidden}>
                  <td>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() =>
                        updateMethodes(
                          config.methodes.map((x) =>
                            x.id === m.id ? { ...x, visible: !x.visible } : x
                          )
                        )
                      }
                      title={m.visible ? 'Masquer dans les formulaires' : 'Afficher dans les formulaires'}
                    >
                      {m.visible ? '👁' : '🚫'}
                    </button>
                  </td>
                  <td>
                    <input
                      className={styles.cell}
                      value={m.label}
                      onChange={(e) =>
                        setConfig((c) =>
                          c
                            ? {
                                ...c,
                                methodes: c.methodes.map((x) =>
                                  x.id === m.id ? { ...x, label: e.target.value } : x
                                ),
                              }
                            : c
                        )
                      }
                      onBlur={commit}
                    />
                  </td>
                  <td className={styles.actions}>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconDelete}`}
                      onClick={() => {
                        if (window.confirm(`Supprimer la méthode « ${m.label} » ?`)) {
                          updateMethodes(config.methodes.filter((x) => x.id !== m.id));
                        }
                      }}
                      title="Supprimer définitivement"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.addRow}>
            <input
              className={styles.addInput}
              value={methodeDraft}
              onChange={(e) => setMethodeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMethode();
                }
              }}
              placeholder="Nouvelle méthode : cours magistral, classe inversée…"
            />
            <button type="button" className={styles.addBtn} onClick={addMethode} disabled={isSaving}>
              +
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Filtres — ils portent sur les tableaux d'habiletés, juste en dessous */}
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un geste, une habileté, un objet…"
        />
        <select
          className={styles.filter}
          value={filterUaa}
          onChange={(e) => setFilterUaa(e.target.value)}
        >
          <option value="">Toutes les UAA</option>
          {config.uaa.map((u) => (
            <option key={u.id} value={u.id}>
              UAA {u.id} — {u.label}
            </option>
          ))}
        </select>
        <select
          className={styles.filter}
          value={filterAtelier}
          onChange={(e) => setFilterAtelier(e.target.value)}
        >
          <option value="">Tous les ateliers</option>
          {ATELIERS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          className={styles.filter}
          value={filterObjet}
          onChange={(e) => setFilterObjet(e.target.value)}
        >
          <option value="">Objet : tous</option>
          <option value="vide">Sans objet</option>
          <option value="plein">Avec objet</option>
        </select>
        <label className={styles.switch}>
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
          Grouper par geste
        </label>
      </div>

      {/* Un tableau replié par type modal */}
      {TYPES_MODAUX.map((t) => {
        const all = config.habiletes.filter((h) => h.type === t.id);
        const rows = all.filter(matches);
        const withObjet = all.filter((h) => h.objets.length).length;
        const isOpen = openType === t.id;

        const groups = new Map<string, Habilete[]>();
        rows.forEach((h) => {
          if (!groups.has(h.geste)) groups.set(h.geste, []);
          groups.get(h.geste)!.push(h);
        });

        return (
          <div key={t.id} className={`${styles.card} ${styles[`card_${t.id}`]}`}>
            <button
              type="button"
              className={styles.cardHead}
              onClick={() => setOpenType(isOpen ? null : t.id)}
            >
              <span className={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
              <span className={styles.cardTitle}>{t.title}</span>
              <span className={styles.cardCount}>
                {all.length} habileté{all.length > 1 ? 's' : ''}
                {all.length > 0 && ` · ${withObjet} avec objet`}
              </span>
            </button>

            {isOpen && (
              <div className={styles.cardBody}>
                {rows.length === 0 ? (
                  <p className={styles.empty}>
                    {all.length
                      ? 'Aucune habileté ne correspond aux filtres.'
                      : 'Aucune habileté — ajoutez-en une ci-dessous.'}
                  </p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.colEye} />
                        {!grouped && <th className={styles.colGeste}>Geste</th>}
                        <th>Habileté</th>
                        <th className={styles.colObjet}>Objet</th>
                        <th className={styles.colAtelier}>Ateliers</th>
                        <th className={styles.colUaa}>UAA</th>
                        <th className={styles.colAct} />
                      </tr>
                    </thead>
                    <tbody>
                      {grouped
                        ? [...groups].map(([nom, list]) => (
                            <GesteGroup
                              key={nom}
                              nom={nom}
                              count={list.length}
                              onRename={(to) => renameGeste(t.id, nom, to)}
                              survole={overGeste === nom}
                              onSurvol={() => {
                                if (!dragHab) return;
                                setOverGeste(nom);
                                setOverHab(null);
                              }}
                              onDepot={() => {
                                if (!dragHab) return;
                                deplacerHabilete(dragHab, { geste: nom });
                                finDeGlisser();
                              }}
                            >
                              {list.map(renderRow)}
                            </GesteGroup>
                          ))
                        : rows.map(renderRow)}
                    </tbody>
                  </table>
                )}
                <div className={styles.cardFoot}>
                  <button
                    type="button"
                    className={styles.addHabBtn}
                    onClick={() => {
                      // L'atelier qui va de soi pour ce type modal est déjà coché
                      const auto = ATELIER_PAR_MODE[t.id];
                      setDraft({ ...EMPTY_DRAFT, ateliers: auto ? [auto] : [] });
                      // Une famille sans aucun geste : la saisie libre d'emblée,
                      // sinon on ouvre sur un menu vide sans le dire.
                      setNouveauGeste(
                        !config.habiletes.some((h) => h.type === t.id && h.geste.trim())
                      );
                      setCreating(t.id);
                    }}
                  >
                    + Nouvelle habileté
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Popup de création */}
      {creating && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreating(null);
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h3>Nouvelle habileté</h3>
              <p>{TYPES_MODAUX.find((t) => t.id === creating)?.title}</p>
            </div>
            <div className={styles.modalBody}>
              {/* ── CHOIX DU GESTE EN DEUX TEMPS ──
                  Une liste unique de tous les gestes du projet (lecture,
                  écriture, parole, lexique, réflexif, savoir-être confondus)
                  était impraticable : « je suis perdu car longue liste » (JP,
                  2026-08-16). On demande donc la FAMILLE d'abord, et on ne
                  propose ensuite que les gestes de cette famille. */}
              <div className={styles.field}>
                <label htmlFor="dp-famille">Famille de gestes</label>
                <select
                  id="dp-famille"
                  value={creating}
                  onChange={(e) => {
                    // Les gestes appartiennent à une famille : changer de
                    // famille rend le geste choisi caduc, on le vide.
                    setCreating(e.target.value as TypeModal);
                    setDraft((d) => ({ ...d, geste: '' }));
                    setNouveauGeste(false);
                  }}
                >
                  {TYPES_MODAUX.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="dp-geste">Geste général</label>
                {nouveauGeste ? (
                  <>
                    <input
                      id="dp-geste"
                      value={draft.geste}
                      onChange={(e) => setDraft((d) => ({ ...d, geste: e.target.value }))}
                      placeholder="Comprendre les consignes"
                      autoFocus
                    />
                    {gestesDeLaFamille.length > 0 && (
                      <button
                        type="button"
                        className={styles.lienDiscret}
                        onClick={() => {
                          setNouveauGeste(false);
                          setDraft((d) => ({ ...d, geste: '' }));
                        }}
                      >
                        ← Reprendre un geste existant
                      </button>
                    )}
                  </>
                ) : (
                  <select
                    id="dp-geste"
                    value={draft.geste}
                    onChange={(e) => {
                      if (e.target.value === NOUVEAU) {
                        setNouveauGeste(true);
                        setDraft((d) => ({ ...d, geste: '' }));
                        return;
                      }
                      setDraft((d) => ({ ...d, geste: e.target.value }));
                    }}
                  >
                    <option value="">— choisir un geste —</option>
                    {gestesDeLaFamille.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                    <option value={NOUVEAU}>＋ Nouveau geste…</option>
                  </select>
                )}
                <p className={styles.fieldHelp}>
                  {nouveauGeste
                    ? 'Ce nom créera un nouveau groupe dans cette famille.'
                    : 'Reprendre un geste existant l’enrichit d’une habileté de plus.'}
                </p>
              </div>
              <div className={styles.field}>
                <label htmlFor="dp-label">Habileté particulière</label>
                <textarea
                  id="dp-label"
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  placeholder="Je suis capable de…"
                />
              </div>
              <div className={styles.field}>
                <label>Objets sur lesquels elle s&apos;exerce</label>
                <TagInput
                  value={draft.objets}
                  suggestions={objetSuggestions}
                  listId="didactique-objets"
                  placeholder="contraction de texte, CRC, critique littéraire…"
                  onChange={(objets) => setDraft((d) => ({ ...d, objets }))}
                />
              </div>
              <div className={styles.field}>
                <label>Ateliers où elle se travaille</label>
                <div className={styles.uaaPick}>
                  {ATELIERS.map((a) => (
                    <label key={a.id}>
                      <input
                        type="checkbox"
                        checked={draft.ateliers.includes(a.id)}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            ateliers: e.target.checked
                              ? [...d.ateliers, a.id].sort()
                              : d.ateliers.filter((x) => x !== a.id),
                          }))
                        }
                      />
                      {a.court}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <label>UAA visées</label>
                <div className={styles.uaaPick}>
                  {config.uaa.map((u) => (
                    <label key={u.id} title={u.label}>
                      <input
                        type="checkbox"
                        checked={draft.uaa.includes(u.id)}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            uaa: e.target.checked
                              ? [...d.uaa, u.id].sort()
                              : d.uaa.filter((x) => x !== u.id),
                          }))
                        }
                      />
                      UAA {u.id}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={styles.btnGhost} onClick={() => setCreating(null)}>
                Annuler
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={createHabilete}
                disabled={!draft.geste.trim() || !draft.label.trim()}
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// En-tête de groupe : le nom du geste est éditable et renomme tout le groupe
function GesteGroup({
  nom,
  count,
  onRename,
  survole,
  onSurvol,
  onDepot,
  children,
}: {
  nom: string;
  count: number;
  onRename: (to: string) => void;
  /** Une habileté est en train d'être glissée au-dessus de ce geste */
  survole?: boolean;
  onSurvol?: () => void;
  onDepot?: () => void;
  children: ReactNode;
}) {
  // La clé du composant est le nom du geste : un renommage remonte le
  // composant, l'état local repart donc de la bonne valeur.
  const [value, setValue] = useState(nom);

  return (
    <>
      {/* Déposer sur l'en-tête range l'habileté À LA FIN de ce geste. C'est ce
          qui permet de la faire passer dans un geste VIDE de la vue filtrée,
          ou de la mettre en dernier sans viser une ligne précise. */}
      <tr
        className={`${styles.groupRow} ${survole ? styles.groupRowOver : ''}`}
        onDragOver={(e) => {
          if (!onDepot) return;
          e.preventDefault();
          onSurvol?.();
        }}
        onDrop={(e) => {
          if (!onDepot) return;
          e.preventDefault();
          onDepot();
        }}
      >
        <td colSpan={6}>
          <div className={styles.groupTitle}>
            <input
              className={styles.cellGeste}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => (value.trim() ? onRename(value) : setValue(nom))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setValue(nom);
              }}
              title="Renommer ce geste renomme toutes ses habiletés"
            />
            <span className={styles.groupCount}>
              {count} habileté{count > 1 ? 's' : ''}
            </span>
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}
