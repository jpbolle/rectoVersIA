# Rollup — activités de recherche (NavigKid!)

> Sessions des 2026-08-12 et **2026-08-14**. L'activité se joue **dans
> l'extension** ; la colonne de gauche de l'app est le miroir de ce qui a été
> envoyé — et, depuis le 14, **l'écran de correction du prof**.

## Où en est le module (2026-08-14)

Tout ce qui précède le 2026-08-14 est **testé et déployé**, sauf l'extension
Chrome (jamais publiée). La session du 14 a livré la **notation des
recherches** : elle n'est ni testée ni déployée.

## La décision de fond du 2026-08-14 : deux notes, jamais une

Une recherche se note en **deux volets séparés**, validés par JP :

| Volet | Ce qu'il note | Barème |
|---|---|---|
| **Réponses** | ce que l'élève a trouvé | `question.points` |
| **Démarche** | comment il l'a cherché (mots-clés + sites retenus) | **1 point par source demandée** (`nbSources`) — jamais saisi |

Pourquoi séparés : « mal cherché » et « mal répondu » ne disent pas la même
chose, ni à l'élève ni au profil. Un total unique effacerait la distinction.

La démarche se note **question par question** (l'extension collecte les
mots-clés et les sites question par question). Une note de démarche globale
avait été proposée comme alternative plus rapide à corriger — **écartée pour
l'instant**, à rouvrir si la correction s'avère trop longue à l'usage.

## Ce qui a été livré le 2026-08-14

### Écran de correction (vue prof)
- **Maquette HTML validée d'abord** (`/tmp/rectoversia-maquettes/`), en deux
  temps : v1 avec la correction empilée sous la production → refusée (« tout
  s'accumule ») ; v2 avec la correction dans une **gouttière à droite de chaque
  bloc**, alignée sur ce qu'elle note → validée.
- `RechercheResponseViewer` refondu : chaque question = une carte à deux blocs
  (Démarche, Réponse), chacun avec sa gouttière (✔ / ? / ✘ + saisie libre +
  remarque). Sous 1150 px la gouttière repasse dessous, en ligne compacte.
- QCM : le verdict de l'ordinateur est affiché ; bouton « Je ne suis pas
  d'accord → tous les points ». La note du prof, une fois posée, gagne.
- Le « ? » pose la **moitié du barème** ; la saisie libre reste possible
  (choix de JP : les icônes couvrent 90 % des cas, le champ le reste).

### Notation
- `src/lib/recherche-scoring.ts` — pendant de `lecture-scoring.ts`. QCM
  recalculés à chaque lecture (jamais stockés) ; note absente = **hors total**,
  numérateur comme dénominateur ; agrégation par habileté avec la même règle
  qu'en lecture (une question à deux habiletés compte **entièrement dans
  chacune**).
- Stockage : `corrections.rechercheScores` — clé = **index** de la question,
  valeur `{ reponse, reponseComment, demarche, demarcheComment }`. Seuls les
  gestes du prof sont écrits ; l'automatique n'est jamais persisté.
- `useCorrection.updateRechercheScore(index, patch)` (debounce, comme les
  points de lecture).

### Onglet Évaluation
- **L'onglet « Recherche » a disparu** (prof ET élève, rail élève compris) :
  doublon de l'onglet Évaluation. Nouveau `RechercheEvaluation` = les deux
  scores en tête (recalculés en direct pendant la correction) + habiletés
  travaillées + statistiques de recherche + l'ancien `RechercheStatsTab` replié
  en « Détail des recherches ».
- Le bouton « ↩ Renvoyer pour correction » est **masqué** pour `lire` et
  `rechercher` : l'élève répond à un questionnaire, il ne réécrit pas sa copie.

### Constructeur de questionnaire
- `QuestionnaireBuilder` **refondu sur le modèle de `LectureQuizBuilder`**
  (demande de JP) : blocs repliables, glisser-déposer, duplication ⧉, énoncé
  redimensionnable qui grandit avec le texte, menu « Habiletés » dans l'entête,
  deux barèmes (Réponse / Démarche), icône 📄 « texte joint à la question ».
  L'ancien tableau à flèches ▲▼ a disparu.
- `NavigKidQuestion` gagne `pointsDemarche`, `competences`, `document`.
- **Aperçu** : `QuestionnairePreviewModal` — le questionnaire tel que l'élève
  le lira dans l'extension. Une popup, et non la page élève : celle-ci est
  voilée tant que rien n'a été envoyé, le prof n'y verrait jamais ses questions.

### Profil de l'élève
- Onglet **Rechercher** : les deux notes par activité (pastilles) + le bloc
  « Habiletés travaillées » (le même qu'en lecture). `/api/profil/recherche`
  renvoie désormais `{ items, habiletes }` — **la forme de la réponse a changé**.
- Rien ne remonte tant que la correction n'a pas été rendue visible.

### Extension
- Bouton **« ↩ Retour à l'app »** après l'envoi des réponses (et si déjà
  envoyé). Ouvre `/activites/{devoirId}`.

## Ce qu'il faut savoir avant de reprendre

- **La démarche vaut 1 point par source** (décision JP du 2026-08-14) : le
  barème découle de `nbSources`, il n'y a rien à saisir. Pour la pondérer, on
  change le nombre de sources. `pointsDemarche` subsiste dans le type comme
  réglage manuel éventuel, non exposé dans l'interface.
- **Sans `competences` sur les questions, le profil reste vide** — le
  constructeur les propose, mais les questionnaires existants n'en ont pas.
- Les pièces jointes d'une question (`document`, et plus tard image/audio)
  supposent que **l'extension sache les afficher** : elle ne le fait pas encore.
- `sanitizeQuestionForStudent` laisse passer les nouveaux champs (spread) :
  rien à filtrer, aucun n'est un élément de corrigé.

## TODO

1. [ ] **Tout tester** — rien de la session du 14 n'a été vu à l'écran :
       correction d'une recherche, deux scores, profil, aperçu, constructeur
       refondu, champs facultatifs, habiletés qui se replient.
2. [ ] **Terminer les tests de la boucle d'envoi** (reste du 2026-08-12) :
       envoi depuis l'extension → voile levé → onglet Évaluation → corrigé QCM.
3. [ ] **Publier l'extension NavigKid!** sur le Chrome Web Store (diffusion
       interne `cnddinant.be`) : bump de version du `manifest.json` (numéro géré
       **à la main** par JP), zip, envoi. ⚠️ Pendant cette étape, régler le
       champ `key` (voir le gotcha `init.md`) : le Store expose la clé publique
       dans le tableau de bord, la recopier aligne les deux Macs. Fait après
       coup, ce travail est à refaire.
4. [ ] **Retravailler la description** du Store —
       `rechercheNavigChrome/chrome-web-store.md` porte le texte v1.3, qui ne
       mentionne ni le lancement depuis l'app, ni les aides
       dictionnaire/traducteur, ni la visionneuse PDF, ni le retour à l'app.
5. [ ] Afficher `question.document` dans l'extension (rien ne le rend
       aujourd'hui côté panneau).
6. [ ] Image et audio par question dans le constructeur de recherche — même
       traitement qu'en lecture, mais suppose aussi l'extension.
