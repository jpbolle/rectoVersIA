'use client';

// Le constructeur d'une SÉQUENCE FLE — au verso « Ajouter des contenus »
// d'une activité de type « sequence » (création et popup ✏️).
//
// Une LIGNE DU TEMPS EN SERPENTIN (demandes JP, 2026-09-14) : les étapes sont
// des encadrés posés sur une ligne qui, arrivée au bord droit, tourne et
// revient vers la gauche — rangée après rangée. Une ÉTAPE est SOIT une
// THÉORIE (un module de Mes Ressources › Modules FLE), SOIT une ACTIVITÉ (de
// Mes Activités). Le « + » demande d'abord laquelle des deux, puis la popup
// s'allonge : prendre dans l'existant, ou créer ici même (le module s'ouvre
// dans son éditeur, l'activité dans le formulaire de création habituel).
//
// Chaque encadré porte le bouton « tous / n élèves » (différenciation, 2e
// étage). Le 1er étage — quels élèves de la classe accèdent à l'activité — se
// règle au recto avec `ElevesChoix` : le constructeur reçoit ces élèves.
//
// Le nombre d'encadrés par rangée se MESURE (largeur du conteneur), la
// rangée impaire s'affiche en `row-reverse`, et un trait vertical relie la
// fin d'une rangée au début de la suivante.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClasses } from '@/hooks/useClasses';
import { useDidactiqueFle } from '@/hooks/useDidactiqueFle';
import { useGrilleTypes } from '@/hooks/useEvaluations';
import { niveauxVisibles } from '@/types/didactique-fle';
import { ATELIERS, atelierLabel } from '@/types/didactique';
import type { CreateDevoirData, Devoir } from '@/types/devoir';
import type { ModuleFle } from '@/types/module-fle';
import { iconeTypeModule } from '@/types/module-fle';
import { SEQUENCE_FLE_VIDE, generateEtapeId } from '@/types/sequence-fle';
import type { NatureEtape, SequenceFleContenu, SequenceFleEtape } from '@/types/sequence-fle';
import { ListeEleves } from '@/components/ElevesChoix/ElevesChoix';
import type { EleveAvecClasse } from '@/components/ElevesChoix/ElevesChoix';
import ModuleFleEditor from '@/components/ModuleFleEditor/ModuleFleEditor';
import CreationForm from '@/components/CreationForm/CreationForm';
import base from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
import styles from './SequenceFleBuilder.module.css';

interface Props {
  value: SequenceFleContenu | null;
  onChange: (contenu: SequenceFleContenu) => void;
  // Les élèves qui suivent la séquence (ceux des classes cochées, filtrés par
  // le choix du recto) — base des restrictions par étape
  elevesDeLaSequence: EleveAvecClasse[];
  plusieursClasses?: boolean;
  disabled?: boolean;
}

// Géométrie de la ligne (doit suivre le CSS) : encadré 200, « + » 34, écarts 10
const LARGEUR_ENCADRE = 200;
const LARGEUR_PLUS = 34;
const ECART = 10;

const ICONE_ATELIER: Record<string, string> = {
  ecriture: '✏️',
  lecture: '📖',
  'lecture-oeuvre': '📚',
  recherche: '🔎',
  vocabulaire: '🗂️',
  autoevaluation: '🪞',
  sondage: '📊',
};

function iconeEtape(e: SequenceFleEtape): string {
  if (e.nature === 'theorie') return iconeTypeModule(e.type ?? '');
  return ICONE_ATELIER[e.atelier ?? ''] ?? '🎯';
}

export default function SequenceFleBuilder({
  value,
  onChange,
  elevesDeLaSequence,
  plusieursClasses = false,
  disabled = false,
}: Props) {
  const { getAuthHeaders } = useAuth();
  const { config } = useDidactiqueFle();
  const { classes: mesClasses } = useClasses();
  const { grilleTypes, grilles } = useGrilleTypes();
  const contenu = value ?? SEQUENCE_FLE_VIDE;

  // Le « + » : où insérer, quelle nature, quel chemin
  const [insertion, setInsertion] = useState<number | null>(null);
  const [nature, setNature] = useState<NatureEtape | null>(null);
  const [chemin, setChemin] = useState<'choisir' | 'creer'>('choisir');
  const [erreur, setErreur] = useState<string | null>(null);

  // L'existant
  const [modules, setModules] = useState<ModuleFle[] | null>(null);
  const [devoirs, setDevoirs] = useState<Devoir[] | null>(null);
  const [recherche, setRecherche] = useState('');

  // Création d'un module ici
  const [titre, setTitre] = useState('');
  const [type, setType] = useState('');
  const [niveau, setNiveau] = useState('');
  const [creation, setCreation] = useState(false);
  const [enEdition, setEnEdition] = useState<ModuleFle | null>(null);
  // Création d'une activité ici (le formulaire habituel, en popup)
  const [creationActivite, setCreationActivite] = useState(false);
  const [creationActiviteEnCours, setCreationActiviteEnCours] = useState(false);

  // Étape dont on choisit les élèves ; null = popup fermée
  const [elevesDe, setElevesDe] = useState<string | null>(null);

  // Encadrés par rangée, mesurés sur la largeur disponible
  const ligneRef = useRef<HTMLDivElement>(null);
  const [parRangee, setParRangee] = useState(3);
  useEffect(() => {
    const el = ligneRef.current;
    if (!el) return;
    const mesurer = () => {
      const largeur = el.clientWidth - 12;
      setParRangee(Math.max(1, Math.floor((largeur - LARGEUR_PLUS) / (LARGEUR_ENCADRE + LARGEUR_PLUS + 2 * ECART))));
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const poser = useCallback(
    (patch: Partial<SequenceFleContenu>) => onChange({ ...contenu, ...patch }),
    [contenu, onChange]
  );

  // L'existant se charge à la première demande de chaque nature
  useEffect(() => {
    if (nature !== 'theorie' || modules !== null) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/modules-fle', { headers });
        const json = await res.json();
        if (!annule) setModules(json.success ? (json.data as ModuleFle[]).filter((m) => !m.archive) : []);
      } catch {
        if (!annule) setModules([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [nature, modules, getAuthHeaders]);

  useEffect(() => {
    if (nature !== 'activite' || devoirs !== null) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/devoirs', { headers });
        const json = await res.json();
        if (!annule) {
          setDevoirs(
            json.success
              ? (json.data as Devoir[]).filter((d) => !d.archive && d.typeTravail !== 'sequence')
              : []
          );
        }
      } catch {
        if (!annule) setDevoirs([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [nature, devoirs, getAuthHeaders]);

  const ouvrirPlus = (index: number) => {
    setInsertion(index);
    setNature(null);
    setChemin('choisir');
    setErreur(null);
    setRecherche('');
    setTitre('');
    setType(config.typesModule.find((t) => t.visible)?.id ?? '');
    const niveaux = niveauxVisibles(config);
    setNiveau(niveaux[1]?.id ?? niveaux[0]?.id ?? '');
  };

  const insererEtape = (etape: Omit<SequenceFleEtape, 'id' | 'eleves'>) => {
    if (insertion === null) return;
    const liste = [...contenu.etapes];
    liste.splice(insertion, 0, { ...etape, id: generateEtapeId(), eleves: null });
    poser({ etapes: liste });
    setInsertion(null);
  };

  const insererModule = (m: ModuleFle) =>
    insererEtape({ nature: 'theorie', moduleId: m.id, titre: m.titre, type: m.type });

  const insererDevoir = (d: Devoir) =>
    insererEtape({
      nature: 'activite',
      devoirId: d.id,
      titre: d.intitule,
      atelier: d.atelier,
      typeTravail: d.typeTravail,
    });

  // Créer un module ici même : il naît dans la bibliothèque, entre dans la
  // ligne, puis s'ouvre dans son éditeur pour l'introduction et la théorie
  const creerModule = async () => {
    if (!titre.trim() || insertion === null) return;
    setCreation(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/modules-fle', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: titre.trim(), type, niveau }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Création impossible');
      const m = json.data as ModuleFle;
      setModules((prev) => (prev ? [...prev, m] : prev));
      insererModule(m);
      setEnEdition(m);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setCreation(false);
    }
  };

  // Créer une activité ici même : le formulaire habituel, sans classe (c'est
  // la séquence qui l'ouvrira aux élèves)
  const creerActivite = async (data: CreateDevoirData) => {
    setCreationActiviteEnCours(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/devoirs', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Création impossible');
      const d = json.data as Devoir;
      setDevoirs((prev) => (prev ? [d, ...prev] : prev));
      insererDevoir({ ...d, atelier: data.atelier, typeTravail: data.typeTravail });
      setCreationActivite(false);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setCreationActiviteEnCours(false);
    }
  };

  // À la fermeture de l'éditeur : l'encadré reprend le titre du module
  const fermerEditeur = async () => {
    const m = enEdition;
    setEnEdition(null);
    if (!m) return;
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/modules-fle/${m.id}`, { headers });
      const json = await res.json();
      if (!json.success) return;
      const frais = json.data as ModuleFle;
      setModules((prev) => (prev ? prev.map((x) => (x.id === frais.id ? frais : x)) : prev));
      poser({
        etapes: contenu.etapes.map((x) =>
          x.moduleId === frais.id ? { ...x, titre: frais.titre, type: frais.type } : x
        ),
      });
    } catch {
      // L'encadré garde ce qu'il avait
    }
  };

  const modifierEtape = (id: string, patch: Partial<SequenceFleEtape>) =>
    poser({ etapes: contenu.etapes.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const deplacer = (i: number, sens: -1 | 1) => {
    const j = i + sens;
    if (j < 0 || j >= contenu.etapes.length) return;
    const liste = [...contenu.etapes];
    [liste[i], liste[j]] = [liste[j], liste[i]];
    poser({ etapes: liste });
  };

  const retirer = (id: string) => poser({ etapes: contenu.etapes.filter((e) => e.id !== id) });

  const etapeEleves = elevesDe ? contenu.etapes.find((e) => e.id === elevesDe) : null;
  const typesVisibles = config.typesModule.filter((t) => t.visible);
  const niveaux = niveauxVisibles(config);
  const q = recherche.trim().toLowerCase();
  const candidatsDevoirs = (devoirs ?? []).filter((d) => !q || d.intitule.toLowerCase().includes(q));
  const candidatsModules = (modules ?? []).filter((m) => !q || m.titre.toLowerCase().includes(q));
  const classeNames = mesClasses.filter((c) => !c.archive).map((c) => c.nom).sort((a, b) => a.localeCompare(b));

  // ── La ligne, découpée en rangées ──
  type Element = { kind: 'plus'; index: number } | { kind: 'etape'; etape: SequenceFleEtape; index: number };
  const suite: Element[] = [{ kind: 'plus', index: 0 }];
  contenu.etapes.forEach((e, i) => {
    suite.push({ kind: 'etape', etape: e, index: i });
    suite.push({ kind: 'plus', index: i + 1 });
  });
  const rangees: Element[][] = [];
  let curseur = 0;
  let premiere = true;
  while (curseur < suite.length) {
    const taille = premiere ? 2 * parRangee + 1 : 2 * parRangee;
    rangees.push(suite.slice(curseur, curseur + taille));
    curseur += taille;
    premiere = false;
  }

  const rendrePlus = (index: number) =>
    disabled ? (
      <span key={`p${index}`} className={styles.plusVide} />
    ) : (
      <button
        key={`p${index}`}
        type="button"
        className={styles.plus}
        onClick={() => ouvrirPlus(index)}
        title="Ajouter une étape ici"
        aria-label="Ajouter une étape ici"
      >
        +
      </button>
    );

  const rendreEtape = (e: SequenceFleEtape, i: number) => {
    const restreint = e.eleves !== null;
    return (
      <article
        key={e.id}
        className={`${styles.encadre} ${e.nature === 'theorie' ? styles.encadreTheorie : styles.encadreActivite} ${
          restreint ? styles.encadreRestreint : ''
        }`}
      >
        <span className={styles.numero}>{i + 1}</span>
        <span className={styles.nature}>{e.nature === 'theorie' ? 'Théorie' : 'Activité'}</span>
        <span className={styles.icone} aria-hidden="true">{iconeEtape(e)}</span>
        <span className={styles.titre} title={e.titre}>{e.titre || e.moduleId || e.devoirId}</span>
        <span className={styles.meta}>
          {e.nature === 'theorie' ? 'module' : atelierLabel(e.atelier ?? '', true) || e.typeTravail || 'activité'}
        </span>
        <button
          type="button"
          className={`${styles.restriction} ${restreint ? styles.restrictionActive : ''}`}
          onClick={() => setElevesDe(e.id)}
          disabled={disabled}
          title="Choisir qui fait cette étape"
        >
          {restreint ? `${e.eleves!.length} élève${e.eleves!.length > 1 ? 's' : ''}` : 'tous les élèves'}
        </button>
        {!disabled && (
          <span className={styles.actions}>
            <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0} title="Avancer dans le parcours">◀</button>
            <button type="button" onClick={() => deplacer(i, 1)} disabled={i === contenu.etapes.length - 1} title="Reculer dans le parcours">▶</button>
            <button type="button" onClick={() => retirer(e.id)} title="Retirer de la séquence">✕</button>
          </span>
        )}
      </article>
    );
  };

  return (
    <div className={styles.builder}>
      <div className={base.bloc}>
        <p className={base.blocTitre}>
          Le parcours, étape par étape
          <span>
            Le « + » ajoute une étape à cet endroit : une théorie (un module) ou une activité,
            prise dans l’existant ou créée ici même. Chaque encadré peut être réservé à certains élèves.
          </span>
        </p>

        {/* ── La ligne du temps en serpentin ── */}
        <div className={styles.ligne} ref={ligneRef}>
          {rangees.map((rangee, r) => (
            <div
              key={r}
              className={`${styles.rangee} ${r % 2 === 1 ? styles.rangeeRetour : ''} ${
                r < rangees.length - 1 ? styles.rangeeAvecVirage : ''
              }`}
            >
              {rangee.map((el) => (el.kind === 'plus' ? rendrePlus(el.index) : rendreEtape(el.etape, el.index)))}
            </div>
          ))}
          {contenu.etapes.length === 0 && (
            <p className={styles.vide}>Aucune étape : clique sur « + » pour commencer le parcours.</p>
          )}
        </div>
      </div>

      {/* ── Le « + » : la nature, puis l'existant ou la création ── */}
      {insertion !== null && !creationActivite && (
        <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && setInsertion(null)}>
          <div className={base.popup}>
            <header className={base.popupEntete}>
              <h3>
                Ajouter une étape
                {contenu.etapes.length > 0 && (
                  <span className={styles.popupPosition}> — en position {insertion + 1}</span>
                )}
              </h3>
              <button type="button" className={base.popupFermer} onClick={() => setInsertion(null)}>
                ✕
              </button>
            </header>
            <div className={base.popupCorps}>
              {/* 1. La nature */}
              <div className={styles.natures}>
                <button
                  type="button"
                  className={`${styles.natureBtn} ${styles.natureTheorie} ${nature === 'theorie' ? styles.natureActive : ''}`}
                  onClick={() => {
                    setNature('theorie');
                    setChemin('choisir');
                    setRecherche('');
                  }}
                >
                  <span className={styles.natureIcone} aria-hidden="true">📖</span>
                  <span className={styles.natureTitre}>Une théorie</span>
                  <span className={styles.natureAide}>un module de la bibliothèque</span>
                </button>
                <button
                  type="button"
                  className={`${styles.natureBtn} ${styles.natureActivite} ${nature === 'activite' ? styles.natureActive : ''}`}
                  onClick={() => {
                    setNature('activite');
                    setChemin('choisir');
                    setRecherche('');
                  }}
                >
                  <span className={styles.natureIcone} aria-hidden="true">🎯</span>
                  <span className={styles.natureTitre}>Une activité</span>
                  <span className={styles.natureAide}>de Mes Activités</span>
                </button>
              </div>

              {/* 2. Le chemin — la popup s'allonge */}
              {nature && (
                <>
                  <div className={styles.chemins}>
                    <button type="button" className={`${styles.cheminBtn} ${chemin === 'choisir' ? styles.cheminActif : ''}`} onClick={() => setChemin('choisir')}>
                      {nature === 'theorie' ? '📚 Un module existant' : '📋 Une activité existante'}
                    </button>
                    <button
                      type="button"
                      className={`${styles.cheminBtn} ${chemin === 'creer' ? styles.cheminActif : ''}`}
                      onClick={() => {
                        if (nature === 'activite') setCreationActivite(true);
                        else setChemin('creer');
                      }}
                    >
                      {nature === 'theorie' ? '➕ Créer un module ici' : '➕ Créer une activité ici'}
                    </button>
                  </div>

                  {chemin === 'choisir' && (
                    <>
                      <input
                        type="search"
                        className={styles.recherche}
                        value={recherche}
                        onChange={(e) => setRecherche(e.target.value)}
                        placeholder={nature === 'theorie' ? 'Rechercher un module…' : 'Rechercher dans Mes Activités…'}
                      />
                      {nature === 'theorie' &&
                        (modules === null ? (
                          <p className={base.vide}>Chargement des modules…</p>
                        ) : candidatsModules.length === 0 ? (
                          <p className={base.vide}>Aucun module — crée-en un ici même, avec l’autre onglet.</p>
                        ) : (
                          <div className={base.liste}>
                            {candidatsModules.map((m) => (
                              <button key={m.id} type="button" className={base.item} onClick={() => insererModule(m)}>
                                <span>{iconeTypeModule(m.type)}</span>
                                <span className={base.activiteNom}>{m.titre}</span>
                                <span className={base.itemClasses}>
                                  {config.niveaux.find((n) => n.id === m.niveau)?.label ?? ''}
                                </span>
                              </button>
                            ))}
                          </div>
                        ))}
                      {nature === 'activite' &&
                        (devoirs === null ? (
                          <p className={base.vide}>Chargement des activités…</p>
                        ) : candidatsDevoirs.length === 0 ? (
                          <p className={base.vide}>Aucune activité — crée-en une ici même, avec l’autre onglet.</p>
                        ) : (
                          <div className={base.liste}>
                            {candidatsDevoirs.map((d) => (
                              <button key={d.id} type="button" className={base.item} onClick={() => insererDevoir(d)}>
                                <span>{ICONE_ATELIER[d.atelier ?? ''] ?? '🎯'}</span>
                                <span className={base.activiteNom}>{d.intitule}</span>
                                <span className={base.itemClasses}>
                                  {atelierLabel(d.atelier ?? '', true) || d.typeTravail}
                                  {d.classes.length ? ` · ${d.classes.join(', ')}` : ''}
                                </span>
                              </button>
                            ))}
                          </div>
                        ))}
                    </>
                  )}

                  {chemin === 'creer' && nature === 'theorie' && (
                    <div className={styles.creation}>
                      <label className={styles.champ}>
                        Titre
                        <input
                          type="text"
                          value={titre}
                          onChange={(e) => setTitre(e.target.value)}
                          placeholder="Ex : Le verbe avoir"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && creerModule()}
                        />
                      </label>
                      <div className={styles.deuxChamps}>
                        <label className={styles.champ}>
                          Type
                          <select value={type} onChange={(e) => setType(e.target.value)}>
                            {typesVisibles.map((t) => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.champ}>
                          Niveau
                          <select value={niveau} onChange={(e) => setNiveau(e.target.value)}>
                            {niveaux.map((n) => (
                              <option key={n.id} value={n.id}>{n.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <p className={base.vide}>
                        Le module est enregistré dans Mes Ressources › Modules FLE, prend sa place dans
                        le parcours, et s’ouvre aussitôt pour l’introduction et la théorie.
                      </p>
                    </div>
                  )}
                </>
              )}
              {erreur && <p className={base.erreur}>{erreur}</p>}
            </div>
            <footer className={base.popupPied}>
              <span className={base.popupNote}>
                {nature === 'theorie'
                  ? 'Un même module peut servir dans plusieurs séquences.'
                  : nature === 'activite'
                    ? 'Une activité sans classe convient : la séquence l’ouvrira aux élèves.'
                    : 'Choisis d’abord la nature de l’étape.'}
              </span>
              <span className={styles.popupBoutons}>
                <button type="button" className={base.btnGhost} onClick={() => setInsertion(null)}>
                  Fermer
                </button>
                {chemin === 'creer' && nature === 'theorie' && (
                  <button type="button" className={base.btnPrimary} onClick={creerModule} disabled={creation || !titre.trim()}>
                    {creation ? 'Création…' : 'Créer et ajouter'}
                  </button>
                )}
              </span>
            </footer>
          </div>
        </div>
      )}

      {/* ── L'éditeur du module créé ici, en popup ── */}
      {enEdition && (
        <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && fermerEditeur()}>
          <div className={styles.popupEditeur}>
            <ModuleFleEditor module={enEdition} onFermer={fermerEditeur} onModifie={() => undefined} />
          </div>
        </div>
      )}

      {/* ── Le formulaire de création d'activité, en popup ── */}
      {creationActivite && (
        <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && setCreationActivite(false)}>
          <div className={styles.popupEditeur}>
            <div className={styles.creationActivite}>
              <p className={base.vide}>
                Le formulaire est le même que celui de Mes Activités. L’activité créée y apparaîtra,
                et prendra sa place dans le parcours.
              </p>
              {erreur && <p className={base.erreur}>{erreur}</p>}
              <CreationForm
                classeNames={classeNames}
                grilleTypes={grilleTypes}
                grilles={grilles}
                isVisible
                onSubmit={creerActivite}
                isSubmitting={creationActiviteEnCours}
                onClose={() => setCreationActivite(false)}
                getAuthHeaders={getAuthHeaders}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Les élèves d'une étape ── */}
      {etapeEleves && (
        <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && setElevesDe(null)}>
          <div className={base.popup}>
            <header className={base.popupEntete}>
              <h3>Qui fait « {etapeEleves.titre} » ?</h3>
              <button type="button" className={base.popupFermer} onClick={() => setElevesDe(null)}>
                ✕
              </button>
            </header>
            <div className={base.popupCorps}>
              <div className={styles.choixEleves}>
                <label className={`${styles.option} ${etapeEleves.eleves === null ? styles.optionActive : ''}`}>
                  <input type="radio" checked={etapeEleves.eleves === null} disabled={disabled} onChange={() => modifierEtape(etapeEleves.id, { eleves: null })} />
                  Tous les élèves de la séquence
                </label>
                <label className={`${styles.option} ${etapeEleves.eleves !== null ? styles.optionActive : ''}`}>
                  <input type="radio" checked={etapeEleves.eleves !== null} disabled={disabled} onChange={() => modifierEtape(etapeEleves.id, { eleves: etapeEleves.eleves ?? [] })} />
                  Certains élèves seulement
                </label>
              </div>
              {etapeEleves.eleves !== null &&
                (elevesDeLaSequence.length === 0 ? (
                  <p className={styles.vide}>Coche d’abord une classe au recto : ses élèves apparaîtront ici.</p>
                ) : (
                  <ListeEleves
                    eleves={elevesDeLaSequence}
                    coches={etapeEleves.eleves}
                    onBasculer={(id, coche) =>
                      modifierEtape(etapeEleves.id, {
                        eleves: coche ? [...etapeEleves.eleves!, id] : etapeEleves.eleves!.filter((e) => e !== id),
                      })
                    }
                    avecClasse={plusieursClasses}
                    disabled={disabled}
                  />
                ))}
            </div>
            <footer className={base.popupPied}>
              <span className={base.popupNote}>Seuls les élèves qui suivent la séquence sont proposés.</span>
              <button type="button" className={base.btnGhost} onClick={() => setElevesDe(null)}>
                Fermer
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

// Les ateliers ne servent ici qu'à l'icône et au libellé court ; on garde la
// liste sous la main pour les compléter le jour où un atelier s'ajoute.
void ATELIERS;
