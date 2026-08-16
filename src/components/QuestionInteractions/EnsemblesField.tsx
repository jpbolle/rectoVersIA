'use client';

// ═══ MOTEUR DÉPLACER — ensembles ═══
//
// Des étiquettes (texte ou image) à ranger dans des boîtes nommées par le prof.
// On peut toujours ressortir une étiquette et la remettre dans la réserve :
// une erreur qu'on ne peut pas défaire est une erreur qui bloque.
//
// Ici le jeton ne change pas d'ORDRE mais de CONTENANT : pas besoin du trou
// de `OrdreField`. Le jeton reste en place, estompé, jusqu'au dépôt.

import { useRef, useState } from 'react';
import type { LectureAnswer, LectureQuestion } from '@/types/lecture';
import { dragProps, cibleSous, creerFantome, type DragHandlers, type Fantome } from './pointerDrag';
import JetonContenu from './Jeton';
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

export default function EnsemblesField({
  question,
  answer,
  onChange,
  disabled,
  showCorrection,
}: Props) {
  const boites = question.ensembles ?? [];
  const items = question.ensembleItems ?? [];
  const affectations = answer.ensembles ?? {};
  const corrige = showCorrection ? question.ensembleAffectations : undefined;

  const racineRef = useRef<HTMLDivElement | null>(null);
  const fantomeRef = useRef<Fantome | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [arme, setArme] = useState<string | null>(null);

  const ranger = (idJeton: string, idBoite: string) => {
    if (disabled) return;
    const suivant = { ...affectations };
    if (idBoite === RESERVE) delete suivant[idJeton];
    else suivant[idJeton] = idBoite;
    onChange({ ensembles: suivant });
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
      const cible = cibleSous(e, '[data-boite]', racineRef.current);
      setSurvol(cible?.dataset.boite ?? null);
    },
    onDrop(e) {
      fantomeRef.current?.detruire();
      fantomeRef.current = null;
      const cible = cibleSous(e, '[data-boite]', racineRef.current);
      if (cible?.dataset.boite) ranger(id, cible.dataset.boite);
      setEnCours(null);
      setSurvol(null);
    },
    onTap() {
      setArme((a) => (a === id ? null : id));
    },
  });

  const auTap = (idBoite: string) => () => {
    if (!arme) return;
    ranger(arme, idBoite);
    setArme(null);
  };

  const rendre = (idBoite: string) => {
    const dedans = items.filter((j) =>
      idBoite === RESERVE ? !affectations[j.id] : affectations[j.id] === idBoite
    );
    return dedans.map((j) => {
      const juste = corrige ? corrige[j.id] === idBoite : null;
      return (
        <Etiquette
          key={j.id}
          id={j.id}
          enabled={!disabled}
          handlers={handlersDe(j.id)}
          className={[
            styles.token,
            arme === j.id ? styles.armed : '',
            enCours === j.id ? styles.grabbed : '',
            // Un jeton resté dans la réserve n'est pas « faux » : il est
            // simplement non rangé. Le verdict ne vaut que dans une boîte.
            idBoite !== RESERVE && juste === true ? styles.ok : '',
            idBoite !== RESERVE && juste === false ? styles.ko : '',
            disabled ? styles.fige : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {!disabled && <span className={styles.grip}>⣿</span>}
          <JetonContenu jeton={j} />
        </Etiquette>
      );
    });
  };

  const nonRanges = items.filter((j) => !affectations[j.id]).length;

  return (
    <div ref={racineRef}>
      <p className={styles.hint}>
        Glisse une étiquette dans un ensemble — ou tape-la, puis tape l&apos;ensemble.
      </p>

      <div className={styles.setsLayout}>
        <div
          data-boite={RESERVE}
          onClick={auTap(RESERVE)}
          className={`${styles.bank} ${survol === RESERVE ? styles.dropping : ''}`}
        >
          <span className={styles.bankLabel}>
            Réserve{nonRanges === 0 ? ' — tout est rangé' : ''}
          </span>
          {rendre(RESERVE)}
        </div>

        <div className={styles.setsRow}>
          {boites.map((b) => (
            <div
              key={b.id}
              data-boite={b.id}
              onClick={auTap(b.id)}
              className={`${styles.setBox} ${survol === b.id ? styles.dropping : ''}`}
            >
              <div className={styles.setHead}>{b.titre}</div>
              <div className={styles.setBody}>
                {items.some((j) => affectations[j.id] === b.id) ? (
                  rendre(b.id)
                ) : (
                  <span className={styles.empty}>Dépose ici…</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {corrige && (
        <p className={styles.hint} style={{ marginTop: 8 }}>
          {items
            .filter((j) => affectations[j.id] !== corrige[j.id])
            .map((j) => {
              const attendue = boites.find((b) => b.id === corrige[j.id]);
              return attendue ? (
                <span key={j.id} style={{ display: 'block' }}>
                  « {j.texte || 'Étiquette'} » allait dans « {attendue.titre} ».
                </span>
              ) : null;
            })}
        </p>
      )}
    </div>
  );
}
