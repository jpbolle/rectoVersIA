'use client';

// La roue des ceintures : une branche par UAA, une couronne par ceinture.
//
// Portée telle quelle de la maquette validée le 2026-08-17
// (harnais/plans/maquette-accueil-ceintures.html). Trois règles qui expliquent
// tous les choix de tracé :
//
//  1. Chaque branche porte SA DERNIÈRE CEINTURE OBTENUE, grande et centrée sur
//     la couronne de sa couleur — qu'elle traverse. Les six karatékas empilés
//     racontaient un parcours que les couronnes disent déjà, et à 44 px on ne
//     distinguait plus la couleur du tissu.
//  2. La BLANCHE est acquise d'emblée : c'est le plancher, jamais un vide.
//  3. Le BOUCLIER de l'UAA est le motif le PLUS EXTÉRIEUR de la branche —
//     au-delà de l'étiquette et de son libellé. Il attend là, en gris et en
//     transparence, et s'allume à la ceinture noire. Placé entre la roue et
//     l'étiquette, il s'intercalait dans la lecture au lieu de la terminer.
//
// ⚠ La géométrie travaille en angles mathématiques (y vers le haut). Un angle
// qui croît tourne donc dans le sens ANTIHORAIRE à l'écran, et le drapeau de
// balayage des arcs SVG vaut 0 — avec 1 (le sens horaire) on trace l'arc
// complémentaire, c'est-à-dire tout le reste du cercle.

import { CEINTURES, badgeUaa, estEnReussite, rangDe } from '@/types/ceintures';
import type { UaaCertifiee } from '@/types/profil';
import styles from './CeinturesRoue.module.css';

interface Props {
  uaa: UaaCertifiee[];
  // Libellé montré au survol de l'étiquette. Absent = le libellé complet de
  // l'UAA, tel qu'il est tenu dans la configuration didactique.
  libelleCourt?: (uaa: string) => string;
}

// 7 branches réparties sur 240°, UAA 0 droit en haut : les UAA 3 et 4
// descendent sous l'horizontale, comme sur le tableau de bord de JP.
const OUVERTURE = 240;
const CX = 620;
const CY = 560;
const R_INT = 110;
// La couronne extérieure est ramenée à 300 pour dégager la place des trois
// niveaux qui la suivent : étiquette, libellé, puis bouclier.
const R_EXT = 300;
// Distances radiales des trois niveaux, du plus proche au plus lointain
const R_ETIQUETTE = R_EXT + 38;
const R_BADGE = R_EXT + 122;

const pt = (angle: number, r: number): [number, number] => [
  CX + r * Math.cos((angle * Math.PI) / 180),
  CY - r * Math.sin((angle * Math.PI) / 180),
];

function arc(a1: number, a2: number, r: number): string {
  const [x1, y1] = pt(a1, r);
  const [x2, y2] = pt(a2, r);
  const grand = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${grand} 0 ${x2} ${y2}`;
}

export default function CeinturesRoue({ uaa, libelleCourt }: Props) {
  if (uaa.length === 0) return null;

  const epaisseur = (R_EXT - R_INT) / CEINTURES.length;
  const pas = uaa.length > 1 ? OUVERTURE / (uaa.length - 1) : 0;
  // UAA 0 à 90°, puis on s'écarte symétriquement de part et d'autre
  const moitie = Math.ceil(uaa.length / 2);
  const angleDe = (i: number) => 90 - (i < moitie ? i : i - uaa.length) * pas;

  const aDebut = angleDe(moitie - 1) - pas / 2;
  const aFin = angleDe(moitie) + pas / 2;
  const acquises = uaa.filter((u) => u.badge).length;

  return (
    <svg
      className={styles.svg}
      viewBox="0 0 1240 900"
      role="img"
      aria-label={`Progression par UAA : ${acquises} UAA sur ${uaa.length} acquises`}
    >
      {/* Les six couronnes de ceinture, du centre vers l'extérieur */}
      {CEINTURES.map((c, i) => {
        const r = R_INT + epaisseur * (i + 0.5);
        return (
          <g key={c.id}>
            <path
              d={arc(aDebut, aFin, r)}
              fill="none"
              stroke={c.couleur}
              strokeWidth={epaisseur - 5}
              opacity={0.85}
            />
            {c.contour && (
              <path
                d={arc(aDebut, aFin, r)}
                fill="none"
                stroke={c.contour}
                strokeWidth={1}
                opacity={0.6}
              />
            )}
          </g>
        );
      })}

      {/* Les séparateurs : chaque UAA a son couloir */}
      {uaa.map((u, i) =>
        [angleDe(i) - pas / 2, angleDe(i) + pas / 2].map((a, k) => {
          const [x1, y1] = pt(a, R_INT);
          const [x2, y2] = pt(a, R_EXT);
          return (
            <line
              key={`${u.uaa}-sep-${k}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#ffffff"
              strokeWidth={2.5}
              opacity={0.9}
            />
          );
        })
      )}

      {uaa.map((u, i) => {
        const a = angleDe(i);
        const r = Math.max(1, rangDe(u.ceinture));
        const ceinture = CEINTURES[r - 1];
        const [kx, ky] = pt(a, R_INT + epaisseur * (r - 0.5));
        const [lx, ly] = pt(a, R_ETIQUETTE);
        const [bx, by] = pt(a, R_BADGE);
        const acquise = estEnReussite(u.ceinture);
        const intitule = libelleCourt ? libelleCourt(u.uaa) : u.label;
        const pct = u.percent !== null ? ` · ${u.percent} %` : '';

        return (
          <g key={u.uaa}>
            {/* La dernière ceinture obtenue, traversant sa couronne */}
            <image
              href={ceinture.image}
              x={kx - 41.5}
              y={ky - 41.5}
              width={83}
              height={83}
              preserveAspectRatio="xMidYMid meet"
              className={styles.karateka}
            >
              <title>{`UAA ${u.uaa} — ceinture ${ceinture.label.toLowerCase()}${pct}`}</title>
            </image>

            {/* L'intitulé de l'UAA passe AU SURVOL de l'étiquette.
                Sept intitulés déployés autour de la roue faisaient sept pavés
                de texte qui la ceinturaient : on lisait des phrases avant de
                voir la progression, alors que c'est elle le sujet. L'étiquette
                reste le repère, l'intitulé se demande. */}
            <g className={styles.etiquette}>
              <title>{`UAA ${u.uaa} — ${intitule}${pct}`}</title>
              <rect
                x={lx - 33}
                y={ly - 11}
                width={66}
                height={22}
                rx={6}
                fill={acquise ? 'var(--c-primary)' : 'var(--c-text-muted)'}
              />
              <text x={lx} y={ly + 4} textAnchor="middle" className={styles.chip}>
                UAA {u.uaa}
              </text>
            </g>

            {/* Le bouclier ferme la branche : c'est le bout du parcours, il est
                donc le motif le plus extérieur — après l'étiquette et son
                libellé, jamais entre eux et la roue. */}
            <image
              href={badgeUaa(u.uaa)}
              x={bx - 44}
              y={by - 44}
              width={88}
              height={88}
              className={acquise ? styles.badgeAcquis : styles.badgeAttente}
            >
              <title>
                {acquise
                  ? `UAA ${u.uaa} acquise — ceinture noire atteinte`
                  : `UAA ${u.uaa} — le badge s’obtient à la ceinture noire`}
              </title>
            </image>
          </g>
        );
      })}

      {/* Le disque central : ce que la roue dit en un chiffre */}
      <circle cx={CX} cy={CY} r={R_INT - 6} fill="var(--c-accent)" />
      <text x={CX} y={CY - 14} textAnchor="middle" className={styles.centreChiffre}>
        {acquises}/{uaa.length}
      </text>
      <text x={CX} y={CY + 12} textAnchor="middle" className={styles.centreTexte}>
        UAA acquises
      </text>
      <text x={CX} y={CY + 34} textAnchor="middle" className={styles.centreNote}>
        ceinture noire
      </text>
    </svg>
  );
}

// La légende — hors du SVG, pour rester du texte sélectionnable et accessible
export function CeinturesLegende() {
  return (
    <div className={styles.legende}>
      <span className={styles.legFleche}>Départ</span>
      {CEINTURES.map((c) => (
        <span key={c.id} className={styles.legItem}>
          <span
            className={styles.legDot}
            style={{ background: c.couleur, borderColor: c.contour ?? 'rgba(0,0,0,.12)' }}
          />
          {c.label.toLowerCase()}
        </span>
      ))}
      <span className={styles.legFleche}>Dépassement</span>
    </div>
  );
}
