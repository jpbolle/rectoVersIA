# 2026-09-07 — Mode « Compétition » : le questionnaire au rythme du prof

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-09-07 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **proposé** — les quatre points ouverts ont été tranchés par JP le
  2026-09-07 (voir la dernière section).
- **Remplace** le plan [`2026-09-01-direct-sondage-quiz.md`](2026-09-01-direct-sondage-quiz.md),
  qui prévoyait un 6ᵉ dispositif `direct` et le transport en SSE. Les deux décisions
  sont abandonnées : voir « Options ».
- **Demande initiale** : « Ajouter une activité de type sondage ou questionnaire
  ludique. Plus j'y réfléchis, plus je crois que c'est une variante de l'actuel
  questionnaire de lecture, qui possède déjà les modes quiz / worksheet et qui
  posséderait un 3ᵉ mode **Compétition**. » Puis, après échange : « **Compétition :
  au rythme du prof ; c'est ce qui le distingue de worksheet ou quiz.** »

## Le problème

Rien dans Recto-versIA n'est **synchrone**. Les six ateliers supposent un élève seul
devant son travail, à son rythme. Le geste le plus courant du cours — poser une
question à toute la classe au même instant et voir les réponses tomber — n'a
aucune place dans l'application.

Le questionnaire de lecture sait pourtant déjà tout le reste : composer des
questions, les servir sans leur corrigé, les corriger automatiquement, les faire
remonter au profil de l'élève. Il ne lui manque **que le tempo**.

## Ce qui change, et ce qui ne change pas

Un troisième mode s'ajoute aux deux existants. **C'est le seul axe qui bouge.**

| Mode | Qui décide de la question suivante | Existe ? |
|---|---|---|
| `worksheet` | l'élève — toutes les questions à l'écran | ✅ |
| `quiz` | l'élève — une à la fois, sans retour en arrière | ✅ |
| **`competition`** | **le prof — toute la classe sur la même question, au même instant** | **neuf** |

Tout le reste est du réemploi : les types de questions, la correction automatique
(`lecture-scoring.ts`), la bibliothèque de questionnaires, les images et les audios
joints, et surtout les **sessions** livrées le 2026-09-01 — une **manche** n'est rien
d'autre que l'état en direct d'une session, donc d'un couple (activité × classe).

## Options

### 1 — Le transport : comment la question arrive chez 25 élèves en même temps

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Flux poussé (SSE)** — le serveur garde une ligne ouverte et pousse | Le vrai temps réel | ⚠ Un proxy qui met le flux en tampon sur le VPS le rend muet. Non vérifiable sans y aller |
| **B — Interrogation courte (1 s) + départ programmé** — le navigateur demande « du neuf ? » chaque seconde ; le serveur ne répond pas « voici la question » mais « **la question N démarre à telle heure** », 2 s plus tard | Marche partout, aucun risque de proxy. Le décalage de l'interrogation devient **invisible** : tous les navigateurs ont la question d'avance et l'affichent au même instant | ~25 requêtes/s sur le VPS, et un cache mémoire de 500 ms côté serveur qui évite 95 % des lectures Firestore |
| **C — Firestore en direct depuis le client** (modèle quizKit) | Déjà écrit | ❌ Contre la règle du projet : aucun accès Firestore client aux données d'élèves |

**Retenue : B**, parce que le départ programmé rend l'équité du chrono indépendante
du transport. C'est ce qui permet de commencer **ce soir** sans sonde technique et
sans dépendre du VPS. A reste ouvert plus tard, pour l'extension.

### 2 — Où vit l'état de la manche

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Un champ sur le document de session** | Rien de neuf à créer | ❌ La session est lue dans toutes les listes du prof ; on y écrirait plusieurs fois par minute pendant une partie |
| **B — Collection `manches`, un document par session** (`MAN-{sessionId}`), réponses en sous-collection | Isolé, jetable, sans effet sur l'existant | Une collection de plus. Accès **serveur uniquement**, donc aucune règle Firestore à déployer |

**Retenue : B.** L'identifiant est déduit de la session (comme `sessionId()`), donc
un double clic sur « Ouvrir la manche » ne peut pas créer deux parties.

### 3 — Un écran de projection séparé ?

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Deux écrans** (le prof pilote sur son portable, la classe voit le tableau) | L'ergonomie de Kahoot | Suppose deux affichages indépendants — au Collège, le projecteur **recopie** l'écran du prof |
| **B — Un écran, deux zones** : la question en grand, une barre de pilotage discrète en bas | Correspond au matériel réel | La classe voit la barre de pilotage. Sans importance : elle ne révèle rien |

**Retenue : B**, avec un bouton « Masquer les commandes » pour les moments où le
prof ne veut rien laisser voir.

### 4 — Les types de questions retenus en mode Compétition

Onze types existent aujourd'hui. **Sept sont retenus** (décision de JP, 2026-09-07) :

| Retenu | Type | Remarque |
|---|---|---|
| ✅ | **Choix multiple**, à une ou plusieurs réponses | + image jointe. Le cœur du jeu |
| ✅ | **Réponse courte** | Corrigée seule via les `reponsesAcceptees` du prof. **Sans cette liste, la question ne peut pas être cotée en direct** — le constructeur doit le dire |
| ✅ | **Appariement** | ≤ 4 paires pour tenir en une minute |
| ✅ | **Remise en ordre**, courte | ≤ 5 items |
| ✅ | **Image à annoter** | Le plus lent au trackpad — c'est au prof d'allonger son chrono |
| ✅ | **Ensembles** | |
| ✅ | **Bloc informatif** | La « diapo » entre deux questions : le prof introduit, personne ne répond, pas de chrono |
| ❌ | Réponse longue | Ne se corrige pas toute seule : pas de score, donc pas de podium |
| ❌ | Souligner du texte / Fluorage par catégories | Écartés par JP |
| ❌ | Matrice | Écartée par JP |

⚠ **Le mélange des propositions** est coupé pour le **choix multiple** seulement —
c'est là qu'il gênait (le prof dit « c'était la B » alors que chacun a vu son ordre).
Pour la remise en ordre, l'image à annoter et les ensembles, le mélange **est** la
question : le prof saisit ses items dans le bon ordre, le supprimer donnerait le
corrigé. Il reste donc en place, avec la graine habituelle.

### 5 — Le score

| Option | Ce que ça implique |
|---|---|
| **A — Le plus rapide gagne** | Enseigne à bâcler |
| **B — Vitesse dégressive** : une bonne réponse rapporte de **100 % à 50 %** de son barème selon le temps mis ; une mauvaise réponse rapporte 0 quel qu'il soit | Une bonne réponse lente vaut toujours mieux qu'une mauvaise rapide |

**Retenue : B** *(confirmée par JP : « au cours de français, il faut du temps pour
répondre »)*. Le **barème partiel** existant (appariement, ordre, ensembles) se
multiplie par le même facteur de vitesse.

**Série (streak)** : bonus croissant aux bonnes réponses consécutives, plafonné.
Cassée par une mauvaise réponse ou une absence de réponse.

## Ce qu'on fait

Six étapes, chacune se termine sur **quelque chose de visible à l'écran**.

| Étape | Contenu | Ce que JP voit |
|---|---|---|
| **1** | Le squelette du direct : collection `manches`, routes `/api/direct/{etat,pilote,reponse}`, cache mémoire 500 ms, départ programmé. Une seule question en dur | **Deux navigateurs côte à côte** : la question apparaît au même instant sur les deux |
| **2** | Mode `competition` dans le constructeur : filtre des sept types, **chrono par question** (60 s par défaut), **feedback par mauvaise réponse** (facultatif — aucun champ obligatoire) | Le prof compose son questionnaire de compétition |
| **3** | La manche complète : ouvrir sur une session, lancer / **stopper avant la fin** / révéler, compteur « 12 / 24 réponses reçues », écran élève | **Jouable en classe**, sans score |
| **4** | Score (vitesse dégressive + série), **podium 1 / 3 / 5 / 10 au choix**, classement général, révélation de la bonne réponse et du feedback | Le jeu complet |
| **5** | Versement de la manche dans `travaux` (les réponses ont déjà la forme `LectureAnswersState`) → la correction, l'onglet Évaluation et le profil de l'élève fonctionnent **sans une ligne de plus**. Onglet **Statistiques** du prof | Qui a répondu, qui n'a rien répondu, qui répond vite et faux |
| **6** | **Équipes** : `groupes.ts` de quizKit porté, score agrégé par équipe | |

### Fichiers principaux touchés

- `src/types/lecture.ts` — `LectureQuizMode` gagne `'competition'` ; `LectureQuestion`
  gagne `chronoSec?` et `feedbackParChoix?`
- `src/types/manche.ts` **(neuf)** — état de la manche, phases, score
- `src/lib/manche-server.ts` **(neuf)** — pilotage, cache mémoire, calcul du score
- `src/app/api/direct/{etat,pilote,reponse}/route.ts` **(neuf)**
- `src/components/QuestionCard/` **(extraction)** — aujourd'hui enfermée dans
  `LectureQuizActivity.tsx:210`. La sortir pour que l'écran de direct, l'écran actuel
  et le futur popup de l'extension affichent **la même carte**
- `src/components/CompetitionPilote/` **(neuf)** — l'écran du prof
- `src/components/CompetitionActivity/` **(neuf)** — l'écran de l'élève
- `src/components/LectureQuizBuilder/` — réglages du mode compétition

## Ce qu'on ne fait pas dans ce chantier

- **Le sondage.** C'est un **atelier à part entière**, **toujours anonyme** — donc
  sans groupes par réponse, les deux s'excluant. Il se rapproche du questionnaire
  d'**auto-évaluation** (pas de bonne réponse, échelle 1→5, emojis) bien plus que du
  questionnaire de lecture. Chantier suivant, plan séparé.
- **L'extension NavigKid.** Le direct vit d'abord dans l'app : c'est ce qui permet de
  développer et de tester sans attendre l'examen du Chrome Web Store.
- **Aucune note certificative.** Un podium de rapidité n'est pas une cote : la
  compétition reste **formative**. Pas de ceinture, pas d'UAA certifiée.
- **On ne touche pas à l'échelle d'évaluation** (les 6 niveaux).
- **On ne migre rien de quizKit** — seul `groupes.ts` sera porté, à l'étape 6.
- **Pas de classement au-delà du 10ᵉ côté élève.** Le bas du classement n'est jamais
  affiché : ce sont des mineurs, en classe, devant leurs camarades. Le prof, lui, voit
  tout — dans son onglet Statistiques.

## Comment on saura que ça marche

Le prof ouvre une manche pour la 4C depuis l'activité. Sur deux Chromebooks, la
question apparaît **au même instant**, avec le même chrono. Les élèves répondent ;
le compteur du prof monte « 17 / 24 ». Le prof coupe avant la fin, révèle la bonne
réponse, et le podium des trois plus rapides s'affiche. À la fin, la copie de chaque
élève est consultable dans l'écran de correction habituel.

## L'écran d'une question à choix multiple (décidé le 2026-09-07, en cours d'étape 1)

**Pendant que la question court** : les propositions en **grandes cases, deux par
ligne**, se visant d'un coup d'œil depuis le fond de la classe et se cliquant au
doigt sur un Chromebook.

⚠ Les quatre teintes **excluent le vert et le rouge** — ce n'est pas un goût. Ces
deux couleurs sont réservées à la révélation : une case verte pendant que la
question court se lirait comme la bonne réponse. Retenues : bleu ardoise, ambre
(l'accent Classica), violet prune, brun cannelle. Chaque case porte en plus une
**forme** (▲ ◆ ● ■) : elle nomme la case à voix haute (« la case losange ») et
reste lisible pour un élève qui distingue mal les couleurs.

**À la révélation**, la disposition change — c'est la bonne réponse qu'on
regarde, pas la place qu'elle occupait :

| | |
|---|---|
| **Première ligne** | la **bonne réponse**, seule, en **vert** |
| **Deuxième ligne** | les autres, alignées à largeur égale — **en rouge** celle que CET élève avait choisie, **en gris** celles qu'il avait écartées (elles restent lisibles : il doit pouvoir relire ce qu'il n'a pas pris) |

Conséquence serveur : le corrigé part à l'élève **en phase `resultat` seulement**.
C'est sans risque — `enregistrerReponse` n'accepte que la phase `question`, donc
la question est close quand la bonne réponse arrive.

## Le questionnaire est une RESSOURCE — ce qui appartient à l'activité

Question de JP en cours d'étape 2, et elle a rouvert la conception : un
questionnaire de la bibliothèque sert **plusieurs activités**. Tout ce qui décrit
*comment cette activité-ci s'en sert* doit donc vivre sur l'**activité**, jamais
sur la ressource.

| Champ | Sur | Pourquoi |
|---|---|---|
| `devoirs.lectureMode` | l'activité | Sinon passer une révision en compétition changerait aussi la présentation du diagnostic qui réutilise le même questionnaire |
| `devoirs.hiddenQuestions` | l'activité | L'œil ferme une question **pour cette activité**. Même précédent que `hiddenCriteria` (critères de grille masqués par devoir) |

Options écartées : mettre le mode sur la **session** (compétition avec la 4C,
worksheet en rattrapage pour la 4D). JP préfère créer une seconde activité
pointant vers le même questionnaire. Si le besoin revient, il se pose
**par-dessus** ces champs sans rien casser.

⚠ Deux pièges rencontrés en écrivant ceci :
- **La ligne « Présentation » devait sortir du constructeur.** En piochant un
  questionnaire dans la bibliothèque, le constructeur ne s'ouvre pas — ces
  activités-là n'avaient donc aucun moyen de choisir leur mode. D'où
  `LectureModeRow`, affichée dans les deux cas.
- **Le prof doit continuer à voir ce qu'il a masqué.** Filtrer les questions
  écartées partout les rendait irrécupérables. `quizDuDevoir` filtre **par
  défaut** (une erreur d'inattention sert alors moins que prévu, jamais plus) et
  les écrans de réglage du prof demandent explicitement `{ complet: true }`.

## À faire à l'étape 3 — choisir ses questions en direct

Demande de JP (2026-09-07) : pendant la partie, le prof choisit **quelle question
il pose**, et celles déjà posées se barrent dans sa liste. C'est le pendant
*improvisé* de l'œil, qui est lui la *préparation* — les deux se complètent, ils
ne font pas doublon. Côté serveur, `piloterManche('lancer')` avancera d'un rang
par défaut mais acceptera un index.

## Décisions prises en écrivant l'étape 3 (2026-09-07)

- **`QuestionCard` est exportée, pas déplacée.** Le mode Compétition affiche la
  MÊME carte que le questionnaire ordinaire pour les six types manipulés — deux
  rendus parallèles divergeraient au premier ajustement. Elle reste dans
  `LectureQuizActivity.tsx`, dont elle utilise `QuestionAudio`, `ImageWorkspace`
  et tout le module de styles ; `FluoExtrait` y est déjà partagée ainsi.
  **Le QCM fait exception** : il se joue en cases pleines colorées
  (`CompetitionQcm`), qu'on lit du fond de la classe.
- **Deux façons de répondre.** QCM à réponse unique : le clic EST la réponse.
  Tout le reste : on manipule, puis on envoie — ces types se construisent en
  plusieurs gestes, partir au premier serait absurde.
- **Un seul écran pour le prof**, question en haut, pilotage en bas : au
  Collège, le projecteur RECOPIE l'écran du professeur, les deux écrans de
  Kahoot n'ont pas de sens ici.
- **Le sommaire reste cliquable sur une question déjà posée** (barrée) : on
  repose une question quand la classe n'a rien compris.
- **Porte d'entrée du prof** : le lien des sessions sur la carte de l'activité,
  qui devient « 🏁 Lancer une partie » et s'affiche **même avec une seule
  classe** — on joue toujours AVEC une classe donnée.
- ⚠ **Fuite bouchée** : l'activité livrait les trente-neuf questions au
  navigateur de l'élève dès son ouverture (corrigé retiré, mais lisibles dans
  l'onglet réseau une heure avant la partie). En compétition, l'élève ne reçoit
  plus AUCUNE question à l'ouverture — elles arrivent une à une par
  `/api/direct/etat` (`lectureQuizEnDirectPourEleve`).

## Ce que le FIGEAGE d'une session protège — et ce qu'il ne protège pas

Corrigé le 2026-09-07 après un essai en vraie activité : le questionnaire figé
d'une session emportait aussi son **mode**, si bien qu'une activité déjà ouverte
une fois ne pouvait plus passer en compétition — l'élève recevait le
questionnaire entier en worksheet.

| Figé | Pourquoi |
|---|---|
| Les **questions** | Une retouche dans la bibliothèque ne doit pas changer l'épreuve sous les yeux d'une classe qui la passe |
| Le **mode** — NON | Ce n'est pas du contenu : c'est la façon de jouer, et elle vit sur l'activité |
| Les **questions écartées** (`hiddenQuestions`) — NON appliquées à une copie figée | Une question déjà posée ne doit pas disparaître en cours d'épreuve |

Au passage, deux routes rattrapées : `/api/travaux/mine` et `/api/travaux`
lisaient le seul drapeau `disponible` de l'activité et **ignoraient les
sessions** — elles étaient restées en arrière du chantier du 2026-09-01. Le
symptôme (« Ce devoir n'est pas disponible » alors que le prof vient d'ouvrir)
touchait déjà tous les dispositifs, pas seulement la compétition.

## Trois moments dans une question, et pas deux (2026-09-07)

Demande de JP en cours d'étape 3, et elle ajoute un temps au jeu :

| Moment | Ce qu'on voit |
|---|---|
| `question` | La question court, le chrono descend |
| `resultat` | Elle est close. On montre **ce que la classe a répondu** — barres par proposition pour un QCM, nuage de mots pour une réponse courte, **rien du tout** pour les types qu'on ne sait pas résumer en dix secondes (appariement, remise en ordre, ensembles, image annotée) |
| `revele` | Le prof a cliqué **« Révéler les réponses »** : la bonne réponse apparaît |

**Pourquoi** : livrer la bonne réponse au coup de sifflet ferme la seule minute
où la classe se demande encore qui a raison. La répartition ne porte donc
**aucune couleur de jugement** — ni vert ni rouge, ils sont réservés à la
révélation.

Côté serveur, le corrigé ne part plus en `resultat` : seulement en `revele` (et
au prof, qui projette). La répartition est tenue **au fil des envois** dans le
cache mémoire — la recalculer en relisant les copies coûterait une lecture par
élève, deux fois par seconde.

## L'écran du prof passe à deux colonnes (2026-09-07)

Sur la demande de JP, l'écran de jeu adopte la structure habituelle côté
professeur (`ResizableSplit`) :

- **à gauche, l'espace de jeu** — la question, le chrono, la barre d'actions.
  C'est cette colonne qui est projetée ;
- **à droite, deux onglets** — **Questions** (le sommaire : on lance celle qu'on
  veut, les posées sont barrées mais restent cliquables) et **Statistiques**
  (questions posées, réponses en cours ; le détail par élève et le podium
  viennent aux étapes 4 et 5).

## Comment s'affichent les réponses de la classe, type par type (2026-09-07)

Principe posé par JP : **on préserve la FORME de la question**. Pas de graphique
à part — la question reste à l'écran telle qu'elle a été jouée, et une
**pastille** y porte le nombre. Les barres génériques de la première version
sont abandonnées.

| Type | Ce qu'on affiche une fois la question close |
|---|---|
| **Choix multiple** | Les encadrés restent. Une **pastille à droite dans chaque encadré** : combien d'élèves l'ont choisi |
| **Réponse courte** | **Nuage de mots**, la taille selon le nombre de réponses |
| **Appariement** | Les deux étiquettes reliées comme dans le jeu, **une pastille au milieu du lien** |
| **Remise en ordre** | La liste ordonnée 1→n. Dans chaque place, **l'étiquette que la classe y a le plus souvent mise**, avec sa pastille |
| **Ensembles** | Les boîtes restent. Un jeton apparaît **dans chaque boîte où des élèves l'ont mis**, avec son compte — un jeton hésitant se voit ainsi dans deux boîtes à la fois, et c'est exactement ce qu'on veut voir |
| **Image à annoter** | **Rien** — l'image est déjà chargée, y superposer des comptes la rend illisible au projecteur |
| **Bloc informatif** | Rien : personne n'y répond |

⚠ Conséquence : `MancheRepartition` ne peut plus être une simple liste de
barres. Elle porte une structure PAR TYPE, et l'affichage réutilise les
composants de jeu (`CompetitionQcm`, `QuestionInteractions/`) plutôt que d'en
dessiner de nouveaux — deux rendus parallèles divergeraient.

## Points tranchés par l'utilisateur (2026-09-07)

- **L'élève qui arrive après le lancement d'une question répond quand même**, avec le
  temps déjà écoulé compté contre lui. « Tant pis » — on ne complique pas le pilotage
  pour les retardataires.
- **Le chrono se règle question par question**, valeur initiale **60 s**. Pas de
  barème de chrono par type : le prof sait mieux que nous ce que sa question demande.
- **Barre d'actions au bas de la colonne 1** (« espace de jeu »), à la forme imposée du
  projet — deux traits horizontaux, boutons verts (agir sur le jeu) puis ambres
  (afficher), ligne qui **ne touche jamais les bords de la colonne**. Deux actions :
  **arrêter la question** avant la fin du chrono, et **arrêter la partie** (la sonnerie
  n'attend pas). Corollaire assumé : la manche vivant sur le serveur, refermer puis
  rouvrir la page **reprend la partie où elle en était** — rien n'est perdu.
- **Pas de degré d'assurance** dans la compétition : les smileys de lucidité restent
  au questionnaire de lecture ordinaire. Une question de plus sous chrono alourdirait
  la réponse au moment où l'élève n'a pas une seconde.
