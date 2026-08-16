'use client';

// Sommaire de l'œuvre — il vit dans la COLONNE DE DROITE, sous l'onglet
// « Consignes et navigation » (décision de JP du 2026-08-15).
//
// Pourquoi là plutôt qu'en troisième colonne : la liseuse EST la colonne de
// gauche. Un sommaire à demeure y prendrait la place du texte, et sur les
// écrans de Chromebook du Collège, chaque pixel de largeur compte. À droite,
// il ne coûte rien et le texte peut se lire en deux colonnes.
//
// L'ACTE n'est pas un niveau de navigation : c'est un intertitre qui regroupe
// les scènes. On ne clique pas sur un acte, on clique sur une scène.
//
// Les CHAPITRES SE REPLIENT. L'anthologie Molière en compte 11 pour 67
// scènes : déroulée d'un bloc, la liste demandait un défilement interminable
// pour retrouver la pièce en cours. Seul le chapitre où l'élève se trouve
// s'ouvre de lui-même.
//
// ⚠️ Ce composant est rendu DANS `.content` de l'AssistancePanel, qui est à
// `padding: 0` — le panneau ne préjuge pas de son contenu. Il doit donc poser
// son propre retrait, sinon le texte colle au bord (gotcha du projet).

import { useState } from 'react';
import { etatPastille, type EtatPastille } from '@/types/oeuvre';
import type { OeuvreChapitre, OeuvreProgression } from '@/types/oeuvre';
import styles from './OeuvreReader.module.css';

// Ce que dit chaque couleur — en infobulle sur la pastille, et en légende
// sous le compteur. Trois couleurs sans mode d'emploi se devinent de travers :
// l'orange se lirait comme un avertissement alors qu'il dit « tu y travailles ».
const LEGENDE_PASTILLE: Record<EtatPastille, string> = {
  vide: 'Pas encore ouverte',
  ouverte: 'Ouverte',
  active: 'Tu y as travaillé',
  faite: 'Terminée',
};

interface OeuvreSommaireProps {
  chapitres: OeuvreChapitre[];
  sectionCourante: string | null;
  progression: OeuvreProgression | null;
  onAller: (sectionId: string) => void;
}

export default function OeuvreSommaire({
  chapitres,
  sectionCourante,
  progression,
  onAller,
}: OeuvreSommaireProps) {
  // Le chapitre ouvert suit l'élève : il change de pièce, le sommaire le suit.
  const chapitreCourant =
    chapitres.find((c) => c.sections.some((s) => s.id === sectionCourante))?.id ?? null;
  const [ouvert, setOuvert] = useState<string | null>(chapitreCourant ?? chapitres[0]?.id ?? null);

  // Ajustement PENDANT le rendu, et non dans un effet : React documente ce
  // geste pour « un état qui doit suivre une prop » — l'effet, lui, provoquait
  // un second rendu en cascade à chaque changement de scène. On ne prévient
  // ici aucun parent : le seul état touché est celui de ce composant.
  const [suivi, setSuivi] = useState<string | null>(chapitreCourant);
  if (chapitreCourant && chapitreCourant !== suivi) {
    setSuivi(chapitreCourant);
    setOuvert(chapitreCourant);
  }

  if (!chapitres.length) {
    return (
      <div className={styles.sommaire}>
        <p className={styles.sommaireVide}>Cette œuvre n’a pas encore de contenu.</p>
      </div>
    );
  }

  // Deux compteurs seulement — ce sont les deux seuls indicateurs de cet
  // atelier : on lit, on vérifie. Aucune note nulle part.
  const total = chapitres.reduce((n, c) => n + c.sections.length, 0);
  const faites = chapitres.reduce(
    (n, c) => n + c.sections.filter((s) => progression?.sections[s.id]?.termineLe).length,
    0
  );
  const aVerifier = chapitres.reduce(
    (n, c) => n + c.sections.filter((s) => s.aQuestions).length,
    0
  );

  return (
    <div className={styles.sommaire}>
      <div className={styles.sommaireEntete}>
        <h4 className={styles.sommaireEnteteTitre}>Navigation dans le texte</h4>
        <p className={styles.sommaireEnteteChiffres}>
          {total} scène{total > 1 ? 's' : ''}
          {aVerifier > 0 && <> · {faites}/{aVerifier} vérification{aVerifier > 1 ? 's' : ''} faite{faites > 1 ? 's' : ''}</>}
        </p>
        {aVerifier > 0 && (
          <div className={styles.sommaireBarre}>
            <i style={{ width: `${Math.round((faites / aVerifier) * 100)}%` }} />
          </div>
        )}

        <p className={styles.puceLegende}>
          <span className={styles.puceLegendeItem}>
            <i className={`${styles.puceLegendePoint} ${styles.puceVue}`} /> ouverte
          </span>
          <span className={styles.puceLegendeItem}>
            <i className={`${styles.puceLegendePoint} ${styles.puceActive}`} /> tu y as travaillé
          </span>
          <span className={styles.puceLegendeItem}>
            <i className={`${styles.puceLegendePoint} ${styles.puceFaite}`} /> terminée
          </span>
        </p>
      </div>

      <nav className={styles.sommaireNav} aria-label="Navigation dans le texte">
        {chapitres.map((chapitre) => {
          const deplie = ouvert === chapitre.id;
          const faitesIci = chapitre.sections.filter(
            (s) => progression?.sections[s.id]?.termineLe
          ).length;

          return (
            <section key={chapitre.id} className={styles.sommaireChapitre}>
              <button
                type="button"
                className={`${styles.sommaireTitre} ${deplie ? styles.sommaireTitreOuvert : ''}`}
                onClick={() => setOuvert(deplie ? null : chapitre.id)}
                aria-expanded={deplie}
              >
                <span className={styles.sommaireChevron} aria-hidden="true">
                  ▸
                </span>
                <span className={styles.sommaireTitreTexte}>
                  {chapitre.titre}
                  {chapitre.sousTitre && (
                    <span className={styles.sommaireDate}>{chapitre.sousTitre}</span>
                  )}
                </span>
                <span className={styles.sommaireChapitreCompteur}>
                  {faitesIci > 0 ? `${faitesIci}/${chapitre.sections.length}` : chapitre.sections.length}
                </span>
              </button>

              {deplie && (
                <div className={styles.sommaireSections}>
                  {chapitre.sections.map((section, index) => {
                    // L'intertitre d'acte n'apparaît qu'au changement d'acte
                    const groupePrecedent =
                      index > 0 ? chapitre.sections[index - 1].groupe : undefined;
                    const nouvelActe = section.groupe && section.groupe !== groupePrecedent;
                    const etat = progression?.sections[section.id];
                    // Trois états, une seule règle — elle vit dans
                    // src/types/oeuvre.ts et sert aussi au suivi du prof.
                    const pastille = etatPastille(etat, section.aQuestions);
                    const faite = pastille === 'faite';

                    return (
                      <div key={section.id}>
                        {nouvelActe && <div className={styles.sommaireActe}>{section.groupe}</div>}
                        <button
                          type="button"
                          className={`${styles.sommaireItem} ${
                            section.id === sectionCourante ? styles.sommaireItemActif : ''
                          }`}
                          onClick={() => onAller(section.id)}
                          aria-current={section.id === sectionCourante ? 'true' : undefined}
                        >
                          <span
                            className={[
                              styles.puce,
                              pastille === 'faite' ? styles.puceFaite : '',
                              pastille === 'active' ? styles.puceActive : '',
                              pastille === 'ouverte' ? styles.puceVue : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            title={LEGENDE_PASTILLE[pastille]}
                          >
                            {faite ? '✓' : ''}
                          </span>
                          <span className={styles.sommaireLabel}>
                            {section.titre}
                            {section.aQuestions && (
                              <span className={styles.sommaireIndice}>
                                {faite ? 'vérification faite' : 'vérification de lecture'}
                              </span>
                            )}
                          </span>
                        </button>
                      </div>
                    );
                  })}

                  {chapitre.sections.length === 0 && (
                    <p className={styles.sommaireVide}>Aucune scène dans ce chapitre.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </nav>
    </div>
  );
}
