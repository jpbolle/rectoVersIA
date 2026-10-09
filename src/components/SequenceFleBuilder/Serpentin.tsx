'use client';

// LE SERPENTIN — le mécanisme partagé des lignes du temps (séquence FLE,
// portfolio d'apprentissage) : des encadrés posés sur une ligne qui, arrivée
// au bord droit, tourne et revient vers la gauche, rangée après rangée, avec
// un « + » entre chaque encadré. Le nombre d'encadrés par rangée se MESURE
// (largeur du conteneur) ; la rangée impaire s'affiche en `row-reverse` ; un
// trait vertical relie la fin d'une rangée au début de la suivante.
//
// Il ne sait rien du contenu des encadrés : chaque constructeur rend les
// siens (`rendreItem`). Extrait de `SequenceFleBuilder` le 2026-10-09 pour le
// portfolio — même mécanisme, singularités à part (règle du projet).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './SequenceFleBuilder.module.css';

// Géométrie de la ligne (doit suivre le CSS) : encadré 200, « + » 34, écarts 10
const LARGEUR_ENCADRE = 200;
const LARGEUR_PLUS = 34;
const ECART = 10;

interface Props<T> {
  items: T[];
  cle: (item: T) => string;
  rendreItem: (item: T, index: number) => ReactNode;
  // Absent = lecture seule : pas de « + »
  onPlus?: (index: number) => void;
  // Texte sous le début de ligne quand il n'y a encore rien
  aideDepart: string;
  aideVide?: string;
}

export default function Serpentin<T>({ items, cle, rendreItem, onPlus, aideDepart, aideVide = 'Aucune étape.' }: Props<T>) {
  const ligneRef = useRef<HTMLDivElement>(null);
  const [parRangee, setParRangee] = useState(3);
  useEffect(() => {
    const el = ligneRef.current;
    if (!el) return;
    const mesurer = () => {
      const largeur = el.clientWidth - 12;
      setParRangee(Math.max(1, Math.floor((largeur - LARGEUR_PLUS) / (LARGEUR_ENCADRE + LARGEUR_PLUS + 2 * ECART))));
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  type Element = { kind: 'plus'; index: number } | { kind: 'item'; item: T; index: number };
  const suite: Element[] = [{ kind: 'plus', index: 0 }];
  items.forEach((item, i) => {
    suite.push({ kind: 'item', item, index: i });
    suite.push({ kind: 'plus', index: i + 1 });
  });
  const rangees: Element[][] = [];
  let curseur = 0;
  let premiere = true;
  while (curseur < suite.length) {
    const taille = premiere ? 2 * parRangee + 1 : 2 * parRangee;
    rangees.push(suite.slice(curseur, curseur + taille));
    curseur += taille;
    premiere = false;
  }

  const rendrePlus = (index: number) =>
    onPlus ? (
      <button
        key={`p${index}`}
        type="button"
        className={styles.plus}
        onClick={() => onPlus(index)}
        title="Ajouter une étape ici"
        aria-label="Ajouter une étape ici"
      >
        +
      </button>
    ) : (
      <span key={`p${index}`} className={styles.plusVide} />
    );

  return (
    <div className={styles.ligne} ref={ligneRef}>
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
              el.kind === 'plus' ? rendrePlus(el.index) : <span key={cle(el.item)} style={{ display: 'contents' }}>{rendreItem(el.item, el.index)}</span>
            )}
          </div>
        ))
      )}
    </div>
  );
}
