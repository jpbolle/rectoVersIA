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

## Design du constructeur (2026-08-15)

Reproche de JP : « le design n'est pas assez clair », « la couleur du bandeau de
la question se confond avec le fond du div ».

**Cause exacte** : le conteneur `.builder` était peint en `--c-bg-element`,
c'est-à-dire **la couleur même des bandeaux de question** (`.qHead`). Les
bandeaux s'y noyaient et les blocs ne se détachaient plus les uns des autres.
Le constructeur de lecture, lui, est **transparent** — d'où la différence.

Remède : conteneur transparent (comme la lecture), titre souligné d'un filet
vert, ombre douce sur chaque carte, survol du bandeau, et la section Thèmes
devenue une carte à part.

⇒ **Règle à retenir** : ne jamais donner à un conteneur la couleur qu'il donne
déjà à ses en-têtes internes.

Ajout : bouton **« Créer l'activité »** à côté de « Aperçu du questionnaire »,
au verso — le questionnaire s'écrit là, on ne doit pas retourner au recto pour
un seul clic.

## TODO

0. [ ] Vérifier le **nouveau design** du constructeur et le bouton
       « Créer l'activité » (2026-08-15).
1. [ ] **Tout tester** — rien de la session du 14 n'a été vu à l'écran :
       correction d'une recherche, deux scores, profil, aperçu, constructeur
       refondu, champs facultatifs, habiletés qui se replient.
2. [ ] **Terminer les tests de la boucle d'envoi** (reste du 2026-08-12) :
       envoi depuis l'extension → voile levé → onglet Évaluation → corrigé QCM.
3. [x] **Publier l'extension NavigKid!** — fait le 2026-08-31. Version **1.4**
       envoyée pour examen, visibilité **non répertoriée**. Champ `key` réglé
       dans la foulée : l'identifiant est figé (voir le gotcha `init.md`).
       ⚠️ **Examen en cours** — vérifier le verdict de Google. Un refus arrive
       par courriel et se rattrape en corrigeant la fiche, pas le code.
4. [x] **Retravailler la description** du Store — fait le 2026-08-31.
       `chrome-web-store.md` est à jour et sert de source unique ; la politique
       de confidentialité a migré de Notion vers
       `politique-confidentialite-navigkid.md`, publiée sur
       `pedagokit.be/politiques-de-confidentialité-extensions-et-apps/navigkid`.
       Les deux doivent rester d'accord entre elles **et** avec les déclarations
       du tableau de bord.
4b. [ ] **Rafraîchir les captures d'écran** du Store : celles en ligne datent de
       la 1.3 et ne montrent ni le dictionnaire, ni le traducteur, ni la
       visionneuse PDF — que la description annonce désormais. Format imposé :
       1280×800 exactement. Vérifier au passage qu'aucun nom d'élève réel n'y
       figure.
5. [ ] Afficher `question.document` dans l'extension (rien ne le rend
       aujourd'hui côté panneau).
6. [ ] Image et audio par question dans le constructeur de recherche — même
       traitement qu'en lecture, mais suppose aussi l'extension.

---

## Session du 2026-08-31 — publication au Chrome Web Store

**Envoyé pour examen.** Version 1.4, visibilité non répertoriée.

Ce que la préparation a mis au jour — à savoir avant de retoucher l'extension :

- **L'extension interroge deux services tiers**, ce qu'aucune déclaration ne
  disait : le dictionnaire appelle `fr.wiktionary.org`, le traducteur appelle
  `translate.googleapis.com`. Requêtes en `fetch` nu — seul le mot cliqué part,
  sans en-tête ni identifiant. Arbitré avec JP : données de mineurs, mais un mot
  isolé sans identifiant n'est pas une donnée personnelle → **déclarer**, ne pas
  proxifier. Les faire transiter un jour par `/api/navigkid/*` serait une
  amélioration, pas une correction.
- **La collecte de la démarche est automatique, pas gestuelle** : requête tapée
  dans Google, URL et titre des pages ouvertes depuis les résultats, temps passé,
  clics sur les liens de résultats. Le garde-fou est `if (!qData) return` dans
  `sidebar/app.js` — rien n'est consigné hors d'une question ouverte. La case
  « Activité de l'utilisateur » du formulaire Google a donc été **cochée** : ce
  sont bien des clics interceptés.
- **`firebase-firestore-compat.js` était embarqué mais jamais chargé** (341 Ko) —
  vestige de l'architecture d'avant `/api/navigkid/*`. Supprimé.
- **Le zip livré à la main était faux** : 18 fichiers au lieu de 28, sans le popup
  ni la visionneuse PDF, avec trois icônes de 1024×1024 pesant 3,4 Mo. D'où
  `build-zip.sh`.

Fiche et politique de confidentialité : voir le TODO 4 ci-dessus.

---

## Session du 2026-08-15

**Livré, non testé.**

- **Onglet « Remarques du professeur » retiré** de la vue élève d'une
  recherche : il montrait la copie annotée, vide ici — le prof commente dans la
  gouttière, question par question. Le rail passe de 4 icônes à 3.
- **Total en tête de l'onglet Évaluation** : les deux volets réunis
  (`percentGlobalRecherche`), au-dessus des cartes Réponses / Démarche. Il ne
  les remplace pas — « mal cherché » et « mal répondu » ne veulent pas dire la
  même chose. « Score partiel » annoncé en clair, pas en astérisque.
- **Le bloc « Tes réponses ont bien été envoyées » disparaît** dès que la
  correction est rendue : c'était un pis-aller en attendant la note, le garder
  ferait cohabiter deux comptages du même travail.
- **Badge du bandeau bleu (vue prof) retiré** — même raison qu'en lecture.
  Avant : il affichait « 0 % » quoi qu'il arrive, `calculateScore` retombant à
  zéro faute de grille.
- **Smileys d'assurance dans l'extension** — voir `rollup_lucidite`.
- **Le trou des QCM, bouché** : `/api/navigkid/questionnaire` envoie désormais
  les bonnes réponses QCM si le corrigé est ouvert **ou** si la correction de
  cet élève est visible. Sans elles, `autoScoreQcm` renvoyait `null` et chaque
  QCM basculait en « à noter », ses points disparaissant du total.
  Effet de bord assumé : publier une copie dévoile le corrigé QCM de SES
  questions à cet élève-là.
- Constructeur : icône de duplication agrandie (14 → 19 px — le glyphe ⧉ dessine
  petit dans son cadratin), énoncé en `AutoGrowTextarea`.

---

## Session du 2026-08-15 soir — le surlignage fuyait hors de la recherche

**Livré, non testé — l'extension doit être RECHARGÉE dans `chrome://extensions`.**

**Symptôme** : l'outil de surlignage jaune/vert de NavigKid apparaissait dans
**Recto-versIA lui-même**, par-dessus la popup de remise, alors que le panneau
de l'extension n'était même pas ouvert.

**Cause** : l'état « sidebar ouverte » vivait dans `chrome.storage.session`, qui
**survit à la mort du service worker**. Chrome endort ce dernier ; si le panneau
se ferme entre-temps, le `onDisconnect` qui devait remettre le drapeau à `false`
ne s'exécute jamais. « Ouvert » restait gravé pour toute la session du
navigateur.

**Remède** — le surlignage exige désormais **deux conditions simultanées** :

| Condition | Comment elle est vérifiée |
|---|---|
| Le panneau est ouvert | on compte les **ports vivants** (`portsSidebar`), plus aucun drapeau mémorisé — plus de port, plus de panneau, par construction |
| Une **activité de recherche** y est ouverte | la sidebar annonce ouverture / reprise de session / fermeture (`RECHERCHE_ETAT`) |

Deux garde-fous en plus :
- la sidebar **se rebranche** quand le service worker se réveille (sinon Chrome
  couperait le port et le fluo clignoterait), et **redit** au fond s'il y a une
  recherche en cours — un service worker redémarré a tout oublié ;
- le script de contenu **redemande l'état au fond** avant d'afficher la
  pastille, et ne s'affiche **jamais** sur un domaine `pedagokit.be` ni sur
  `localhost:3003`.

> **Règle générale à retenir** : dans une extension MV3, un état écrit dans
> `chrome.storage.session` n'est pas une vérité — c'est un souvenir. Pour
> « quelque chose est-il ouvert en ce moment ? », compter des ports vivants.
