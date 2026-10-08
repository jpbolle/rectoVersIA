# 2026-10-08 — « Lecture d'une séquence de cours » : l'élève FLE importe un cours et Claude le lui rend lisible

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-10-08 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : proposé → **validé le 2026-10-08** (JP : partage public possible ; niveau global
  **déduit du radar** ; les 11 langues, posées par le prof dans la fiche ; « parcours » à
  l'écran, `sequence` dans le code ; sur `/fle`, radar et classes restent sous les deux cards
  mais **disparaissent dès qu'une card est ouverte**, remplacés par son contenu ;
  `claude-sonnet-5-5` pour le neuf ; ordre 1 → 7, tout dans la journée) → **écrit le
  2026-10-08, les 7 étapes, rien vu à l'écran** (état réel : `memoire/rollup_fle.md`)
- **Demande initiale** (JP, 2026-10-08, après avoir tout testé de l'espace FLE) :
  1. une **case « activité FLE »** sur chaque activité, pour filtrer celles qu'on insère dans
     un parcours FLE (il ne donnera pas que des parcours : il y insère des activités
     construites avant) ;
  2. une activité **FLE et uniquement FLE** : « Lecture d'une séquence de cours » — l'élève
     importe un cours (Docs, Slides, Sheets, PDF ≤ 5 pages, page web), et une colonne de
     travail en six sections repliées, générées par Claude **progressivement**, l'aide à le
     lire : résumé traduit, points saillants, vocabulaire par niveau (fiches + **les
     exercices de l'extension Daspalecte, repris intégralement**), reformulation par parties
     avec questions, cinq phrases complexes analysées (schéma souhaité), passerelle vers le
     pays de l'élève. Toujours du français accompagné d'aides lexicales entre parenthèses,
     dosées selon le niveau ;
  3. pour cela, la **fiche élève** porte sa **langue maternelle** et son **niveau** (A1 → C2) ;
  4. « moins une activité qu'une card du cours FLE » : côté élève, « Mon cours FLE » a deux
     cards — **Parcours** (ceux du prof) et **Lectures** (les siennes + bouton d'import) ;
  5. côté prof, parcours FLE et lectures **ne vivent plus dans les activités classiques** :
     un bouton **« Mes parcours FLE »** dans l'en-tête, à côté d'Accueil / Activités /
     Ressources ; et dans une classe FLE, la fiche d'un élève montre ses lectures de cours,
     ajoutées au fil du temps.

## Le problème

- Un élève DASPA reçoit des cours (sciences, histoire…) écrits pour des francophones. Il n'a
  aujourd'hui que le clic-mot de l'extension Daspalecte. Rien ne lui résume, ne lui
  reformule, ne lui questionne un cours **à son niveau et dans sa langue**.
- La fiche élève ne connaît ni sa langue maternelle ni son niveau global : le radar CECR
  positionne huit compétences, mais rien ne dit « cet élève est A2 » ni « il parle arabe ».
  La seule trace de langue est par mot, dans son vocabulaire personnel (`MotPersonnel.langue`,
  posé par l'extension).
- Les séquences FLE sont créées depuis le tableau de bord ordinaire (tuile « Séquence FLE »
  dans « Quel type d'activité ? ») et rangées dans Mes Ressources › Modules FLE : le prof
  FLE n'a pas d'entrée à lui.
- Une activité ordinaire n'est pas repérable comme « bonne pour le FLE » : le sélecteur
  d'activités du constructeur de séquence montre deux groupes (FLE / Mes Activités), le
  second sans filtre.

## Ce que la sonde a trouvé (2026-10-08)

- **Claude** : aucun helper commun ; 8 routes instancient chacune `new Anthropic(...)`, sans
  streaming, sans comptage de coûts, avec un `cleanJsonResponse()` dupliqué 3 fois. Modèle
  partout `claude-sonnet-4-5-20250929`. Aucun `maxDuration` ni timeout documenté côté VPS.
- **PDF / Docs / pages web** : rien n'existe. L'upload de ressources n'accepte que images et
  audios ≤ 700 Ko, **en base64 dans Firestore** (pas de Firebase Storage). Seul l'export
  CSV d'un Google Sheets **public** existe (`src/lib/sheet-url.ts`, import vocabulaire du
  07/10). Dépendances présentes : `@anthropic-ai/sdk`, `googleapis` (scopes Classroom et
  Sheets compte de service seulement — **pas de Drive**). Absentes : pdf-parse, pdfjs,
  cheerio, readability, mammoth.
- **L'API Claude lit les PDF nativement** (bloc `document` base64, sans en-tête bêta,
  jusqu'à 32 Mo de requête) : on peut extraire le texte **sans dépendance**, et un PDF
  scanné (images) passe aussi.
- **Fiche élève** : `Eleve` = `nom, prenom, email` (chiffrés), `classeId`, `firebaseUid`.
  Édition : `AddEleveModal` + `PATCH /api/eleves/[id]` (nom/prénom/email seulement). Le
  positionnement CECR vit dans `niveauxFle/{eleveId}` (serveur seul, `PUT /api/niveaux-fle`,
  panneau `NiveauFlePanel` dans la fiche prof d'une classe FLE, et en lecture sur `/fle`).
- **Extension Daspalecte** : le dépôt local (`~/Documents/daspalecte`) est en **v1.9** ;
  la **2.0.2** n'existe que dans Chrome (`~/Library/Application Support/Google/Chrome/…/
  dfamiepedkpjldfbdcmdchjfopnhnkgf/2.0.2_0/`). **7 exercices** : associations, écoute et
  associe, famille de mots, étiquettes, lecture (TTS + micro), texte à trous, phrase avec le
  vocabulaire ; plus un **test de lecture** (10 QCM + appariement). ~2 400 lignes de JS sans
  framework. ⚠ **Le backend (Cloud Function, prompts Claude) n'est sur aucun disque** : il
  n'a jamais été commité. Les formats JSON attendus se lisent dans le client ; les prompts
  sont **à réécrire**. Traduction au clic : point d'accès **non officiel** de Google
  Translate, sans clé. Voix : `chrome.tts` (→ `speechSynthesis` sur une page web).
  Micro : `webkitSpeechRecognition` (Chrome, donc ChromeOS : OK). Langues : 11 (ar, en, fa,
  es, ku, ps, pl, ro, ru, tr, uk).
- **Accordéon** : aucun composant générique ; `Volet` local dans `RessourcesTab`, `<details>`
  natif ailleurs. **Flashcards** : fonction locale non exportée dans `VocabulaireActivity`.
- **Schémas** : le moteur de l'atelier de conceptualisation (`Diagram` JSON, React Flow,
  lecture seule pour la correction) peut rendre un arbre produit par Claude.

## Options

### 1. Où vit une « lecture de cours »

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Collection neuve `lecturesCours`**, un document par import, propriété de l'élève, serveur seul | Modèle propre : source, texte, langue et niveau **au moment de l'import**, six sections avec leur état. Aucune règle Firestore. La fiche prof lit la collection par `eleveId` | Un circuit de plus à côté de `devoirs`/`travaux` : pas de correction, pas de profil en v1 |
| **B — Un `devoir` + un `travail` créés à la volée** | Tout l'existant (copies, correction, profil) s'applique | Un devoir **sans prof auteur**, créé par un élève : tordu partout (tableau de bord, sessions, partage). Ce n'est pas une activité, JP le dit lui-même |

**Retenue : A.** Le suivi côté prof se fait par la fiche élève, pas par les copies.

### 2. Importer un Google Docs / Slides / Sheets

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Lien partagé « tous les utilisateurs disposant du lien »**, export public (`/export?format=txt` pour Docs, `/export/txt` pour Slides, CSV pour Sheets — même méthode que l'import vocabulaire) | Zéro OAuth, serveur seul, quelques lignes | ⚠ Si le Workspace du Collège **interdit** le partage hors domaine, l'export public répond 401 et l'élève est bloqué. À vérifier avant |
| **B — OAuth Drive sur le compte Google de l'élève** (scope `drive.readonly` à la connexion, `files.export` via `googleapis`) | Marche avec un partage interne au domaine | Jeton de courte durée à gérer, consentement supplémentaire pour 1 300 comptes, écran de validation Google |
| **C — Coller le texte** | Marche toujours | Perd les images, mais le cours est du texte |

**Retenue : A + C** (C comme filet). B en réserve si le point à trancher sur le partage tourne mal.

### 3. Lire un PDF

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Envoyer le PDF à Claude** (bloc `document`) en lui demandant la transcription fidèle ; compter les pages côté serveur par lecture de `/Type /Page` dans le flux, refus au-delà de 5 ; taille max 4 Mo | **Aucune dépendance**. Les PDF scannés passent (vision). Le texte extrait est stocké une fois, puis réutilisé par les six sections | Un appel Claude de plus (~5 pages = quelques milliers de tokens). Le compteur de pages est une approximation (fiable sur les PDF courants) |
| **B — `pdf-parse`** (dépendance) | Extraction locale, gratuite | Dépendance nouvelle ; PDF scanné = texte vide |

**Retenue : A.**

### 4. Générer six sections sans faire attendre l'élève

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Une route par section, appelées en chaîne par la page** : `POST /api/fle/lectures/[id]/sections/[cle]` génère et **enregistre** la section ; la page lance 1 → 6 dans l'ordre, chaque section s'ouvre à l'arrivée ; si l'élève part, ce qui est fait reste, le reste se reprend à la réouverture | Chaque appel tient en 10-30 s, sous tout timeout de proxy ; pas de streaming à mettre en place ; **cache de prompt** : le texte du cours est le préfixe commun des six appels (facturé ~10 % dès le 2ᵉ) | Six allers-retours ; l'onglet doit rester ouvert pour enchaîner (sinon reprise plus tard) |
| **B — Chaîne côté serveur après la réponse d'import + interrogation périodique** | L'élève peut fermer l'onglet | Un travail en arrière-plan dans le processus Next du VPS : fragile au redéploiement, invisible en cas d'échec |

**Retenue : A.** Répond à la question de JP : oui, segmenté, et l'affichage progressif est
porté par les sections repliables.

### 5. Où ranger langue maternelle et niveau

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Dans `niveauxFle/{eleveId}`**, à côté du radar : deux champs `langueMaternelle` et `niveauGlobal`, édités dans `NiveauFlePanel` (fiche prof d'une classe FLE), lus par `/api/niveaux-fle` déjà appelé par `/fle` | Un seul panneau, une seule route, serveur seul | Un élève à deux fiches a deux docs : règle existante (la plus récente) |
| **B — Sur la fiche `eleves`** (`AddEleveModal`, `PATCH /api/eleves/[id]`) | « Dans la fiche élève » au sens strict | Deux écrans à toucher, et la langue devient un champ de la fiche identité (chiffrement à gérer dans `SENSITIVE_ELEVE_FIELDS`) |

**Retenue : A.** ⚠ RGPD : la langue maternelle est un **indice d'origine** (donnée sensible
au sens du RGPD) : **chiffrée** à l'écriture (`encrypt`), jamais dans un `where()`. Valeur
proposée par défaut : la langue la plus fréquente de ses mots Daspalecte.

### 6. L'espace du prof FLE

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Page `/parcours-fle` + bouton « Mes parcours FLE » dans l'en-tête prof** ; `RessourcesFlePanel` (théorie · activités · séquences) **déménage** là ; l'onglet « Modules FLE » de Mes Ressources disparaît ; la tuile « Séquence FLE » quitte la popup « Quel type d'activité ? » ; les séquences quittent le tableau de bord | Un seul endroit, celui que JP décrit | Déplacement de code (pas de réécriture) ; les liens `/grilles?onglet=fle` existants à rediriger |
| **B — Bouton d'en-tête qui pointe vers l'onglet existant** | Minimal | Deux portes pour la même chose, et les séquences restent dans les activités classiques |

**Retenue : A.**

### 7. La case « activité FLE »

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Un drapeau `fle: boolean` sur `Devoir`**, case « Utilisable en FLE » dans le formulaire de création et d'édition, **distinct** de `referentiel: 'fle'` (qui veut dire « activité sans classe née fermée ») ; le sélecteur du constructeur de séquence filtre dessus ; coché d'office quand une classe FLE est cochée | Explicite, filtrable, rétroactif à la main | Un drapeau de plus à expliquer (deux notions FLE sur `Devoir`) |
| **B — Déduire de la classe** (une activité donnée à une classe FLE est FLE) | Rien à cocher | Une activité construite avant d'avoir une classe FLE n'est jamais FLE : c'est exactement le cas de JP |

**Retenue : A.**

### 8. Les exercices Daspalecte

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Les sept d'un bloc** | Ce que JP demande | ~2 400 lignes à réécrire en React + prompts à réinventer : une étape qui ne se voit pas à l'écran avant longtemps |
| **B — En deux temps, mêmes sept au final** : d'abord fiches + les quatre à correction **locale** (associations, écoute et associe, étiquettes, texte à trous — une seule génération Claude) ; puis famille de mots, lecture (voix + micro), phrase (vérifiée par Claude) et le test de lecture | Chaque temps se voit à l'écran ; le premier couvre déjà l'essentiel du vocabulaire | Rien de retiré, seulement ordonné |

**Retenue : B** — c'est un ordre, pas une réduction. La traduction au clic d'un mot
réutilise le **point d'accès Google Translate non officiel** de l'extension (sans clé),
côté serveur, avec repli « demander à Claude » s'il cesse de répondre.

### 9. Modèle

Convention du projet : `claude-sonnet-4-5-20250929`. La génération actuelle (`claude-sonnet-5-5`)
est **moins chère** (2 $ / 10 $ par million de tokens contre le tarif de la génération
précédente) et lit les PDF comme l'autre. Proposition : le **nouveau** dispositif démarre
sur `claude-sonnet-5-5` via un helper commun ; les routes existantes ne bougent pas.
À trancher par JP (point 6 ci-dessous).

## Ce qu'on fait

### Le modèle, en une page

| Collection / champ | Contenu |
|---|---|
| `lecturesCours/{id}` | `eleveUid`, `eleveId` (fiche), `classeId` (classe FLE), `titre`, `source: {type: 'gdoc'\|'gslides'\|'gsheet'\|'pdf'\|'web'\|'texte', url?, nomFichier?, pages?}`, `texte` (≤ 20 000 caractères ≈ 5 pages), `langue`, `niveau` (copiés au moment de l'import), `sections: {resume, saillants, vocabulaire, reformulation, grammaire, passerelle}`, chaque section = `{statut: 'a-faire'\|'en-cours'\|'prete'\|'erreur', contenu: JSON, generatedAt, usage?}`, `reponses` (ce que l'élève a fait : questions, exercices), `createdAt`, `updatedAt` |
| `niveauxFle/{eleveId}` | **+** `langueMaternelle` (code, chiffré), `niveauGlobal` (`pre-a1`…`c2`) |
| `devoirs` | **+** `fle?: boolean` |

Contenus des sections (JSON produit par Claude, validé serveur) :
1. `resume` : `{ texte }` — ≤ 10 lignes, mots difficiles suivis de « (traduction) » en L1.
2. `saillants` : `{ points: [{ texte, aides: [{mot, traduction}] }] }` — 10 points.
3. `vocabulaire` : `{ mots: [{ mot, traduction, definitionSimple, exemple }], exercices }` —
   8 à 15 mots selon le niveau ; `exercices` au **format Daspalecte** (`pairs`, `items`…).
4. `reformulation` : `{ parties: [{ titre, texte, questions: [{ type: 'qcm'\|'vrai-faux'\|'ouverte', enonce, choix?, bonne?, exempleReponse?, aide }] }] }` — difficulté selon le niveau.
5. `grammaire` : `{ phrases: [{ phrase, segments: [{ texte, fonction, explication }], explication, arbre: Diagram }] }` — ≤ 5 phrases, `arbre` au format du moteur de schémas.
6. `passerelle` : `{ intro, paralleles: [{ titre, texte }], question }` — le même thème vu depuis le pays de la langue de l'élève.

Un **préambule système commun** (cache de prompt) fixe la règle du niveau : A1/A2 phrases
courtes et beaucoup de parenthèses ; B1/B2 parenthèses sur le lexique abstrait ; C1/C2
parenthèses rares. Le texte du cours suit, mis en cache ; la consigne de section vient en
dernier.

### Les étapes, chacune visible à l'écran

Ordre : d'abord ce qui conditionne le reste (fiche, espace prof), puis la lecture section par
section, le vocabulaire en dernier parce qu'il est le plus gros.

1. **Fiche élève : langue maternelle + niveau global** — fichiers : `src/types/niveaux-fle.ts`,
   `src/app/api/niveaux-fle/route.ts`, `src/components/NiveauFlePanel/`, `src/lib/crypto.ts`
   (chiffrement du champ langue), `src/lib/daspalecte/mots.ts` (langue la plus fréquente =
   valeur proposée). Liste des langues : les 11 de l'extension + « autre ».
   Visible : dans la fiche d'un élève d'une classe FLE, au-dessus du radar, un menu « Langue
   maternelle » et un menu « Niveau » ; sur `/fle`, l'élève voit « Bonjour Ahmed · A2 ».
2. **Espace prof FLE + case « activité FLE »** — fichiers : `src/components/Header/Header.tsx`
   (bouton « Mes parcours FLE »), `src/app/parcours-fle/page.tsx` (neuf, accueille
   `RessourcesFlePanel`), `src/app/grilles/page.tsx` (onglet retiré, redirection),
   `src/types/devoir.ts` (`fle`), `src/app/api/devoirs/route.ts` + `[id]/route.ts`,
   `CreationForm`, `EditDevoirModal`, `DevoirCard` (pastille FLE), popup « Quel type
   d'activité ? » (tuile séquence retirée hors espace FLE), `src/app/dashboard/page.tsx`
   (séquences retirées), `SequenceFleBuilder` (filtre sur la case).
   Visible : le bouton dans l'en-tête, la page, la case dans le formulaire, le filtre dans le
   constructeur de séquence.
3. **Lecture de cours — import + résumé** — fichiers : `src/types/lecture-cours.ts`,
   `src/lib/claude.ts` (neuf : client unique, JSON nettoyé, cache, usage),
   `src/lib/import-cours/{google,pdf,web}.ts`, `src/app/api/fle/lectures/route.ts` (GET
   liste, POST import), `[id]/route.ts`, `[id]/sections/[cle]/route.ts`,
   `src/app/fle/page.tsx` (deux cards : Parcours · Lectures + bouton « Importer un cours »
   en popup de l'app), `src/app/fle/lectures/[id]/page.tsx` (deux colonnes : travail à
   gauche, encadré source à droite), composant `Accordeon` partagé (neuf, repris ensuite par
   `RessourcesTab` si JP le veut — pas dans ce chantier).
   Visible : l'élève colle un lien Docs ou dépose un PDF de 3 pages, la page s'ouvre, le texte
   est à droite, le résumé traduit apparaît à gauche en quelques secondes. Un PDF de 8 pages
   est refusé avec un message clair.
4. **Sections 2, 4, 5, 6** (saillants, reformulation + questions, phrases à la loupe avec
   arbre, passerelle) — fichiers : les routes de section, `src/lib/prompts-lecture-cours.ts`,
   composants de section (`LectureCoursSections/`), rendu de l'arbre par le moteur de schémas
   en lecture seule (`src/components/Diagram/`), réponses de l'élève enregistrées
   (`reponses`).
   Visible : les sections s'ouvrent une à une pendant que l'élève lit le résumé ; il répond
   aux questions de la reformulation (QCM et vrai/faux corrigés sur place, question ouverte
   avec exemple de réponse dévoilé après) ; il déplie une phrase et voit son arbre.
5. **Côté prof : les lectures dans la fiche élève** — fichiers : `EleveProfilModal`
   (section « Lectures de cours » pour une classe FLE), route GET liste par `eleveId`
   (titulaire ou coprof), page de lecture en mode prof (lecture seule, même URL avec
   `?eleveId=`).
   Visible : dans la fiche d'un élève FLE, la liste de ses lectures avec date, source et
   sections prêtes ; un clic ouvre la lecture telle qu'il la voit.
6. **Section 3 — vocabulaire, premier temps** — fichiers : `Flashcard` **sorti** de
   `VocabulaireActivity` en composant partagé (`src/components/Flashcard/`), exercices
   `Associations`, `EcouteEtAssocie` (`speechSynthesis`), `Etiquettes` (glisser-déposer),
   `TexteATrous`, cadre d'exercices (navigation, « Vérifier », seuils 70 %, indices de
   première syllabe) porté de `content.js` 2.0.2 ; traduction au clic (`/api/fle/traduire`,
   Google Translate non officiel + repli Claude) ; les mots **versés** dans
   `vocabulairePersonnel` comme ceux de l'extension.
   Visible : les fiches à retourner, puis les quatre exercices avec correction immédiate.
7. **Section 3 — vocabulaire, second temps** — `FamilleDeMots`, `LectureAVoixHaute`
   (TTS mot à mot + `webkitSpeechRecognition` + alignement), `PhraseAvecLeVocabulaire`
   (vérification Claude), `TestDeLecture` (10 QCM + appariement).
   Visible : les sept exercices de l'extension, dans l'app, avec l'écran final au trophée.

## Ce qu'on ne fait pas dans ce chantier

- Pas de **notation** ni de passage par la correction : une lecture de cours est un outil de
  l'élève, lue par le prof, pas une copie.
- Pas d'OAuth Google Drive (option 2-B) tant que le partage par lien suffit.
- Pas de refonte des 8 routes Claude existantes vers le helper commun (elles restent telles
  quelles ; le helper sert au neuf).
- Pas de lien séquence ↔ scénarisation (reporté depuis le plan du 14/09, toujours reporté).
- Pas de comptabilité des coûts en euros dans `/admin` : on **stocke** l'usage par section
  (`usage`), l'affichage viendra avec le chantier coûts.
- Pas de remplacement de l'extension Daspalecte : elle continue d'envoyer ses traces.

## Comment on saura que ça marche

- Un élève de FLE 4, positionné A2 / arabe, colle le lien d'un cours de sciences de 3 pages :
  en moins de 30 s le résumé est là, avec les mots difficiles traduits en arabe entre
  parenthèses ; les cinq autres sections arrivent pendant qu'il lit.
- Il ferme l'onglet au milieu, revient le lendemain : les sections faites sont là, les
  manquantes se génèrent.
- Il dépose un PDF de 8 pages : refus, message « 5 pages maximum : choisis la partie du cours ».
- Dans sa fiche, JP voit la lecture, l'ouvre, et lit les réponses de l'élève aux questions.
- Un élève B2 reçoit nettement moins de parenthèses qu'un A1 sur le même texte.
- Coût : une lecture complète ≈ 30 000 tokens d'entrée (dont ~80 % en cache) et ~10 000 de
  sortie, soit **une quinzaine de centimes** sur `claude-sonnet-5-5`.

## Points à trancher par l'utilisateur

- [ ] **Partage Google** : un élève du Collège peut-il mettre un Docs en « tous les
      utilisateurs disposant du lien » ? Si le Workspace l'interdit, c'est l'option 2-B
      (OAuth Drive) ou le collage de texte seul.
- [ ] **Niveau global** : saisi à la main par le prof (proposé), ou déduit du radar (le plus
      bas des huit ? la médiane ?). Les deux peuvent coexister : déduit par défaut, corrigé à
      la main.
- [ ] **Langues** : les 11 de l'extension suffisent-elles ? (Les élèves DASPA actuels.)
- [ ] **Le mot « parcours »** : jusqu'ici réservé à la scénarisation (mémoire du 14/09) ;
      JP l'emploie aujourd'hui pour le FLE. Proposition : « Mes parcours FLE » à l'écran,
      `sequence` inchangé dans le code.
- [ ] **`/fle` côté élève** : les deux cards en haut ; le radar « Où j'en suis » et « Mes
      classes » restent en dessous ? (JP a dit « 2 sections ».)
- [ ] **Modèle** : `claude-sonnet-5-5` pour le neuf (proposé), ou rester sur la convention
      `claude-sonnet-4-5-20250929` ?
- [ ] **Ordre** : étapes 1 → 7 comme ci-dessus, ou la lecture (3-4) avant l'espace prof (2) ?
- [ ] **Extension 2.0.2** : récupérer son code depuis Chrome dans le dépôt `daspalecte`
      (il n'y est pas) avant le portage — un geste de JP, pour que la source du portage soit
      versionnée.
