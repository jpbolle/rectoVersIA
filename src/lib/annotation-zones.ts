// ═══ Tracer une zone sur une image, au pointeur ═══
//
// PARTAGÉ par le constructeur (le prof pose ses zones) et par le champ de
// l'élève (jeu « marqueurs », où il pose ses marques avec les mêmes outils).
// Deux copies divergeraient au premier réglage — le seuil du clic, la taille
// par défaut, l'arrondi — et l'élève tracerait autrement que son professeur.
//
// Tout est en POURCENTAGE de l'image, comme `DrawShape` : indépendant de la
// résolution, donc du Chromebook sur lequel on regarde.
//
// Les écouteurs vont sur `window`, jamais sur l'image : le tracé doit
// continuer quand le doigt sort du cadre, et le lâcher être reçu quand même.

import type { AnnotationForme } from '@/types/lecture';

export const OUTILS_ZONE: { id: AnnotationForme; icone: string; libelle: string; aide: string }[] = [
  { id: 'point', icone: '●', libelle: 'Point', aide: 'Cliquez sur l’image pour poser un point.' },
  { id: 'rect', icone: '▭', libelle: 'Encadré', aide: 'Tracez un encadré en glissant sur l’image.' },
  { id: 'cercle', icone: '◯', libelle: 'Zone circulaire', aide: 'Tracez une zone en glissant sur l’image.' },
];

/** Un clic sans glisser avec l'outil encadré ou cercle pose une zone de cette taille (%). */
export const ZONE_DEFAUT = { w: 14, h: 10 };
/** En deçà (en %), le geste est un clic et non un tracé. */
export const SEUIL_TRACE = 1.5;

export interface Boite {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** La géométrie d'une zone posée : un point n'a ni largeur ni hauteur. */
export interface ZoneTracee {
  x: number;
  y: number;
  forme: AnnotationForme;
  w?: number;
  h?: number;
}

/** Ce qu'on lit d'un événement de pointeur — de quoi accepter un `React.PointerEvent`. */
interface GestePointeur {
  button: number;
  clientX: number;
  clientY: number;
  currentTarget: HTMLElement;
  preventDefault(): void;
}

/**
 * Démarre le tracé. `onBrouillon` sert à montrer la zone grandir sous la
 * souris ; `onFini` reçoit la zone posée, arrondie au dixième de pour cent.
 */
export function tracerZone(
  e: GestePointeur,
  outil: AnnotationForme,
  onBrouillon: (b: Boite | null) => void,
  onFini: (zone: ZoneTracee) => void
): void {
  if (e.button > 0) return;
  e.preventDefault();
  const r = e.currentTarget.getBoundingClientRect();
  const enPct = (ev: { clientX: number; clientY: number }) => ({
    x: Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100)),
    y: Math.max(0, Math.min(100, ((ev.clientY - r.top) / r.height) * 100)),
  });
  const arrondi = (v: number) => Math.round(v * 10) / 10;
  const depart = enPct(e);
  const boite = (ev: PointerEvent): Boite => {
    const p = enPct(ev);
    return {
      x: Math.min(depart.x, p.x),
      y: Math.min(depart.y, p.y),
      w: Math.abs(p.x - depart.x),
      h: Math.abs(p.y - depart.y),
    };
  };

  if (outil === 'point') {
    onFini({ x: arrondi(depart.x), y: arrondi(depart.y), forme: 'point' });
    return;
  }

  const move = (ev: PointerEvent) => onBrouillon(boite(ev));
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    onBrouillon(null);
    let b = boite(ev);
    // Un simple clic pose une zone de taille par défaut, centrée sur le clic
    if (b.w < SEUIL_TRACE && b.h < SEUIL_TRACE) {
      b = {
        x: Math.max(0, Math.min(100 - ZONE_DEFAUT.w, depart.x - ZONE_DEFAUT.w / 2)),
        y: Math.max(0, Math.min(100 - ZONE_DEFAUT.h, depart.y - ZONE_DEFAUT.h / 2)),
        ...ZONE_DEFAUT,
      };
    }
    onFini({
      forme: outil,
      x: arrondi(b.x),
      y: arrondi(b.y),
      w: Math.max(1, arrondi(Math.min(b.w, 100 - b.x))),
      h: Math.max(1, arrondi(Math.min(b.h, 100 - b.y))),
    });
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
