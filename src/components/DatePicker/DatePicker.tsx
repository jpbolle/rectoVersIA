'use client';

import styles from './DatePicker.module.css';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  label,
  required = false,
  disabled = false,
}: DatePickerProps) {
  return (
    <div className={styles.wrapper}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        className={styles.input}
      />
    </div>
  );
}
