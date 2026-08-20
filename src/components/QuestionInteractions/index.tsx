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
import { ordreAffichage } from '@/types/lecture';
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
  /**
   * Graine du mélange des propositions — l'identifiant de l'élève qui répond.
   * Absente côté prof (aperçu, correction) : il voit alors ses questions dans
   * l'ordre où il les a saisies. Voir `ordreAffichage`.
   */
  graine?: string | null;
}

export default function ChampManipule({
  question,
  answer,
  onAnswerChange,
  disabled,
  showCorrection,
  graine,
}: Props) {
  const commun = { question, answer, onChange: onAnswerChange, disabled, showCorrection };

  switch (question.type) {
    case 'appariement':
      // La colonne des réponses est mélangée par élève : le prof saisit
      // chaque réponse à côté de ce qu'elle répond.
      return <AppariementField {...commun} graine={graine} />;
    case 'ordre':
      return <OrdreField {...commun} />;
    case 'image-annotee':
      return <AnnotationField {...commun} />;
    case 'ensembles':
      // La réserve d'étiquettes est mélangée par élève : le prof les saisit
      // rangées dans leur ensemble.
      return <EnsemblesField {...commun} graine={graine} />;
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
          // Les affirmations seulement : les colonnes sont une échelle.
          ordre={ordreAffichage(
            (question.matriceItems ?? []).length,
            graine ? `${graine}-${question.id}` : null,
            !question.pasDeMelange
          )}
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
