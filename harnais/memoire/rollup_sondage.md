# Rollup — Sondage en direct

Chantier du **2026-09-08** (soir), mené d'un bloc après la compétition. Plan et
décisions datées : `harnais/plans/2026-09-08-atelier-sondage.md`.

> **État au 2026-09-08** : **écrit, `tsc` et `eslint` propres, pages et routes
> compilées par le serveur de dev (200 / 401 attendus), RIEN VU À L'ÉCRAN.**
> Rien n'est déployé. **JP teste dans la semaine du 2026-09-08** — lui demander
> l'état plutôt que le déduire d'ici. La compétition, elle, se teste en classe le
> 2026-09-09 — ce chantier n'a pas touché à son comportement.

## Ce que c'est

Les **questions de l'auto-évaluation** (emojis, échelle 1→5, matrice, choix sans
bonne réponse, mot, texte), posées **en classe au rythme du professeur** comme
en compétition, et **anonymes**. Un atelier à part entière (`sondage`, dans
`ATELIERS`), sur le dispositif `autoevaluation` — donc le même constructeur.

| | Compétition | Sondage |
|---|---|---|
| Questions | questionnaire de lecture | questionnaire d'auto-évaluation (`devoirs.autoEvalQuiz`) |
| Bonne réponse, score, podium | oui | **non** |
| Phases | salle → question → resultat → revele → finie | salle → question → resultat → finie |
| Chrono | par question, 60 s par défaut | **par question, fixé dans le constructeur** (`chronoSec`, 0 = pas de chrono) |
| Identité | nominative | **anonyme** — ni nom ni uid ne sortent du serveur |
| Trace | copies dans `travaux`, profil | **la manche seule** (onglet Statistiques) |

## Décisions de JP (2026-09-08)

- **Pas de groupes de discussion.** L'anonymat prime ; `groupes.ts` de quizKit
  n'est pas porté. (Le plan les prévoyait ; l'option 4 et l'étape 3 tombent.)
- **Chrono par question, réglé à la construction** — pas « le prof ferme à la main
  par défaut ».
- **Réponses longues retenues**, projetées en **cartes anonymes mélangées**.
- **Aucune trace nominative**, confirmé.

## Comment c'est bâti — ce qui coûterait cher à redécouvrir

- **Une manche de genre `sondage`** dans la même collection `manches`
  (`genre: 'sondage'`), même sous-collection de réponses. `ouvrirSondage` appelle
  `ouvrirManche` puis pose le genre.
- **`sondage-server.ts` importe la plomberie de `manche-server.ts`** — cinq
  fonctions passées en `export` (`Entree`, `entree`, `effectif`, `reponsesA`,
  `effacerReponses`), **aucune ligne de comportement changée**, à une exception
  près : ⚠ **`reponseVide()` reconnaît désormais `echelon` et `likert`**. Sans
  ces deux lignes, le cache partagé jetait un emoji choisi ou un cran d'échelle
  comme réponse « vide ». Une réponse de lecture ne porte jamais ces champs.
- **Routes à part** (`/api/sondage/{etat,pilote,reponse}`), miroir des routes du
  direct : la route la plus appelée du projet n'a pas bougé la veille du test
  en classe.
- **`useDirect` prend une `base`** et un type de vue générique (`SondageVue`) —
  une ligne d'appel dans les composants, rien de changé pour la compétition.
- **`AutoEvalReponse`** : le champ de réponse a été **extrait** d'`AutoEvalActivity`
  et exporté (comme `QuestionCard` pour la compétition). `AutoEvalActivity` l'appelle
  désormais — c'est une extraction pure, mais l'auto-évaluation n'a pas été
  rouverte à l'écran depuis.
- **Le questionnaire est lu sur l'activité** avec un cache de 5 s
  (`quizDuSondage`) : pas de bibliothèque, pas de figeage.
- **Anti-fuite** : l'élève ne reçoit pas `autoEvalQuiz` quand l'atelier est
  `sondage` (`/api/devoirs`, `/api/devoirs/[id]`). Les questions arrivent une à
  une par `/api/sondage/etat`.
- **Le bilan part au prof à chaque interrogation** (une fois par seconde, un
  seul client) : toutes les questions posées et leur répartition, la courante
  seulement une fois close. Il n'y a rien de nominatif dedans.
- **Constructeur** : prop `sondage` sur `AutoEvalBuilder` → chrono dans l'entête
  (à la place de « obligatoire »), gestes et texte d'accompagnement rangés, textes
  d'aide réécrits. `chronoSec` nettoyé côté serveur (0 → 600).
- **Carte et popup** : `estSondage()` → pas d'échéance, pas de copies, pas de
  bascule « Travail disponible » (c'est « Ouvrir le sondage » qui ouvre la
  classe, comme en compétition), pas de corrigé ; lien « 📊 Lancer le sondage »
  → `/sondage/{sessionId}`.

## Formes de la répartition (`SondageRepartition`)

| Type | Projeté |
|---|---|
| Choix multiple | Les cases, lettre, pastille, barre de part ; la majoritaire en relief |
| Réponse courte | Nuage de mots |
| Réponse longue | Cartes anonymes, mélangées côté serveur |
| Compétence · Émotion | Les cinq emojis, pastille sous chacun |
| Échelle 1→5 | Cinq colonnes, pastille, moyenne |
| Échelle à items · Matrice | Tableau, cellules teintées selon la part de la ligne |
| Bloc informatif | Rien |

Aucune couleur de jugement — il n'y a rien à juger.

## À essayer à la reprise

1. **Créer un sondage** : atelier « Sondage en direct » dans la création
   d'activité → le constructeur affiche ⏱ sur chaque question, sans
   « obligatoire ». Enregistrer, rouvrir en édition : le chrono tient.
2. **Carte** : « 📊 Lancer le sondage » → popup → « 📊 Lancer » sur la classe →
   `/sondage/SES-…` → « Ouvrir le sondage ».
3. **Élève** (compte `p1Fd0…`, classe `CLS-mn6br10y-ya1vka`) : ouvrir
   l'activité → salle d'attente → la question tombe → Envoyer → « Réponse
   envoyée ✓ ».
4. **Prof** : compteur, « Arrêter la question » → répartition projetée, et la
   même chez l'élève ; onglet Statistiques → le bilan.
5. **Les sept types** un par un — seul le chemin a été relu, aucun n'a été vu.
6. **L'auto-évaluation ordinaire** encore une fois : `AutoEvalReponse` en est
   extrait.
