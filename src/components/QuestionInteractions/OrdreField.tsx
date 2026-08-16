'use client';

// ═══ MOTEUR DÉPLACER — remise en ordre ═══
//
// LE POINT QUI FAIT TOUT : pendant le glisser, le jeton saisi n'est PAS dans
// la liste. Il est remplacé par un TROU de même taille, et c'est le trou qui
// se déplace ; le doigt ne tient qu'un fantôme posé sur `document.body`.
//
// La première maquette réinsérait le vrai jeton à chaque mouvement : il se
// replaçait sous le pointeur, décalait ses voisins, et se comparait à
// lui-même dans le calcul du point d'insertion. Le geste était impraticable —
// c'est la remarque de JP du 2026-08-16, et c'était bien le code, pas la
// maquette.
//
// Le mélange initial vient du SERVEUR (`preparerPresentation`), avec une
// graine stable : deux ouvertures donnent le même désordre, donc l'élève qui
// revient sur sa copie retrouve son travail en place.

import { useRef, useState } from 'react';
import type { LectureAnswer, LectureQuestion } from '@/types/lecture';
import { dragProps, creerFantome, type DragHandlers, type Fantome } from './pointerDrag';
import JetonContenu from './Jeton';
import styles from './QuestionInteractions.module.css';

interface Props {
  question: LectureQuestion;
  answer: LectureAnswer;
  onChange: (partial: Partial<LectureAnswer>) => void;
  disabled?: boolean;
  showCorrection?: boolean;
}

function Jeton({
  id,
  children,
  className,
  handlers,
  enabled,
}: {
  id: string;
  children: React.ReactNode;
  className: string;
  handlers: DragHandlers;
  enabled: boolean;
}) {
  return (
    <div {...dragProps(handlers, enabled)} data-jeton data-id={id} className={className}>
      {children}
    </div>
  );
}

export default function OrdreField({
  question,
  answer,
  onChange,
  disabled,
  showCorrection,
}: Props) {
  const items = question.ordreItems ?? [];
  // Les images se rangent en bande horizontale, les textes en file verticale :
  // huit phrases côte à côte seraient illisibles sur un Chromebook.
  const vertical = items.some((j) => j.kind === 'texte');

  const zoneRef = useRef<HTMLDivElement | null>(null);
  const fantomeRef = useRef<Fantome | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [provisoire, setProvisoire] = useState<string[] | null>(null);
  const [arme, setArme] = useState<string | null>(null);
  // Taille du trou — mesurée une fois, à la saisie. En état et non en ref :
  // c'est une valeur d'affichage, elle doit déclencher le rendu du trou.
  const [taille, setTaille] = useState<{ largeur: number; hauteur: number } | null>(null);

  const aRepondu = (answer.ordre?.length ?? 0) > 0;
  const ordre = provisoire ?? answer.ordre ?? items.map((j) => j.id);
  const parId = new Map(items.map((j) => [j.id, j]));
  // Le corrigé n'arrive qu'avec la correction ; sans réponse de l'élève, on
  // n'affiche aucun verdict — sinon une question jamais touchée s'afficherait
  // toute verte alors qu'elle vaut zéro.
  const bonOrdre = showCorrection && aRepondu ? items.map((j) => j.id) : null;

  /**
   * Où le trou doit-il aller ? On compare le pointeur aux milieux des seuls
   * VOISINS : le jeton saisi n'est plus dans le flux (c'est le trou qui tient
   * sa place, et le trou ne porte pas `data-jeton`), il ne peut donc pas se
   * comparer à lui-même. C'est exactement ce qui rendait le geste impraticable
   * dans la première maquette.
   *
   * Pas de `useCallback` ici ni sur `deplacerVers` : ces fonctions ne servent
   * que dans des gestionnaires d'événement, jamais comme dépendance d'effet.
   * Les mémoïser empêchait en plus le compilateur React d'optimiser le
   * composant, faute de pouvoir garantir que `ordre` ne change pas.
   */
  const indexCible = (e: PointerEvent): number => {
    const zone = zoneRef.current;
    if (!zone) return 0;
    const voisins = [...zone.querySelectorAll<HTMLElement>('[data-jeton]')];
    const idx = voisins.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return vertical ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
    });
    return idx === -1 ? voisins.length : idx;
  };

  const deplacerVers = (id: string, index: number) => {
    const sans = ordre.filter((x) => x !== id);
    setProvisoire([...sans.slice(0, index), id, ...sans.slice(index)]);
  };

  const handlersDe = (id: string): DragHandlers => ({
    onStart(e) {
      setArme(null);
      const source = (e.target as HTMLElement).closest<HTMLElement>('[data-jeton]');
      if (source) {
        const f = creerFantome(source, e);
        fantomeRef.current = f;
        setTaille(f.taille);
      }
      setEnCours(id);
      setProvisoire(ordre);
    },
    onMove(e) {
      fantomeRef.current?.suivre(e);
      deplacerVers(id, indexCible(e));
    },
    onDrop() {
      fantomeRef.current?.detruire();
      fantomeRef.current = null;
      setEnCours(null);
      const fige = provisoire ?? ordre;
      setProvisoire(null);
      if (!disabled) onChange({ ordre: fige });
    },
    onTap() {
      setArme((a) => (a === id ? null : id));
    },
  });

  // Rattrapage au tap : le jeton armé va se poser là où on tape ensuite
  const poserAuTap = (e: React.MouseEvent) => {
    if (!arme || disabled) return;
    const zone = zoneRef.current;
    if (!zone) return;
    const voisins = [...zone.querySelectorAll<HTMLElement>('[data-jeton]')].filter(
      (el) => el.dataset.id !== arme
    );
    const idx = voisins.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return vertical ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
    });
    const sans = ordre.filter((x) => x !== arme);
    const index = idx === -1 ? sans.length : idx;
    onChange({ ordre: [...sans.slice(0, index), arme, ...sans.slice(index)] });
    setArme(null);
  };

  return (
    <div>
      <p className={styles.hint}>
        Fais glisser un bloc à sa place — ou tape-le, puis tape l&apos;endroit où le poser.
      </p>

      <div
        ref={zoneRef}
        className={`${styles.orderStrip} ${vertical ? styles.vertical : ''}`}
        onClick={poserAuTap}
      >
        {ordre.map((id, rang) => {
          const jeton = parId.get(id);
          if (!jeton) return null;

          // Le trou : le jeton saisi sort du flux, sa place reste réservée
          if (enCours === id) {
            return (
              <div
                key={id}
                className={styles.placeholder}
                style={{
                  width: taille ? `${taille.largeur}px` : undefined,
                  height: taille ? `${taille.hauteur}px` : undefined,
                }}
              />
            );
          }

          const juste = bonOrdre ? bonOrdre[rang] === id : null;
          return (
            <Jeton
              key={id}
              id={id}
              enabled={!disabled}
              handlers={handlersDe(id)}
              className={[
                styles.token,
                arme === id ? styles.armed : '',
                juste === true ? styles.ok : '',
                juste === false ? styles.ko : '',
                disabled ? styles.fige : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {!disabled && <span className={styles.grip}>⣿</span>}
              <span className={styles.rank}>{rang + 1}</span>
              <JetonContenu jeton={jeton} />
            </Jeton>
          );
        })}
      </div>

      {bonOrdre && (
        <p className={styles.hint} style={{ marginTop: 8 }}>
          Ordre attendu&nbsp;:{' '}
          {items.map((j, i) => (
            <span key={j.id}>
              {i > 0 && ' · '}
              {j.texte || `Élément ${i + 1}`}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
