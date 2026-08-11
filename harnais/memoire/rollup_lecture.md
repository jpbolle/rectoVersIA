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
