# Rollup — La correction d'une copie, et ce qu'elle déclenche

> Session du **2026-09-20**. Tout a été **vu à l'écran et validé par JP** au fil
> de la séance, sauf mention contraire. `npx tsc --noEmit` passe.
> Rien n'est commité ni poussé, rien n'est déployé.

## Le fil rouge : `correction.score` n'existe que pour l'écriture

Un seul défaut expliquait la moitié de la session. **Seule la correction à la
grille écrit `correction.score`.** Un questionnaire de lecture, une recherche
NavigKid, une auto-évaluation n'écrivent que leur carte de notes
(`questionScores`, `rechercheScores`, `autoEvalProf`) : leur total se
**recalcule à l'affichage** (`src/lib/lecture-scoring.ts`) et n'est jamais rangé
en base. Tout ce qui testait `score > 0` se trompait donc en silence.

| Symptôme observé | Cause |
|---|---|
| Aucune copie de lecture n'atteignait jamais la colonne « Corrigés » | tri sur `score > 0` |
| Bulle de % muette sur la carte de l'élève | idem |
| Statistiques de l'activité à 0 / « — » | idem |
| Certification « faite » qui ne se cochait pas | idem, via `copieCorrigee` |

**Le critère retenu, posé avec JP** : une copie est corrigée quand **plus rien
n'attend le professeur**. Écriture → `score > 0` ; questionnaire de lecture →
`scoreLectureQuiz(...).aNoter === 0`. Corollaire assumé : une activité
**entièrement auto-corrigeable** est corrigée dès la remise.

⚠ Ce test vit désormais dans **`src/lib/correction-etat.ts`** (`copieCorrigee`),
utilisable client ET serveur. **Ne pas en réécrire un second ailleurs.**

## Trois pièges qui ont coûté du temps

1. **Le questionnaire n'est pas sur l'activité.** Depuis la bibliothèque de
   questionnaires (01/09), une activité de lecture peut ne porter qu'un
   `lectureQuizId` — et la session en fige sa propre copie. Lire
   `devoir.lectureQuiz` en direct côté serveur renvoie `undefined`.
   **Toujours passer par `quizDuDevoir()`** (`questionnaire-lecture-server.ts`).
2. **`eleves.firebaseUid` n'est pas fiable comme clé de jointure.** Il n'est posé
   qu'à la connexion *suivant* l'ajout en classe : mesuré le 20/09 sur le
   parcours de français, **25 fiches sur 40** en avaient un, contre **40 sur 40**
   pour `emailHash`. **Rapprocher un élève de sa copie par l'empreinte d'email**
   (`eleves.emailHash` ↔ `travaux.studentEmailHash`), l'uid en complément.
3. **`GET /api/travaux/[id]` oubliait `sessionId`.** Toute copie chargée seule se
   présentait comme sans classe. Corrigé.

## Ce qui a changé, écran par écran

### Liste des copies (`/dashboard/travaux/[devoirId]`)
- Colonnes triées sur le vrai critère ; bulle de % rétablie pour la lecture.
- **Statistiques** : réussites, échecs, moyenne, médiane. ⚠ Elles partaient de
  **toutes** les corrections de l'activité, toutes classes mélangées — elles ne
  parlent désormais que de la classe ouverte. Seules les copies **entièrement**
  corrigées entrent dans les moyennes.
- La **classe choisie vit dans l'URL** (`?session=…`) et survit au retour arrière.
- **Interrupteur « Corrigé visible pour <classe> »** en tête de page, agissant
  sur la SEULE session — même route que la popup des sessions
  (`PATCH /api/sessions/[id]`), pas un nouveau mécanisme.

### Correction d'une copie (`.../[travailId]`)
- **Bug des ✔ / ✘ qu'il fallait recliquer** : `updateQuestionScore`,
  `updateRechercheScore`, `updateAutoEvalProf` appelaient l'enregistrement
  **à l'intérieur** d'un updater de `setState` (gotcha `init.md` : la fonction
  doit être PURE). Et sur une copie encore vierge, la mise à jour locale était
  jetée faute de document, pendant que chaque clic relançait la temporisation de
  2 s → JP cliquait dix fois et attendait vingt secondes. Le **premier** geste
  crée maintenant le document et enregistre aussitôt ; un verrou empêche deux
  créations concurrentes (le POST est destructeur, `.set()`).
- Le panneau de droite s'ouvre sur **Évaluation** (mode interne = prof seulement).
- **Menu des copies** : symboles alignés sur les colonnes (🔒 / 📝 / ✅), non
  corrigées en tête, et **une seule classe** — celle d'où l'on vient. L'ordre est
  figé à l'arrivée pour que rien ne saute sous la souris.
- Champ de points élargi (0,5 était tronqué).

### Revue d'un questionnaire de lecture (`LectureQuizReview`)
- Bascule **« Seulement les questions à corriger (N) »** dans le bandeau vert.
  ⚠ L'ensemble est calculé sur « la machine sait-elle corriger ? »
  (`seCorrigeSeule`), **pas** sur « ai-je déjà noté ? » : sinon la liste
  rétrécirait sous la souris.
- **Pastilles de navigation** numérotées, une par question : ambre plein = à
  noter, ambre pâle = notée, gris = automatique.

### Carte d'activité et tableau de bord
- Étiquette du **type d'activité** à côté du titre, avec Formatif/Certificatif ;
  plus d'étiquette « VOC » (doublon). Ligne d'étiquettes toujours affichée.
- L'interrupteur du corrigé **quitte la carte** (il vaut maintenant par classe,
  depuis la page des copies). **La compétition garde le sien** — il y dit autre
  chose (« Relecture ouverte »).
- Filtres **par type** et **par formatif/certificatif**, et **tri par échéance**
  (la plus proche d'abord ; sans échéance en fin de liste).
- L'icône 📚 (grille d'évaluation) ne s'affiche plus quand il n'y en a pas.

### Côté élève
- Activité de **vocabulaire** : plus de bouton « Remettre le devoir » — rien ne
  s'y remet (`hideSubmit`).

## Certification « faite » automatique — LIVRÉ

Plan : `harnais/plans/2026-09-20-certification-faite-automatique.md` (validé).

Une certification **non cotée** rattachée à une activité est acquise dès que la
copie de l'élève est corrigée. **Rien n'est écrit en base** : la copie corrigée
EST la preuve, et `notesFaitesAuto()` fabrique des notes *virtuelles*
consommées comme les autres. JP a explicitement accepté de **perdre le
décochage** (« la copie fait foi »).

- Touche la roue des ceintures de `/accueil`, l'onglet certifications du profil,
  la popup « 📊 Notes des élèves » (case cochée, grisée, mention « copie
  corrigée ») et le compteur de Mes Classes.
- Enregistrer la popup **n'écrit rien** pour ces élèves : recopier la déduction
  recréerait les deux vérités qu'on voulait éviter. Restent saisissables à la
  main les élèves **sans copie** dans l'application.
- Les certifications **cotées** ne changent pas ; leur proposition de note
  bénéficie seulement de la jointure par empreinte d'email.

## Ce qui reste

- **Recherche NavigKid et auto-évaluation** : qu'est-ce qu'une copie « corrigée »
  pour elles ? Question ouverte — elles retombent aujourd'hui sur `score > 0`,
  donc jamais.
- Le **panneau Consignes** de l'élève affiche « Grille d'évaluation » suivi de
  rien quand il n'y en a pas (même défaut que l'icône 📚 de la carte) —
  proposé à JP, pas tranché.
- Roadmap : **cahier de notes** du prof, à séparer de la bibliothèque de
  ressources et de la scénarisation (demandé en fin de session).
