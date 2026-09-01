// ═══ SESSION — une activité MISE EN ŒUVRE dans une classe ═══
//
// Une activité (`devoirs`) dit CE QU'ON FAIT : l'atelier, les consignes, le
// questionnaire, les habiletés. Une session dit QUAND et POUR QUI : une classe,
// une échéance, une ouverture, un corrigé, un archivage.
//
// Pourquoi la séparation (décision du 2026-09-01, cf.
// `harnais/plans/2026-09-01-sessions-par-classe.md`) : `corrigeDisponible`
// était un seul drapeau par activité. Un diagnostic donné à la 4C et à la 4D
// livrait donc le corrigé aux deux dès que la première avait fini — y compris à
// celle qui passait l'épreuve le lendemain.
//
// ⚠ COMPATIBILITÉ — la session n'est PAS obligatoire. Une activité qui n'en a
// pas (document ancien, classe non résolue) garde exactement le comportement
// qu'elle avait : les drapeaux du devoir font foi. C'est ce qui permet de
// migrer sans interrompre la production. Voir `etatEffectif()` dans
// `src/lib/session-server.ts`.

export interface Session {
  /** SES-{devoirId}-{classeId} — déterministe : pas de doublon possible */
  id: string;
  devoirId: string;
  classeId: string;
  /** Nom de la classe, recopié pour l'afficher sans une jointure de plus */
  classeNom: string;
  anneeScolaire: string;
  profId: string;

  /** Échéance propre à cette classe (null = aucune) */
  dateRemise: string | null;
  /** L'activité est ouverte aux élèves de CETTE classe */
  disponible: boolean;
  disponibleAt: string | null;
  /** La correction est visible par les élèves de CETTE classe */
  corrigeDisponible: boolean;
  corrigeDisponibleAt: string | null;
  archive: boolean;

  createdAt: string;
  updatedAt: string;
}

// ⚠ `quizFige` et `quizFigeAt` existent en base sur le document de session,
// mais N'APPARAISSENT PAS dans le type ci-dessus, et c'est délibéré : c'est un
// questionnaire entier (parfois 100 Ko), et la liste des sessions envoyée au
// professeur n'a rien à en faire. Il ne se lit que là où il sert — servir à
// l'élève ce qu'il a réellement eu sous les yeux.
// Écriture : `figerQuizDeLaSession` (src/lib/session-server.ts), à la première
// ouverture de la session, une seule fois, sans resynchronisation possible.
// Lecture : `quizDuDevoir` (src/lib/questionnaire-lecture-server.ts), en
// priorité sur la bibliothèque.

/**
 * Panier des copies qu'aucune session ne réclame — élève supprimé, classe
 * effacée, travail antérieur aux sessions. Ce n'est PAS un id de session :
 * c'est le mot de passe entre l'écran du prof et les routes serveur pour
 * désigner « celles qui ne sont à personne ».
 */
export const SANS_CLASSE = '__sans_classe__';

/** Ce qu'une session accepte de se voir modifier depuis l'interface. */
export type SessionPatch = Partial<
  Pick<Session, 'dateRemise' | 'disponible' | 'corrigeDisponible' | 'archive'>
>;

/**
 * Identifiant déterministe. Le déduire plutôt que le tirer au sort évite
 * qu'un double appel crée deux sessions pour la même classe.
 */
export function sessionId(devoirId: string, classeId: string): string {
  return `SES-${devoirId}-${classeId}`;
}
