# Rollup — Questionnaire de lecture (type « lire »)

## État actuel (session du 2026-08-11 soir)

**Testé par l'utilisateur (v1 ok) puis largement enrichi le 2026-08-11 soir — les
enrichissements restent à tester et l'ensemble à déployer.** Maquette d'origine :
`harnais/plans/maquette-questionnaire-lecture.html`.

### Enrichissements du 2026-08-11 soir (à tester)

- **Audio par question** (`question.audio` : fichier ≤ 700 Ko base64 `ressourceImages`,
  ou enregistrement micro 32 kb/s — popup unique « 🎧 Joindre un audio ») avec
  **limite d'écoutes** (`maxEcoutes`, vide = illimité) : côté élève lecteur maison sans
  navigation, compteur `answer.audioPlays` décompté au démarrage (contrôle navigateur,
  pas inviolable) ; correction : lecteur libre + « Écouté X fois ». La route
  `/api/ressources/upload` accepte désormais les mimetypes audio.
- **« Fluorage » renommé « Souligner du texte »** partout + **soulignage attendu du
  prof** (`fluoAttendu`, indices de mots, remis à zéro si l'extrait change) :
  comparaison automatique **indicative** dans la correction et la vue élève corrigée
  (`FluoCompare` : juste / en trop / manqué + compte) — les points restent au prof.
- **Corrigé visible par l'élève** : quand `corrigeDisponible`, le serveur envoie le
  quiz **complet** à l'élève (sinon filtré — `lectureQuizForEleve`) et
  `LectureQuizActivity` reçoit `showCorrection` : QCM ✅/❌ + bonne réponse, réponse
  idéale en encadré, comparaison de soulignage, mode quiz redevient une liste.
- **Builder redessiné** : blocs en **accordéon** (nouvelle question dépliée, les autres
  repliées, extrait d'énoncé dans le bandeau), icônes 🖼/🎧 **à côté de l'énoncé**,
  total de points, **bloc informatif en éditeur Tiptap** (rendu HTML élève/correction),
  menu déroulant **« Gestes de lecture »** dans le bandeau (avant les points).
- **Gestes de lecture dynamiques** : `question.competences` est désormais `string[]`
  (ids de la config didactique, cf. rollup_admin) ; les 7 slugs historiques restent les
  défauts et le repli d'affichage.

### Ce qui existe

- **Modèle** : `devoirs.lectureQuiz` `{ mode: 'worksheet'|'quiz', questions[] }` —
  types dans `src/types/lecture.ts`, formes de tracé dans `src/types/draw.ts`.
  4 types de questions : `qcm` (bonne réponse `correctIndex`, **filtrée côté serveur
  pour l'élève** — `src/lib/lecture-server.ts`), `texte-court`, `texte-long` (réponse
  Tiptap), `fluorage` (source `extrait` ou `ressource`).
- **7 compétences de lecture** par question (multi-sélection, dérivées du jeu Sambre) :
  Comprendre l'explicite, Inférer, Interpréter, Analyser la forme, Modes et médias,
  Exercer son esprit critique, Identifier des structures.
- **Builder prof** (`LectureQuizBuilder`) : drag & drop des blocs, points, image par
  question (base64 `ressourceImages`, upload compressé réutilisé), vignette + popup.
  Intégré au verso de `CreationForm` **et** d'`EditDevoirModal`.
- **Vue élève** (`LectureQuizActivity`) : worksheet (tout) ou quiz (1 par 1 + barre de
  progression) ; réponses auto-sauvées en JSON dans `travail.content`
  (`LectureAnswersState`, `parseLectureAnswers`) ; remise habituelle. Image jointe →
  atelier de tracé complet (`DrawTools`, porté de romantismesam sans dépendance,
  coordonnées en %) ; tracés enregistrés dans la réponse. Fluorage extrait = clic sur
  les mots (indices stockés) ; fluorage ressource = renvoi vers l'onglet Ressources
  (annotations existantes du travail).
- **Correction prof** (`LectureQuizReview`, page travail) : réponses en lecture seule,
  QCM comptés automatiquement (x/y corrects + points), tracés affichés, compétences
  visibles par question.
- **Prévisualisation** (tous les types) : bouton au verso de la création → enregistre
  l'activité `disponible: false` puis ouvre `/activites/[id]` (un prof y est
  automatiquement en mode aperçu).
- Onglet Ressources élève désormais affiché aussi pour les activités **rechercher**.
- Onglet Aide IA masqué quand l'activité lire porte un questionnaire.
- **Images de ressources analysables** (tous types d'activités) : dans l'onglet
  Ressources élève, chaque image du prof porte l'atelier de tracé (toolbar
  horizontale + zoom) — tracés dans `travail.ressourceImageShapes` (clé = fileId),
  auto-save débouncée (`updateRessourceImageShapes`, autorisée après remise comme
  les annotations texte), visibles par le prof en lecture seule dans sa page de
  correction (compteur de tracés sous l'image).

### Derniers ajustements (fin de session 2026-08-11)

- **Réponse idéale** par question (`reponseIdeale`) : champ prof, jamais envoyé à
  l'élève (filtré serveur), affiché en encadré amber dans la correction.
- **Bloc informatif** (type `info`) : pas une question — texte d'introduction ou de
  commentaire du prof à même le questionnaire (pas de points, pas de compétences,
  pas compté dans la numérotation), image possible.
- **Quiz : navigation avant seulement** (pas de bouton Précédent).
- **Fluorage : champ commentaire élève** (les deux sources), stocké dans
  `answer.text`, affiché dans la correction.
- Confirmé avec l'utilisateur : pas de correction automatique visible par l'élève en
  fin de questionnaire — les points/bonnes réponses passent par la correction prof.

## TODOs

- [x] Tester la v1 (création, vue élève, remise, correction) — fait le 2026-08-11.
- [ ] **Tester les enrichissements du 2026-08-11 soir** : audio (upload + micro +
  limite d'écoutes), soulignage attendu + comparaison, vue corrigée élève
  (QCM/idéale/soulignage), accordéon du builder, bloc info Tiptap, gestes dynamiques.
- [ ] **Déployer** (aucune règle Firestore à toucher).
- [ ] **Profil élève (onglet Lire)** : agréger les résultats par geste de lecture
  (`question.competences` × réponses/QCM corrects) — non commencé.
- [ ] Soulignage « ressource » : le surlignage vit dans `ressourceAnnotations` (global au
  travail), pas rattaché finement à la question — suffisant pour v1, à raffiner si besoin.
- [ ] Roadmap app (`/roadmap`) à mettre à jour via l'interface admin.

---

## Session du 2026-08-15

**Livré, non testé.**

- **Bloc « Corrigé » replié** : la réponse idéale du prof passe dans un
  `<details>`, comme « Corrigé & références » côté recherche — sans les
  références (une question de lecture porte sur un texte fourni, l'élève n'a
  aucune source à retrouver).
- **Duplication de question** ajoutée au constructeur (⧉ avant la corbeille) :
  elle existait en recherche et en auto-évaluation, pas ici.
- **Champ énoncé** : c'était un `<input>` d'UNE SEULE LIGNE, l'énoncé long
  était coupé. Remplacé par `AutoGrowTextarea` (composant partagé, hauteur
  MESURÉE sur le contenu — voir `rollup_didactique`).
- **Bandeau de total** aligné sur celui de la recherche (TOTAL · points ·
  pourcentage, et « Score partiel » en clair quand des questions attendent).
  Conséquence : la couleur du pourcentage par seuil a disparu du total ; elle
  reste sur les barres par habileté.
- **Smileys d'assurance** sous chaque réponse — voir `rollup_lucidite`.
- **Le badge de pourcentage du bandeau bleu (vue prof) ne s'affiche plus** pour
  la lecture : le total est en tête de l'onglet Évaluation, l'afficher deux
  fois à trente centimètres d'écart n'avait pas de sens. Il ne reste que pour
  l'écriture, seul dispositif noté par une grille.

### Le trou trouvé et bouché : le quiz complet
L'onglet Évaluation calcule le score **côté client**. Sans `correctIndex` ni
`fluoAttendu`, les QCM et les soulignages sortaient du total : un élève dont la
correction était publiée sans que le corrigé global soit ouvert lisait un score
**amputé**, sans savoir pourquoi.
Désormais (`/api/devoirs/[id]`, `quizComplet`) le quiz complet part si le
corrigé est ouvert **ou** si la correction de CET élève lui est visible.
Cela ne bascule pas le questionnaire en mode corrigé pour autant : les ✅/❌
inline suivent toujours `corrigeDisponible` (`showCorrection`).
Le garde-fou « non rendu » reste intact.

---

## Session du 2026-08-15 soir — la remise, le premier retour, l'habillage

**Livré, non testé.**

### La remise sort de la barre du haut
« Remettre le devoir » est le geste de l'**écrit**. Un questionnaire de lecture
a désormais son propre bouton **« Envoyer le questionnaire »**, au bas de la
colonne de gauche, dans la ligne d'action encadrée de deux traits (forme
imposée du projet). En mode *quiz*, il n'apparaît qu'**à la dernière
question** — là où, avant, il ne se passait plus rien du tout.

`WorkTopBar` gagne `submitOutsideApp` : `hideSubmit` cachait le bouton **et**
remplaçait l'indicateur de sauvegarde par « Réponses pas encore envoyées », ce
qui n'a de sens que pour la recherche. La lecture, elle, enregistre vraiment.

L'onglet **Remarques du professeur** disparaît des activités de lecture (il
montre la copie annotée : il n'y a pas de copie). Un seul drapeau
`showRemarques` alimente maintenant le rail **et** l'`AssistancePanel` — les
deux conditions étaient dupliquées.

### Premier retour à l'élève : le récapitulatif de remise
Comme pour une recherche, l'élève voit dès l'envoi **combien de réponses sont
justes, fausses, ou en attente du prof** (composant `RechercheResume` réutilisé
tel quel, en tête de l'onglet Évaluation qui s'ouvre seul).

**Le calcul est SERVEUR, et il ne peut pas être ailleurs** : le quiz envoyé au
navigateur est expurgé de ses bonnes réponses (`lectureQuizForEleve`).
→ `computeLectureResume()` dans `src/lib/lecture-server.ts`, appelé par
`/api/devoirs/[id]`, résultat attaché au devoir sous `lectureResume` (**enrichi
à la lecture, jamais stocké**, comme `uaa` et `submittedCount`).
Seuls les QCM dont le prof a désigné la bonne réponse se comptent seuls ; textes
et **soulignages** vont en « à corriger » (un soulignage se compare par degrés).
Une question laissée vide est une **erreur**, pas une attente.
Le bloc s'efface dès que la correction est visible — deux comptages concurrents
du même travail seraient pires que rien.
La page recharge le devoir juste après la remise, sinon le récapitulatif
n'apparaîtrait qu'au prochain F5.

### Pourquoi la pastille de barème affiche « … / 1 »
Le récapitulatif annonce un **total**, jamais quelle question est juste : le
dire question par question reviendrait à livrer le corrigé avant l'heure.
La pastille reste donc sur `…` (infobulle « Corrigé par ton professeur ») et se
remplit **quand le corrigé est ouvert** — décision de JP (option A), prise
contre l'option « marquer les QCM dès la remise ».

### Habillage, appliqué AUX DEUX VUES
`LectureQuizActivity` et `LectureQuizReview` portent les mêmes règles — le prof
doit reconnaître la copie qu'il corrige :
- plus de **cadre gris** autour des questions (le fond blanc suffit) ; le bloc
  informatif garde son pointillé, c'est ce qui le distingue d'une question ;
- **barème en pastille ambre pleine** dans le coin supérieur droit ;
- **astérisque verte ✳** entre deux questions (worksheet) ;
- **zone de réponse en retrait de 2 cm** (20 px sous 1100 px de large) ;
- padding du conteneur : le questionnaire collait les bords de la carte ;
- **marges du contenu riche** du bloc informatif — paragraphes, titres, listes
  et puces n'avaient AUCUNE règle : la mise en forme rédigée par le prof
  n'était pas rendue ;
- ligne « 1 question · 1 point » supprimée.

`LectureEvaluation` reçoit son propre padding : `.content` de l'AssistancePanel
est à `0`, **c'est à chaque onglet de tenir son contenu à distance du bord**.

### Gotcha React — la fonction passée à setState doit être PURE
`updateAnswer` prévenait le parent **depuis l'intérieur** de
`setAnswers(prev => …)`. React rejoue cette fonction pendant le rendu : la page
changeait donc d'état en plein rendu de l'enfant.
**Symptôme** : « Cannot update a component (`TravailPage`) while rendering a
different component (`LectureQuizActivity`) ».
**Remède** : tenir l'état courant dans un `ref`, et prévenir le parent depuis le
gestionnaire d'événement. À vérifier partout où un composant remonte son état.
