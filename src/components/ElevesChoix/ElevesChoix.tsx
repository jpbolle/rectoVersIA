'use client';

// Les élèves qui accèdent à une activité — un menu déroulant à cases, sous le
// menu des classes (création et popup ✏️) : « Tous les élèves », puis une
// case par élève des classes cochées. Même habillage que le menu des classes
// (`ClassesDropdown`), dont il reprend les styles.
//
// Né pour la séquence FLE, généralisé à TOUTES les activités le 2026-09-14 à
// la demande de JP (« tous ne passeront pas par ce parcours, selon leur
// niveau »). Valeur : liste d'ids de fiches `eleves`, ou null = tous.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClasses } from '@/hooks/useClasses';
import type { Eleve } from '@/types/classe';
import menu from '@/components/ClassesDropdown/ClassesDropdown.module.css';
import styles from './ElevesChoix.module.css';

export type EleveAvecClasse = Eleve & { classeNom: string };

interface Props {
  classesNoms: string[];
  value: string[] | null;
  onChange: (eleves: string[] | null) => void;
  disabled?: boolean;
  label?: string;
  // Permet à l'appelant (constructeur de séquence) de connaître les élèves
  // des classes cochées, pour ses propres restrictions par module
  onEleves?: (eleves: EleveAvecClasse[]) => void;
}

export default function ElevesChoix({ classesNoms, value, onChange, disabled = false, label, onEleves }: Props) {
  const { getAuthHeaders } = useAuth();
  const { classes: mesClasses } = useClasses();
  const classesChoisies = useMemo(
    () => mesClasses.filter((c) => classesNoms.includes(c.nom)),
    [mesClasses, classesNoms]
  );
  const [elevesParClasse, setElevesParClasse] = useState<Record<string, Eleve[]>>({});
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Les élèves des classes cochées qu'on n'a pas encore
  useEffect(() => {
    const manquantes = classesChoisies.map((c) => c.id).filter((id) => !(id in elevesParClasse));
    if (manquantes.length === 0) return;
    let annule = false;
    (async () => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const lus: Record<string, Eleve[]> = {};
      await Promise.all(
        manquantes.map(async (id) => {
          try {
            const res = await fetch(`/api/eleves?classeId=${encodeURIComponent(id)}`, { headers });
            const json = await res.json();
            lus[id] = json.success ? (json.data as Eleve[]) : [];
          } catch {
            lus[id] = [];
          }
        })
      );
      if (!annule) setElevesParClasse((prev) => ({ ...prev, ...lus }));
    })();
    return () => {
      annule = true;
    };
  }, [classesChoisies, elevesParClasse, getAuthHeaders]);

  // Fermer au clic hors du menu
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const eleves = useMemo<EleveAvecClasse[]>(
    () => classesChoisies.flatMap((c) => (elevesParClasse[c.id] ?? []).map((e) => ({ ...e, classeNom: c.nom }))),
    [classesChoisies, elevesParClasse]
  );

  useEffect(() => {
    onEleves?.(eleves);
  }, [eleves, onEleves]);

  if (classesNoms.length === 0) return null;

  const tous = value === null;
  const coches = value ?? [];
  const plusieursClasses = classesChoisies.length > 1;
  const choisis = eleves.filter((e) => coches.includes(e.id));
  const resume = tous
    ? 'Tous les élèves'
    : choisis.length === 0
      ? 'Aucun élève'
      : choisis.map((e) => e.prenom).join(', ');

  const basculer = (id: string) =>
    onChange(coches.includes(id) ? coches.filter((e) => e !== id) : [...coches, id]);

  return (
    <div className={styles.champ}>
      <label className={styles.label}>{label ?? 'Élèves concernés'}</label>
      <div className={menu.root} ref={rootRef} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
        <button
          type="button"
          className={`${menu.trigger} ${open ? menu.triggerOpen : ''}`}
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={`${menu.triggerText} ${!tous && choisis.length === 0 ? menu.triggerPlaceholder : ''}`}>
            {resume}
          </span>
          {!tous && choisis.length > 0 && <span className={menu.count}>{choisis.length}</span>}
          <span className={menu.chevron} aria-hidden="true">▾</span>
        </button>

        {open && (
          <div className={menu.panel} role="listbox" aria-multiselectable="true">
            {/* « Tous » : cocher = toute la classe (null) ; décocher = on choisit */}
            <label className={`${menu.option} ${styles.optionTous}`}>
              <input type="checkbox" className={menu.checkbox} checked={tous} onChange={() => onChange(tous ? [] : null)} />
              <span className={menu.optionLabel}>Tous les élèves</span>
            </label>
            {eleves.length === 0 && <p className={menu.empty}>Aucun élève dans les classes choisies</p>}
            {eleves.map((e) => (
              <label key={e.id} className={menu.option}>
                <input
                  type="checkbox"
                  className={menu.checkbox}
                  checked={tous || coches.includes(e.id)}
                  disabled={tous}
                  onChange={() => basculer(e.id)}
                />
                <span className={menu.optionLabel}>
                  {e.prenom} {e.nom}
                  {plusieursClasses && <span className={styles.classe}> · {e.classeNom}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Liste d'élèves à cocher, en clair — pour les restrictions PAR MODULE du
// constructeur de séquence (un menu déroulant dans un volet déplié serait
// un menu dans un menu)
export function ListeEleves({
  eleves,
  coches,
  onBasculer,
  avecClasse,
  disabled,
}: {
  eleves: EleveAvecClasse[];
  coches: string[];
  onBasculer: (id: string, coche: boolean) => void;
  avecClasse: boolean;
  disabled: boolean;
}) {
  if (eleves.length === 0) {
    return <p className={styles.vide}>Aucun élève dans les classes choisies (ou chargement en cours).</p>;
  }
  return (
    <div className={styles.eleves}>
      {eleves.map((e) => {
        const coche = coches.includes(e.id);
        return (
          <label key={e.id} className={`${styles.eleve} ${coche ? styles.eleveActive : ''}`}>
            <input type="checkbox" checked={coche} disabled={disabled} onChange={(ev) => onBasculer(e.id, ev.target.checked)} />
            <span className={styles.eleveNom}>
              {e.prenom} {e.nom}
            </span>
            {avecClasse && <span className={styles.eleveClasse}>{e.classeNom}</span>}
          </label>
        );
      })}
    </div>
  );
}
