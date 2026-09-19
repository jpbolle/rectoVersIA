// Ce qu'on envoie à POST /api/devoirs pour DUPLIQUER une activité — partagé
// par le tableau de bord et Mes Ressources › Modules FLE › Activités (2026-09-19 :
// avant, la recette vivait dans la page du tableau de bord).
//
// Côté client : aucune donnée d'identité ici, seulement le contenu de
// l'activité.

import type { CreateDevoirData, Devoir } from '@/types/devoir';

export async function donneesDeCopie(
  devoir: Devoir,
  getAuthHeaders: () => Promise<Record<string, string> | null>
): Promise<CreateDevoirData> {
  // Récupérer le questionnaire si type rechercher
  let questionnaire: CreateDevoirData['questionnaire'] | undefined;
  if (devoir.typeTravail === 'rechercher' && devoir.questionnaireId) {
    const headers = await getAuthHeaders();
    if (headers) {
      const qRes = await fetch(`/api/navigkid/questionnaire?id=${devoir.questionnaireId}`, { headers });
      const qJson = await qRes.json();
      if (qJson.success) {
        questionnaire = {
          themes: qJson.data.theme || '',
          questions: qJson.data.questions || [],
        };
      }
    }
  }

  return {
    intitule: `COPIE - ${devoir.intitule}`,
    grille: devoir.grille,
    classes: [],
    dateRemise: devoir.dateRemise,
    consignes: devoir.consignes || '',
    accesIA: devoir.accesIA,
    disponible: false,
    ressources: devoir.ressources || null,
    typeTravail: devoir.typeTravail || 'ecrire',
    evaluation: devoir.evaluation ?? 'formatif',
    questionnaire,
    // Le verso doit suivre le recto. Sans ces champs, dupliquer une
    // activité de lecture rendait une coquille vide : le questionnaire,
    // les habiletés et le corrigé restaient sur l'original.
    modePrincipal: devoir.modePrincipal,
    atelier: devoir.atelier,
    habiletes: devoir.habiletes ?? null,
    hiddenCriteria: devoir.hiddenCriteria,
    autoEvaluation: devoir.autoEvaluation,
    flipInverted: devoir.flipInverted,
    corrigeReference: devoir.corrigeReference ?? null,
    ressourcesToIA: devoir.ressourcesToIA,
    lectureQuiz: devoir.lectureQuiz ?? null,
    autoEvalQuiz: devoir.autoEvalQuiz ?? null,
    // L'œuvre n'est pas recopiée : elle vit dans la bibliothèque et la
    // copie y renvoie, comme l'original.
    oeuvreId: devoir.oeuvreId ?? null,
    // Séquence FLE : le parcours suit. Les élèves choisis, non : la copie
    // n'a pas de classe (le prof les rechoisit avec la classe)
    sequenceFle: devoir.sequenceFle ?? null,
    // Une activité FLE reste une activité FLE (rangée dans Mes Ressources)
    referentiel: devoir.referentiel === 'fle' ? 'fle' : null,
    oeuvreChapitres: devoir.oeuvreChapitres ?? null,
    oeuvreMinimum: devoir.oeuvreMinimum ?? null,
    vocabulaireConfig: devoir.vocabulaireThemes
      ? { themes: devoir.vocabulaireThemes, diagnostic: devoir.vocabulaireDiagnostic }
      : undefined,
  };
}
