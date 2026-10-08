// Les consignes données à Claude pour chaque section d'une lecture de cours.
// SERVEUR UNIQUEMENT (importé par la route de génération).
//
// Architecture des appels (cache de prompt) :
//   system = PRÉAMBULE (règles de niveau, stable) + TEXTE DU COURS (mis en cache)
//   user   = la consigne de la section
// Le texte est identique à l'octet près d'une section à l'autre : les cinq
// appels suivants le lisent depuis le cache.

import { langueLabel } from '@/types/niveaux-fle';
import type { SectionCle } from '@/types/lecture-cours';

// Combien d'aides, et quelle longueur de phrase, selon le niveau CECR
function reglesDuNiveau(niveau: string): string {
  switch (niveau) {
    case 'pre-a1':
    case 'a1':
      return `NIVEAU A1 (débutant). Phrases très courtes (8 mots au plus), présent de l'indicatif, vocabulaire de base. Presque chaque mot qui n'est pas du vocabulaire élémentaire reçoit une aide entre parenthèses, juste après lui.`;
    case 'a2':
      return `NIVEAU A2. Phrases courtes (12 mots au plus), une idée par phrase. Aide entre parenthèses pour tout mot peu fréquent, abstrait ou technique — environ un mot sur cinq.`;
    case 'b1':
      return `NIVEAU B1. Phrases simples mais complètes. Aide entre parenthèses pour les mots abstraits, techniques ou rares du cours — environ un mot sur dix.`;
    case 'b2':
      return `NIVEAU B2. Français courant. Aide entre parenthèses seulement pour les termes techniques ou rares.`;
    default:
      return `NIVEAU C1/C2. Français courant, aides entre parenthèses réservées aux termes spécialisés.`;
  }
}

export function preambule(langue: string, niveau: string): string {
  const aide = langue
    ? `L'aide entre parenthèses est la TRADUCTION du mot en ${langueLabel(langue)} (code « ${langue} »), écrite dans l'alphabet de cette langue. Exemple : « la photosynthèse (الـتمثيل الضوئي) ».`
    : `La langue maternelle de l'élève n'est pas connue : l'aide entre parenthèses est une DÉFINITION très simple en français, de trois à six mots. Exemple : « la photosynthèse (comment la plante fabrique sa nourriture) ».`;
  return `Tu aides un élève allophone (DASPA, Belgique) à lire un cours écrit pour des francophones. Tu écris en français, simplement, avec bienveillance, sans jamais le juger.

${reglesDuNiveau(niveau)}

${aide}
Règle absolue : chaque aide se place entre parenthèses IMMÉDIATEMENT après le mot qu'elle explique, dans la phrase même. Jamais de liste d'aides séparée du texte, sauf là où le format JSON le demande explicitement.

Tu ne commentes jamais le cours (pas de « ce cours parle de… ») : tu le rends lisible. Tu restes fidèle au contenu du cours ; tu n'inventes aucun fait. Tu réponds UNIQUEMENT en JSON brut, sans texte autour, sans balise de code : la réponse commence par { et finit par }.`;
}

export function contexteCours(titre: string, texte: string): string {
  return `═══ LE COURS À LIRE — « ${titre} » ═══\n\n${texte}`;
}

function nbMotsVocabulaire(niveau: string): number {
  if (niveau === 'pre-a1' || niveau === 'a1') return 8;
  if (niveau === 'a2') return 10;
  if (niveau === 'b1') return 12;
  return 15;
}

export function consigneSection(cle: SectionCle, ctx: { langue: string; niveau: string }): string {
  const nomLangue = ctx.langue ? langueLabel(ctx.langue) : '';
  switch (cle) {
    case 'resume':
      return `SECTION 1 — LE COURS EN BREF.
Résume le cours en DIX LIGNES AU MAXIMUM (une ligne ≈ une phrase courte). Garde l'ordre du cours. Mets les aides entre parenthèses selon les règles du niveau.
JSON : {"texte": "<le résumé, une phrase par ligne, lignes séparées par \\n>"}`;

    case 'saillants':
      return `SECTION 2 — LES DIX POINTS IMPORTANTS.
Donne les DIX points les plus importants du cours (moins si le cours est très court), chacun en UNE phrase, dans l'ordre du cours. Mets les aides entre parenthèses dans la phrase, ET recopie ces mêmes aides dans le tableau "aides" du point (mot → aide).
JSON : {"points": [{"texte": "<la phrase, avec ses parenthèses>", "aides": [{"mot": "<mot du cours>", "traduction": "<l'aide>"}]}]}`;

    case 'vocabulaire':
      return `SECTION 3 — LE VOCABULAIRE.
Choisis les ${nbMotsVocabulaire(ctx.niveau)} mots ou expressions du cours les plus utiles à ce niveau pour comprendre le cours (mots-clés de la matière d'abord, puis mots de la langue de l'école). Pour chacun : ${
        nomLangue ? `sa traduction en ${nomLangue}` : 'une traduction vide ""'
      }, une définition très simple en français (dix mots au plus, adaptée au niveau), et une phrase d'exemple courte tirée du cours ou proche du cours. Le mot est donné à sa forme de dictionnaire, avec son article pour un nom (« la cellule »).
Ajoute ensuite les EXERCICES sur ces mots, au format de l'extension Daspalecte :
- "matching" : une paire par mot, "fr" = le mot, "tr" = ${nomLangue ? `sa traduction en ${nomLangue}` : 'sa définition simple (3 à 5 mots)'} ;
- "tags" : une phrase par mot (6 à 12 mots, au niveau de l'élève, proche du cours) où le mot est remplacé par ___, et "word" = le mot exact attendu (à la forme employée dans la phrase, sans article) ;
- "cloze" : une AUTRE phrase par mot, même principe (___ et "answer" = le mot attendu, un seul mot, sans article) ;
- "family" : pour 4 à 6 des mots, "mainWord" = le mot, "related" = 2 à 4 mots de la même famille (dérivés, même racine) ;
- "reading" : un texte court (60 à 100 mots, au niveau de l'élève) qui réemploie au moins la moitié des mots, pour une lecture à voix haute ;
- "test" : un TEST DE LECTURE sur le cours lui-même : 10 questions à choix multiple (4 options, une seule juste, "correct" = index de la bonne option), au niveau de l'élève, qui vérifient la compréhension du cours, de la plus simple à la plus difficile.
JSON : {"mots": [{"mot": "<mot>", "traduction": "<traduction>", "definitionSimple": "<définition>", "exemple": "<phrase>"}], "exercices": {"matching": {"pairs": [{"fr": "<mot>", "tr": "<traduction>"}]}, "tags": {"items": [{"sentence": "<phrase avec ___>", "word": "<mot>"}]}, "cloze": {"items": [{"text": "<phrase avec ___>", "answer": "<mot>"}]}, "family": {"items": [{"mainWord": "<mot>", "related": ["<mot>", "<mot>"]}]}, "reading": {"text": "<texte>"}, "test": {"questions": [{"question": "<question>", "options": ["<a>", "<b>", "<c>", "<d>"], "correct": 0}]}}}`;

    case 'reformulation':
      return `SECTION 4 — LE COURS, PARTIE PAR PARTIE.
Découpe le cours en TROIS à CINQ parties qui suivent son ordre. Pour chaque partie : un titre court, puis le contenu REFORMULÉ au niveau de l'élève (aides entre parenthèses ; pas plus de 120 mots par partie pour A1/A2, 200 pour B1 et au-delà), puis DEUX ou TROIS questions de compréhension sur CETTE partie, de difficulté adaptée au niveau :
- "qcm" : énoncé, 3 choix, index du bon choix dans "bonne" ;
- "vrai-faux" : énoncé affirmatif, "bonne" = 0 pour vrai, 1 pour faux ;
- "ouverte" : une question courte dont la réponse est dans la partie, avec "exempleReponse" (une phrase).
Chaque question porte une courte "aide" (le mot difficile de l'énoncé, traduit ou expliqué). Varie les types.
JSON : {"parties": [{"titre": "<titre>", "texte": "<reformulation>", "questions": [{"type": "qcm", "enonce": "<énoncé>", "choix": ["<a>", "<b>", "<c>"], "bonne": 0, "aide": "<aide>"}, {"type": "vrai-faux", "enonce": "<affirmation>", "bonne": 1, "aide": "<aide>"}, {"type": "ouverte", "enonce": "<question>", "exempleReponse": "<réponse>", "aide": "<aide>"}]}]}`;

    case 'grammaire':
      return `SECTION 5 — DES PHRASES À LA LOUPE.
Choisis CINQ phrases du cours (moins si le cours est court) qui sont difficiles pour l'élève par leur construction : phrase longue, subordonnée, passif, pronoms, participe, nominalisation… Recopie chaque phrase telle quelle. Découpe-la en SEGMENTS qui se suivent et recomposent exactement la phrase (sujet, verbe, complément, subordonnée, connecteur…), avec pour chacun sa FONCTION en un ou deux mots simples et une EXPLICATION d'une phrase courte au niveau de l'élève (aides entre parenthèses). Termine par une explication d'ensemble : « pourquoi cette phrase est difficile et comment la lire ».
Ajoute un ARBRE de la phrase, emboîté : la racine est la phrase entière (label = « Phrase »), ses enfants sont les grands groupes (« Sujet : les plantes vertes », « Verbe : fabriquent », « Complément : leur nourriture »…), et une subordonnée ou un groupe complexe se découpe à son tour en enfants. Trois niveaux au plus, 12 nœuds au plus ; chaque label commence par la fonction, deux-points, puis les mots exacts de la phrase.
JSON : {"phrases": [{"phrase": "<phrase du cours>", "segments": [{"texte": "<segment>", "fonction": "<fonction>", "explication": "<explication>"}], "explication": "<explication d'ensemble>", "arbre": {"label": "Phrase", "enfants": [{"label": "Sujet : …", "enfants": []}, {"label": "Verbe : …"}]}}]}`;

    case 'passerelle':
      return `SECTION 6 — ET DANS MON PAYS ?
${
        nomLangue
          ? `L'élève parle ${nomLangue}. Il est arrivé en Belgique récemment (classe DASPA). Choisis le PAYS ou la RÉGION d'où vient le plus probablement un élève de cette langue (par exemple : dari ou pashto → Afghanistan ; ukrainien → Ukraine ; arabe → Syrie, Irak, Maroc… ; kurde → Kurdistan ; turc → Turquie ; roumain → Roumanie ou Moldavie ; russe → Russie ou pays voisins…), nomme-le dans "pays", et REGARDE LE THÈME DU COURS DEPUIS CE PAYS`
          : `La langue de l'élève n'est pas connue : choisis une autre région du monde, nomme-la dans "pays", et regarde le thème du cours depuis cette région`
      } : que s'est-il passé LÀ-BAS sur le même sujet, à la même époque ? Quels lieux, quels exemples, quelles figures, quels mots, quelles pratiques de ce pays font écho à ce que dit le cours ? Chaque passerelle part d'un élément PRÉCIS du cours et le relie à un élément PRÉCIS du pays (un lieu, une date, un nom, une habitude, un mot). Crée des PASSERELLES vraies et vérifiables (si tu n'es pas sûr d'un fait, ne l'écris pas). Écris en français au niveau de l'élève, aides entre parenthèses${
        nomLangue ? `, et cite un mot ou un nom en ${nomLangue} quand il éclaire la passerelle` : ''
      }. Une intro de deux phrases qui nomme le pays, puis DEUX à QUATRE passerelles (titre + paragraphe de 60 à 100 mots), puis UNE question ouverte qui invite l'élève à raconter ce qu'il sait de chez lui sur ce thème.
JSON : {"intro": "<intro>", "pays": "<pays ou région>", "paralleles": [{"titre": "<titre>", "texte": "<paragraphe>"}], "question": "<question>"}`;

    case 'resumeEleve':
      // Jamais générée : l'élève écrit, Claude juge à la demande (consigneAvisResume)
      return '';
  }
}

// ── Corrections à la demande ──

// Le texte libre de l'élève (réponse à la passerelle), phrase par phrase
export function consigneCorrectionTexte(texte: string, ctx: { langue: string; niveau: string }): string {
  return `CORRECTION D'UN TEXTE DE L'ÉLÈVE (niveau ${ctx.niveau.toUpperCase()}${ctx.langue ? `, langue maternelle ${langueLabel(ctx.langue)}` : ''}).
Voici ce que l'élève a écrit en réponse à la question « Et dans ton pays ? » :
« ${texte} »

Découpe son texte en PHRASES (telles qu'il les a écrites). Pour chaque phrase :
a) "remarques" : ce qui va et ce qui ne va pas du point de vue de la GRAMMAIRE française et du LEXIQUE (accords, temps, articles, prépositions, mot mal choisi, structure…), en une à trois phrases simples, bienveillantes, au niveau de l'élève (aides entre parenthèses) ; si la phrase est correcte, dis-le ;
b) "reformulation" : la MÊME idée, bien dite, dans une phrase correcte et naturelle au niveau de l'élève.
Termine par un "commentaire" d'ensemble : deux phrases d'encouragement et le point principal à travailler.
JSON : {"phrases": [{"phrase": "<phrase de l'élève>", "remarques": "<remarques>", "reformulation": "<phrase correcte>"}], "commentaire": "<commentaire>"}`;
}

// Le résumé de l'élève, comparé au cours (le cours est dans le contexte mis en cache)
export function consigneAvisResume(resume: string, ctx: { langue: string; niveau: string }): string {
  return `AVIS SUR LE RÉSUMÉ DE L'ÉLÈVE (niveau ${ctx.niveau.toUpperCase()}${ctx.langue ? `, langue maternelle ${langueLabel(ctx.langue)}` : ''}).
L'élève a lu le cours ci-dessus et a écrit ce résumé de ce qu'il a compris :
« ${resume} »

Compare son résumé AU COURS.
a) Le repérage des idées importantes : "ideesVues" = les idées importantes du cours que son résumé a bien repérées (une par ligne, courtes) ; "ideesManquantes" = celles qui manquent ou sont mal comprises. "avis" = "positif" (l'essentiel y est), "mitige" (une partie), ou "negatif" (l'essentiel manque ou est faux). "commentaire" : trois phrases simples et bienveillantes qui disent cet avis et ce qu'il faut relire.
b) La grammaticalité de ses phrases : liste SEULEMENT les phrases problématiques, telles qu'il les a écrites : "probleme" = ce qui ne va pas, lexicalement ou grammaticalement, en termes simples (aides entre parenthèses) ; "exemples" = deux exemples de bonne phrase pour la même idée, au niveau de l'élève. Si aucune phrase ne pose problème, "phrases" est vide.
JSON : {"avis": "positif", "commentaire": "<commentaire>", "ideesVues": ["<idée>"], "ideesManquantes": ["<idée>"], "phrases": [{"phrase": "<phrase de l'élève>", "probleme": "<ce qui ne va pas>", "exemples": ["<phrase>", "<phrase>"]}]}`;
}

// Vérification minimale de la forme renvoyée — on refuse ce qui n'a pas le
// squelette attendu, le reste est rendu tel quel
export function contenuValide(cle: SectionCle, data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  switch (cle) {
    case 'resume':
      return typeof d.texte === 'string' && d.texte.trim().length > 0;
    case 'saillants':
      return Array.isArray(d.points) && d.points.length > 0;
    case 'vocabulaire':
      return Array.isArray(d.mots) && d.mots.length > 0;
    case 'reformulation':
      return Array.isArray(d.parties) && d.parties.length > 0;
    case 'grammaire':
      return Array.isArray(d.phrases) && d.phrases.length > 0;
    case 'passerelle':
      return typeof d.intro === 'string' && Array.isArray(d.paralleles);
    case 'resumeEleve':
      return true;
  }
}
