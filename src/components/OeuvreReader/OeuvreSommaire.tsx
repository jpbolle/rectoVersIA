'use client';

// Sommaire de l'œuvre — il vit dans la COLONNE DE DROITE, sous l'onglet
// « Consignes et navigation dans le texte » (décision de JP du 2026-08-15).
//
// Pourquoi là plutôt qu'en troisième colonne : la liseuse EST la colonne de
// gauche. Un sommaire à demeure y prendrait la place du texte, et sur les
// écrans de Chromebook du Collège, chaque pixel de largeur compte. À droite,
// il ne coûte rien et le texte peut se lire en deux colonnes.
//
// L'ACTE n'est pas un niveau de navigation : c'est un intertitre qui regroupe
// les scènes. On ne clique pas sur un acte, on clique sur une scène.

import type { OeuvreChapitre, OeuvreProgression } from '@/types/oeuvre';
import styles from './OeuvreReader.module.css';

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
  if (!chapitres.length) {
    return <p className={styles.sommaireVide}>Cette œuvre n’a pas encore de contenu.</p>;
  }

  return (
    <nav className={styles.sommaire} aria-label="Navigation dans le texte">
      {chapitres.map((chapitre) => (
        <section key={chapitre.id} className={styles.sommaireChapitre}>
          <h4 className={styles.sommaireTitre}>
            {chapitre.titre}
            {chapitre.sousTitre && <span className={styles.sommaireDate}>{chapitre.sousTitre}</span>}
          </h4>

          {chapitre.sections.map((section, index) => {
            // L'intertitre d'acte n'apparaît qu'au changement d'acte
            const groupePrecedent = index > 0 ? chapitre.sections[index - 1].groupe : undefined;
            const nouvelActe = section.groupe && section.groupe !== groupePrecedent;
            const etat = progression?.sections[section.id];
            const faite = !!etat?.termineLe;
            const vue = !!etat?.vueLe;

            return (
              <div key={section.id}>
                {nouvelActe && <div className={styles.sommaireActe}>{section.groupe}</div>}
                <button
                  type="button"
                  className={`${styles.sommaireItem} ${
                    section.id === sectionCourante ? styles.sommaireItemActif : ''
                  }`}
                  onClick={() => onAller(section.id)}
                >
                  <span
                    className={`${styles.puce} ${faite ? styles.puceFaite : vue ? styles.puceVue : ''}`}
                    aria-hidden="true"
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
        </section>
      ))}
    </nav>
  );
}
