'use client';

// Un bouton qu'on TOURNE (demande JP, 2026-10-13 : « une roue, un bouton
// qu'on tourne ») — pour régler une valeur sans prendre la place d'un curseur.
//
// Trois gestes : glisser vers le haut / le bas (ou la droite / la gauche),
// la molette de la souris au survol, les flèches du clavier. Double-clic :
// retour à la valeur par défaut. L'aiguille parcourt 270°, de 7 h à 5 h.

import { useEffect, useRef } from 'react';
import styles from './Molette.module.css';

const ANGLE_MIN = -135;
const ANGLE_MAX = 135;
// Pixels de glissé pour parcourir toute la plage
const COURSE = 160;

export default function Molette({
  valeur,
  min,
  max,
  pas = 1,
  defaut,
  onChange,
  label,
  unite = '',
}: {
  valeur: number;
  min: number;
  max: number;
  pas?: number;
  defaut?: number;
  onChange: (v: number) => void;
  label: string;
  unite?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Les gestionnaires natifs lisent la valeur et le rappel du moment
  const etat = useRef({ valeur, onChange });
  useEffect(() => {
    etat.current = { valeur, onChange };
  });

  const borner = (v: number) => Math.min(max, Math.max(min, Math.round(v / pas) * pas));

  // Molette de la souris : écouteur natif NON passif, sans quoi la page
  // défilerait en même temps qu'on tourne le bouton
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const auRoulement = (e: WheelEvent) => {
      e.preventDefault();
      const sens = e.deltaY < 0 || e.deltaX > 0 ? 1 : -1;
      const { valeur: v, onChange: changer } = etat.current;
      const suivant = Math.min(max, Math.max(min, v + sens * pas));
      if (suivant !== v) changer(suivant);
    };
    el.addEventListener('wheel', auRoulement, { passive: false });
    return () => el.removeEventListener('wheel', auRoulement);
  }, [min, max, pas]);

  const auPointeur = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.focus();
    const depart = { x: e.clientX, y: e.clientY, v: valeur };
    const deplacer = (ev: PointerEvent) => {
      const delta = depart.y - ev.clientY + (ev.clientX - depart.x);
      const suivant = borner(depart.v + (delta / COURSE) * (max - min));
      if (suivant !== etat.current.valeur) etat.current.onChange(suivant);
    };
    const lacher = () => {
      el.removeEventListener('pointermove', deplacer);
      el.removeEventListener('pointerup', lacher);
      el.removeEventListener('pointercancel', lacher);
    };
    el.addEventListener('pointermove', deplacer);
    el.addEventListener('pointerup', lacher);
    el.addEventListener('pointercancel', lacher);
  };

  const auClavier = (e: React.KeyboardEvent) => {
    const pas10 = (max - min) / 10;
    const suivant =
      e.key === 'ArrowUp' || e.key === 'ArrowRight'
        ? valeur + pas
        : e.key === 'ArrowDown' || e.key === 'ArrowLeft'
          ? valeur - pas
          : e.key === 'PageUp'
            ? valeur + pas10
            : e.key === 'PageDown'
              ? valeur - pas10
              : e.key === 'Home'
                ? min
                : e.key === 'End'
                  ? max
                  : null;
    if (suivant === null) return;
    e.preventDefault();
    onChange(borner(suivant));
  };

  const part = (valeur - min) / (max - min || 1);
  const angle = ANGLE_MIN + part * (ANGLE_MAX - ANGLE_MIN);

  // L'arc parcouru, de 7 h jusqu'à l'aiguille
  const r = 13;
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${16 + r * Math.cos(rad)} ${16 + r * Math.sin(rad)}`;
  };
  const arc = `M ${point(ANGLE_MIN)} A ${r} ${r} 0 ${angle - ANGLE_MIN > 180 ? 1 : 0} 1 ${point(angle)}`;
  const fond = `M ${point(ANGLE_MIN)} A ${r} ${r} 0 1 1 ${point(ANGLE_MAX)}`;

  return (
    <div className={styles.molette}>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={valeur}
        aria-valuetext={`${valeur}${unite}`}
        title={`${label} — tourner (glisser vers le haut ou le bas, molette de la souris)${
          defaut !== undefined ? ' ; double-clic : valeur par défaut' : ''
        }`}
        onPointerDown={auPointeur}
        onKeyDown={auClavier}
        onDoubleClick={() => defaut !== undefined && onChange(defaut)}
        className={styles.bouton}
      >
        <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
          <path d={fond} className={styles.piste} />
          {part > 0 && <path d={arc} className={styles.arc} />}
          <circle cx="16" cy="16" r="9" className={styles.tete} />
          <line
            x1="16"
            y1="16"
            x2="16"
            y2="9"
            className={styles.aiguille}
            transform={`rotate(${angle} 16 16)`}
          />
        </svg>
      </div>
      <span className={styles.valeur}>
        {valeur}
        {unite}
      </span>
    </div>
  );
}
