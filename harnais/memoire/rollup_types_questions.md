# Rollup — Types de questions (lecture & auto-évaluation)

> Session du 2026-08-16. Demande de JP : enrichir les questionnaires de
> lecture et d'auto-évaluation. Tout est **livré**, `tsc` / `eslint` / `build`
> passent. **Testé à l'écran par JP : questionnaire de lecture et questionnaire
> d'œuvre — « pas de bug a priori ».** Le reste (matrice, appariement, remise
> en ordre, image annotée, ensembles) n'a pas encore été ouvert.

## Session du 2026-08-20 — mélange, constructeurs, lisibilité

**Livré, `tsc` / `eslint` / `build` passent. Rien testé à l'écran.**

### Le mélange des propositions, PAR ÉLÈVE

`ordreAffichage()` (`src/types/lecture.ts`) — s'appuie sur `melangeStable`, qui
existait déjà. Graine : `uid de l'élève + id de la question`. Deux élèves ne
voient pas la même liste ; le même élève retrouve la sienne en revenant.

⚠️ **C'est un ORDRE D'AFFICHAGE, rien d'autre.** La réponse reste enregistrée
dans l'ordre du professeur — sinon tous les corrigés, barèmes et statistiques
déjà en base désigneraient la mauvaise case. Les écrans bouclent sur des index
D'ORIGINE ; seule la place à l'écran bouge (et la lettre A/B/C, qui suit
l'écran).

| Type | Ce qui se mélange | Où |
|---|---|---|
| QCM | les propositions | `LectureQuizActivity`, `OeuvreReader` |
| Matrice | les **lignes** seulement — les colonnes sont une échelle | `MatriceField` (prop `ordre`) |
| Appariement | la colonne des **réponses** | `AppariementField` |
| Ensembles | la réserve d'étiquettes | `EnsemblesField` |

Case **`pasDeMelange`** par question (QCM et matrice) : pour une chronologie,
une gradation, un « toutes les réponses ci-dessus ».

Pour l'appariement et les ensembles, le mélange est fait **deux fois** : une
fois côté serveur dans `preparerPresentation` (l'ordre de la réponse réseau
trahirait le corrigé, même corrigé retiré), une fois par élève à l'écran.

### Deux constructeurs refondus

- **Appariement** : une ligne = une paire (l'élément, flèche, sa réponse).
  L'étape d'appariement a disparu. Modèle inchangé — les questions déjà
  encodées se rouvrent dans la nouvelle forme. Deux paires de même réponse
  partagent la même pastille (dédoublonnage par texte). Bloc « intrus » à part.
- **Ensembles** : chaque ensemble est un bloc encadré, on y dépose directement
  ce qui lui appartient. Bloc de rattrapage « Étiquettes sans ensemble » pour
  les questions encodées avant.

### Le trait d'insertion

Repris de l'outil d'édition d'œuvre : entre deux blocs de question, un trait
qui s'éclaire au survol avec un `+` ; le clic déplie les dix types **à cet
endroit**. La ligne permanente de boutons du bas a été **supprimée**.
Hauteur réservée en permanence, sinon la liste saute sous la souris.

### Entrée

- Matrice : Entrée ouvre l'affirmation suivante (`insererLigneMatrice` —
  pendant de `insererChoix`, mais sur l'autre axe : ce qui se décale est le
  RANG dans `matriceCorrect`, pas la colonne visée).
- Auto-évaluation : idem, matrice et échelle 1-5 à plusieurs items.
- Appariement : Entrée passe de l'élément à sa réponse, puis ouvre la paire
  suivante.

### Pastilles de type illisibles — corrigé

`.qType` écrit en **blanc** et compte sur `.type_<type>` pour fournir le fond.
Les cinq types manipulés ajoutés le 16 août n'en avaient jamais reçu : blanc sur
blanc. CSS ignore silencieusement une classe absente — rien ne le signalait.
Couleurs ajoutées (contraste ≥ 4,5) : matrice terre cuite, appariement
bleu-vert, ordre olive, image annotée framboise, ensembles indigo.

---

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

---

# Suite du 2026-08-17

## Le likert gagne sa dimension matrice

Demande de JP dès le 16, mal comprise alors : il ne voulait pas un type
`matrice` **à la place** de l'échelle 1-5, mais une **dimension** ajoutée à
l'échelle — ce que `multiple` est au QCM. (Il avait cru l'échelle disparue :
elle était bien là, 4ᵉ bouton du bandeau. Fausse alerte, vérifiée avec lui.)

- `AutoEvalQuestion.matriceItems` **sert aux deux** : c'est le même objet —
  des lignes qui partagent une réponse. Absent = curseur simple, donc tous les
  questionnaires déjà écrits gardent leur comportement.
- À l'écran, une échelle à items est rendue par **`MatriceField`**, colonnes
  `1…5`, bornes annoncées au-dessus. Aucun composant neuf.
- **Lucidité : comparaison LIGNE À LIGNE** (`autoeval-scoring`). Une moyenne
  dirait « se voit juste en moyenne », ce qui ne veut rien dire — un élève peut
  se surestimer sur un point et se sous-estimer sur un autre, et c'est
  justement ce qu'il faut lui montrer. `EcartQuestion.questionId` vaut alors
  `AE-…#3` : **ne jamais s'en servir pour retrouver la question sans couper au
  `#`**. L'écran de correction affiche un décompte (« 3 justes · 1
  surestimation ») au lieu d'un verdict unique.

## Entrée ajoute une option (les TROIS constructeurs)

`src/lib/choix-liste.ts` — `insererChoix` + `focaliserChamp`. Partagé par
lecture, auto-évaluation et recherche NavigKid : les trois tenaient déjà
chacun leur *suppression* d'option et elles avaient divergé sur le décalage du
corrigé ; l'insertion ne devait pas repartir pour un tour.

⚠️ **PIÈGE TROUVÉ ET CORRIGÉ** — `sanitizeLectureQuiz` jetait les choix vides
**sans redécaler le corrigé**. Scénario : A / **B**, on se place sur A, Entrée,
on n'écrit rien, on enregistre → l'option vide disparaît, l'indice 2 ne pointe
plus sur rien, **la bonne réponse redevient A**, sans un mot. Le bug existait
avant ; la touche Entrée le rendait facile à déclencher. Corrigé pour le QCM
simple, le QCM multiple **et la matrice sur ses deux axes** (une ligne vide
décalait aussi les réponses des lignes du dessous) — table de correspondance
`rangDuChoix`, vérifiée hors écran sur les trois cas.

## Réponse courte AUTO-CORRIGÉE

`LectureQuestion.reponsesAcceptees: string[]` — le prof liste ce qu'il accepte
(« le cheval », « cheval », « chevalin »). **Vide = correction à la main**,
comportement de tout ce qui est déjà encodé.

- **Tolérance arbitrée par JP** : majuscules, espaces, accents. **PAS la
  ponctuation, PAS l'orthographe** — `cheval.` est faux, `chevaline` est faux,
  `le chevàl` est juste. Voir `normaliserReponseCourte` (NFD + retrait des
  diacritiques).
- **Tout ou rien** : le barème partiel n'a de sens que là où il y a plusieurs
  éléments à trouver.
- **La note du prof prime** — sur la réponse courte SEULEMENT. C'est la seule
  question dont le corrigé peut être incomplet (une formulation juste qu'il
  n'avait pas prévue) ; un QCM n'a rien d'imprévu. L'écran de correction
  affiche donc la note automatique **dans un champ ouvert** : on écrit pour
  reprendre la main, on vide pour la rendre.
- ⚠️ **C'EST UN CORRIGÉ** : `reponsesAcceptees` est filtré par
  `lectureQuizForEleve`, au même endroit que `correctIndex`. Oublier ce filtre,
  c'est livrer les réponses avec l'énoncé.
- Élève : ✅ « Réponse juste » ou ❌ « Réponse attendue : … » quand le corrigé
  est rendu — immédiat dans une œuvre, où le corrigé est ouvert.

## Reste à faire
- [ ] **Tester à l'écran** tout ce qui précède, plus les 5 types de questions
      jamais ouverts (matrice, appariement, remise en ordre, image annotée,
      ensembles) — inchangé depuis le 16.
- [ ] Étendre « Entrée ajoute une ligne » aux **lignes d'une matrice**, aux
      **paires d'un appariement**, aux **jetons d'une remise en ordre** et aux
      **items d'un ensemble** : même mécanique, proposé à JP, pas tranché.
- [ ] Faut-il pardonner un point final dans une réponse courte ? Proposé,
      pas tranché.

---

## 2026-08-18 — MATRICE MULTIPLE : le 500 à l'enregistrement

**Symptôme rapporté par JP** : une matrice à réponse unique s'enregistre ;
la même à **plusieurs réponses par ligne** échoue. `PUT /api/oeuvres/…` répond
500, rien n'est écrit. (Les erreurs `script.js` / `jquery.js` de la console
venaient d'une extension de navigateur — fausse piste.)

**Cause** : `matriceCorrect` vaut `(number | number[])[]`. Dès qu'une ligne
accepte plusieurs colonnes, c'est un **tableau dans un tableau** — et Firestore
**refuse** cette valeur, faisant échouer l'écriture ENTIÈRE du document.

**Correction** — conversion au passage en base, décidée avec JP :

```
en base    : matriceCorrect: [ 0, {cols:[1,2]}, -1 ]
dans l'app : matriceCorrect: [ 0, [1,2],        -1 ]
```

Deux fonctions appariées dans `src/lib/lecture-server.ts` —
`questionsPourFirestore` / `questionsDepuisFirestore`, plus leurs jumelles à
l'échelle du questionnaire (`lectureQuizPourFirestore` / `…DepuisFirestore`).

⚠️ **Elles vont par paire.** Toute nouvelle route qui écrit des questions passe
par l'une, toute route qui les relit par l'autre — sinon le corrigé d'une
matrice multiple revient vide et la question sort du barème **sans rien dire**.

Points de passage (7) : écriture → `oeuvres/[id]/sections/[sectionId]` (PUT),
`devoirs` (POST), `devoirs/[id]` (PATCH) ; lecture → `docToSection`
(`oeuvre-server.ts`, point unique pour les œuvres), `devoirs` (GET liste),
`devoirs/[id]` (GET), `profil-stats.ts`.

**Aucune migration** : une matrice à réponse unique reste des nombres, les
questionnaires existants sont relus tels quels.

> Le bug ne touchait pas que les œuvres : un **questionnaire de lecture** avec
> matrice multiple plantait pareil. Les deux chemins sont corrigés.

**Pas encore vu à l'écran** — JP teste de son côté.
