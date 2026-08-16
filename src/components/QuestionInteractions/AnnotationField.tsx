'use client';

// ═══ MOTEUR DÉPLACER — image à annoter ═══
//
// Disposition arrêtée avec JP le 2026-08-16 :
//   · la RÉSERVE d'étiquettes sous l'image (ou au-dessus, au choix du prof) ;
//   · des CASES DE DÉPÔT à gauche et à droite de l'image ;
//   · chaque case est reliée en permanence, par un trait, à son point sur
//     l'image. Ce trait est posé par le PROF : l'élève n'y touche jamais, il
//     ne fait que remplir la case.
//
// La numérotation ne figure QUE sur le point, jamais sur la case (demande de
// JP) : deux fois le même chiffre à 3 cm d'écart n'aide personne, le trait
// dit déjà quelle case va avec quel point.
//
// C'est le même moteur que les ensembles — une case est une boîte qui ne
// tient qu'une étiquette. D'où l'échange automatique quand on en dépose une
// seconde : elle ne se perd pas, elle repart d'où venait la nouvelle.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LectureAnswer, LectureJeton, LectureQuestion } from '@/types/lecture';
import { melangeStable } from '@/types/lecture';
import { dragProps, cibleSous, creerFantome, type DragHandlers, type Fantome } from './pointerDrag';
import styles from './QuestionInteractions.module.css';

interface Props {
  question: LectureQuestion;
  answer: LectureAnswer;
  onChange: (partial: Partial<LectureAnswer>) => void;
  disabled?: boolean;
  showCorrection?: boolean;
}

const RESERVE = '__reserve__';

function Etiquette({
  id,
  texte,
  className,
  handlers,
  enabled,
}: {
  id: string;
  texte: string;
  className: string;
  handlers: DragHandlers;
  enabled: boolean;
}) {
  return (
    <div {...dragProps(handlers, enabled)} data-jeton data-id={id} className={className}>
      {texte}
    </div>
  );
}

export default function AnnotationField({
  question,
  answer,
  onChange,
  disabled,
  showCorrection,
}: Props) {
  // Mémoïsés : ces `?? []` créent un objet neuf à chaque rendu, ce qui
  // relancerait la mesure des traits en boucle.
  const cibles = useMemo(() => question.annotations ?? [], [question.annotations]);
  const placements = useMemo(() => answer.annotations ?? {}, [answer.annotations]);

  // Les étiquettes viennent du serveur déjà mélangées (`preparerPresentation`).
  // Le repli local ne sert qu'à la prévisualisation du constructeur, où la
  // question n'est jamais passée par le serveur.
  const etiquettes: LectureJeton[] = useMemo(
    () =>
      question.annotationsEtiquettes ??
      melangeStable(
        cibles.map((c) => ({ id: c.id, kind: 'texte' as const, texte: c.label })),
        question.id
      ),
    [question.annotationsEtiquettes, question.id, cibles]
  );
  const libelle = new Map(etiquettes.map((e) => [e.id, e.texte ?? '']));

  const gauche = cibles.filter((c) => c.cote !== 'droite');
  const droite = cibles.filter((c) => c.cote === 'droite');
  const reserveEnHaut = question.annotationsReserve === 'haut';

  const racineRef = useRef<HTMLDivElement | null>(null);
  const fantomeRef = useRef<Fantome | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [arme, setArme] = useState<string | null>(null);
  const [traits, setTraits] = useState<
    { id: string; x1: number; y1: number; x2: number; y2: number }[]
  >([]);

  // Les traits se mesurent sur le DOM réel : la largeur de la colonne change
  // d'un écran à l'autre, et une coordonnée en dur se décalerait partout.
  const mesurer = useCallback(() => {
    const racine = racineRef.current;
    if (!racine) return;
    const z = racine.getBoundingClientRect();
    const suivant: typeof traits = [];
    racine.querySelectorAll<HTMLElement>('[data-case]').forEach((caseEl) => {
      const id = caseEl.dataset.case!;
      const point = racine.querySelector<HTMLElement>(`[data-point="${id}"]`);
      if (!point) return;
      const rc = caseEl.getBoundingClientRect();
      const rp = point.getBoundingClientRect();
      const aGauche = caseEl.dataset.cote !== 'droite';
      suivant.push({
        id,
        x1: (aGauche ? rc.right : rc.left) - z.left,
        y1: rc.top + rc.height / 2 - z.top,
        x2: rp.left + rp.width / 2 - z.left,
        y2: rp.top + rp.height / 2 - z.top,
      });
    });
    setTraits(suivant);
  }, []);

  // Mesure APRÈS la pose du DOM — le seul moyen de connaître la géométrie
  // réelle des cases, que React ne connaît pas. `useLayoutEffect` pour que
  // les traits soient tracés avant la peinture, sinon ils clignotent.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    mesurer();
  }, [mesurer, cibles.length, placements]);

  useEffect(() => {
    const racine = racineRef.current;
    if (!racine) return;
    const ro = new ResizeObserver(() => mesurer());
    ro.observe(racine);
    window.addEventListener('resize', mesurer);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', mesurer);
    };
  }, [mesurer]);

  const poser = (idEtiquette: string, idCase: string) => {
    if (disabled) return;
    const suivant = { ...placements };
    // D'où vient l'étiquette ? (pour l'échange)
    const origine = Object.keys(suivant).find((k) => suivant[k] === idEtiquette);
    if (origine) delete suivant[origine];

    if (idCase === RESERVE) {
      onChange({ annotations: suivant });
      return;
    }
    // Une case ne tient qu'une étiquette : l'occupante repart d'où venait la
    // nouvelle — un échange, jamais une éjection dans le vide.
    const occupante = suivant[idCase];
    if (occupante && origine) suivant[origine] = occupante;
    suivant[idCase] = idEtiquette;
    onChange({ annotations: suivant });
  };

  const handlersDe = (id: string): DragHandlers => ({
    onStart(e) {
      setArme(null);
      const source = (e.target as HTMLElement).closest<HTMLElement>('[data-jeton]');
      if (source) fantomeRef.current = creerFantome(source, e);
      setEnCours(id);
    },
    onMove(e) {
      fantomeRef.current?.suivre(e);
      const cible = cibleSous(e, '[data-case],[data-boite]', racineRef.current);
      setSurvol(cible?.dataset.case ?? cible?.dataset.boite ?? null);
    },
    onDrop(e) {
      fantomeRef.current?.detruire();
      fantomeRef.current = null;
      const cible = cibleSous(e, '[data-case],[data-boite]', racineRef.current);
      const dest = cible?.dataset.case ?? cible?.dataset.boite;
      if (dest) poser(id, dest);
      setEnCours(null);
      setSurvol(null);
    },
    onTap() {
      setArme((a) => (a === id ? null : id));
    },
  });

  const auTap = (idCase: string) => () => {
    if (!arme) return;
    poser(arme, idCase);
    setArme(null);
  };

  const verdict = (idCase: string): boolean | null => {
    if (!showCorrection) return null;
    // L'étiquette porte l'id de sa case attendue : juste = les deux coïncident
    return placements[idCase] === idCase;
  };

  const classeEtiquette = (id: string) =>
    [
      styles.token,
      arme === id ? styles.armed : '',
      enCours === id ? styles.grabbed : '',
      disabled ? styles.fige : '',
    ]
      .filter(Boolean)
      .join(' ');

  const colonne = (liste: typeof cibles, cote: 'left' | 'right') => (
    <div className={`${styles.slotCol} ${styles[cote]}`}>
      {liste.map((c) => {
        const posee = placements[c.id];
        const juste = verdict(c.id);
        return (
          <div
            key={c.id}
            data-case={c.id}
            data-cote={c.cote === 'droite' ? 'droite' : 'gauche'}
            onClick={auTap(c.id)}
            className={[
              styles.slot,
              survol === c.id ? styles.dropping : '',
              juste === true ? styles.ok : '',
              juste === false ? styles.ko : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {posee && (
              <Etiquette
                id={posee}
                texte={libelle.get(posee) ?? ''}
                enabled={!disabled}
                handlers={handlersDe(posee)}
                className={classeEtiquette(posee)}
              />
            )}
            {/* Ce qu'on attendait, dit SUR la case — pas dans un bandeau au
                loin qu'il faudrait rapprocher soi-même du bon endroit */}
            {juste === false && <span className={styles.attendu}>{c.label}</span>}
          </div>
        );
      })}
    </div>
  );

  const reserve = (
    <div
      data-boite={RESERVE}
      onClick={auTap(RESERVE)}
      className={`${styles.bank} ${survol === RESERVE ? styles.dropping : ''}`}
      style={reserveEnHaut ? { marginBottom: 16 } : { marginTop: 16 }}
    >
      <span className={styles.bankLabel}>Étiquettes à placer</span>
      {etiquettes
        .filter((e) => !Object.values(placements).includes(e.id))
        .map((e) => (
          <Etiquette
            key={e.id}
            id={e.id}
            texte={e.texte ?? ''}
            enabled={!disabled}
            handlers={handlersDe(e.id)}
            className={classeEtiquette(e.id)}
          />
        ))}
    </div>
  );

  return (
    <div ref={racineRef} className={styles.annotWrap}>
      <p className={styles.hint}>
        Fais glisser une étiquette dans une case — ou tape-la, puis tape la case.
      </p>

      <svg className={styles.leaderSvg}>
        {traits.map((t) => {
          const juste = verdict(t.id);
          return (
            <line
              key={t.id}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              className={juste === true ? 'ok' : juste === false ? 'ko' : ''}
            />
          );
        })}
      </svg>

      {reserveEnHaut && reserve}

      <div className={styles.annotGrid}>
        {colonne(gauche, 'left')}

        <div className={styles.annotStage}>
          {question.image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={question.image.url} alt="Image à annoter" />
          )}
          {cibles.map((c, i) => (
            <span
              key={c.id}
              data-point={c.id}
              className={styles.anchor}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
            >
              {i + 1}
            </span>
          ))}
        </div>

        {colonne(droite, 'right')}
      </div>

      {!reserveEnHaut && reserve}
    </div>
  );
}
