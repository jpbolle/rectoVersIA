'use client';

// ═══ SOULIGNER DU TEXTE — par catégories ═══
//
// « Le sujet en fluo rouge, les verbes en fluo vert » (JP, 2026-08-16).
// Le prof définit des catégories (un libellé + une couleur de la palette) ;
// l'élève choisit une catégorie, puis clique les mots.
//
// SANS CATÉGORIE, ce composant n'est pas utilisé : le fluorage garde alors
// son comportement historique (une seule couleur, `FluoExtrait`). C'est ce qui
// laisse intacts tous les questionnaires déjà écrits.
//
// Un mot n'appartient qu'à UNE catégorie à la fois : cliquer un mot déjà
// marqué d'une autre couleur le change de catégorie plutôt que de le marquer
// deux fois. Un mot bicolore ne voudrait rien dire dans la correction.
//
// GESTE : on appuie sur un mot et on glisse jusqu'au dernier — tout le
// passage prend la couleur active. Sans mouvement, le geste se réduit au mot
// cliqué. Même règle que `FluoExtrait` (soulignage sans catégories) : on ne
// souligne pas une phrase mot à mot, ni côté prof ni côté élève.

import { useState, useRef } from 'react';
import type { LectureFluoCategorie } from '@/types/lecture';
import { fluoHex } from '@/types/lecture';
import { segmenter } from '@/lib/fluo-segments';
import styles from './QuestionInteractions.module.css';

const GOMME = '__gomme__';

interface Props {
  texte: string;
  categories: LectureFluoCategorie[];
  /** idCategorie -> indices de mots */
  valeurs: Record<string, number[]>;
  onChange: (valeurs: Record<string, number[]>) => void;
  disabled?: boolean;
  /** Le marquage attendu, quand la correction est rendue. */
  attendu?: Record<string, number[]> | null;
}

export default function FluoCategoriesField({
  texte,
  categories,
  valeurs,
  onChange,
  disabled,
  attendu,
}: Props) {
  const [active, setActive] = useState<string>(categories[0]?.id ?? '');
  const mots = texte.split(/\s+/).filter(Boolean);

  // Index inversé : quel mot porte quelle catégorie ? Recalculé à chaque
  // rendu, mais sur une phrase — pas de quoi mémoïser.
  const categorieDe = (source: Record<string, number[]>) => {
    const map = new Map<number, string>();
    Object.entries(source).forEach(([cat, indices]) =>
      indices.forEach((i) => map.set(i, cat))
    );
    return map;
  };
  const marque = categorieDe(valeurs);
  const cible = attendu ? categorieDe(attendu) : null;

  const zoneRef = useRef<HTMLParagraphElement>(null);

  // Geste en cours : le mot de départ, ce qu'il fait (colorer ou effacer) et
  // l'état du marquage AVANT le geste — c'est cette photo de départ qui
  // permet de revenir en arrière en glissant dans l'autre sens.
  const geste = useRef<{ ancre: number; efface: boolean; base: Record<string, number[]> } | null>(
    null
  );

  const appliquer = (jusqua: number) => {
    const g = geste.current;
    if (!g) return;
    const debut = Math.min(g.ancre, jusqua);
    const fin = Math.max(g.ancre, jusqua);
    const dansLeGeste = (x: number) => x >= debut && x <= fin;

    const suivant: Record<string, number[]> = {};
    Object.entries(g.base).forEach(([cat, indices]) => {
      suivant[cat] = indices.filter((x) => !dansLeGeste(x));
    });
    if (!g.efface) {
      const ajout = [];
      for (let i = debut; i <= fin; i++) ajout.push(i);
      suivant[active] = [...(suivant[active] ?? []), ...ajout].sort((a, b) => a - b);
    }
    Object.keys(suivant).forEach((k) => {
      if (suivant[k].length === 0) delete suivant[k];
    });
    onChange(suivant);
  };

  // Pendant un glissé, le pointeur est CAPTURÉ par la zone : les mots
  // survolés ne reçoivent plus d'événement. On retrouve donc le mot sous le
  // curseur (ou sous le doigt) par sa position à l'écran.
  const motSous = (x: number, y: number): number | null => {
    const cible = document.elementFromPoint(x, y) as HTMLElement | null;
    const attr = cible?.closest('[data-mot]')?.getAttribute('data-mot');
    if (attr === null || attr === undefined) return null;
    const i = Number(attr);
    return Number.isNaN(i) ? null : i;
  };

  const debutGeste = (e: React.PointerEvent, i: number) => {
    if (disabled || !active) return;
    // Empêche la sélection de texte du navigateur de se battre avec la nôtre
    e.preventDefault();
    geste.current = {
      ancre: i,
      // Repasser dans la même couleur efface : c'est la gomme naturelle,
      // celle qu'on essaie d'instinct avant de chercher un bouton.
      efface: active === GOMME || marque.get(i) === active,
      base: valeurs,
    };
    zoneRef.current?.setPointerCapture(e.pointerId);
    appliquer(i);
  };

  const suiviGeste = (e: React.PointerEvent) => {
    if (!geste.current) return;
    const i = motSous(e.clientX, e.clientY);
    if (i !== null) appliquer(i);
  };

  // pointercancel compris : au doigt, un défilement vertical annule le geste
  // et le marquage reste sur le seul mot touché.
  const finGeste = (e: React.PointerEvent) => {
    if (!geste.current) return;
    geste.current = null;
    if (zoneRef.current?.hasPointerCapture(e.pointerId)) {
      zoneRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const couleurDe = (id: string | undefined) => {
    if (!id) return undefined;
    const cat = categories.find((c) => c.id === id);
    return cat ? fluoHex(cat.couleur) : undefined;
  };

  return (
    <div>
      {!disabled && (
        <div className={styles.fluoLegend}>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              className={`${styles.fluoCat} ${active === c.id ? styles.active : ''}`}
            >
              <span className={styles.swatch} style={{ background: fluoHex(c.couleur) }} />
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActive(GOMME)}
            className={`${styles.fluoCat} ${active === GOMME ? styles.active : ''}`}
          >
            <span className={styles.swatch} style={{ background: 'var(--c-bg-card)' }} />
            Gomme
          </button>
        </div>
      )}

      {disabled && (
        <div className={styles.fluoLegend}>
          {categories.map((c) => (
            <span key={c.id} className={styles.fluoCat}>
              <span className={styles.swatch} style={{ background: fluoHex(c.couleur) }} />
              {c.label}
            </span>
          ))}
        </div>
      )}

      <p
        ref={zoneRef}
        className={`${styles.fluoText} ${disabled ? '' : styles.fluoTextActive}`}
        onPointerMove={suiviGeste}
        onPointerUp={finGeste}
        onPointerCancel={finGeste}
      >
        {/* Le fond est porté par le SEGMENT — la suite de mots d'une même
            catégorie, espaces compris. Un fond par mot sautait par-dessus les
            blancs et donnait un passage haché plutôt qu'un groupe souligné.
            Les mots restent des éléments à part entière à l'intérieur : c'est
            `data-mot` qui permet de retrouver celui qui est sous le curseur
            pendant un glissé. */}
        {segmenter(mots.length, (i) => {
          const catEleve = marque.get(i);
          const catAttendue = cible?.get(i);
          // Correction : le mot que l'élève a manqué se souligne de la
          // couleur due, sans se remplir — on distingue « pas marqué » de
          // « mal marqué » d'un coup d'œil.
          const manque = !!cible && !!catAttendue && catEleve !== catAttendue;
          return `${catEleve ?? ''}|${manque ? catAttendue : ''}`;
        }).map((seg, s, tous) => {
          const [catEleve, catManquee] = seg.nature.split('|');
          const contenu = seg.mots.map((i, k) => (
            <span key={i}>
              <span
                className={`${styles.w} ${disabled ? styles.fige : ''}`}
                data-mot={i}
                onPointerDown={(e) => debutGeste(e, i)}
              >
                {mots[i]}
              </span>
              {/* L'espace INTERNE au segment est coloré avec lui */}
              {k < seg.mots.length - 1 ? ' ' : ''}
            </span>
          ));
          const espace = s < tous.length - 1 ? ' ' : '';
          if (!catEleve && !catManquee) {
            return (
              <span key={s}>
                {contenu}
                {espace}
              </span>
            );
          }
          return (
            <span key={s}>
              <span
                className={`${styles.run} ${catManquee ? styles.manque : ''}`}
                style={{
                  background: couleurDe(catEleve || undefined),
                  // Le soulignement porte la couleur attendue ; le texte
                  // garde la sienne — un mot écrit en jaune pâle ne se lit pas
                  borderBottom: catManquee ? `3px solid ${couleurDe(catManquee)}` : undefined,
                }}
              >
                {contenu}
              </span>
              {espace}
            </span>
          );
        })}
      </p>
    </div>
  );
}
