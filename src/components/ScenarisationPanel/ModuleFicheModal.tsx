'use client';

// FICHE DESCRIPTIVE D'UN MODULE — popup ouverte depuis le menu du module.
//
// Elle rassemble ce qui décrit le module sans se saisir ligne à ligne : les
// concepts et connaissances visés (seul champ éditable ici), et tout ce qui se
// DÉDUIT de ses activités — méthodes, UAA, gestes, durée.
//
// Pourquoi une popup plutôt qu'une colonne ou un bloc déplié : le tableau des
// modules doit rester lisible d'un coup d'œil (UAA, périodes, activités), et le
// menu déroulant appartient aux ACTIVITÉS, où se fait la saisie réelle. Tout
// mettre au même endroit rendait les deux illisibles.

import { useEffect } from 'react';
import type { ModuleActivite, ModuleDidactique } from '@/types/scenarisation';
import AutoTextarea from './AutoTextarea';
import styles from './ScenarisationPanel.module.css';

interface Props {
  module: ModuleDidactique;
  genreLabel: string;
  genreIcone?: string;
  /** Périodes du module et leur équivalent horaire, déjà formatés */
  periodes: number;
  dureeLabel: string;
  /** Listes déjà traduites en libellés lisibles */
  methodes: string[];
  uaa: string[];
  gestesCognitifs: string[];
  gestesSavoirEtre: string[];
  /** Traduit les ids d'une activité pour le résumé */
  labelMethode: (id: string) => string;
  onConceptsChange: (concepts: string) => void;
  onClose: () => void;
}

function Tags({ valeurs, vide }: { valeurs: string[]; vide: string }) {
  if (!valeurs.length) return <span className={styles.ficheVide}>{vide}</span>;
  return (
    <span className={styles.roTags}>
      {valeurs.map((v) => (
        <span key={v} className={styles.roTag} title={v}>
          {v}
        </span>
      ))}
    </span>
  );
}

function LigneActivite({
  activite,
  labelMethode,
}: {
  activite: ModuleActivite;
  labelMethode: (id: string) => string;
}) {
  const meta = [
    `${activite.periodes} pér.`,
    ...(activite.uaa ?? []).map((u) => `UAA ${u}`),
    ...(activite.methodes ?? []).map(labelMethode),
  ];
  return (
    <li className={styles.ficheActivite}>
      <span className={styles.ficheActIcone}>{activite.devoirId ? '🔗' : '🗣'}</span>
      <span className={styles.ficheActCorps}>
        <span className={styles.ficheActTitre}>
          {activite.titre.trim() || <em className={styles.ficheVide}>Sans intitulé</em>}
        </span>
        <span className={styles.ficheActMeta}>{meta.join(' · ')}</span>
        {activite.concepts?.trim() && (
          <span className={styles.ficheActConcepts}>{activite.concepts}</span>
        )}
        {(activite.gestes ?? []).length > 0 && (
          <span className={styles.ficheActGestes}>{activite.gestes.join(' · ')}</span>
        )}
      </span>
    </li>
  );
}

export default function ModuleFicheModal({
  module,
  genreLabel,
  genreIcone,
  periodes,
  dureeLabel,
  methodes,
  uaa,
  gestesCognitifs,
  gestesSavoirEtre,
  labelMethode,
  onConceptsChange,
  onClose,
}: Props) {
  const nbAct = module.activites.length;

  // Échap ferme la fiche — la popup des activités le fait déjà, celle-ci ne
  // se fermait qu'à la souris.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={styles.ficheOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.ficheModal} role="dialog" aria-modal="true">
        <div className={styles.ficheHead}>
          <div>
            <span className={styles.ficheGenre}>
              {genreIcone && <span>{genreIcone} </span>}
              {genreLabel}
            </span>
            <h3 className={styles.ficheTitre}>
              {module.titre.trim() || 'Module sans titre'}
            </h3>
          </div>
          <button type="button" className={styles.ficheClose} onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>

        {/* Les chiffres du module, en tête : ce sont eux qu'on vient vérifier */}
        <div className={styles.ficheChiffres}>
          <div className={styles.ficheChiffre}>
            <span className={styles.ficheChiffreVal}>{periodes}</span>
            <span className={styles.ficheChiffreLbl}>période{periodes > 1 ? 's' : ''}</span>
          </div>
          <div className={styles.ficheChiffre}>
            <span className={styles.ficheChiffreVal}>{nbAct}</span>
            <span className={styles.ficheChiffreLbl}>activité{nbAct > 1 ? 's' : ''}</span>
          </div>
          <div className={styles.ficheChiffre}>
            <span className={styles.ficheChiffreVal}>{uaa.length}</span>
            <span className={styles.ficheChiffreLbl}>UAA ciblée{uaa.length > 1 ? 's' : ''}</span>
          </div>
          <span className={styles.ficheDuree}>{dureeLabel}</span>
        </div>

        <div className={styles.ficheCorps}>
          {/* Seul champ éditable de la fiche */}
          <section className={styles.ficheBloc}>
            <span className={styles.ficheLabel}>Concepts et connaissances</span>
            <AutoTextarea
              className={styles.detailArea}
              value={module.objectifs.concepts}
              placeholder="Ce que l’élève doit savoir…"
              onChange={onConceptsChange}
            />
          </section>

          {/* Tout ce qui suit se DÉDUIT des activités — rien ne s'y saisit */}
          <div className={styles.ficheDeduit}>
            <section className={styles.ficheBloc}>
              <span className={styles.ficheLabel}>
                Méthodes d’enseignement
                <span className={styles.auto}>d’après les activités</span>
              </span>
              <Tags valeurs={methodes} vide="Aucune — à choisir sur une activité" />
            </section>

            <section className={styles.ficheBloc}>
              <span className={styles.ficheLabel}>
                UAA visées
                <span className={styles.auto}>d’après les activités</span>
              </span>
              <Tags valeurs={uaa} vide="Aucune — à cocher sur une activité" />
            </section>

            <section className={styles.ficheBloc}>
              <span className={styles.ficheLabel}>
                Gestes cognitifs
                <span className={styles.auto}>d’après les activités</span>
              </span>
              <Tags valeurs={gestesCognitifs} vide="Aucun — à cocher dans la colonne Gestes d’une activité" />
              {module.objectifs.habiletesTexte && (
                <p className={styles.ancienTexte}>
                  Note d’avant les gestes : {module.objectifs.habiletesTexte}
                </p>
              )}
            </section>

            <section className={styles.ficheBloc}>
              <span className={styles.ficheLabel}>
                Savoir-être et gestes réflexifs
                <span className={styles.auto}>d’après les activités</span>
              </span>
              <Tags valeurs={gestesSavoirEtre} vide="Aucun — à cocher dans la colonne Gestes d’une activité" />
              {module.objectifs.savoirEtreTexte && (
                <p className={styles.ancienTexte}>
                  Note d’avant les gestes : {module.objectifs.savoirEtreTexte}
                </p>
              )}
            </section>
          </div>

          {/* Les activités en RÉSUMÉ : la saisie reste dans le menu déroulant
              du module, cette liste sert à relire le parcours d'un bloc. */}
          <section className={styles.ficheBloc}>
            <span className={styles.ficheLabel}>
              Activités du module
              <span className={styles.auto}>résumé — la saisie se fait dans le module</span>
            </span>
            {nbAct === 0 ? (
              <p className={styles.ficheVide}>
                Aucune activité. Les périodes du module sont la somme de celles de ses activités.
              </p>
            ) : (
              <ol className={styles.ficheActListe}>
                {module.activites.map((a) => (
                  <LigneActivite key={a.id} activite={a} labelMethode={labelMethode} />
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className={styles.ficheFoot}>
          <button type="button" className={styles.btn} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
