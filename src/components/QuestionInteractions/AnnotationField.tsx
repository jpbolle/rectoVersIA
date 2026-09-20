'use client';

// ═══ MOTEUR DÉPLACER — image à annoter ═══
//
// Refonte du 2026-09-19, achevée le 2026-09-20. L'élève travaille SUR L'IMAGE
// MÊME, dans les zones posées par le prof (point, encadré, cercle). Il n'y a
// plus de case sur le côté reliée à un point par un trait : joué en classe sur
// des Chromebooks, personne ne les avait trouvées — petites, loin de l'image,
// et la réserve à une image de distance.
//
// TROIS JEUX, un seul socle (voir `AnnotationJeu`) :
//   · étiquettes — il tire une étiquette de la réserve et la pose dans sa zone ;
//   · bulles     — il ÉCRIT dans chaque zone ;
//   · marqueurs  — il pose lui-même ses marques, et les zones attendues ne lui
//                  arrivent qu'avec le corrigé.
//
// Deux règles tiennent l'exercice sur un écran d'entrée de gamme :
//   · la réserve est AU-DESSUS de l'image, et collante : on ne peut pas faire
//     défiler la page en tenant une étiquette sous le doigt ;
//   · l'image est plafonnée en hauteur (≈ 65 % de l'écran) : réserve et zones
//     tiennent ensemble à l'écran, sans défilement pendant le geste.
//
// Le jeu « étiquettes » est le même moteur que les ensembles — une zone est
// une boîte qui ne tient qu'une étiquette. D'où l'échange automatique quand on
// en dépose une seconde : elle ne se perd pas, elle repart d'où venait la
// nouvelle.

import { useMemo, useRef, useState } from 'react';
import type {
  LectureAnnotationCible,
  LectureAnswer,
  LectureJeton,
  LectureMarque,
  LectureQuestion,
} from '@/types/lecture';
import { bulleJuste, jeuAnnotation, marqueDansZone, melangeStable } from '@/types/lecture';
import { OUTILS_ZONE, tracerZone, type Boite } from '@/lib/annotation-zones';
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
export function styleDeZone(c: {
  x: number;
  y: number;
  forme?: string;
  w?: number;
  h?: number;
}): React.CSSProperties {
  if (c.forme === 'rect' || c.forme === 'cercle') {
    return { left: `${c.x}%`, top: `${c.y}%`, width: `${c.w ?? 0}%`, height: `${c.h ?? 0}%` };
  }
  return { left: `${c.x}%`, top: `${c.y}%` };
}

const formeDe = (f: string | undefined) => (f === 'rect' || f === 'cercle' ? f : 'point');

/** L'image et ce qu'on pose dessus — commune aux trois jeux. */
function Scene({
  question,
  onPointerDown,
  children,
}: {
  question: LectureQuestion;
  /** Présent = on trace sur l'image : le doigt ne doit plus faire défiler la page. */
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.annotCadre}>
      <div
        className={`${styles.annotStage} ${onPointerDown ? styles.annotStageTrace : ''}`}
        onPointerDown={onPointerDown}
      >
        {question.image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={question.image.url} alt="Image à annoter" draggable={false} />
        )}
        {children}
      </div>
    </div>
  );
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

export default function AnnotationField(props: Props) {
  switch (jeuAnnotation(props.question)) {
    case 'bulles':
      return <JeuBulles {...props} />;
    case 'marqueurs':
      return <JeuMarqueurs {...props} />;
    default:
      return <JeuEtiquettes {...props} />;
  }
}

// ─────────────────────────── JEU 1 — ÉTIQUETTES ───────────────────────────

function JeuEtiquettes({ question, answer, onChange, disabled, showCorrection }: Props) {
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

      <Scene question={question}>
        {cibles.map((c) => {
          const posee = placements[c.id];
          const juste = verdict(c.id);
          return (
            <div
              key={c.id}
              data-case={c.id}
              onClick={auTap(c.id)}
              style={styleDeZone(c)}
              className={[
                styles.zone,
                styles[`zone_${formeDe(c.forme)}`],
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
      </Scene>
    </div>
  );
}

// ──────────────────────────── JEU 2 — BULLES ────────────────────────────
//
// L'élève écrit DANS la zone. Pas de réserve, pas de glisser : sur un
// Chromebook, écrire est le geste le plus sûr qui soit.

function JeuBulles({ question, answer, onChange, disabled, showCorrection }: Props) {
  const cibles = useMemo(() => question.annotations ?? [], [question.annotations]);
  const textes = useMemo(() => answer.annotationsTexte ?? {}, [answer.annotationsTexte]);

  const ecrire = (idZone: string, valeur: string) => {
    if (disabled) return;
    onChange({ annotationsTexte: { ...textes, [idZone]: valeur } });
  };

  // ⚠ Le corrigé ne part qu'avec `showCorrection` : sans lui, `label` arrive
  // vide et aucun verdict n'est possible (rien ne doit être affiché en rouge
  // sur la foi d'une chaîne vide).
  const verdict = (c: LectureAnnotationCible): boolean | null =>
    showCorrection ? bulleJuste(c, textes[c.id]) : null;

  return (
    <div>
      <p className={styles.hint}>
        Écris ta réponse dans chaque bulle, sur l&apos;image.
      </p>

      <Scene question={question}>
        {cibles.map((c) => {
          const juste = verdict(c);
          return (
            <div
              key={c.id}
              style={styleDeZone(c)}
              className={[
                styles.zone,
                styles[`zone_${formeDe(c.forme)}`],
                styles.zoneBulle,
                juste === true ? styles.ok : '',
                juste === false ? styles.ko : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="text"
                className={styles.bulleInput}
                value={textes[c.id] ?? ''}
                onChange={(e) => ecrire(c.id, e.target.value)}
                disabled={disabled}
                placeholder="…"
                aria-label="Réponse à écrire dans cette zone"
              />
              {juste === false && <span className={styles.attendu}>{c.label}</span>}
            </div>
          );
        })}
      </Scene>
    </div>
  );
}

// ─────────────────────────── JEU 3 — MARQUEURS ───────────────────────────
//
// L'élève pose lui-même ses marques. Les zones attendues ne lui sont PAS
// envoyées (`lectureQuizForEleve` les retire) : elles n'apparaissent qu'avec
// le corrigé — sinon l'exercice consisterait à viser ce qu'on lui montre.
//
// Aucune pénalité : une marque à côté ne retire rien (décision de JP).

function JeuMarqueurs({ question, answer, onChange, disabled, showCorrection }: Props) {
  const cibles = useMemo(() => question.annotations ?? [], [question.annotations]);
  const marques = useMemo(() => answer.marques ?? [], [answer.marques]);
  const outil = question.marqueurOutil === 'rect' || question.marqueurOutil === 'cercle'
    ? question.marqueurOutil
    : 'point';
  const multiple = !!question.marqueurMultiple;
  const [brouillon, setBrouillon] = useState<Boite | null>(null);

  const poser = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Un tap sur une marque déjà posée la retire : il ne doit pas en poser une
    // seconde par-dessus.
    if ((e.target as HTMLElement).closest('[data-marque]')) return;
    tracerZone(e, outil, setBrouillon, (zone) => {
      const marque: LectureMarque = { id: `m-${Date.now()}-${marques.length}`, ...zone };
      onChange({ marques: multiple ? [...marques, marque] : [marque] });
    });
  };

  const retirer = (id: string) => {
    if (disabled) return;
    onChange({ marques: marques.filter((m) => m.id !== id) });
  };

  const aide = OUTILS_ZONE.find((o) => o.id === outil)?.libelle ?? 'Point';

  return (
    <div>
      <p className={styles.hint}>
        {outil === 'point'
          ? `Tape sur l’image pour poser ${multiple ? 'tes marques' : 'ta marque'}.`
          : `Trace ${multiple ? 'tes zones' : 'ta zone'} en glissant sur l’image (${aide.toLowerCase()}).`}
        {!disabled && marques.length > 0 && ' Tape une marque pour l’effacer.'}
      </p>

      <Scene question={question} onPointerDown={disabled ? undefined : poser}>
        {/* Ce qu'on attendait — seulement quand le corrigé est ouvert */}
        {showCorrection &&
          cibles.map((c) => {
            const trouvee = marques.some((m) => marqueDansZone(m, c));
            return (
              <div
                key={c.id}
                style={styleDeZone(c)}
                className={[
                  styles.zone,
                  styles[`zone_${formeDe(c.forme)}`],
                  styles.zoneAttendue,
                  trouvee ? styles.ok : styles.ko,
                ].join(' ')}
              >
                {c.label && <span className={styles.attendu}>{c.label}</span>}
              </div>
            );
          })}

        {marques.map((m) => (
          <div
            key={m.id}
            data-marque={m.id}
            onClick={() => retirer(m.id)}
            style={styleDeZone(m)}
            className={[
              styles.marque,
              styles[`zone_${formeDe(m.forme)}`],
              disabled ? styles.fige : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}

        {brouillon && (
          <div
            style={styleDeZone({ ...brouillon, forme: outil })}
            className={`${styles.marque} ${styles.marqueBrouillon} ${
              outil === 'cercle' ? styles.zone_cercle : styles.zone_rect
            }`}
          />
        )}
      </Scene>
    </div>
  );
}
