'use client';

// ═══ MOTEUR DÉPLACER — image à annoter ═══
//
// Refonte du 2026-09-19. L'élève dépose ses étiquettes SUR L'IMAGE MÊME, dans
// les zones posées par le prof (point, encadré, cercle). Il n'y a plus de
// case sur le côté reliée à un point par un trait : joué en classe sur des
// Chromebooks, personne ne les avait trouvées — petites, loin de l'image, et
// la réserve à une image de distance.
//
// Deux règles tiennent l'exercice sur un écran d'entrée de gamme :
//   · la réserve est AU-DESSUS de l'image, et collante : on ne peut pas faire
//     défiler la page en tenant une étiquette sous le doigt ;
//   · l'image est plafonnée en hauteur (≈ 65 % de l'écran) : réserve et zones
//     tiennent ensemble à l'écran, sans défilement pendant le geste.
//
// C'est le même moteur que les ensembles — une zone est une boîte qui ne
// tient qu'une étiquette. D'où l'échange automatique quand on en dépose une
// seconde : elle ne se perd pas, elle repart d'où venait la nouvelle.

import { useMemo, useRef, useState } from 'react';
import type { LectureAnnotationCible, LectureAnswer, LectureJeton, LectureQuestion } from '@/types/lecture';
import { melangeStable } from '@/types/lecture';
import { dragProps, cibleSous, creerFantome, useFantome, type DragHandlers } from './pointerDrag';
import styles from './QuestionInteractions.module.css';

interface Props {
  question: LectureQuestion;
  answer: LectureAnswer;
  onChange: (partial: Partial<LectureAnswer>) => void;
  disabled?: boolean;
  showCorrection?: boolean;
}

const RESERVE = '__reserve__';

/**
 * Où se place une zone sur l'image, en % : un point est centré sur ses
 * coordonnées (sa taille est fixe, en pixels, dans la feuille de style) ; un
 * encadré ou un cercle part de son coin haut-gauche.
 */
export function styleDeZone(c: LectureAnnotationCible): React.CSSProperties {
  if (c.forme === 'rect' || c.forme === 'cercle') {
    return { left: `${c.x}%`, top: `${c.y}%`, width: `${c.w ?? 0}%`, height: `${c.h ?? 0}%` };
  }
  return { left: `${c.x}%`, top: `${c.y}%` };
}

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

  const racineRef = useRef<HTMLDivElement | null>(null);
  const fantomeRef = useFantome();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [arme, setArme] = useState<string | null>(null);

  const poser = (idEtiquette: string, idZone: string) => {
    if (disabled) return;
    const suivant = { ...placements };
    // D'où vient l'étiquette ? (pour l'échange)
    const origine = Object.keys(suivant).find((k) => suivant[k] === idEtiquette);
    if (origine) delete suivant[origine];

    if (idZone === RESERVE) {
      onChange({ annotations: suivant });
      return;
    }
    // Une zone ne tient qu'une étiquette : l'occupante repart d'où venait la
    // nouvelle — un échange, jamais une éjection dans le vide.
    const occupante = suivant[idZone];
    if (occupante && origine) suivant[origine] = occupante;
    suivant[idZone] = idEtiquette;
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

  const auTap = (idZone: string) => (e: React.MouseEvent) => {
    if (!arme) return;
    // Le tap sur une étiquette déjà posée l'arme elle-même : ne pas le
    // prendre en plus pour un dépôt dans la zone qui la contient.
    e.stopPropagation();
    poser(arme, idZone);
    setArme(null);
  };

  const verdict = (idZone: string): boolean | null => {
    if (!showCorrection) return null;
    // L'étiquette porte l'id de sa zone attendue : juste = les deux coïncident
    return placements[idZone] === idZone;
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

  const restantes = etiquettes.filter((e) => !Object.values(placements).includes(e.id));

  return (
    <div ref={racineRef}>
      <p className={styles.hint}>
        Fais glisser chaque étiquette sur l&apos;image, dans sa zone — ou tape-la, puis tape la
        zone.
      </p>

      {!disabled && (
        <div
          data-boite={RESERVE}
          onClick={auTap(RESERVE)}
          className={`${styles.bank} ${styles.annotBank} ${survol === RESERVE ? styles.dropping : ''}`}
        >
          <span className={styles.bankLabel}>
            {restantes.length === 0 ? 'Toutes les étiquettes sont placées' : 'Étiquettes à placer'}
          </span>
          {restantes.map((e) => (
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
      )}

      <div className={styles.annotCadre}>
        <div className={styles.annotStage}>
          {question.image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={question.image.url} alt="Image à annoter" draggable={false} />
          )}
          {cibles.map((c) => {
            const posee = placements[c.id];
            const juste = verdict(c.id);
            const forme = c.forme === 'rect' || c.forme === 'cercle' ? c.forme : 'point';
            return (
              <div
                key={c.id}
                data-case={c.id}
                onClick={auTap(c.id)}
                style={styleDeZone(c)}
                className={[
                  styles.zone,
                  styles[`zone_${forme}`],
                  posee ? styles.zoneRemplie : '',
                  arme && !disabled ? styles.zoneAppel : '',
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
                {/* Ce qu'on attendait, dit SUR la zone — pas dans un bandeau
                    au loin qu'il faudrait rapprocher soi-même du bon endroit */}
                {juste === false && <span className={styles.attendu}>{c.label}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
