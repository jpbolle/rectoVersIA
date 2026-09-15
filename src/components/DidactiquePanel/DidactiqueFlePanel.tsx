'use client';

// Onglet « Gestion didactique » de /admin, référentiel FLE (français langue
// étrangère). Jumeau de `DidactiquePanel` pour les classes DASPA : mêmes
// styles, même mécanique (état optimiste, enregistrement au blur ou
// immédiat, œil pour masquer), mais un autre modèle :
//
//  1. Compétences — les huit branches du radar CECR
//  2. Niveaux — les crans du CECR (pré-A1 → C2), ordonnés par rang
//  3. Types de module — qualifient un module de la bibliothèque FLE
//  4. Descripteurs « Je peux… » — une carte repliable par compétence,
//     les descripteurs groupés par niveau
//
// Pas de `window.confirm` : les suppressions passent par une popup de
// l'application (consigne durable, dépôt harnais).

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { setDidactiqueFleCache } from '@/hooks/useDidactiqueFle';
import { DEFAULT_DIDACTIQUE_FLE, slugFle } from '@/types/didactique-fle';
import type {
  DescripteurFle,
  DidactiqueFleConfig,
  DidactiqueItem,
  NiveauCecr,
} from '@/types/didactique-fle';
import styles from './DidactiquePanel.module.css';

function generateDescripteurId(): string {
  return `DF-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

type Confirmation = { titre: string; texte: string; onConfirm: () => void };

export default function DidactiqueFlePanel() {
  const { getAuthHeaders } = useAuth();
  const [config, setConfig] = useState<DidactiqueFleConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Cartes de descripteurs repliées par défaut — une seule ouverte à la fois
  const [openCompetence, setOpenCompetence] = useState<string | null>(null);

  // Champs d'ajout
  const [competenceDraft, setCompetenceDraft] = useState('');
  const [niveauDraft, setNiveauDraft] = useState('');
  const [typeDraft, setTypeDraft] = useState('');
  // Ajout d'un descripteur : niveau + texte, dans la carte ouverte
  const [descDraft, setDescDraft] = useState<{ niveau: string; label: string }>({
    niveau: '',
    label: '',
  });

  // Popup de confirmation (suppression)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/didactique-fle', { headers });
        const json = await res.json();
        setConfig(json.success && json.data ? json.data : DEFAULT_DIDACTIQUE_FLE);
      } catch {
        setConfig(DEFAULT_DIDACTIQUE_FLE);
        setError('Impossible de charger le référentiel FLE.');
      }
    };
    load();
  }, [getAuthHeaders]);

  // Enregistre la configuration complète (optimiste : l'état est déjà à jour)
  const persist = async (next: DidactiqueFleConfig) => {
    const previous = config;
    setConfig(next);
    setIsSaving(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/didactique-fle', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDidactiqueFleCache(json.data);
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

  const commit = () => {
    if (config) persist(config);
  };

  // Niveaux ordonnés par rang — l'ordre d'affichage partout
  const niveauxTries = useMemo(
    () => [...(config?.niveaux ?? [])].sort((a, b) => a.rang - b.rang),
    [config]
  );

  if (!config) {
    return (
      <section className={styles.section}>
        <p className={styles.hint}>Chargement...</p>
      </section>
    );
  }

  // ── Listes simples (compétences, types de module) ────────────────────
  const updateListe = (cle: 'competences' | 'typesModule', items: DidactiqueItem[]) =>
    persist({ ...config, [cle]: items });

  const ajouterDansListe = (
    cle: 'competences' | 'typesModule',
    label: string,
    reset: () => void
  ) => {
    const propre = label.trim();
    if (!propre) return;
    const existants = new Set(config[cle].map((x) => x.id));
    const id = slugFle(propre, existants, cle === 'competences' ? 'competence' : 'type');
    updateListe(cle, [...config[cle], { id, label: propre, visible: true }]);
    reset();
  };

  // Frappe dans une cellule d'une liste simple : état local, enregistré au blur
  const editerLabel = (cle: 'competences' | 'typesModule', id: string, label: string) =>
    setConfig((c) =>
      c ? { ...c, [cle]: c[cle].map((x) => (x.id === id ? { ...x, label } : x)) } : c
    );

  // ── Niveaux ──────────────────────────────────────────────────────────
  const updateNiveaux = (items: NiveauCecr[]) => persist({ ...config, niveaux: items });

  const ajouterNiveau = () => {
    const label = niveauDraft.trim();
    if (!label) return;
    const existants = new Set(config.niveaux.map((n) => n.id));
    const id = slugFle(label, existants, 'niveau');
    const rang = Math.max(-1, ...config.niveaux.map((n) => n.rang)) + 1;
    updateNiveaux([...config.niveaux, { id, label, rang, visible: true }]);
    setNiveauDraft('');
  };

  // Monter / descendre un niveau : on échange les rangs de deux voisins
  const deplacerNiveau = (id: string, sens: -1 | 1) => {
    const i = niveauxTries.findIndex((n) => n.id === id);
    const j = i + sens;
    if (i === -1 || j < 0 || j >= niveauxTries.length) return;
    const a = niveauxTries[i];
    const b = niveauxTries[j];
    updateNiveaux(
      config.niveaux.map((n) =>
        n.id === a.id ? { ...n, rang: b.rang } : n.id === b.id ? { ...n, rang: a.rang } : n
      )
    );
  };

  // ── Descripteurs ─────────────────────────────────────────────────────
  const updateDescripteurs = (items: DescripteurFle[]) =>
    persist({ ...config, descripteurs: items });

  const editerDescripteur = (id: string, patch: Partial<DescripteurFle>) =>
    setConfig((c) =>
      c
        ? {
            ...c,
            descripteurs: c.descripteurs.map((d) => (d.id === id ? { ...d, ...patch } : d)),
          }
        : c
    );

  const editerEtEnregistrerDescripteur = (id: string, patch: Partial<DescripteurFle>) =>
    updateDescripteurs(config.descripteurs.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const ajouterDescripteur = (competence: string) => {
    const label = descDraft.label.trim();
    const niveau = descDraft.niveau || niveauxTries.find((n) => n.visible)?.id || '';
    if (!label || !niveau) return;
    updateDescripteurs([
      ...config.descripteurs,
      { id: generateDescripteurId(), competence, niveau, label, visible: true },
    ]);
    setDescDraft((d) => ({ ...d, label: '' }));
  };

  // ── Rendu d'une liste simple (compétences / types de module) ─────────
  const renderListe = (
    cle: 'competences' | 'typesModule',
    titre: string,
    sousTitre: string,
    draft: string,
    setDraft: (v: string) => void,
    placeholder: string,
    nomSingulier: string
  ) => (
    <div className={styles.colBlock}>
      <p className={styles.colTitle}>
        {titre}
        <span>{sousTitre}</span>
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
          {config[cle].map((item) => (
            <tr key={item.id} className={item.visible ? '' : styles.rowHidden}>
              <td>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() =>
                    updateListe(
                      cle,
                      config[cle].map((x) =>
                        x.id === item.id ? { ...x, visible: !x.visible } : x
                      )
                    )
                  }
                  title={item.visible ? 'Masquer dans les formulaires' : 'Afficher dans les formulaires'}
                >
                  {item.visible ? '👁' : '🚫'}
                </button>
              </td>
              <td>
                <input
                  className={styles.cell}
                  value={item.label}
                  onChange={(e) => editerLabel(cle, item.id, e.target.value)}
                  onBlur={commit}
                />
              </td>
              <td className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.iconDelete}`}
                  onClick={() =>
                    setConfirmation({
                      titre: `Supprimer ${nomSingulier} ?`,
                      texte: `« ${item.label} » sera retiré du référentiel. Si l’élément a déjà servi, préférez le masquer (œil) : la suppression ne modifie pas les contenus existants, mais leur libellé ne sera plus retrouvé.`,
                      onConfirm: () =>
                        updateListe(
                          cle,
                          config[cle].filter((x) => x.id !== item.id)
                        ),
                    })
                  }
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
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              ajouterDansListe(cle, draft, () => setDraft(''));
            }
          }}
          placeholder={placeholder}
        />
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => ajouterDansListe(cle, draft, () => setDraft(''))}
          disabled={isSaving}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <section className={styles.section}>
      {isSaving && <p className={styles.saving}>Enregistrement...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {/* ── Compétences + niveaux : le cadre du radar ── */}
      <div className={`${styles.card} ${styles.card_fle}`}>
        <div className={styles.cardHeadStatic}>
          <span className={styles.cardTitle}>Référentiel FLE</span>
          <span className={styles.cardCount}>
            {config.competences.length} compétence{config.competences.length > 1 ? 's' : ''} ·{' '}
            {config.niveaux.filter((n) => n.visible).length} niveau
            {config.niveaux.filter((n) => n.visible).length > 1 ? 'x' : ''} visibles ·{' '}
            {config.typesModule.length} type{config.typesModule.length > 1 ? 's' : ''} de module
          </span>
        </div>
        <div className={styles.twoCols}>
          {renderListe(
            'competences',
            'Compétences',
            'Les branches du radar, dans l’ordre horaire depuis le haut',
            competenceDraft,
            setCompetenceDraft,
            'Nouvelle compétence…',
            'cette compétence'
          )}

          {/* Niveaux du CECR — ordonnés par rang, avec flèches pour réordonner */}
          <div className={styles.colBlock}>
            <p className={styles.colTitle}>
              Niveaux du CECR
              <span>Les anneaux du radar, du plus bas au plus haut — C1 et C2 masqués par défaut</span>
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colEye} />
                  <th className={styles.colNum}>Rang</th>
                  <th>Intitulé</th>
                  <th className={styles.colAtelier} />
                </tr>
              </thead>
              <tbody>
                {niveauxTries.map((n, i) => (
                  <tr key={n.id} className={n.visible ? '' : styles.rowHidden}>
                    <td>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() =>
                          updateNiveaux(
                            config.niveaux.map((x) =>
                              x.id === n.id ? { ...x, visible: !x.visible } : x
                            )
                          )
                        }
                        title={n.visible ? 'Masquer ce niveau' : 'Afficher ce niveau'}
                      >
                        {n.visible ? '👁' : '🚫'}
                      </button>
                    </td>
                    <td className={styles.uaaNum}>{i}</td>
                    <td>
                      <input
                        className={styles.cell}
                        value={n.label}
                        onChange={(e) =>
                          setConfig((c) =>
                            c
                              ? {
                                  ...c,
                                  niveaux: c.niveaux.map((x) =>
                                    x.id === n.id ? { ...x, label: e.target.value } : x
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
                        className={styles.iconBtn}
                        onClick={() => deplacerNiveau(n.id, -1)}
                        disabled={i === 0}
                        title="Monter"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => deplacerNiveau(n.id, 1)}
                        disabled={i === niveauxTries.length - 1}
                        title="Descendre"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconDelete}`}
                        onClick={() =>
                          setConfirmation({
                            titre: 'Supprimer ce niveau ?',
                            texte: `« ${n.label} » sera retiré du référentiel, et les descripteurs qui s’y rattachent avec lui. Préférez le masquer (œil) s’il a déjà servi.`,
                            onConfirm: () =>
                              persist({
                                ...config,
                                niveaux: config.niveaux.filter((x) => x.id !== n.id),
                                descripteurs: config.descripteurs.filter((d) => d.niveau !== n.id),
                              }),
                          })
                        }
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
                value={niveauDraft}
                onChange={(e) => setNiveauDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    ajouterNiveau();
                  }
                }}
                placeholder="Nouveau niveau (ajouté en dernier)…"
              />
              <button type="button" className={styles.addBtn} onClick={ajouterNiveau} disabled={isSaving}>
                +
              </button>
            </div>
          </div>
        </div>

        {/* Types de module — qualifient un module de la bibliothèque FLE */}
        <div className={styles.oneCol}>
          {renderListe(
            'typesModule',
            'Types de module',
            'Proposés à la création d’un module de la bibliothèque FLE (grammaire, vocabulaire, phonétique…)',
            typeDraft,
            setTypeDraft,
            'Nouveau type : orthographe, conjugaison…',
            'ce type de module'
          )}
        </div>
      </div>

      {/* ── Descripteurs « Je peux… » : une carte repliable par compétence ── */}
      {config.competences.map((comp) => {
        const tous = config.descripteurs.filter((d) => d.competence === comp.id);
        const isOpen = openCompetence === comp.id;
        // Groupés par niveau, dans l'ordre des rangs
        const parNiveau = niveauxTries
          .map((n) => ({ niveau: n, items: tous.filter((d) => d.niveau === n.id) }))
          .filter((g) => g.items.length > 0);

        return (
          <div key={comp.id} className={`${styles.card} ${styles.card_fle}`}>
            <button
              type="button"
              className={styles.cardHead}
              onClick={() => {
                setOpenCompetence(isOpen ? null : comp.id);
                setDescDraft({ niveau: niveauxTries.find((n) => n.visible)?.id ?? '', label: '' });
              }}
            >
              <span className={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
              <span className={styles.cardTitle}>{comp.label}</span>
              <span className={styles.cardCount}>
                {tous.length} descripteur{tous.length > 1 ? 's' : ''}
                {!comp.visible && ' · compétence masquée'}
              </span>
            </button>

            {isOpen && (
              <div className={styles.cardBody}>
                {tous.length === 0 ? (
                  <p className={styles.empty}>
                    Aucun descripteur — ajoutez un « Je peux… » ci-dessous.
                  </p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.colEye} />
                        <th className={styles.colNum}>Niveau</th>
                        <th>Descripteur « Je peux… »</th>
                        <th className={styles.colAct} />
                      </tr>
                    </thead>
                    <tbody>
                      {parNiveau.map(({ niveau, items }) => (
                        <NiveauGroup key={niveau.id} label={niveau.label} count={items.length}>
                          {items.map((d) => (
                            <tr key={d.id} className={d.visible ? '' : styles.rowHidden}>
                              <td>
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  onClick={() =>
                                    editerEtEnregistrerDescripteur(d.id, { visible: !d.visible })
                                  }
                                  title={d.visible ? 'Masquer dans les formulaires' : 'Afficher dans les formulaires'}
                                >
                                  {d.visible ? '👁' : '🚫'}
                                </button>
                              </td>
                              <td>
                                {/* Changer le niveau d'un descripteur le déplace de groupe */}
                                <select
                                  className={styles.cell}
                                  value={d.niveau}
                                  onChange={(e) =>
                                    editerEtEnregistrerDescripteur(d.id, { niveau: e.target.value })
                                  }
                                >
                                  {niveauxTries.map((n) => (
                                    <option key={n.id} value={n.id}>
                                      {n.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  className={styles.cell}
                                  value={d.label}
                                  placeholder="Je peux…"
                                  onChange={(e) => editerDescripteur(d.id, { label: e.target.value })}
                                  onBlur={commit}
                                />
                              </td>
                              <td className={styles.actions}>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.iconDelete}`}
                                  onClick={() =>
                                    setConfirmation({
                                      titre: 'Supprimer ce descripteur ?',
                                      texte: `« ${d.label} » sera retiré du référentiel. Préférez le masquer (œil) s’il a déjà servi.`,
                                      onConfirm: () =>
                                        updateDescripteurs(
                                          config.descripteurs.filter((x) => x.id !== d.id)
                                        ),
                                    })
                                  }
                                  title="Supprimer définitivement"
                                >
                                  🗑
                                </button>
                              </td>
                            </tr>
                          ))}
                        </NiveauGroup>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Ajout en ligne : niveau + texte — pas de popup pour une ligne */}
                <div className={styles.addRow}>
                  <select
                    className={styles.filter}
                    value={descDraft.niveau}
                    onChange={(e) => setDescDraft((x) => ({ ...x, niveau: e.target.value }))}
                  >
                    {niveauxTries.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className={styles.addInput}
                    value={descDraft.label}
                    onChange={(e) => setDescDraft((x) => ({ ...x, label: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        ajouterDescripteur(comp.id);
                      }
                    }}
                    placeholder="Je peux… (nouveau descripteur à ce niveau)"
                  />
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => ajouterDescripteur(comp.id)}
                    disabled={isSaving || !descDraft.label.trim()}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Popup de confirmation — jamais window.confirm */}
      {confirmation && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmation(null);
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h3>{confirmation.titre}</h3>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.confirmTexte}>{confirmation.texte}</p>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={styles.btnGhost} onClick={() => setConfirmation(null)}>
                Annuler
              </button>
              <button
                type="button"
                className={`${styles.btnPrimary} ${styles.btnDanger}`}
                onClick={() => {
                  confirmation.onConfirm();
                  setConfirmation(null);
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// En-tête de groupe : le niveau (non éditable ici — il se renomme dans la
// liste des niveaux, ce qui renomme tous les groupes d'un coup)
function NiveauGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className={styles.groupRow}>
        <td colSpan={4}>
          <div className={styles.groupTitle}>
            <span className={styles.groupNom}>{label}</span>
            <span className={styles.groupCount}>
              {count} descripteur{count > 1 ? 's' : ''}
            </span>
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}
