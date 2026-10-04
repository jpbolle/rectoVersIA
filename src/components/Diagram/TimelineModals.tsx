'use client';

/** Les deux popups de la ligne du temps : un événement, un étage. */
import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Diagram/ui/Modal';
import buttons from '@/components/Diagram/ui/buttons.module.css';
import { parseDate, toIso, toYears } from '@/lib/diagram/dates';
import type { ColorRef, TimelineLane } from '@/types/diagram';
import { ColorPicker } from './ColorPicker';
import styles from './TimelineModals.module.css';

export interface EventValues {
  label: string;
  date: string;
  endDate?: string;
  laneId?: string;
}

interface EventModalProps {
  open: boolean;
  initial: EventValues;
  lanes: TimelineLane[];
  isNew: boolean;
  onClose: () => void;
  onSave: (values: EventValues) => void;
  onDelete?: () => void;
}

export function EventModal({ open, initial, lanes, isNew, onClose, onSave, onDelete }: EventModalProps) {
  return open ? <EventForm initial={initial} lanes={lanes} isNew={isNew} onClose={onClose} onSave={onSave} onDelete={onDelete} /> : null;
}

function EventForm({ initial, lanes, isNew, onClose, onSave, onDelete }: Omit<EventModalProps, 'open'>) {
  const [label, setLabel] = useState(initial.label);
  const [date, setDate] = useState(initial.date);
  const [endDate, setEndDate] = useState(initial.endDate ?? '');
  const [laneId, setLaneId] = useState(initial.laneId ?? '');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const start = parseDate(date);
    if (!start) {
      setError('Date illisible. Exemples : 1815, 1815-06, 1815-06-18, 18/06/1815, -52.');
      return;
    }
    const end = endDate.trim() ? parseDate(endDate) : null;
    if (endDate.trim() && !end) {
      setError('Date de fin illisible.');
      return;
    }
    if (end && toYears(end) < toYears(start)) {
      setError('La fin est avant le début.');
      return;
    }
    if (!label.trim()) {
      setError('Donne un titre à l’événement.');
      return;
    }
    const values: EventValues = { label: label.trim(), date: toIso(start) };
    if (end) values.endDate = toIso(end);
    if (laneId) values.laneId = laneId;
    onSave(values);
  };

  return (
    <Modal
      open
      title={isNew ? 'Nouvel événement' : 'Modifier l’événement'}
      onClose={onClose}
      actions={
        <>
          {onDelete && (
            <button type="button" className={`${buttons.button} ${buttons.danger}`} onClick={onDelete} style={{ marginRight: 'auto' }}>
              Supprimer
            </button>
          )}
          <button type="button" className={buttons.button} onClick={onClose}>
            Annuler
          </button>
          <button type="submit" form="event-form" className={`${buttons.button} ${buttons.primary}`}>
            {isNew ? 'Ajouter' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="event-form" className={styles.form} onSubmit={submit}>
        <label className={styles.label}>
          Titre
          <input className={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Congrès de Vienne" autoFocus />
        </label>
        <div className={styles.row}>
          <label className={styles.label}>
            Date
            <input className={styles.input} value={date} onChange={(e) => setDate(e.target.value)} placeholder="1815 · 1815-06-18 · -52" />
          </label>
          <label className={styles.label}>
            Fin (période, facultatif)
            <input className={styles.input} value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="1831" />
          </label>
        </div>
        <label className={styles.label}>
          Étage
          <select className={styles.input} value={laneId} onChange={(e) => setLaneId(e.target.value)}>
            <option value="">Sur l’axe (sans étage)</option>
            {lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label} ({l.side === 'above' ? 'dessus' : 'dessous'})
              </option>
            ))}
          </select>
        </label>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    </Modal>
  );
}

export interface LaneValues {
  label: string;
  side: 'above' | 'below';
  color?: ColorRef;
}

interface LaneModalProps {
  open: boolean;
  initial: LaneValues;
  isNew: boolean;
  onClose: () => void;
  onSave: (values: LaneValues) => void;
  onDelete?: () => void;
}

export function LaneModal({ open, initial, isNew, onClose, onSave, onDelete }: LaneModalProps) {
  return open ? <LaneForm initial={initial} isNew={isNew} onClose={onClose} onSave={onSave} onDelete={onDelete} /> : null;
}

function LaneForm({ initial, isNew, onClose, onSave, onDelete }: Omit<LaneModalProps, 'open'>) {
  const [label, setLabel] = useState(initial.label);
  const [side, setSide] = useState<'above' | 'below'>(initial.side);
  const [color, setColor] = useState<ColorRef | undefined>(initial.color);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const values: LaneValues = { label: label.trim() || 'Étage', side };
    if (color) values.color = color;
    onSave(values);
  };
  return (
    <Modal
      open
      title={isNew ? 'Nouvel étage' : 'Modifier l’étage'}
      onClose={onClose}
      actions={
        <>
          {onDelete && (
            <button type="button" className={`${buttons.button} ${buttons.danger}`} onClick={onDelete} style={{ marginRight: 'auto' }} title="Les événements de l’étage restent, sur l’axe">
              Supprimer l’étage
            </button>
          )}
          <button type="button" className={buttons.button} onClick={onClose}>
            Annuler
          </button>
          <button type="submit" form="lane-form" className={`${buttons.button} ${buttons.primary}`}>
            {isNew ? 'Ajouter' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="lane-form" className={styles.form} onSubmit={submit}>
        <label className={styles.label}>
          Nom
          <input className={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Politique, Économie, Culture…" autoFocus />
        </label>
        <div className={styles.label}>
          Position
          <div className={styles.segmented} role="radiogroup">
            <button type="button" role="radio" aria-checked={side === 'above'} className={styles.segment} data-active={side === 'above' || undefined} onClick={() => setSide('above')}>
              Au-dessus de l’axe
            </button>
            <button type="button" role="radio" aria-checked={side === 'below'} className={styles.segment} data-active={side === 'below' || undefined} onClick={() => setSide('below')}>
              Au-dessous
            </button>
          </div>
        </div>
        <div className={styles.label}>
          Couleur du bandeau
          <ColorPicker palette="fill" value={color} label="Couleur" onChange={setColor} />
        </div>
      </form>
    </Modal>
  );
}
