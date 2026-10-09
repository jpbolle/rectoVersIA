'use client';

// La popup « Étape du portfolio » — ce que le créateur règle sur UNE étape
// (plan 2026-10-09, maquette v2 vue 3) : section, titre, objectifs, consigne,
// échéance, statut IA à trois états, portée (personnelle / collective),
// « Verrouille l'étape suivante » (le réglage « Marquer comme terminé » de
// VibeCoding, transposé), et les dépôts.
//
// Un RENVOI vers une activité existante n'a ni consigne ni dépôt ici — ils
// sont dans l'activité — mais garde section, objectifs, échéance et IA.
//
// Popup de l'application (jamais `prompt()` / `confirm()`), sur le gabarit
// des popups de l'éditeur FLE (`ModuleFleEditor.module.css`).

import { useState } from 'react';
import ConsignesEditor from '@/components/ConsignesEditor/ConsignesEditor';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import { atelierLabel } from '@/types/didactique';
import { iconeAtelier } from '@/types/sequence-fle';
import {
  nouveauDepot,
  STATUT_IA_LABELS,
  TYPE_DEPOT_LABELS,
  type PorteeEtape,
  type PortfolioDepot,
  type PortfolioEtape,
  type StatutIA,
  type TypeDepot,
} from '@/types/portfolio';
import base from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
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
  disabled?: boolean;
}

const STATUTS: (StatutIA | null)[] = [null, 'libre', 'partielle', 'aucune'];

export default function EtapePortfolioModal({
  etape,
  sections,
  titreSuivante,
  onSave,
  onClose,
  onOuvrirActivite,
  disabled = false,
}: Props) {
  const [brouillon, setBrouillon] = useState<PortfolioEtape>({
    ...etape,
    objectifs: etape.objectifs ?? [],
    depots: etape.depots ?? [],
  });
  const poser = (patch: Partial<PortfolioEtape>) => setBrouillon((b) => ({ ...b, ...patch }));
  const renvoi = brouillon.nature === 'activite';
  const depots = brouillon.depots ?? [];

  const modifierDepot = (id: string, patch: Partial<PortfolioDepot>) =>
    poser({ depots: depots.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const retirerDepot = (id: string) => poser({ depots: depots.filter((d) => d.id !== id) });
  const ajouterDepot = () => poser({ depots: [...depots, nouveauDepot('texte')] });

  const enregistrer = () => {
    const titre = brouillon.titre.trim();
    if (!titre) return;
    onSave({
      ...brouillon,
      titre,
      section: (brouillon.section ?? '').trim(),
      objectifs: (brouillon.objectifs ?? []).map((o) => o.trim()).filter(Boolean),
      depots: renvoi ? [] : depots.filter((d) => d.libelle.trim()),
    });
  };

  const listeSections = 'sections-portfolio';
  const [ressourcesOuvertes, setRessourcesOuvertes] = useState(!!brouillon.ressources);

  return (
    <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${base.popup} ${styles.popupLarge}`}>
        <header className={base.popupEntete}>
          <h3>{renvoi ? 'Étape — activité du portfolio' : 'Étape du portfolio'}</h3>
          <button type="button" className={base.popupFermer} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className={base.popupCorps}>
          {renvoi && (
            <div className={styles.renvoiBloc}>
              <span className={styles.picto} aria-hidden="true">{iconeAtelier(brouillon.atelier)}</span>
              <div>
                <b>{brouillon.titre || 'Activité'}</b>
                <small>
                  {atelierLabel(brouillon.atelier ?? '', true) || brouillon.typeTravail} — l’élève la fait dans son
                  activité ; l’étape est cochée quand elle est remise.
                </small>
              </div>
              {onOuvrirActivite && brouillon.devoirId && (
                <button type="button" className={`${styles.btnGhost} ${styles.btn}`} onClick={() => onOuvrirActivite(brouillon.devoirId!)}>
                  ✏️ Ouvrir l’activité
                </button>
              )}
            </div>
          )}

          <div className={styles.deuxColonnes}>
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
            <div>
              <label className={styles.lab} htmlFor="etp-titre">{renvoi ? 'Titre de l’étape dans le portfolio' : 'Titre de l’étape'}</label>
              <input
                id="etp-titre"
                className={styles.input}
                value={brouillon.titre}
                onChange={(e) => poser({ titre: e.target.value })}
                placeholder="2.2 Mon personnage"
                disabled={disabled}
                autoFocus={!renvoi}
              />
            </div>
          </div>

          <label className={styles.lab}>
            Objectifs <span className={styles.labNote}>— un par ligne, Entrée pour le suivant</span>
          </label>
          <ConsignesEditor
            value={(brouillon.objectifs ?? []).join('\n')}
            onChange={(v) => poser({ objectifs: v.split('\n') })}
            disabled={disabled}
          />

          {!renvoi && (
            <>
              <label className={styles.lab} htmlFor="etp-consigne">Consigne de l’étape</label>
              <textarea
                id="etp-consigne"
                className={`${styles.input} ${styles.textarea}`}
                value={brouillon.consigne ?? ''}
                onChange={(e) => poser({ consigne: e.target.value })}
                placeholder="Ce que l’élève fait dans cette étape…"
                disabled={disabled}
              />
            </>
          )}

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
              <div className={styles.seg} role="radiogroup" aria-label="Statut IA">
                {STATUTS.map((s) => (
                  <button
                    key={s ?? 'activite'}
                    type="button"
                    className={(brouillon.ia ?? null) === s ? styles.segActif : ''}
                    onClick={() => poser({ ia: s })}
                    disabled={disabled}
                    title={s ? STATUT_IA_LABELS[s].long : 'Le réglage IA de l’activité'}
                  >
                    {s ? `${STATUT_IA_LABELS[s].picto} ${STATUT_IA_LABELS[s].court}` : 'Celui de l’activité'}
                  </button>
                ))}
              </div>
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

          {!renvoi && (
            <>
              <label className={styles.lab}>
                Dépôts <span className={styles.labNote}>— ce que l’élève laisse dans cette étape · aucun = étape sans trace, cochée par l’élève</span>
              </label>
              {depots.map((d, i) => (
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
                    <select
                      value={d.type}
                      onChange={(e) => modifierDepot(d.id, { type: e.target.value as TypeDepot })}
                      disabled={disabled}
                      aria-label="Type de dépôt"
                    >
                      {(Object.keys(TYPE_DEPOT_LABELS) as TypeDepot[]).map((t) => (
                        <option key={t} value={t}>{TYPE_DEPOT_LABELS[t]}</option>
                      ))}
                      <option disabled>Tableau — bientôt</option>
                      <option disabled>Image — bientôt</option>
                      <option disabled>Lien — bientôt</option>
                    </select>
                    {!disabled && (
                      <button type="button" className={styles.depotSup} onClick={() => retirerDepot(d.id)} title="Retirer ce dépôt">
                        ✕
                      </button>
                    )}
                  </div>
                  {d.type === 'groupe' ? (
                    <p className={styles.hint}>
                      L’élève y liste ses partenaires (élèves de la classe) ; chacun confirme, puis vous acceptez ou
                      refusez le groupe depuis sa copie.
                    </p>
                  ) : (
                    <div className={styles.deuxColonnes}>
                      <input
                        className={styles.input}
                        value={d.consigne ?? ''}
                        onChange={(e) => modifierDepot(d.id, { consigne: e.target.value })}
                        placeholder="Consigne du dépôt"
                        disabled={disabled}
                      />
                      <input
                        className={styles.input}
                        value={d.exemple ?? ''}
                        onChange={(e) => modifierDepot(d.id, { exemple: e.target.value })}
                        placeholder="Exemple (en filigrane chez l’élève)"
                        disabled={disabled}
                      />
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
                  </label>
                </div>
              ))}
              {!disabled && (
                <button type="button" className={styles.ajout} onClick={ajouterDepot}>
                  + Ajouter un dépôt
                </button>
              )}
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
            {renvoi ? 'Les réglages de l’activité elle-même se font dans sa popup ✏️.' : 'Sans titre, l’étape n’est pas enregistrée.'}
          </span>
          <button type="button" className={base.btnGhost} onClick={onClose}>
            Annuler
          </button>
          <button type="button" className={base.btnPrimary} onClick={enregistrer} disabled={disabled || !brouillon.titre.trim()}>
            Enregistrer l’étape
          </button>
        </footer>
      </div>
    </div>
  );
}
