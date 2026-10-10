'use client';

// LE SERPENTIN — le mécanisme partagé des lignes du temps (séquence FLE,
// portfolio d'apprentissage) : des encadrés posés sur une ligne qui, arrivée
// au bord droit, tourne et revient vers la gauche, rangée après rangée, avec
// un « + » entre chaque encadré. Le nombre d'encadrés par rangée se MESURE
// (largeur du conteneur) ; la rangée impaire s'affiche en `row-reverse` ; un
// VIRAGE arrondi relie la fin d'une rangée au début de la suivante.
//
// Géométrie du virage (2026-10-10, « que cela forme un serpentin ») : toutes
// les rangées ont la même structure — un emplacement de « + » à chaque bout
// (la rangée suivante commence par un emplacement vide, pile sous le dernier
// « + » de la précédente) — et la même hauteur (grille à rangées égales). Le
// virage tombe donc exactement d'un centre à l'autre.
//
// Glisser-déposer (facultatif, `onDeplacer`) : on attrape un encadré, on le
// lâche sur un « + » (il s'insère là) ou sur un autre encadré (il prend sa
// place). HTML5 natif, sans bibliothèque.
//
// Il ne sait rien du contenu des encadrés : chaque constructeur rend les
// siens (`rendreItem`). Extrait de `SequenceFleBuilder` le 2026-10-09 pour le
// portfolio — même mécanisme, singularités à part (règle du projet).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import styles from './SequenceFleBuilder.module.css';

// Géométrie de la ligne (doit suivre le CSS) : encadré 200, « + » 34, écarts
// 10, marges de la ligne (place pour les virages) 2 × 18 + rangée 2 × 6
const LARGEUR_ENCADRE = 200;
const LARGEUR_PLUS = 34;
const ECART = 10;
const MARGES = 2 * 18 + 2 * 6;

interface Props<T> {
  items: T[];
  cle: (item: T) => string;
  rendreItem: (item: T, index: number) => ReactNode;
  // Absent = lecture seule : pas de « + »
  onPlus?: (index: number) => void;
  // Glisser-déposer : l'élément `de` va à la position `vers` (index final)
  onDeplacer?: (de: number, vers: number) => void;
  // Ce vers quoi la ligne mène, posé après le dernier « + » (la tâche finale
  // d'un portfolio). Même largeur qu'un encadré : la géométrie ne change pas.
  fin?: ReactNode;
  // Texte sous le début de ligne quand il n'y a encore rien
  aideDepart: string;
  aideVide?: string;
}

export default function Serpentin<T>({
  items,
  cle,
  rendreItem,
  onPlus,
  onDeplacer,
  fin,
  aideDepart,
  aideVide = 'Aucune étape.',
}: Props<T>) {
  // On mesure le CADRE (pleine largeur), pas la ligne, qui prend la largeur
  // de ses rangées
  const cadreRef = useRef<HTMLDivElement>(null);
  const [parRangee, setParRangee] = useState(3);
  // L'écart entre un encadré et un « + », ÉTIRÉ pour que la rangée occupe toute
  // la largeur (JP, 2026-10-11). Le même pour toutes les rangées, dernière
  // comprise : les colonnes restent alignées et les virages tombent juste.
  const [ecart, setEcart] = useState(ECART);
  // Glisser-déposer : l'encadré attrapé, et la cible survolée
  const [attrape, setAttrape] = useState<number | null>(null);
  const [cible, setCible] = useState<string | null>(null);
  useEffect(() => {
    const el = cadreRef.current;
    if (!el) return;
    const mesurer = () => {
      const largeur = el.clientWidth - MARGES;
      const n = Math.max(1, Math.floor((largeur - LARGEUR_PLUS) / (LARGEUR_ENCADRE + LARGEUR_PLUS + 2 * ECART)));
      setParRangee(n);
      // Une rangée pleine : n encadrés, n + 1 « + », 2n écarts
      const reste = largeur - n * LARGEUR_ENCADRE - (n + 1) * LARGEUR_PLUS;
      setEcart(Math.max(ECART, Math.floor(reste / (2 * n))));
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  type Element =
    | { kind: 'plus'; index: number }
    | { kind: 'item'; item: T; index: number }
    | { kind: 'vide'; rangee: number }
    | { kind: 'fin' };
  const suite: Element[] = [{ kind: 'plus', index: 0 }];
  items.forEach((item, i) => {
    suite.push({ kind: 'item', item, index: i });
    suite.push({ kind: 'plus', index: i + 1 });
  });
  if (fin) suite.push({ kind: 'fin' });
  // Chaque rangée après la première commence par un emplacement vide, sous le
  // dernier « + » de la précédente : le virage tombe dessus
  const rangees: Element[][] = [];
  let curseur = 0;
  while (curseur < suite.length) {
    const taille = rangees.length === 0 ? 2 * parRangee + 1 : 2 * parRangee;
    const morceau = suite.slice(curseur, curseur + taille);
    rangees.push(rangees.length === 0 ? morceau : [{ kind: 'vide', rangee: rangees.length }, ...morceau]);
    curseur += taille;
  }

  const deposer = (vers: number) => {
    if (attrape !== null && onDeplacer && vers !== attrape) onDeplacer(attrape, vers);
    setAttrape(null);
    setCible(null);
  };
  // Les gestes communs des cibles de dépôt (un « + », un encadré)
  const zoneDeDepot = (id: string, vers: () => number) =>
    onDeplacer && attrape !== null
      ? {
          onDragOver: (ev: React.DragEvent) => {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = 'move';
            if (cible !== id) setCible(id);
          },
          onDragLeave: () => setCible((c) => (c === id ? null : c)),
          onDrop: (ev: React.DragEvent) => {
            ev.preventDefault();
            deposer(vers());
          },
        }
      : {};

  const rendrePlus = (index: number) =>
    onPlus ? (
      <button
        key={`p${index}`}
        type="button"
        className={`${styles.plus} ${cible === `p${index}` ? styles.plusCible : ''}`}
        onClick={() => onPlus(index)}
        title="Ajouter une étape ici"
        aria-label="Ajouter une étape ici"
        // Lâché sur un « + » : l'encadré s'insère à cet endroit
        {...zoneDeDepot(`p${index}`, () => (attrape !== null && attrape < index ? index - 1 : index))}
      >
        +
      </button>
    ) : (
      <span key={`p${index}`} className={styles.plusVide} />
    );

  const rendreEncadre = (item: T, index: number) =>
    onDeplacer ? (
      <div
        key={cle(item)}
        className={`${styles.glissable} ${attrape === index ? styles.glisse : ''} ${
          cible === `i${index}` && attrape !== index ? styles.glissableCible : ''
        }`}
        draggable
        onDragStart={(ev) => {
          ev.dataTransfer.effectAllowed = 'move';
          ev.dataTransfer.setData('text/plain', String(index));
          setAttrape(index);
        }}
        onDragEnd={() => {
          setAttrape(null);
          setCible(null);
        }}
        // Lâché sur un encadré : il prend sa place
        {...zoneDeDepot(`i${index}`, () => index)}
      >
        {rendreItem(item, index)}
      </div>
    ) : (
      <span key={cle(item)} style={{ display: 'contents' }}>
        {rendreItem(item, index)}
      </span>
    );

  return (
    <div className={styles.cadreLigne} ref={cadreRef}>
    <div className={styles.ligne} style={{ '--serp-ecart-x': `${ecart}px` } as CSSProperties}>
      {items.length === 0 ? (
        // Ligne vide : un grand « + » bien visible, et le début du serpentin
        // pour dire ce qui va se construire
        <div className={styles.depart}>
          {onPlus && (
            <button
              type="button"
              className={`${styles.plus} ${styles.plusDepart}`}
              onClick={() => onPlus(0)}
              title="Ajouter la première étape"
              aria-label="Ajouter la première étape"
            >
              +
            </button>
          )}
          <span className={styles.departTrait} aria-hidden="true" />
          <span className={styles.departVirage} aria-hidden="true" />
          <span className={styles.departRetour} aria-hidden="true" />
          <p className={styles.departAide}>{onPlus ? aideDepart : aideVide}</p>
        </div>
      ) : (
        rangees.map((rangee, r) => (
          <div
            key={r}
            className={`${styles.rangee} ${r % 2 === 1 ? styles.rangeeRetour : ''} ${
              r < rangees.length - 1 ? styles.rangeeAvecVirage : ''
            }`}
          >
            {rangee.map((el) =>
              el.kind === 'plus' ? (
                rendrePlus(el.index)
              ) : el.kind === 'vide' ? (
                <span key={`v${el.rangee}`} className={styles.plusVide} aria-hidden="true" />
              ) : el.kind === 'fin' ? (
                <span key="fin" style={{ display: 'contents' }}>
                  {fin}
                </span>
              ) : (
                rendreEncadre(el.item, el.index)
              )
            )}
          </div>
        ))
      )}
    </div>
    </div>
  );
}
