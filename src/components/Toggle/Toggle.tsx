'use client';

import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  labelOn?: string;
  labelOff?: string;
  disabled?: boolean;
}

export default function Toggle({
  checked,
  onChange,
  label,
  labelOn,
  labelOff,
  disabled = false,
}: ToggleProps) {
  const displayLabel = label || (checked ? labelOn : labelOff);

  return (
    <label className={`${styles.toggleWrapper} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.toggle}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className={styles.input}
        />
        <span className={`${styles.slider} ${checked ? styles.sliderOn : ''}`}>
          <span className={styles.knob} />
        </span>
      </div>
      {displayLabel && (
        <span className={`${styles.label} ${checked ? styles.labelOn : styles.labelOff}`}>
          {displayLabel}
        </span>
      )}
    </label>
  );
}
