'use client';

// La popup « Étape du portfolio » — ce que le créateur règle sur UNE étape
// (plan 2026-10-09, maquette v2 vue 3) : section, titre, objectifs, consigne,
// échéance, statut IA à trois états, portée (personnelle / collective),
// « Verrouille l'étape suivante » (le réglage « Marquer comme terminé » de
// VibeCoding, transposé), et les dépôts.
//
// Ce que l'élève FAIT dans l'étape (2026-10-10, « l'activité doit être proposée
// comme alternative aux dépôts ») : des DÉPÔTS dans le portfolio, OU une
// ACTIVITÉ de Mes Activités (existante, ou créée sur place depuis l'atelier).
// Le « + » du serpentin ouvre directement cette popup.
// Un RENVOI n'a ni consigne ni dépôt ici — ils sont dans l'activité — mais
// garde section, objectifs, échéance et IA.
//
// L'INTRODUCTION (2026-10-11) : la même popup, réduite à ce qu'une page
// d'information porte — titre, image de couverture, objectifs, informations
// générales (UAA évaluées, planification…), ressources. Ni section, ni dépôt,
// ni échéance, ni verrou : elle est faite dès que l'élève l'ouvre.
//
// Popup de l'application (jamais `prompt()` / `confirm()`), sur le gabarit
// des popups de l'éditeur FLE (`ModuleFleEditor.module.css`).

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Devoir } from '@/types/devoir';
import ConsignesEditor from '@/components/ConsignesEditor/ConsignesEditor';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import { atelierLabel } from '@/types/didactique';
import { iconeAtelier } from '@/types/sequence-fle';
import {
  nouveauDepot,
  ORDRE_TYPES_DEPOT,
  STATUT_IA_LABELS,
  TYPE_DEPOT_LABELS,
  MAX_COLONNES_TABLEAU,
  TYPES_DEPOT_DISPONIBLES,
  TYPES_DEPOT_EXCLUSIFS,
  typesDuDepot,
  type PorteeEtape,
  type PortfolioDepot,
  type PortfolioEtape,
  type StatutIA,
  type TypeDepot,
  generateValeurId,
  GENRE_VALEUR_LABELS,
  type AffichageValeur,
  type GenreValeur,
  type ValeurDeclaree,
  type ValidationEtape,
  nettoyerIntroduction,
} from '@/types/portfolio';
import base from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
import IaPicto from './IaPicto';
import PortfolioCouverture from './PortfolioCouverture';
import { chargerBibliotheque } from './PortfolioRetourProf';
import type { Oeuvre } from '@/types/oeuvre';
import styles from './Portfolio.module.css';

interface Props {
  etape: PortfolioEtape;
  // Sections déjà présentes : proposées à la saisie
  sections: string[];
  // Titre de l'étape suivante (pour dire ce que le verrou ferme)
  titreSuivante?: string | null;
  onSave: (etape: PortfolioEtape) => void;
  onClose: () => void;
  // Renvoi : ouvrir l'activité elle-même (popup ✏️) — atelier seulement
  onOuvrirActivite?: (devoirId: string) => void;
  // Créer une activité sur place (atelier pleine page) : la popup se ferme,
  // le formulaire de création prend la page, l'étape garde ses réglages
  onCreerActivite?: (brouillon: PortfolioEtape) => void;
  // Les valeurs attribuées par les étapes PRÉCÉDENTES (« Le sketch »), que
  // celle-ci peut afficher
  valeursDisponibles?: (ValeurDeclaree & { etapeTitre: string })[];
  // Introduction : le titre du portfolio, montré dans le cercle sans image
  titrePortfolio?: string;
  disabled?: boolean;
}

// Pas de choix « comme l'activité » : une étape sans statut (anciennes
// données) retombe encore sur le réglage de l'activité côté élève.
const STATUTS: StatutIA[] = ['libre', 'partielle', 'aucune'];

// Cocher / décocher un type sur un dépôt. « Groupe » et « Scène » sont
// exclusifs ; il reste toujours au moins un type coché.
function basculerType(types: TypeDepot[], t: TypeDepot): TypeDepot[] {
  if (types.includes(t)) {
    const reste = types.filter((x) => x !== t);
    return reste.length > 0 ? reste : types;
  }
  if (TYPES_DEPOT_EXCLUSIFS.includes(t)) return [t];
  return ORDRE_TYPES_DEPOT.filter((x) => !TYPES_DEPOT_EXCLUSIFS.includes(x) && (x === t || types.includes(x)));
}

export default function EtapePortfolioModal({
  etape,
  sections,
  titreSuivante,
  onSave,
  onClose,
  onOuvrirActivite,
  onCreerActivite,
  valeursDisponibles = [],
  titrePortfolio,
  disabled = false,
}: Props) {
  const { getAuthHeaders } = useAuth();
  const [brouillon, setBrouillon] = useState<PortfolioEtape>({
    ...etape,
    objectifs: etape.objectifs ?? [],
    depots: etape.depots ?? [],
  });
  const poser = (patch: Partial<PortfolioEtape>) => setBrouillon((b) => ({ ...b, ...patch }));
  const intro = brouillon.introduction === true;
  const renvoi = !intro && brouillon.nature === 'activite';
  const depots = brouillon.depots ?? [];

  // Le choix d'une activité : la liste de Mes Activités, chargée à la demande
  const [choixActivite, setChoixActivite] = useState(renvoi && !brouillon.devoirId);
  const [devoirs, setDevoirs] = useState<Devoir[] | null>(null);
  const [recherche, setRecherche] = useState('');
  useEffect(() => {
    if (!choixActivite || devoirs !== null) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/devoirs', { headers });
        const json = await res.json();
        if (annule) return;
        setDevoirs(
          json.success
            ? (json.data as Devoir[]).filter((d) => !d.archive && d.typeTravail !== 'sequence' && d.typeTravail !== 'portfolio')
            : []
        );
      } catch {
        if (!annule) setDevoirs([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [choixActivite, devoirs, getAuthHeaders]);
  const q = recherche.trim().toLowerCase();
  const candidats = (devoirs ?? []).filter((d) => !q || d.intitule.toLowerCase().includes(q));

  // ── Validation du prof : bloque-t-elle la suite, quelles valeurs attribue-t-elle ──
  const validation = brouillon.validation ?? { bloquante: false, attribue: [] };
  const poserValidation = (patch: Partial<ValidationEtape>) => poser({ validation: { ...validation, ...patch } });
  const modifierValeur = (id: string, patch: Partial<ValeurDeclaree>) =>
    poserValidation({ attribue: validation.attribue.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
  const affiche = brouillon.affiche ?? [];
  const basculerAffiche = (valeurId: string, coche: boolean) =>
    poser({
      affiche: coche
        ? [...affiche.filter((a) => a.valeurId !== valeurId), { valeurId, place: 'travail' }]
        : affiche.filter((a) => a.valeurId !== valeurId),
    });
  const soumissible = renvoi || depots.length > 0;

  const passerAuxDepots = () => {
    poser({ nature: 'etape', devoirId: undefined, atelier: undefined, typeTravail: undefined });
    setChoixActivite(false);
  };
  const passerAUneActivite = () => {
    poser({ nature: 'activite' });
    if (!brouillon.devoirId) setChoixActivite(true);
  };
  const choisirActivite = (d: Devoir) => {
    poser({
      nature: 'activite',
      devoirId: d.id,
      atelier: d.atelier,
      typeTravail: d.typeTravail,
      // Le titre de l'activité, sauf si le prof en a déjà donné un
      titre: brouillon.titre.trim() ? brouillon.titre : d.intitule,
    });
    setChoixActivite(false);
  };

  const modifierDepot = (id: string, patch: Partial<PortfolioDepot>) =>
    poser({ depots: depots.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const retirerDepot = (id: string) => poser({ depots: depots.filter((d) => d.id !== id) });
  const ajouterDepot = () => poser({ depots: [...depots, nouveauDepot(['texte'])] });

  const enregistrer = () => {
    const titre = brouillon.titre.trim();
    if (!titre) return;
    if (intro) {
      onSave(
        nettoyerIntroduction({
          ...brouillon,
          titre,
          section: '',
          objectifs: (brouillon.objectifs ?? []).map((o) => o.trim()).filter(Boolean),
          echeance: null,
          ia: null,
        })
      );
      return;
    }
    onSave({
      ...brouillon,
      titre,
      section: (brouillon.section ?? '').trim(),
      objectifs: (brouillon.objectifs ?? []).map((o) => o.trim()).filter(Boolean),
      iaPrecision: brouillon.ia === 'partielle' ? (brouillon.iaPrecision ?? '').trim() : '',
      // Une valeur sans nom n'est pas enregistrée
      validation: brouillon.validation
        ? { ...brouillon.validation, attribue: brouillon.validation.attribue.filter((v) => v.nom.trim()) }
        : null,
      depots: renvoi
        ? []
        : depots
            .filter((d) => d.libelle.trim())
            .map((d) => (d.colonnes ? { ...d, colonnes: d.colonnes.map((c) => c.trim()).filter(Boolean) } : d)),
    });
  };

  const listeSections = 'sections-portfolio';
  const [ressourcesOuvertes, setRessourcesOuvertes] = useState(!!brouillon.ressources);
  // La bibliothèque d'œuvres : chargée dès qu'un dépôt « Scène d'une œuvre » existe
  const [oeuvres, setOeuvres] = useState<Oeuvre[] | null>(null);
  const aDepotScene = (brouillon.depots ?? []).some((d) => typesDuDepot(d).includes('scene'));
  useEffect(() => {
    if (aDepotScene && oeuvres === null) void chargerBibliotheque(getAuthHeaders).then(setOeuvres);
  }, [aDepotScene, oeuvres, getAuthHeaders]);

  return (
    <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${base.popup} ${styles.popupLarge}`}>
        <header className={base.popupEntete}>
          <h3>{intro ? 'Introduction du portfolio' : 'Étape du portfolio'}</h3>
          <button type="button" className={base.popupFermer} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className={base.popupCorps}>
          {intro && (
            <>
              <label className={styles.lab}>
                Image de couverture <span className={styles.labNote}>— le cercle en tête du serpentin et de la page de l’élève</span>
              </label>
              <PortfolioCouverture
                valeur={brouillon.couverture}
                onChange={(id) => poser({ couverture: id })}
                cadrage={brouillon.couvertureCadrage}
                onCadrage={(cadrage) => poser({ couvertureCadrage: cadrage })}
                titrePortfolio={titrePortfolio}
                disabled={disabled}
              />
            </>
          )}
          <div className={intro ? undefined : styles.deuxColonnes}>
            {!intro && (
            <div>
              <label className={styles.lab} htmlFor="etp-section">Section</label>
              <input
                id="etp-section"
                className={styles.input}
                list={listeSections}
                value={brouillon.section ?? ''}
                onChange={(e) => poser({ section: e.target.value })}
                placeholder="1. Premiers préparatifs"
                disabled={disabled}
              />
              <datalist id={listeSections}>
                {sections.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <p className={styles.hint}>Les étapes qui portent la même section se regroupent dans le sommaire de l’élève.</p>
            </div>
            )}
            <div>
              <label className={styles.lab} htmlFor="etp-titre">{renvoi ? 'Titre de l’étape dans le portfolio' : 'Titre de l’étape'}</label>
              <input
                id="etp-titre"
                className={styles.input}
                value={brouillon.titre}
                onChange={(e) => poser({ titre: e.target.value })}
                placeholder={intro ? 'Introduction' : '2.2 Mon personnage'}
                disabled={disabled}
                autoFocus
              />
            </div>
          </div>

          {/* Le choix structurant de l’étape, juste après section et titre (JP, 2026-10-11) */}
          {!intro && (
          <>
          <label className={styles.lab}>Ce que l’élève fait dans cette étape</label>
          <div className={styles.seg} role="radiogroup" aria-label="Ce que l’élève fait">
            <button type="button" className={!renvoi ? styles.segActif : ''} onClick={passerAuxDepots} disabled={disabled}>
              📥 Des dépôts dans le portfolio
            </button>
            <button type="button" className={renvoi ? styles.segActif : ''} onClick={passerAUneActivite} disabled={disabled}>
              🎯 Une activité de Mes Activités
            </button>
          </div>
          </>
          )}

          {renvoi && !choixActivite && brouillon.devoirId && (
            <div className={styles.renvoiBloc}>
              <span className={styles.picto} aria-hidden="true">{iconeAtelier(brouillon.atelier)}</span>
              <div>
                <b>{brouillon.titre || 'Activité'}</b>
                <small>
                  {atelierLabel(brouillon.atelier ?? '', true) || brouillon.typeTravail} — l’élève la fait dans son
                  activité ; l’étape est cochée quand elle est remise.
                </small>
              </div>
              {!disabled && (
                <button type="button" className={`${styles.btnGhost} ${styles.btn}`} onClick={() => setChoixActivite(true)}>
                  Changer
                </button>
              )}
              {onOuvrirActivite && (
                <button type="button" className={`${styles.btnGhost} ${styles.btn}`} onClick={() => onOuvrirActivite(brouillon.devoirId!)}>
                  ✏️ Ouvrir l’activité
                </button>
              )}
            </div>
          )}

          {renvoi && choixActivite && (
            <div className={styles.choixActivite}>
              <div className={styles.choixActiviteTete}>
                <input
                  type="search"
                  className={styles.recherche}
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher dans Mes Activités…"
                />
                <button
                  type="button"
                  className={`${styles.btnGhost} ${styles.btn}`}
                  onClick={() => onCreerActivite?.({ ...brouillon, nature: 'activite' })}
                  disabled={!onCreerActivite || disabled}
                  title={onCreerActivite ? 'Le formulaire de création prend la page ; l’étape garde ses réglages' : 'Depuis l’atelier du portfolio (Mes Ressources › Portfolios)'}
                >
                  ➕ Créer une nouvelle activité
                </button>
              </div>
              {devoirs === null ? (
                <p className={base.vide}>Chargement…</p>
              ) : candidats.length === 0 ? (
                <p className={base.vide}>{q ? 'Aucune activité ne correspond.' : 'Aucune activité pour l’instant.'}</p>
              ) : (
                <div className={base.liste}>
                  {candidats.map((d) => (
                    <button key={d.id} type="button" className={base.item} onClick={() => choisirActivite(d)}>
                      <span>{iconeAtelier(d.atelier)}</span>
                      <span className={base.activiteNom}>{d.intitule}</span>
                      <span className={base.itemClasses}>
                        {atelierLabel(d.atelier ?? '', true) || d.typeTravail}
                        {d.classes.length ? ` · ${d.classes.join(', ')}` : ' · sans classe'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className={styles.lab}>
            Objectifs <span className={styles.labNote}>— un par ligne, Entrée pour le suivant</span>
          </label>
          <ConsignesEditor
            nature="objectif"
            value={(brouillon.objectifs ?? []).join('\n')}
            onChange={(v) => poser({ objectifs: v.split('\n') })}
            disabled={disabled}
          />

          {!renvoi && (
            <>
              <label className={styles.lab}>
                {intro ? (
                  <>
                    Informations générales{' '}
                    <span className={styles.labNote}>— UAA évaluées, planification, déroulement… (lues par l’élève, rien à cocher)</span>
                  </>
                ) : (
                  <>
                    Consigne de l’étape <span className={styles.labNote}>— la liste des tâches que l’élève coche au fil du travail</span>
                  </>
                )}
              </label>
              <ConsignesEditor
                value={brouillon.consigne ?? ''}
                onChange={(v) => poser({ consigne: v })}
                disabled={disabled}
              />
            </>
          )}

          {!intro && (
          <>
          <div className={styles.deuxColonnes}>
            <div>
              <label className={styles.lab} htmlFor="etp-echeance">Échéance</label>
              <input
                id="etp-echeance"
                type="date"
                className={styles.input}
                value={brouillon.echeance ?? ''}
                onChange={(e) => poser({ echeance: e.target.value || null })}
                disabled={disabled}
              />
              <p className={styles.hint}>Facultative — affichée à l’élève sur l’étape et dans le sommaire.</p>
            </div>
            <div>
              <label className={styles.lab}>Intelligence artificielle</label>
              <div className={`${styles.seg} ${styles.segIa}`} role="radiogroup" aria-label="Statut IA">
                {STATUTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={brouillon.ia === s ? styles.segActif : ''}
                    onClick={() => poser({ ia: s })}
                    disabled={disabled}
                    title={STATUT_IA_LABELS[s].long}
                  >
                    <IaPicto statut={s} className={styles.iaImage} />
                    {STATUT_IA_LABELS[s].court}
                  </button>
                ))}
              </div>
              {/* « Aide de l'IA » : préciser COMMENT (lu par l'élève au survol de la carte IA) */}
              {brouillon.ia === 'partielle' && (
                <>
                  <label className={styles.lab} htmlFor="etp-ia-precision">
                    Comment l’élève peut utiliser l’IA <span className={styles.labNote}>— au survol de la carte IA, chez l’élève</span>
                  </label>
                  <textarea
                    id="etp-ia-precision"
                    className={styles.input}
                    rows={2}
                    maxLength={500}
                    value={brouillon.iaPrecision ?? ''}
                    onChange={(e) => poser({ iaPrecision: e.target.value })}
                    placeholder="Ex. : pour reformuler une phrase ou vérifier l’orthographe, pas pour écrire ta réplique"
                    disabled={disabled}
                  />
                </>
              )}
            </div>
          </div>

          <div className={styles.deuxColonnes}>
            <div>
              <label className={styles.lab}>Portée</label>
              <div className={styles.seg} role="radiogroup" aria-label="Portée">
                {(['personnelle', 'collective'] as PorteeEtape[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={(brouillon.portee ?? 'personnelle') === p ? styles.segActif : ''}
                    onClick={() => poser({ portee: p })}
                    disabled={disabled}
                  >
                    {p === 'personnelle' ? '👤 Personnelle' : '👥 Collective'}
                  </button>
                ))}
              </div>
              <p className={styles.hint}>Collective : un seul dépôt pour tout le groupe accepté (arrive à l’étape 2 du chantier).</p>
            </div>
            <div>
              <label className={styles.lab}>Enchaînement</label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={brouillon.verrouille === true}
                  onChange={(e) => poser({ verrouille: e.target.checked })}
                  disabled={disabled}
                />
                <div>
                  <b>Verrouille l’étape suivante</b>
                  <span>
                    {titreSuivante ? `« ${titreSuivante} » reste fermée` : 'L’étape suivante reste fermée'} tant que
                    celle-ci n’est pas faite.
                  </span>
                </div>
              </label>
            </div>
          </div>
          </>
          )}

          {!renvoi && !intro && (
            <>
              <p className={styles.hint}>Aucun dépôt = étape sans trace, cochée par l’élève lui-même.</p>
              {depots.map((d, i) => {
                const types = typesDuDepot(d);
                return (
                <div key={d.id} className={styles.depot}>
                  <div className={styles.depotTete}>
                    <span className={styles.depotNum}>{i + 1}</span>
                    <input
                      className={styles.input}
                      value={d.libelle}
                      onChange={(e) => modifierDepot(d.id, { libelle: e.target.value })}
                      placeholder="Libellé du dépôt (« Costume et maquillage »)"
                      disabled={disabled}
                    />
                    {!disabled && (
                      <button type="button" className={styles.depotSup} onClick={() => retirerDepot(d.id)} title="Retirer ce dépôt">
                        ✕
                      </button>
                    )}
                  </div>
                  <div className={styles.depotTypes} role="group" aria-label="Ce que l’élève dépose">
                    <span className={styles.depotTypesLab}>L’élève dépose :</span>
                    {ORDRE_TYPES_DEPOT.map((t) => {
                      const dispo = TYPES_DEPOT_DISPONIBLES.includes(t);
                      const coche = types.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`${styles.depotType} ${coche ? styles.depotTypeOn : ''}`}
                          aria-pressed={coche}
                          onClick={() => {
                            const suivants = basculerType(types, t);
                            // Tableau coché pour la première fois : deux colonnes à nommer
                            const colonnes =
                              suivants.includes('tableau') && !(d.colonnes && d.colonnes.length > 0) ? ['', ''] : d.colonnes;
                            modifierDepot(d.id, { types: suivants, type: undefined, colonnes });
                          }}
                          disabled={disabled || !dispo}
                          title={
                            !dispo
                              ? 'Bientôt disponible'
                              : t === 'groupe'
                                ? 'Déclaration des partenaires — ne se combine avec aucun autre type'
                                : t === 'scene'
                                  ? 'L’élève choisit une scène dans une œuvre de la bibliothèque — ne se combine avec aucun autre type'
                                : 'Plusieurs types possibles : une zone par type, dans le même bloc'
                          }
                        >
                          {coche && '✓ '}
                          {TYPE_DEPOT_LABELS[t]}
                          {!dispo && ' · bientôt'}
                        </button>
                      );
                    })}
                  </div>
                  {types.includes('tableau') && (
                    <div className={styles.colonnesEdit}>
                      <span className={styles.depotTypesLab}>Colonnes du tableau :</span>
                      {(d.colonnes ?? []).map((c, ci) => (
                        <span key={ci} className={styles.colonneChamp}>
                          <input
                            className={styles.input}
                            value={c}
                            onChange={(e) =>
                              modifierDepot(d.id, {
                                colonnes: (d.colonnes ?? []).map((x, j) => (j === ci ? e.target.value : x)),
                              })
                            }
                            placeholder={ci === 0 ? 'Réplique' : ci === 1 ? 'Didascalie' : `Colonne ${ci + 1}`}
                            disabled={disabled}
                            aria-label={`Colonne ${ci + 1}`}
                          />
                          {!disabled && (d.colonnes ?? []).length > 1 && (
                            <button
                              type="button"
                              className={styles.depotSup}
                              onClick={() => modifierDepot(d.id, { colonnes: (d.colonnes ?? []).filter((_, j) => j !== ci) })}
                              title="Retirer cette colonne"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                      {!disabled && (d.colonnes ?? []).length < MAX_COLONNES_TABLEAU && (
                        <button
                          type="button"
                          className={styles.depotType}
                          onClick={() => modifierDepot(d.id, { colonnes: [...(d.colonnes ?? []), ''] })}
                        >
                          + Colonne
                        </button>
                      )}
                      <span className={styles.hint}>L’élève ajoute les lignes lui-même.</span>
                    </div>
                  )}
                  {types.includes('scene') && (
                    <div className={styles.colonnesEdit}>
                      <span className={styles.depotTypesLab}>Œuvre :</span>
                      <select
                        className={styles.input}
                        value={d.oeuvreId ?? ''}
                        onChange={(e) => modifierDepot(d.id, { oeuvreId: e.target.value })}
                        disabled={disabled}
                        aria-label="L’œuvre où l’élève choisit sa scène"
                      >
                        <option value="">{oeuvres === null ? 'Chargement…' : '— Choisir une œuvre de la bibliothèque —'}</option>
                        {(oeuvres ?? []).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.titre}
                          </option>
                        ))}
                      </select>
                      <span className={styles.hint}>L’élève choisit la pièce, puis la scène ; le texte s’affiche dans ses ressources.</span>
                    </div>
                  )}
                  {types.includes('groupe') ? (
                    <p className={styles.hint}>
                      L’élève y liste ses partenaires (élèves de la classe) ; chacun confirme, puis vous acceptez ou
                      refusez le groupe depuis sa copie.
                    </p>
                  ) : (
                    <div className={types.includes('texte') ? styles.deuxColonnes : undefined}>
                      <input
                        className={styles.input}
                        value={d.consigne ?? ''}
                        onChange={(e) => modifierDepot(d.id, { consigne: e.target.value })}
                        placeholder="Consigne du dépôt"
                        disabled={disabled}
                      />
                      {/* L'exemple en filigrane n'a de sens que dans la zone de texte */}
                      {types.includes('texte') && (
                        <input
                          className={styles.input}
                          value={d.exemple ?? ''}
                          onChange={(e) => modifierDepot(d.id, { exemple: e.target.value })}
                          placeholder="Exemple (en filigrane chez l’élève)"
                          disabled={disabled}
                        />
                      )}
                    </div>
                  )}
                  <label className={styles.depotObligatoire}>
                    <input
                      type="checkbox"
                      checked={d.obligatoire !== false}
                      onChange={(e) => modifierDepot(d.id, { obligatoire: e.target.checked })}
                      disabled={disabled}
                    />
                    Obligatoire — l’étape n’est faite que si ce dépôt est rempli
                    {types.length > 1 && ' (toutes ses parties)'}
                  </label>
                </div>
                );
              })}
              {!disabled && (
                <button type="button" className={styles.ajout} onClick={ajouterDepot}>
                  + Ajouter un dépôt
                </button>
              )}
            </>
          )}

          {soumissible && (
            <>
              <label className={styles.lab}>
                Validation du professeur{' '}
                <span className={styles.labNote}>— l’élève soumet l’étape ; vous validez ✓ ou refusez ✗</span>
              </label>
              <div className={styles.validationBloc}>
                <label className={styles.ficheOption}>
                  <input
                    type="checkbox"
                    checked={validation.bloquante}
                    onChange={(e) => poserValidation({ bloquante: e.target.checked })}
                    disabled={disabled}
                  />
                  <span>
                    <b>La suite attend ma validation</b>
                    <span className={styles.labNote}> — l’étape suivante reste fermée tant que je n’ai pas validé</span>
                  </span>
                </label>
                <p className={styles.validationSousTitre}>En validant, j’attribue au groupe :</p>
                {validation.attribue.map((v) => (
                  <div key={v.id} className={styles.valeurDeclaree}>
                    <input
                      className={styles.input}
                      value={v.nom}
                      onChange={(e) => modifierValeur(v.id, { nom: e.target.value })}
                      placeholder="Nom (« Le sketch »)"
                      disabled={disabled}
                      aria-label="Nom de la valeur"
                    />
                    <select
                      value={v.genre}
                      onChange={(e) => modifierValeur(v.id, { genre: e.target.value as GenreValeur })}
                      disabled={disabled}
                      aria-label="Genre de la valeur"
                    >
                      {(Object.keys(GENRE_VALEUR_LABELS) as GenreValeur[]).map((g) => (
                        <option key={g} value={g}>
                          {GENRE_VALEUR_LABELS[g]}
                        </option>
                      ))}
                    </select>
                    {!disabled && (
                      <button
                        type="button"
                        className={styles.depotSup}
                        onClick={() => poserValidation({ attribue: validation.attribue.filter((x) => x.id !== v.id) })}
                        title="Retirer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {!disabled && validation.attribue.length < 6 && (
                  <button
                    type="button"
                    className={styles.depotType}
                    onClick={() =>
                      poserValidation({
                        attribue: [...validation.attribue, { id: generateValeurId(), nom: '', genre: 'oeuvre' }],
                      })
                    }
                  >
                    + Une valeur à attribuer (texte, lien, vidéo…)
                  </button>
                )}
              </div>
            </>
          )}

          {valeursDisponibles.length > 0 && (
            <>
              <label className={styles.lab}>
                Afficher dans cette étape{' '}
                <span className={styles.labNote}>— ce qui a été attribué au groupe plus tôt dans le portfolio</span>
              </label>
              <div className={styles.validationBloc}>
                {valeursDisponibles.map((v) => {
                  const a = affiche.find((x) => x.valeurId === v.id);
                  return (
                    <div key={v.id} className={styles.valeurDeclaree}>
                      <label className={styles.afficheCase}>
                        <input
                          type="checkbox"
                          checked={!!a}
                          onChange={(e) => basculerAffiche(v.id, e.target.checked)}
                          disabled={disabled}
                        />
                        <span>
                          <b>{v.nom || '(sans nom)'}</b>
                          <span className={styles.labNote}> — {GENRE_VALEUR_LABELS[v.genre].toLowerCase()}, attribué à « {v.etapeTitre} »</span>
                        </span>
                      </label>
                      {a && (
                        <select
                          value={a.place}
                          onChange={(e) =>
                            poser({
                              affiche: affiche.map((x) =>
                                x.valeurId === v.id ? { ...x, place: e.target.value as AffichageValeur['place'] } : x
                              ),
                            })
                          }
                          disabled={disabled}
                          aria-label="Où l’afficher"
                        >
                          <option value="travail">
                            {/* Une activité d'écriture : la scène est posée dans l'éditeur
                                de la copie encore vide (plan 2026-10-11, phase 1) */}
                            {renvoi && brouillon.typeTravail === 'ecrire'
                              ? 'Dans l’éditeur de la copie (texte à retravailler)'
                              : 'Colonne de travail (gauche)'}
                          </option>
                          <option value="ressources">Onglet Ressources (droite)</option>
                        </select>
                      )}
                    </div>
                  );
                })}
                {renvoi && <p className={styles.hint}>Pour une activité, la valeur apparaît aussi dans son onglet Ressources quand l’élève l’ouvre depuis le portfolio.</p>}
              </div>
            </>
          )}

          <label className={styles.lab}>
            Ressources de l’étape <span className={styles.labNote}>— facultatives ; en tête de l’onglet Ressources quand l’élève est sur cette étape</span>
          </label>
          {ressourcesOuvertes ? (
            <RessourcesInput
              ressources={brouillon.ressources ?? null}
              onRessourcesChange={(r) => poser({ ressources: r })}
              disabled={disabled}
            />
          ) : (
            <button type="button" className={styles.ajout} onClick={() => setRessourcesOuvertes(true)} disabled={disabled}>
              + Ajouter des ressources à cette étape
            </button>
          )}
        </div>
        <footer className={base.popupPied}>
          <span className={base.popupNote}>
            {intro
              ? 'La première page du portfolio : faite dès que l’élève l’ouvre.'
              : renvoi
                ? 'Les réglages de l’activité elle-même se font dans sa popup ✏️.'
                : 'Sans titre, l’étape n’est pas enregistrée.'}
          </span>
          <button type="button" className={base.btnGhost} onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className={base.btnPrimary}
            onClick={enregistrer}
            disabled={disabled || !brouillon.titre.trim() || (renvoi && !brouillon.devoirId)}
            title={renvoi && !brouillon.devoirId ? 'Choisis d’abord l’activité' : undefined}
          >
            Enregistrer l’étape
          </button>
        </footer>
      </div>
    </div>
  );
}
