# Rollup — Types de questions (lecture & auto-évaluation)

> Session du 2026-08-16. Demande de JP : enrichir les questionnaires de
> lecture et d'auto-évaluation. Tout est **livré**, `tsc` / `eslint` / `build`
> passent. **Testé à l'écran par JP : questionnaire de lecture et questionnaire
> d'œuvre — « pas de bug a priori ».** Le reste (matrice, appariement, remise
> en ordre, image annotée, ensembles) n'a pas encore été ouvert.

## Ce qui a été ajouté

| Type | Dispositifs | Corrigé |
|---|---|---|
| **QCM à réponses multiples** | lecture + auto-évaluation | `correctIndexes[]` |
| **Matrice** (plusieurs items, mêmes réponses) | lecture + auto-évaluation | `matriceCorrect[]` (−1 = ligne hors barème) |
| **Fluorage par catégories** (« le sujet en rouge, le verbe en vert ») | lecture | `fluoAttenduParCategorie` |
| **Appariement** | lecture (+ œuvre) | `appariementPaires` |
| **Remise en ordre** | idem | l'ordre de saisie du prof |
| **Image à annoter** | idem | `annotations[].label` |
| **Ensembles** (tri) | idem | `ensembleAffectations` |

Les quatre derniers ne valent **que pour la lecture** : l'auto-évaluation n'a
pas de bonne réponse, un appariement y serait vide de sens.

## LA décision d'architecture — deux moteurs, jamais trois

`src/components/QuestionInteractions/`

```
RELIER    → AppariementField
DÉPLACER  → OrdreField · AnnotationField · EnsemblesField
(sans glisser) → MatriceField · FluoCategoriesField
```

`ChampManipule` est le point d'entrée commun : **écran élève, liseuse d'œuvre
et correction prof passent tous par lui**, avec la même signature. Une seule
règle d'affichage à tenir pour les trois surfaces.

> **Ajouter un cinquième type manipulé, c'est habiller l'un des deux moteurs.**
> En écrire un troisième, c'est repartir pour la divergence des trois champs
> « énoncé ».

## Décisions arbitrées avec JP

| Question | Décision |
|---|---|
| Mécanique du glisser | **Pointer Events écrits à la main**. Pas le glisser HTML5 : il ne fonctionne **pas au doigt**, et chaque élève a un Chromebook |
| Barème | **PARTIEL** — 6 items justes sur 8 = 75 % des points. Le tout-ou-rien annulerait sept bonnes réponses pour une étourderie |
| Maquette | Une maquette HTML manipulable (`harnais/plans/maquette-types-questions.html`), deux tours, puis code |

**Rattrapage au tap** (ajouté sans être demandé, validé à l'usage) : un appui
sans mouvement arme l'élément, le tap suivant le pose. Sur un pavé tactile
d'entrée de gamme, un glisser raté laisserait l'élève bloqué.

## Pièges qui ont coûté cher (ou qui auraient coûté cher)

### Le corrigé qui part chez l'élève
`lectureQuizForEleve` retire maintenant `correctIndexes`, `matriceCorrect`,
`appariementPaires`, `ensembleAffectations` et **les libellés des cases
d'annotation**. Un champ de corrigé ajouté au modèle sans être ajouté là est
une réponse livrée à l'élève — c'est déjà arrivé une fois sur les QCM de
recherche.

### Mélange ≠ filtrage
Servir une remise en ordre **déjà dans l'ordre**, ce n'est pas « corrigé
ouvert », c'est « pas d'exercice ». `preparerPresentation()` mélange donc les
jetons **aussi dans l'atelier Œuvre**, où le corrigé reste pourtant
volontairement ouvert. Graine stable (`melangeStable`, semée sur l'id de la
question) : l'élève qui revient sur sa copie retrouve son travail en place.

### Appariement : un lien par item de GAUCHE, pas 1 pour 1
Deux répliques peuvent être du même personnage, et la colonne de droite peut
porter des intrus. La première maquette libérait les deux extrémités, ce qui
rendait certains corrigés **impossibles à atteindre**.

### Le glisser qui accroche (remarque de JP sur la maquette 1)
Ce n'était pas la maquette, c'était le code : le jeton était réinséré dans la
liste à chaque mouvement, se replaçait sous le pointeur et se comparait à
lui-même. **Le jeton sort du flux, un TROU de même taille prend sa place**, et
c'est le trou qui se déplace.

### Trois listes de libellés de types
`LectureQuizActivity`, `LectureQuizBuilder` et `LectureQuizReview` en tenaient
chacune une copie, et elles avaient déjà divergé (« QCM » ici, « Choix
multiple » là). Une seule désormais : `LECTURE_TYPE_LABELS`.

## Où c'est branché

- Modèle : `src/types/lecture.ts` (+ `partReussite`, `estAutoCorrigeable`,
  `melangeStable`, `reponseLiseuseVersAnswer`), `src/types/autoevaluation.ts`
  (+ `MATRICE_MODELES`)
- Serveur : `lecture-server.ts` (validation + filtrage + `preparerPresentation`),
  `autoevaluation-server.ts`, `oeuvre-server.ts`
- Notation : `lecture-scoring.ts` (`seCorrigeSeule`, barème partiel au dixième)
- Prof : `LectureQuizBuilder` + `TypeEditors.tsx`, `AutoEvalBuilder`
- Élève : `LectureQuizActivity`, `AutoEvalActivity`, `OeuvreReader`
- Correction / bilans : `LectureQuizReview`, `AutoEvalReview`,
  `/api/oeuvres/suivi`, `/api/oeuvres/bilan`

## Reste à faire
- [ ] **Tester à l'écran** matrice, appariement, remise en ordre, image
      annotée, ensembles — côté prof ET côté élève.
- [ ] Vérifier le **barème partiel** sur une vraie copie corrigée.
- [ ] Les jetons **audio** d'un appariement n'ont pas de limite d'écoutes
      (volontaire) — à confirmer à l'usage.
