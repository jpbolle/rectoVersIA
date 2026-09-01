'use client';

// Choisir un questionnaire pour une activité de lecture.
//
// Depuis le 2026-09-01, un questionnaire vit dans Mes Ressources et une
// activité y RENVOIE : on le rejoue d'une année sur l'autre sans dupliquer
// l'activité entière. Le prof a donc trois voies, et elles doivent tenir sur
// une ligne :
//
//   • en prendre un dans sa bibliothèque ;
//   • en écrire un ici même — il partira dans la bibliothèque à
//     l'enregistrement, sous le nom de l'activité ;
//   • ne rien changer, pour une activité qui porte déjà le sien.
//
// Même mécanique que « ➕ Nouvelle liste… » du vocabulaire : on ne quitte pas
// le formulaire pour créer sa ressource.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { QuestionnaireLectureResume } from '@/types/questionnaire-lecture';
import styles from './QuestionnaireLecturePicker.module.css';

/** Valeur du menu quand le prof écrit son questionnaire dans l'activité */
export const QUESTIONNAIRE_SUR_MESURE = '__sur_mesure__';

interface Props {
  /** Id du questionnaire choisi, ou QUESTIONNAIRE_SUR_MESURE */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function QuestionnaireLecturePicker({ value, onChange, disabled }: Props) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [liste, setListe] = useState<QuestionnaireLectureResume[]>([]);

  const charger = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/questionnaires-lecture', { headers });
      const json = await res.json();
      if (json.success) {
        // Les archivés ne se proposent pas : on les a rangés exprès.
        setListe(
          [...json.data.miens, ...json.data.exemples].filter(
            (q: QuestionnaireLectureResume) => !q.archive
          )
        );
      }
    } catch (err) {
      console.error('Erreur chargement des questionnaires:', err);
    }
  }, [isAuthenticated, getAuthHeaders]);

  useEffect(() => {
    charger();
  }, [charger]);

  const choisi = liste.find((q) => q.id === value);

  return (
    <div className={styles.bloc}>
      <label className={styles.label}>Questionnaire</label>
      <select
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value={QUESTIONNAIRE_SUR_MESURE}>
          ✏️ Écrire un questionnaire pour cette activité
        </option>
        {liste.length > 0 && (
          <optgroup label="Ma bibliothèque">
            {liste.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nom} — {q.nbQuestions} question{q.nbQuestions > 1 ? 's' : ''}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <p className={styles.note}>
        {choisi
          ? `${choisi.nbQuestions} question${choisi.nbQuestions > 1 ? 's' : ''} · ${choisi.points} pt${
              choisi.points > 1 ? 's' : ''
            }. Le modifier depuis Mes Ressources le modifiera pour toutes les activités qui s’en servent.`
          : 'Il rejoindra votre bibliothèque à l’enregistrement : vous pourrez le redonner l’an prochain sans recopier l’activité.'}
      </p>
    </div>
  );
}
