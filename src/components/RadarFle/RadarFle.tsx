'use client';

// Le radar CECR — une toile d'araignée à N branches (les compétences du
// référentiel FLE), N anneaux (les niveaux visibles, pré-A1 au centre), et
// l'aire bleue du positionnement de l'élève.
//
// Porté de la maquette de JP (2026-09-14) : les branches tournent dans le
// SENS HORAIRE depuis le haut, les anneaux sont étiquetés sur l'axe vertical
// (A1, A2, B1, B2), et la légende « 0 = pré-A1 · 1 = A1 … » se lit sous le
// radar. SVG maison, aucune bibliothèque.
//
// ⚠ Géométrie en angles d'ÉCRAN (y vers le bas) : l'angle 0 pointe en haut et
// croît dans le sens horaire — c'est le sens de lecture de la maquette, à
// l'inverse de `CeinturesRoue` qui travaille en angles mathématiques.

import type { DidactiqueItem, NiveauCecr } from '@/types/didactique-fle';
import styles from './RadarFle.module.css';

interface Props {
  competences: DidactiqueItem[]; // visibles, dans l'ordre des branches
  niveaux: NiveauCecr[]; // visibles, triés par rang — le premier est le centre
  positionnement: Record<string, string>; // compétence → niveau
  // Un libellé de branche trop long se coupe ; l'appelant peut fournir plus court
  libelleCourt?: (competence: DidactiqueItem) => string;
}

const CX = 260;
const CY = 230;
const R = 150;
const R_LIBELLE = R + 28;

const pt = (angleDeg: number, r: number): [number, number] => {
  const a = ((angleDeg - 90) * Math.PI) / 180; // 0° en haut, horaire
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};

export default function RadarFle({ competences, niveaux, positionnement, libelleCourt }: Props) {
  const n = competences.length;
  const crans = niveaux.length; // anneaux, centre compris
  if (n < 3 || crans < 2) return null;

  const pas = 360 / n;
  const rayonDe = (indexNiveau: number) => (R * indexNiveau) / (crans - 1);
  const indexNiveau = (competenceId: string) => {
    const id = positionnement[competenceId];
    const i = niveaux.findIndex((niv) => niv.id === id);
    return i < 0 ? 0 : i;
  };

  // Polygone d'un anneau (le centre, indice 0, n'a pas de tracé)
  const anneau = (k: number) =>
    competences.map((_, i) => pt(i * pas, rayonDe(k)).join(',')).join(' ');

  // L'aire du positionnement
  const aire = competences
    .map((c, i) => pt(i * pas, rayonDe(indexNiveau(c.id))).join(','))
    .join(' ');

  // Ancrage du libellé selon le côté de la branche
  const ancre = (angle: number): 'start' | 'middle' | 'end' => {
    const a = ((angle % 360) + 360) % 360;
    if (a < 10 || a > 350 || Math.abs(a - 180) < 10) return 'middle';
    return a < 180 ? 'start' : 'end';
  };

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox="0 0 520 470"
        role="img"
        aria-label={`Radar des niveaux : ${competences
          .map((c) => `${c.label} ${niveaux[indexNiveau(c.id)]?.label ?? ''}`)
          .join(', ')}`}
      >
        {/* Les anneaux, du plus grand au plus petit */}
        {niveaux.map((niv, k) =>
          k === 0 ? null : (
            <polygon
              key={niv.id}
              points={anneau(k)}
              className={k === crans - 1 ? styles.anneauExterieur : styles.anneau}
            />
          )
        )}

        {/* Les branches */}
        {competences.map((c, i) => {
          const [x, y] = pt(i * pas, R);
          return <line key={c.id} x1={CX} y1={CY} x2={x} y2={y} className={styles.branche} />;
        })}

        {/* L'aire du positionnement */}
        <polygon points={aire} className={styles.aire} />
        {competences.map((c, i) => {
          const [x, y] = pt(i * pas, rayonDe(indexNiveau(c.id)));
          return <circle key={c.id} cx={x} cy={y} r={4.5} className={styles.point} />;
        })}

        {/* Étiquettes des anneaux, sur l'axe vertical (le centre ne s'étiquette pas) */}
        {niveaux.map((niv, k) =>
          k === 0 ? null : (
            <text
              key={niv.id}
              x={CX + 6}
              y={CY - rayonDe(k) + 4}
              className={styles.etiquetteAnneau}
            >
              {niv.label}
            </text>
          )
        )}

        {/* Libellés des branches */}
        {competences.map((c, i) => {
          const angle = i * pas;
          const [x, y] = pt(angle, R_LIBELLE);
          const dy = angle < 10 || angle > 350 ? -2 : Math.abs(angle - 180) < 10 ? 12 : 4;
          return (
            <text
              key={c.id}
              x={x}
              y={y + dy}
              textAnchor={ancre(angle)}
              className={styles.libelle}
            >
              {libelleCourt ? libelleCourt(c) : c.label}
            </text>
          );
        })}
      </svg>
      <figcaption className={styles.legende}>
        {niveaux.map((niv, k) => (
          <span key={niv.id}>
            {k > 0 && <span className={styles.sep}> · </span>}
            <b>{k}</b> = {niv.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
