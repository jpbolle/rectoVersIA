'use client';

// ═══ Socle des types de questions manipulés ═══
//
// Six champs, DEUX moteurs. Un cinquième type manipulé s'habille sur l'un
// des deux — on n'en écrit jamais un troisième, sinon ils divergent au premier
// ajustement (c'est déjà arrivé aux trois champs « énoncé » du projet).
//
//   RELIER   → AppariementField
//   DÉPLACER → OrdreField · AnnotationField · EnsemblesField
//   (sans glisser) → MatriceField · FluoCategoriesField
//
// `ChampManipule` est le point d'entrée commun : l'écran élève, la liseuse
// d'œuvre et la vue de correction du prof passent tous par lui, avec la même
// signature. Une seule règle d'affichage à tenir pour les trois surfaces.

import type { LectureAnswer, LectureQuestion } from '@/types/lecture';
import AppariementField from './AppariementField';
import OrdreField from './OrdreField';
import AnnotationField from './AnnotationField';
import EnsemblesField from './EnsemblesField';
import MatriceField from './MatriceField';
import FluoCategoriesField from './FluoCategoriesField';

export { default as AppariementField } from './AppariementField';
export { default as OrdreField } from './OrdreField';
export { default as AnnotationField } from './AnnotationField';
export { default as EnsemblesField } from './EnsemblesField';
export { default as MatriceField } from './MatriceField';
export { default as FluoCategoriesField } from './FluoCategoriesField';
export { default as JetonContenu } from './Jeton';

/** Les types qui passent par ce socle. */
export function estTypeManipule(type: LectureQuestion['type']): boolean {
  return (
    type === 'appariement' ||
    type === 'ordre' ||
    type === 'image-annotee' ||
    type === 'ensembles' ||
    type === 'matrice'
  );
}

interface Props {
  question: LectureQuestion;
  answer: LectureAnswer;
  onAnswerChange: (partial: Partial<LectureAnswer>) => void;
  disabled?: boolean;
  /** Le corrigé est-il là ? (il est filtré côté serveur tant qu'il ne l'est pas) */
  showCorrection?: boolean;
}

export default function ChampManipule({
  question,
  answer,
  onAnswerChange,
  disabled,
  showCorrection,
}: Props) {
  const commun = { question, answer, onChange: onAnswerChange, disabled, showCorrection };

  switch (question.type) {
    case 'appariement':
      return <AppariementField {...commun} />;
    case 'ordre':
      return <OrdreField {...commun} />;
    case 'image-annotee':
      return <AnnotationField {...commun} />;
    case 'ensembles':
      return <EnsemblesField {...commun} />;
    case 'matrice':
      return (
        <MatriceField
          nomGroupe={question.id}
          items={question.matriceItems ?? []}
          colonnes={question.choices ?? []}
          valeurs={answer.matrice ?? {}}
          multiple={question.matriceMultiple}
          onChange={(matrice) => onAnswerChange({ matrice })}
          disabled={disabled}
          attendu={showCorrection ? question.matriceCorrect : null}
        />
      );
    case 'fluorage':
      // N'atterrit ici que le fluorage À CATÉGORIES ; sans catégories, l'écran
      // élève garde son `FluoExtrait` historique.
      return (
        <FluoCategoriesField
          texte={question.fluoTexte ?? ''}
          categories={question.fluoCategories ?? []}
          valeurs={answer.fluoParCategorie ?? {}}
          onChange={(fluoParCategorie) => onAnswerChange({ fluoParCategorie })}
          disabled={disabled}
          attendu={showCorrection ? question.fluoAttenduParCategorie : null}
        />
      );
    default:
      return null;
  }
}
