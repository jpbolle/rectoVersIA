# 2026-09-14 — Espace de cours FLE, et rattachement de Daspalecte

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-09-14 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : validé le 2026-09-14 (les six points ouverts ont été tranchés, voir la
  dernière section) <!-- → livré le {{DATE}} -->
- **Demande initiale** (session Daspalecte du 2026-09-14) : « Fusionner avec
  rectoversia : des classes spéciales "FLE" qui calibrent automatiquement les contenus
  que le prof y dépose comme des contenus FLE. Relier l'extension et le module
  complémentaire Daspalecte à rectoversia là où, pour l'instant, c'est relié à l'app
  daspalecte. Seule différence : e-learning, donc des parcours qui intègrent des
  activités (rectoversia ne permet que des activités autonomes). Un autre schéma de
  progression, avec les niveaux de langue A1 à C2 et d'autres compétences que les UAA ;
  l'admin doit pouvoir travailler sur les compétences FLE comme il le fait avec les UAA
  et habiletés. Chatbot et micro élève : chantier ultérieur. »
- **Contexte** : Daspalecte est l'outil des élèves DASPA (dispositif d'accueil des
  primo-arrivants) du Collège : extension Chrome + module complémentaire Docs/Sheets/
  Slides, qui envoient leurs traces (mots traduits, exercices, tests de lecture) à une
  petite app web à part, `daspa-app` (Next.js + Firebase App Hosting, ~4 600 lignes,
  aucun contenu pédagogique). Décision du 2026-09-14 : **Recto-versIA devient la
  plateforme unique**, `daspa-app` s'éteindra un jour (pas à l'ordre du jour).
- **Vocabulaire retenu** : une **séquence** contient des **modules**, un module contient
  des **activités**. Le mot « parcours » reste à la scénarisation.

## Le problème

Quatre symptômes, observables aujourd'hui :

1. **Le prof DASPA n'a nulle part où déposer un cours.** Recto-versIA a tous les
   constructeurs (questionnaires, vocabulaire, œuvres, audio avec limite d'écoutes,
   écriture), mais chaque activité est **autonome** : rien ne les enchaîne pour l'élève.
   La scénarisation (`scenarisations`) est un outil de **planification prof** : son
   `GET` refuse `role !== 'prof'`, et aucun composant élève ne la lit.
2. **Un même point de langue ne se réutilise pas.** Dans la scénarisation, les modules
   sont **imbriqués dans le document du parcours** : « le verbe avoir » vu en 1re ne
   peut pas être glissé dans une séquence de 4e sans être recopié.
3. **Le référentiel est monolithique.** `configuration/didactique` est un document
   **unique** (UAA + habiletés + méthodes), `CEINTURES` et `UAA_LIST` sont des constantes,
   et `CeinturesRoue` a ses **niveaux câblés sur les 6 ceintures**. Aucune notion de
   niveau CECR (Cadre européen commun de référence pour les langues : pré-A1, A1, A2, B1,
   B2, C1, C2) ni de type de classe : `interface Classe` n'a **aucun champ de discipline**.
4. **Les données d'un élève DASPA sont coupées en deux.** Ses traces Daspalecte vivent
   dans `daspa-app` (projet Firebase `essai-27712`), ses travaux Recto-versIA dans
   `recto-versia`. Deux apps, deux connexions, deux fiches élève.

Et un point d'accroche déjà en place : `/mes-classes` côté élève est une **impasse**
(cartes non cliquables) — c'est exactement l'endroit où un cours doit s'ouvrir.

## Options

### 1. Où vit la séquence e-learning ?

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Ouvrir la scénarisation aux élèves** | Ajouter une publication élève à `scenarisations` (chapitres, périodes de l'année, gestes cognitifs, certifications…) | Touche un écran de production des classes de français ; les modules restent imbriqués, donc **non réutilisables** ; le vocabulaire (« geste », « UAA », « période ») n'a aucun sens pour un élève A1 |
| **B — Deux collections neuves : `modulesFle` (bibliothèque) et `sequencesFle`** | Un module est une **ressource autonome** (point théorique + activités existantes), une séquence est une **suite ordonnée de modules** affectée à des classes, avec différenciation par élève. La scénarisation n'est pas touchée | Une **voie d'autorisation** nouvelle pour ouvrir une activité depuis une séquence ; le lien séquence ↔ scénarisation viendra **après** (décision JP) |

**Retenue : B**, parce que la réutilisation d'un module entre séquences est **la** exigence
de la demande, et qu'un document imbriqué ne la permet pas. Et parce que l'espace FLE
doit être **strictement additif** : Recto-versIA est en production avec des élèves réels.

### 2. Comment l'extension et le module complémentaire s'authentifient

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Le patron NavigKid** : `launchWebAuthFlow` → `signInWithCredential` Firebase → ID token en Bearer → `verifyAuth()` | Embarquer le SDK Firebase dans Daspalecte ; or `analytics.js` tourne dans le **service worker** (pas de DOM), et le module complémentaire Apps Script n'a pas de `chrome.identity` du tout | Deux mécanismes différents pour les deux clients |
| **B — Une route dédiée à jeton Google** : `POST /api/daspalecte/ingest` reçoit le **jeton d'accès Google** que les deux clients ont déjà (`launchWebAuthFlow` côté extension, `ScriptApp.getOAuthToken()` côté add-on), le vérifie contre une **liste d'audiences** (clients OAuth autorisés), retrouve l'élève par **empreinte d'email** (`eleve-lookup.ts`) | **Zéro changement d'auth côté clients** : seule l'URL de base change. Le code de vérification existe déjà dans `daspa-app` (`verify-google-token.ts`, cache 5 min) et se porte tel quel |

**Retenue : B.** Le contrat d'ingestion (`IngestBody` : une session + un lot d'événements
idempotents, 100 max) est **conservé à l'identique** : `analytics.js` et `Code.gs` ne sont
pas réécrits. Un élève inconnu (aucune fiche `eleves` avec cet email) reçoit un 403
`unknown_account`, comportement que l'extension gère déjà (suivi coupé, message dans le
sidepanel).

### 3. Où vit le référentiel FLE

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Constantes TypeScript** (comme `CEINTURES`) | Rapide | Contredit la demande : l'admin doit pouvoir l'éditer |
| **B — Second document `configuration/didactique-fle`**, même mécanique que le premier (`GET` tout connecté, `PUT` admin, `useDidactique` avec cache par référentiel) | Le panneau `/admin` › Gestion didactique gagne un **sélecteur de référentiel** (Français / FLE) | `useDidactique` a un cache **unique au niveau module** (`let cache`) à paramétrer ; `sanitizeHabiletes` valide contre `ATELIER_IDS` (à ouvrir) |

**Retenue : B.**

### 4. Comment un élève accède à une activité de sa séquence

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Réutiliser les sessions** : affecter une séquence à une classe crée `SES-{devoirId}-{classeId}` pour chaque activité (via `syncSessions`) | Tout le circuit existant (Mes Activités, `etatEffectif`, correction, profil) fonctionne sans une ligne | Une session vaut pour **toute la classe** : impossible de différencier par élève — or c'est le cœur de la demande |
| **B — Une voie d'autorisation « par séquence »** dans l'aide d'accès au devoir : l'élève peut ouvrir l'activité si elle appartient à un module d'une séquence qui lui est affectée | Différenciation à la séquence **et** au module | À sonder d'abord : combien de routes vérifient « cet élève a accès à ce devoir ». Si elles passent toutes par un point commun, c'est **un** point d'insertion ; sinon, c'est le vrai risque du chantier |

**Retenue : B, précédée d'une sonde** (étape 0). Repli si la sonde est mauvaise : A pour
les affectations de classe entière, B seulement pour la différenciation.

### 5. La visualisation des niveaux

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Réutiliser `CeinturesRoue`** (branches sur 240°, couronnes, boucliers) | Deux props de plus | Ce n'est pas ce que JP a dessiné ; les boucliers d'UAA n'ont pas d'équivalent FLE |
| **B — Un radar** (toile d'araignée) selon la maquette de JP : polygone à 8 branches, anneaux = niveaux, aire bleue ; à droite, **un curseur par branche** pour le positionnement prof | Un composant SVG maison neuf, `RadarFle`, sans bibliothèque | Aucun — c'est la maquette |

**Retenue : B.** Maquette fournie le 2026-09-14 (capture d'écran) : les huit branches
dans le sens horaire depuis le haut — Compréhension orale, Compréhension écrite,
Production orale, Production écrite, Interaction, Grammaire, Lexique, FLSco (langue
scolaire). Anneaux étiquetés A1, A2, B1, B2 sur l'axe vertical ; légende sous le radar
« 0 = pré-A1 · 1 = A1 · 2 = A2 · 3 = B1 · 4 = B2 » ; à droite, une ligne par branche avec
libellé, niveau en gras et curseur à 5 crans.

## Ce qu'on fait

### Le modèle, en une page

**Ce qui change sur l'existant** (tout facultatif, repli = comportement actuel) :

- `Classe.type?: 'francais' | 'fle'` — défaut `francais`. **C'est le seul réglage que le
  prof fait à la main.** Tout le reste en découle : une activité, un module, une séquence
  créés pour une classe FLE portent `referentiel: 'fle'`, et les formulaires présentent le
  référentiel FLE (niveau + compétences) à la place des UAA/habiletés.
- `Devoir.referentiel?: 'fle'`, `Devoir.niveauCecr?`, `Devoir.competencesFle?: string[]`.
- `vocabulairePersonnel` : un mot gagne `traduction?`, `langue?`, `source?: 'daspalecte'`
  (aucune interface TS à casser, la route accepte déjà un objet partiel).
- `Header` : un variant `fle` (Mon cours · Mes classes · Mon vocabulaire · Mon profil).

**Ce qui est neuf** — toutes collections en **accès serveur uniquement**, comme les
collections vivantes actuelles (aucune règle Firestore à écrire) :

| Collection | Un document = | Champs clés |
|---|---|---|
| `configuration/didactique-fle` | le référentiel FLE (unique, admin) | `competences[]` (les 8 branches du radar, `{id, label, visible}`), `niveaux[]` (pré-A1, A1, A2, B1, B2, C1, C2 — `{id, label, rang, visible}`, **C1 et C2 masqués par défaut** puisque la maquette s'arrête à B2), `descripteurs[]` (« Je peux… », par compétence × niveau — l'équivalent des habiletés), `typesModule[]` (grammaire, vocabulaire, phonétique, actes de parole, langue de l'école, culture) |
| `modulesFle/{id}` | un module de la bibliothèque | `titre`, `type`, `niveau`, `competences[]`, `theorie` (HTML Tiptap, le point théorique), `activites[]` (`{ devoirId, ordre }` — les activités **existantes** de Mes Activités), `profId`, `partage?` |
| `sequencesFle/{id}` | une séquence e-learning | `titre`, `profId`, `anneeScolaire`, `classes[]` (**ids**, pas noms), `eleves: null \| eleveId[]` (`null` = toutes les classes affectées, liste = une partie des élèves), `modules[]` = `{ moduleId, ordre, eleves: null \| eleveId[] }` (différenciation module par module), `archive` |
| `progressionFle/{sequenceId}-{eleveId}` | ce qui **ne se déduit pas** des travaux | `theorieLue: { [moduleId]: date }`, `modulesClos: { [moduleId]: date }` |
| `niveauxFle/{eleveId}` | le positionnement de l'élève | `positionnement: { [competenceId]: niveauId }` (les curseurs du prof), `objectifsMois[]` (`{ mois, texte }`), `historique[]` |
| `tracesDaspalecte/{sessionId}` + `/events` | une session d'usage de l'extension ou de l'add-on | **même forme que `sessions`/`events` de daspa-app** (contrat inchangé) + `eleveId`, `profId` ; les mots traduits sont **aussi** versés dans `vocabulairePersonnel` |

**La différenciation, à deux étages** (décision JP : « flexibilité au maximum ») :
la séquence se partage avec toutes les classes affectées ou une partie de leurs élèves ;
à l'intérieur, chaque module peut être réservé à certains élèves. Un élève voit donc la
séquence si elle lui est ouverte, et dedans seulement les modules qui le concernent.
Le troisième étage (différencier activité par activité dans un module) n'est pas prévu
dans ce chantier : le champ `eleves` se pose au même endroit le jour où il le faudra.

**Ce qui se déduit à la lecture** (patron de la maison, rien n'est stocké) : l'état de
chaque activité de la séquence = le `status` du travail `TRV-{devoirId}-{studentId}` ;
un module est « fait » quand toutes ses activités sont rendues et sa théorie lue ;
« le travail à faire » = les prochaines activités non rendues, dans l'ordre des modules.

### Les étapes, chacune visible à l'écran

Ordre voulu par JP : **voir l'espace élève et une classe FLE d'abord**, Daspalecte en
dernier.

0. **Sonde** (une demi-séance, rien n'est écrit) — fichiers : `src/app/api/devoirs/**`,
   `src/app/api/travaux/**`, `src/lib/session-server.ts`, `daspa-extension/manifest.json`.
   - Compter les routes qui décident « cet élève a accès à ce devoir », et vérifier
     qu'elles passent par un point commun (décide l'option 4).
   - Vérifier que `host_permissions` de l'extension Daspalecte couvre le domaine
     `rectoversia.edukids.pedagokit.be` (sinon, nouvelle version d'extension à publier).
   - Confirmer qu'un jeton Google émis par le client OAuth de Daspalecte (projet
     `essai-27712`) se vérifie bien depuis Recto-versIA (`tokeninfo` ne dépend pas du
     projet, seule l'audience compte).
1. **Classe FLE + référentiel FLE dans `/admin`** — fichiers : `src/types/classe.ts`,
   `src/components/ClasseDetailForm/`, `src/types/didactique-fle.ts` (neuf),
   `src/app/api/didactique/route.ts`, `src/hooks/useDidactique.ts`,
   `src/components/DidactiquePanel/`.
   Visible : un sélecteur « Français / FLE » à la création d'une classe ; dans Gestion
   didactique, un second référentiel pré-rempli (8 compétences, 7 niveaux dont 2 masqués,
   quelques descripteurs d'exemple) que l'admin édite comme les UAA.
2. **Radar CECR, positionnement, et accueil élève `/fle`** — fichiers :
   `src/components/RadarFle/` (neuf, SVG maison), `src/app/api/niveaux-fle/**` (neuf),
   fiche élève (`src/components/EleveProfilModal/`), `src/app/fle/page.tsx`,
   `src/components/Header/Header.tsx` (variant `fle`), `src/app/page.tsx` +
   `src/app/login/page.tsx` (un élève dont **toutes** les classes sont FLE arrive sur
   `/fle` ; classes mixtes → `/accueil` avec une entrée « Mon cours »).
   Visible : le prof positionne un élève avec les huit curseurs ; l'élève se connecte,
   arrive sur `/fle` et voit son radar, ses objectifs du mois, et un « travail à faire »
   encore vide.
3. **Bibliothèque de modules FLE** — fichiers : `src/types/module-fle.ts`,
   `src/app/api/modules-fle/**`, `src/components/ModuleFleEditor/` (éditeur :
   type, niveau, compétences, point théorique Tiptap, liste d'activités prises dans Mes
   Activités ou créées sur place en mode FLE), cartes au gabarit `GrilleCard` dans un
   nouvel onglet de `/grilles`.
   Visible : le prof crée « Le verbe avoir » (A1, Grammaire) avec un point théorique et
   deux activités existantes.
4. **Séquences FLE + voie d'autorisation** — fichiers : `src/types/sequence-fle.ts`,
   `src/app/api/sequences-fle/**`, `src/components/SequenceFleEditor/`, l'aide d'accès
   au devoir identifiée à l'étape 0.
   Visible : le prof enchaîne des modules, affecte la séquence à une classe FLE, la
   restreint à une partie des élèves, réserve « Le verbe avoir » à un seul élève de 4e.
5. **Séquence côté élève** — fichiers : `src/app/fle/classes/page.tsx`,
   `src/app/fle/sequences/[id]/page.tsx` (ligne de progression par module, puis deux
   colonnes fait / à faire), « travail à faire » de `/fle` alimenté.
   Visible : l'élève ouvre sa séquence, fait une activité, elle passe dans la colonne
   « fait », la ligne de progression avance.
6. **Daspalecte branché sur Recto-versIA** — fichiers : `src/app/api/daspalecte/ingest/route.ts`
   (neuf), `src/lib/daspalecte/{verify-google-token,schema,write}.ts` (portés depuis
   `daspa-app/src/lib/`), `src/app/api/vocabulaire/personnel/route.ts`, fiche élève ;
   côté Daspalecte : `daspa-extension/analytics.js` (`apiBase`), `gas-addon/Code.gs`.
   Visible : un mot traduit dans l'extension apparaît dans la fiche élève de Mes Classes
   et dans son vocabulaire personnel, avec sa traduction. `daspa-app` reste déployée mais
   ne reçoit plus rien. **On repart de zéro** : les traces accumulées dans `daspa-app`
   depuis août 2026 ne sont pas importées (décision JP).

L'interface élève FLE est **dépouillée** : gros pictogrammes, très peu de texte, jamais
le lexique « écrilecteur / ceinture / geste ». Les activités elles-mêmes s'ouvrent dans les
écrans existants (`/activites/[id]`) avec un retour vers la séquence.

## Ce qu'on ne fait pas dans ce chantier

- **Chatbot** (interaction) et **micro élève** (production orale) — chantier ultérieur,
  décision du 2026-09-14. Le radar garde leurs branches, alimentées par le positionnement
  du prof en attendant.
- **Relier une séquence à la scénarisation** — voulu par JP, mais **après** : ce sera un
  `sequenceId` sur un `ModuleActivite` ou un `ModuleDidactique`, une fois les séquences
  stables.
- **Toucher à la scénarisation** des classes de français, aux ceintures, aux UAA.
- **Importer les traces déjà dans `daspa-app`** — on repart de zéro.
- **Éteindre `daspa-app`** — pas à l'ordre du jour ; on verra quand la refonte sera
  aboutie.
- **Brancher l'ingestion du module complémentaire** au-delà du changement d'URL : elle
  n'était pas encore reliée à `daspa-app` non plus (phase 5 de ce chantier-là).
- Différencier activité par activité à l'intérieur d'un module.
- Le CECR pour les classes de français, le jeu d'icônes, la responsivité mobile.

## Comment on saura que ça marche

Scénario de bout en bout, avec un compte prof et un compte élève de test :

1. Le prof crée une classe « DASPA 1 » de type FLE, y inscrit l'élève.
2. Dans `/admin`, l'admin renomme une compétence FLE : le libellé change sur le radar.
3. Le prof positionne l'élève avec les curseurs ; l'élève se connecte et voit son radar.
4. Le prof crée le module « Le verbe avoir » (théorie + un questionnaire + une série de
   vocabulaire), puis la séquence « Rentrée A1 » avec deux modules, affectée à la classe.
5. L'élève arrive sur `/fle`, voit « 2 activités à faire », ouvre sa séquence, fait le
   questionnaire ; au retour, il est dans la colonne « fait ».
6. Le prof ajoute « Le verbe avoir » à une séquence de 4e pour un seul élève : les autres
   élèves de la 4e ne le voient pas.
7. L'élève traduit trois mots avec l'extension : ils apparaissent dans sa fiche élève
   **et** dans son vocabulaire personnel, avec traduction ; `daspa-app` ne reçoit plus
   rien.

## Points tranchés par l'utilisateur (2026-09-14)

- [x] **Le mot** : « séquence » (contient des modules, qui contiennent des activités).
      Lien avec la scénarisation : après.
- [x] **Ordre** : espace élève et classe FLE d'abord, Daspalecte en dernier.
- [x] **Traces déjà dans `daspa-app`** : on repart de zéro.
- [x] **Les branches** : les huit de la maquette (compréhension orale, compréhension
      écrite, production orale, production écrite, interaction, grammaire, lexique,
      FLSco), en radar avec curseurs. Niveaux visibles pré-A1 → B2, C1/C2 masqués.
- [x] **Différenciation** : au maximum — la séquence pour toute ou partie des élèves,
      et chaque module de la séquence différencié par élève.
- [x] **Extinction de `daspa-app`** : pas à l'ordre du jour.
