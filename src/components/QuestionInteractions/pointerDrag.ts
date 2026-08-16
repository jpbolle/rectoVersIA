'use client';

// ─── Socle du glisser au pointeur ───
//
// Les quatre types manipulés du questionnaire de lecture (appariement, remise
// en ordre, image annotée, ensembles) reposent sur DEUX moteurs seulement :
// RELIER et DÉPLACER. Ce fichier tient ce qu'ils ont en commun.
//
// Pourquoi Pointer Events et pas le glisser HTML5 : le glisser natif ne
// fonctionne PAS au doigt sur écran tactile, et chaque élève du Collège
// travaille sur un Chromebook. Choix arbitré avec JP le 2026-08-16.
//
// RATTRAPAGE AU TAP — un appui SANS mouvement (moins de 5 px) n'est pas un
// glisser raté, c'est un tap : il « arme » l'élément, et le tap suivant sur
// une cible le pose. Sur un pavé tactile d'entrée de gamme, un glisser qui
// échoue laisserait l'élève bloqué ; là, il a toujours une porte de sortie.
// C'est le même gestionnaire, ça ne coûte rien.

import type { PointerEvent as ReactPointerEvent } from 'react';

/** En deçà, l'appui est un tap et non un glisser. */
export const SEUIL_GLISSER = 5;

export interface DragHandlers {
  /** Le glisser commence vraiment (le seuil est franchi). */
  onStart?: (e: PointerEvent) => void;
  onMove?: (e: PointerEvent) => void;
  onDrop?: (e: PointerEvent) => void;
  /** Appui relâché sans avoir bougé. */
  onTap?: (e: PointerEvent) => void;
}

/**
 * Rend un élément saisissable au doigt, au pavé et à la souris.
 * `enabled` à false débranche tout (copie remise, lecture seule…).
 *
 * Renvoie des PROPS à étaler sur l'élément, pas un `ref` : les callbacks sont
 * alors ceux du rendu courant, sans ref-miroir à tenir à jour ni écouteur à
 * réabonner. C'est le même principe que le pattern `userRef` du projet, pris
 * par l'autre bout — au lieu de figer une valeur instable, on ne la fige pas
 * du tout.
 */
export function dragProps(handlers: DragHandlers, enabled = true) {
  if (!enabled) return {};

  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.button > 0) return;
      e.preventDefault();
      const el = e.currentTarget;
      const depart = { x: e.clientX, y: e.clientY };
      let bouge = false;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Safari refuse parfois la capture : le glisser marche quand même,
        // il perd seulement le suivi hors de l'élément.
      }

      const move = (ev: PointerEvent) => {
        if (!bouge && Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) > SEUIL_GLISSER) {
          bouge = true;
          handlers.onStart?.(ev);
        }
        if (bouge) handlers.onMove?.(ev);
      };
      const up = (ev: PointerEvent) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if (bouge) handlers.onDrop?.(ev);
        else handlers.onTap?.(ev);
      };

      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    },
  };
}

/**
 * Que vise le doigt ? Le fantôme qui suit le pointeur porte
 * `pointer-events: none`, il ne se met donc jamais en travers.
 */
export function cibleSous(
  e: PointerEvent,
  selecteur: string,
  racine?: HTMLElement | null
): HTMLElement | null {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return null;
  const cible = (el as HTMLElement).closest<HTMLElement>(selecteur);
  if (!cible) return null;
  if (racine && !racine.contains(cible)) return null;
  return cible;
}

/**
 * Le fantôme : une copie de l'élément saisi, en position fixe sous le doigt.
 * On clone plutôt qu'on ne déplace l'original, pour que le flux de la page ne
 * bouge pas pendant le geste — c'est ce qui rendait le glisser impraticable
 * dans la première maquette.
 */
export interface Fantome {
  /** Taille de l'original — sert à dimensionner le trou laissé derrière lui. */
  taille: { largeur: number; hauteur: number };
  suivre: (e: PointerEvent) => void;
  detruire: () => void;
}

export function creerFantome(source: HTMLElement, e: PointerEvent): Fantome {
  const r = source.getBoundingClientRect();
  // Le doigt doit rester exactement là où il a pris l'élément, sinon le jeton
  // saute au premier pixel de mouvement.
  const dx = e.clientX - r.left;
  const dy = e.clientY - r.top;

  const noeud = source.cloneNode(true) as HTMLElement;
  noeud.classList.add('drag-ghost');
  noeud.style.position = 'fixed';
  noeud.style.zIndex = '2000';
  noeud.style.pointerEvents = 'none';
  noeud.style.margin = '0';
  noeud.style.width = `${r.width}px`;
  noeud.style.left = `${r.left}px`;
  noeud.style.top = `${r.top}px`;
  document.body.appendChild(noeud);

  return {
    taille: { largeur: r.width, hauteur: r.height },
    suivre(ev: PointerEvent) {
      noeud.style.left = `${ev.clientX - dx}px`;
      noeud.style.top = `${ev.clientY - dy}px`;
    },
    detruire() {
      noeud.remove();
    },
  };
}
