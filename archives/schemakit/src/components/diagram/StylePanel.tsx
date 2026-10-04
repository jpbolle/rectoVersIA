'use client';

/**
 * Onglet « Outils » du volet du bas : le style de la sélection — ou, sans sélection,
 * les réglages par défaut du schéma. Encadré = fond, bordure, coins ; trait = épaisseur,
 * style, couleur. Les mêmes contrôles servent aux liens et aux branches.
 */
import type { BoxStyle, ColorRef, LineStyle } from '@/types/diagram';
import { ColorPicker } from './ColorPicker';
import styles from './StylePanel.module.css';

export interface StyleTarget {
  /** Ce que décrit le panneau, pour l'utilisateur. */
  title: string;
  fill?: ColorRef; // absent = pas de fond à régler (lien, défauts)
  box?: Required<BoxStyle>;
  line?: Required<LineStyle>;
  lineLabel?: string; // « Lien », « Branche », « Traits »
}

interface Props {
  target: StyleTarget;
  onFill: (color: ColorRef) => void;
  onBox: (patch: BoxStyle) => void;
  onLine: (patch: LineStyle) => void;
}

const WIDTHS: LineStyle['width'][] = [1, 2, 4];
const DASHES: { value: NonNullable<LineStyle['dash']>; label: string }[] = [
  { value: 'solid', label: 'Plein' },
  { value: 'dashed', label: 'Tirets' },
  { value: 'dotted', label: 'Pointillé' },
];

export function StylePanel({ target, onFill, onBox, onLine }: Props) {
  return (
    <div className={styles.panel}>
      <p className={styles.title}>{target.title}</p>
      <div className={styles.groups}>
        {target.fill !== undefined && (
          <section className={styles.group}>
            <h4 className={styles.heading}>Fond</h4>
            <ColorPicker palette="fill" value={target.fill} label="Fond" onChange={onFill} />
          </section>
        )}
        {target.box && (
          <section className={styles.group}>
            <h4 className={styles.heading}>Encadré</h4>
            <div className={styles.row}>
              <Segmented
                label="Bordure"
                value={target.box.border}
                options={[
                  { value: 'thin', label: 'Fine' },
                  { value: 'thick', label: 'Épaisse' },
                  { value: 'none', label: 'Aucune' },
                ]}
                onChange={(border) => onBox({ border })}
              />
              <Segmented
                label="Coins"
                value={target.box.corners}
                options={[
                  { value: 'round', label: 'Arrondis' },
                  { value: 'square', label: 'Carrés' },
                ]}
                onChange={(corners) => onBox({ corners })}
              />
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Contour</span>
                <ColorPicker palette="stroke" value={target.box.borderColor} label="Contour" onChange={(borderColor) => onBox({ borderColor })} />
              </div>
            </div>
          </section>
        )}
        {target.line && (
          <section className={styles.group}>
            <h4 className={styles.heading}>{target.lineLabel ?? 'Trait'}</h4>
            <div className={styles.row}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Épaisseur</span>
                <div className={styles.segmented} role="radiogroup" aria-label="Épaisseur">
                  {WIDTHS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      role="radio"
                      aria-checked={target.line!.width === w}
                      className={styles.segment}
                      data-active={target.line!.width === w || undefined}
                      onClick={() => onLine({ width: w })}
                      title={`${w} px`}
                    >
                      <span className={styles.widthSample} style={{ height: w }} />
                    </button>
                  ))}
                </div>
              </div>
              <Segmented label="Style" value={target.line.dash} options={DASHES} onChange={(dash) => onLine({ dash })} />
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Couleur</span>
                <ColorPicker palette="stroke" value={target.line.color} label="Couleur du trait" onChange={(color) => onLine({ color })} />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.segmented} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={styles.segment}
            data-active={value === o.value || undefined}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
