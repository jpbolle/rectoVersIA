'use client';

// ═══ MOTEUR RELIER ═══
//
// L'élève tire un trait d'une pastille de gauche vers une pastille de droite.
//
// UN LIEN PAR ITEM DE GAUCHE, mais plusieurs items de gauche peuvent viser la
// même cible : deux répliques peuvent être du même personnage, et la colonne
// de droite peut contenir des intrus. Relier ne libère donc que l'extrémité
// GAUCHE — libérer aussi la droite rendrait certains corrigés impossibles à
// atteindre.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LectureAnswer, LectureJeton, LectureQuestion } from '@/types/lecture';
import { dragProps, cibleSous, type DragHandlers } from './pointerDrag';
import JetonContenu from './Jeton';
import styles from './QuestionInteractions.module.css';

interface Props {
  question: LectureQuestion;
  answer: LectureAnswer;
  onChange: (partial: Partial<LectureAnswer>) => void;
  disabled?: boolean;
  /** Le corrigé est-il visible ? (jamais transmis à l'élève avant l'heure) */
  showCorrection?: boolean;
}

type Point = { x: number; y: number };

function Pastille({
  id,
  cote,
  className,
  handlers,
  enabled,
}: {
  id: string;
  cote: 'g' | 'd';
  className: string;
  handlers: DragHandlers;
  enabled: boolean;
}) {
  return (
    <button
      {...dragProps(handlers, enabled)}
      type="button"
      data-dot={id}
      data-cote={cote}
      className={className}
      aria-label={cote === 'g' ? 'Relier cet élément' : 'Relier à cette réponse'}
    />
  );
}

export default function AppariementField({
  question,
  answer,
  onChange,
  disabled,
  showCorrection,
}: Props) {
  // Mémoïsés : ces `?? []` créent un nouvel objet à chaque rendu, ce qui
  // relancerait la mesure en boucle (même famille de piège que `user` et
  // `travail` dans les dépendances de hooks — cf. AGENTS.md).
  const gauche = useMemo(() => question.appariementGauche ?? [], [question.appariementGauche]);
  const droite = useMemo(() => question.appariementDroite ?? [], [question.appariementDroite]);
  const paires = useMemo(() => answer.paires ?? {}, [answer.paires]);
  const corrige = showCorrection ? question.appariementPaires : undefined;

  const zoneRef = useRef<HTMLDivElement | null>(null);
  const tempRef = useRef<SVGLineElement | null>(null);
  const departRef = useRef<string | null>(null);

  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [depart, setDepart] = useState<string | null>(null); // glisser en cours
  const [survol, setSurvol] = useState<string | null>(null);
  const [arme, setArme] = useState<string | null>(null);     // rattrapage au tap

  const estGauche = useCallback((id: string) => gauche.some((j) => j.id === id), [gauche]);

  // Les traits se calculent depuis la position RÉELLE des pastilles : la
  // liseuse, le panneau prof et le Chromebook n'ont pas la même largeur, et
  // une position codée en dur se décalerait partout sauf sur un écran.
  const mesurer = useCallback(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const z = zone.getBoundingClientRect();
    const suivant: Record<string, Point> = {};
    zone.querySelectorAll<HTMLElement>('[data-dot]').forEach((d) => {
      const r = d.getBoundingClientRect();
      suivant[d.dataset.dot!] = {
        x: r.left + r.width / 2 - z.left,
        y: r.top + r.height / 2 - z.top,
      };
    });
    setPositions(suivant);
  }, []);

  // Mesure APRÈS la pose du DOM : c'est précisément le cas où un `setState`
  // dans un effet est légitime — on lit une géométrie que React ne connaît
  // pas. `useLayoutEffect` et pas `useEffect` pour que les traits soient
  // tracés avant la peinture, sinon ils clignotent à l'ouverture.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    mesurer();
  }, [mesurer, gauche.length, droite.length]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const ro = new ResizeObserver(() => mesurer());
    ro.observe(zone);
    window.addEventListener('resize', mesurer);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', mesurer);
    };
  }, [mesurer]);

  const relier = useCallback(
    (idA: string, idB: string) => {
      if (disabled) return;
      const g = estGauche(idA) ? idA : idB;
      const d = g === idA ? idB : idA;
      onChange({ paires: { ...paires, [g]: d } });
    },
    [disabled, estGauche, onChange, paires]
  );

  const handlersDe = (id: string, cote: 'g' | 'd'): DragHandlers => ({
    onStart() {
      setArme(null);
      departRef.current = id;
      setDepart(id);
    },
    onMove(e) {
      const zone = zoneRef.current;
      const ligne = tempRef.current;
      if (!zone || !ligne) return;
      const z = zone.getBoundingClientRect();
      ligne.setAttribute('x2', String(e.clientX - z.left));
      ligne.setAttribute('y2', String(e.clientY - z.top));
      const cible = cibleSous(e, '[data-dot]', zone);
      const idCible = cible?.dataset.dot ?? null;
      setSurvol(idCible && cible?.dataset.cote !== cote ? idCible : null);
    },
    onDrop(e) {
      const cible = cibleSous(e, '[data-dot]', zoneRef.current);
      if (cible && cible.dataset.cote !== cote && cible.dataset.dot) {
        relier(id, cible.dataset.dot);
      }
      departRef.current = null;
      setDepart(null);
      setSurvol(null);
    },
    onTap() {
      // Rattrapage au tap : première pastille armée, la suivante ferme le lien
      if (arme === id) return setArme(null);
      if (arme && estGauche(arme) !== estGauche(id)) {
        relier(arme, id);
        return setArme(null);
      }
      setArme(id);
    },
  });

  const actif = depart ?? arme;
  const coteActif = actif ? (estGauche(actif) ? 'g' : 'd') : null;

  const classeDot = (id: string, cote: 'g' | 'd') => {
    const relieDejà = cote === 'g' ? !!paires[id] : Object.values(paires).includes(id);
    return [
      styles.dot,
      relieDejà ? styles.linked : '',
      arme === id ? styles.armed : '',
      survol === id ? styles.dropping : '',
      coteActif && coteActif !== cote && survol !== id ? styles.candidate : '',
      disabled ? styles.fige : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  // Les traits attendus que l'élève n'a pas trouvés — affichés en pointillé
  // vert pâle, pour qu'il voie ce qui lui manquait sans confondre avec le sien
  const manquants = corrige
    ? Object.entries(corrige).filter(([g, d]) => paires[g] !== d)
    : [];

  const trait = (g: string, d: string, classe: string, key: string) => {
    const a = positions[g];
    const b = positions[d];
    if (!a || !b) return null;
    return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={classe} />;
  };

  return (
    <div>
      <p className={styles.hint}>
        Tire un trait d&apos;une pastille à l&apos;autre — ou tape l&apos;une, puis l&apos;autre.
      </p>

      <div ref={zoneRef} className={`${styles.relierZone} ${styles.pairGrid}`}>
        <svg className={styles.relierSvg}>
          {manquants.map(([g, d]) => trait(g, d, 'attendu', `att-${g}`))}
          {Object.entries(paires).map(([g, d]) =>
            trait(g, d, corrige ? (corrige[g] === d ? 'ok' : 'ko') : '', `l-${g}`)
          )}
          {depart && positions[depart] && (
            <line
              ref={tempRef}
              className="temp"
              x1={positions[depart].x}
              y1={positions[depart].y}
              x2={positions[depart].x}
              y2={positions[depart].y}
            />
          )}
        </svg>

        {/* La grille alterne : item de gauche · gouttière · item de droite.
            Les deux colonnes peuvent être de longueur différente (intrus),
            d'où le remplissage par rangées jusqu'au plus long des deux. */}
        {Array.from({ length: Math.max(gauche.length, droite.length) }).map((_, i) => (
          <Rangee
            key={i}
            g={gauche[i]}
            d={droite[i]}
            classeDot={classeDot}
            handlersDe={handlersDe}
            enabled={!disabled}
          />
        ))}
      </div>
    </div>
  );
}

function Rangee({
  g,
  d,
  classeDot,
  handlersDe,
  enabled,
}: {
  g?: LectureJeton;
  d?: LectureJeton;
  classeDot: (id: string, cote: 'g' | 'd') => string;
  handlersDe: (id: string, cote: 'g' | 'd') => DragHandlers;
  enabled: boolean;
}) {
  return (
    <>
      {g ? (
        <div className={styles.pairItem}>
          <div className={styles.body}>
            <JetonContenu jeton={g} />
          </div>
          <Pastille
            id={g.id}
            cote="g"
            className={classeDot(g.id, 'g')}
            handlers={handlersDe(g.id, 'g')}
            enabled={enabled}
          />
        </div>
      ) : (
        <div />
      )}

      <div className={styles.pairSpacer} />

      {d ? (
        <div className={`${styles.pairItem} ${styles.right}`}>
          <div className={styles.body}>
            <JetonContenu jeton={d} />
          </div>
          <Pastille
            id={d.id}
            cote="d"
            className={classeDot(d.id, 'd')}
            handlers={handlersDe(d.id, 'd')}
            enabled={enabled}
          />
        </div>
      ) : (
        <div />
      )}
    </>
  );
}
