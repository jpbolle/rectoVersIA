# Rollup — Espace de cours FLE (séquences, radar CECR, Daspalecte)

> Plan validé : [`../plans/2026-09-14-espace-fle.md`](../plans/2026-09-14-espace-fle.md).
> Ce rollup porte l'état réel du chantier ; le plan reste une trace datée.

## État actuel (2026-09-19, soir — 2e session)

- **Étape 6 (Daspalecte) : étapes 1 et 2 ÉCRITES, rien vu à l'écran** — plan
  [`2026-09-19-daspalecte-ingestion.md`](../plans/2026-09-19-daspalecte-ingestion.md).
  Mots cliqués → `vocabulairePersonnel/{uid}` comme NavigKid (décision JP), file
  `vocabulaireEnAttente/{emailHash}` pour l'élève jamais connecté ; stats (séances,
  exercices, tests de lecture, mots + clics) en tête de l'onglet **Vocabulaire** de la fiche
  élève. Route **`/api/ingest`** (chemin imposé par l'extension). `tsc` passe.
- **TESTÉ EN LOCAL par JP le 2026-09-19** : 3 mots cliqués par eleve07 → visibles avec
  traduction dans *Mes ressources personnelles*, et dans la carte Daspalecte de la fiche
  prof (après correctif). **Exercices et tests de lecture : pas encore essayés.**
  Façon de tester : **copie locale de l'extension** (le profil élève a l'extension imposée
  par l'école, service worker inaccessible), `chrome.storage.local.set({ daspalecteApiBase:
  'http://localhost:3003', daspalecteTrackingBlocked: false })` dans son service worker, puis
  connexion avec le compte élève. ⚠ Chaque profil Chrome a ses propres réglages d'extension.
- **Correctif du test** : fiche `eleves` pas encore liée (élève ajouté à une classe alors
  qu'il avait déjà un compte — `firebaseUid` n'est posé qu'à sa reconnexion) → la fiche prof
  le croyait jamais connecté. `resolveProfilTarget` retrouve désormais l'uid par l'email
  (`uidParEmail`, `src/lib/eleve-lookup.ts`) : vaut pour les 6 onglets du profil.
- Libellé de l'en-tête élève FLE : **« Mon cours FLE »** (demande JP, 19/09).
- **Reste** : bascule (extension 2.0.2 avec la nouvelle adresse, variable sur le VPS).
- Le scénario de test des Modules FLE (ci-dessous) n'a toujours pas été joué.

## État précédent (fin de la 1re session du 2026-09-19)

- **Session du 19/09 : tout écrit, RIEN vu à l'écran, rien commité** (tsc, lint des fichiers
  touchés et `npm run build` passent). Deux plans du jour :
  [`théorie et activités`](../plans/2026-09-19-fle-theorie-et-activites.md) et
  [`séquences de cours`](../plans/2026-09-19-fle-sequences-de-cours.md) — détail plus bas.
- **Prochaine session** : faire tester par JP, dans l'ordre du scénario « À tester » plus
  bas ; puis trancher les copies « sans classe » venues par une séquence (fin du fichier) ;
  puis l'étape 6 (Daspalecte).
- Les étapes 3-4-5 du 14/09 n'avaient pas été testées : JP a essayé le 19/09 (retours →
  plans du jour), mais pas encore le parcours élève.

### Avant (nuit du 2026-09-14 au 15)

- **Étapes 1 et 2 testées par JP** le 14/09 (aucun bug remonté).
- **Étapes 3, 4 et 5 écrites** (bibliothèque de modules = théories ; séquence = activité
  `sequence` avec ligne du temps en serpentin, étapes théorie / activité, création sur
  place ; parcours élève). JP a **vu le serpentin** à l'écran et l'a fait évoluer trois
  fois dans la soirée ; **le reste n'a pas été testé**. `npx tsc --noEmit` passe.
  **Commité, poussé et DÉPLOYÉ par JP le 2026-09-15** (commit « daspalecte - modules et
  parcours ») — donc **en production sans avoir été testé** pour les étapes 3-4-5 et la
  restriction d'élèves généralisée. Le premier build VPS a planté (mémoire), relancé avec
  `NODE_OPTIONS=--max-old-space-size=4096` : réglé.
- Restriction d'élèves **généralisée à toutes les activités** (`Devoir.eleves`) : à tester
  aussi sur une activité classique.
- Étape 6 (Daspalecte branché) : pas commencée.
- Vocabulaire : **séquence** > modules > activités. « Parcours » reste à la scénarisation.

## 2026-09-19 — retours de JP après essai → plan « théorie et activités »

Plan : [`../plans/2026-09-19-fle-theorie-et-activites.md`](../plans/2026-09-19-fle-theorie-et-activites.md)
(validé et **écrit le 19/09, rien vu à l'écran**). En bref :
- le « + » n'avait **aucun style** (bouton brut) → cercle pointillé ; séquence vide = grand
  « + » et début de serpentin ;
- le « + » ne prend plus que **l'existant** ; créer = Mes Ressources › Modules FLE **en nouvel
  onglet**, la liste se relit au retour ;
- Mes Ressources : onglet **« Modules FLE »** (nom gardé, demande JP) à deux sous-sections **Points de théorie** (= les
  `modulesFle`, seul le mot change à l'écran) / **Activités** ;
- **activité FLE** = `Devoir.referentiel: 'fle'` : sans classe, **née fermée** (seule une
  séquence l'ouvre), **absente du tableau de bord et des archives**, gérée dans
  `ActiviteFlePanel` (mêmes `DevoirCard` / `CreationForm modeFle` / `EditDevoirModal`) ;
- le « + » propose aussi les activités **classiques** (choix JP) → corrigé : copies
  introuvables d'une activité à une seule classe prise dans une séquence par un élève
  d'une autre classe (la liste des classes s'affiche désormais s'il y a des copies sans
  classe) ;
- points de théorie archivés : ils restent désormais dans les parcours (ils en
  disparaissaient, contrairement à ce que dit la popup d'archivage).

**Puis, même jour — 3e sous-section « Séquences de cours »** (plan
[`../plans/2026-09-19-fle-sequences-de-cours.md`](../plans/2026-09-19-fle-sequences-de-cours.md),
écrit, rien vu) : les séquences (aussi au tableau de bord) avec, au clic, l'**atelier** —
serpentin en grand, élèves concernés, enregistrement automatique, encadrés cliquables qui
ouvrent la ressource sur place (« ← Retour à la séquence »). Et : la carte « + » d'un point
de théorie ouvre **directement** l'éditeur (plus de popup ; créé au premier Enregistrer).

Et **cartes des Ressources harmonisées** (voir le plan « séquences de cours ») :
`ActiviteRessourceCard` pour activités et séquences FLE, questionnaires réalignés, carte
« + » unique `CreateOeuvreCard libelle`.

**À tester** : le « + » (vide et plein) ; créer depuis le lien, revenir, voir l'élément
dans la liste ; créer une activité FLE → absente du tableau de bord, présente dans le
« + » ; l'élève l'ouvre depuis sa séquence et PAS en tapant son id hors séquence ; ✏️,
copies (Retour → Ressources FLE), dupliquer, archiver.

## Étape 1 — ce qui a été écrit (2026-09-14)

**Classe FLE** — `Classe.type?: 'francais' | 'fle'` (`src/types/classe.ts`, avec
`CLASSE_TYPES`, `isClasseType`, `estClasseFle`). Absent = français, aucune migration.
- Routes : `/api/classes` (GET renvoie `type`, POST l'accepte), `/api/classes/[id]`
  (GET, PATCH accepte `type` — une classe se **re-type** après coup), `/api/classes/student`
  (renvoie `type` — servira à l'aiguillage `/fle` de l'étape 2). `StudentClasse` exporté
  de `useStudentClasses` avec `type`.
- Interface : deux cartes à cocher « Cours de français / FLE » dans `ClasseCreationForm`
  (création) et `AddClasseModal` (modification) ; pastille ambre **FLE** sur `ClasseCard`
  et dans l'en-tête de `ClasseDetailForm`.
- L'import Google Classroom reçoit aussi le `type` choisi dans le formulaire
  (`importCourse(…, type)` → `/api/classroom/import`).

**Référentiel FLE** — `src/types/didactique-fle.ts` : `DidactiqueFleConfig`
{ `competences` (8 branches du radar), `niveaux` (pré-A1 → C2, `rang` 0-6, **C1/C2
masqués**), `descripteurs` (« Je peux… » par compétence × niveau, 8 d'amorce en A1),
`typesModule` (6) } + helpers (`niveauxVisibles`, `descripteursDe`, `slugFle`…).
- Route `/api/didactique-fle` (GET tout connecté, PUT admin) — doc
  `configuration/didactique-fle`, **document à part**, `/api/didactique` intouché.
- Hook `useDidactiqueFle` — copie de `useDidactique` avec **son propre cache** (choix
  retenu plutôt que paramétrer le cache unique : zéro risque sur le référentiel français).
- `/admin` › Gestion didactique : **sélecteur « Cours de français / FLE »** (pilule,
  `refSwitch` dans `admin.module.css`) → `DidactiquePanel` ou `DidactiqueFlePanel`.
- `DidactiqueFlePanel` réutilise `DidactiquePanel.module.css` (+ `.card_fle`, `.oneCol`,
  `.btnDanger`). Compétences et types de module : listes œil / renommer / 🗑 / « + ».
  Niveaux : idem + **flèches ▲▼** (échange de `rang`). Descripteurs : une carte
  repliable par compétence, groupés par niveau, ajout en ligne (niveau + texte).
  Suppressions par **popup de l'app**, pas `window.confirm` (le panneau français, lui,
  l'utilise encore).

## Étape 2 — ce qui a été écrit (2026-09-14, plus tard le soir)

**Positionnement CECR** — `niveauxFle/{eleveId}` (`src/types/niveaux-fle.ts`) :
`positionnement` (compétence → niveau), `objectifsMois` (un texte par mois `YYYY-MM`,
un mois vidé disparaît), `historique` (les positionnements précédents, 24 max, posés à
chaque changement des curseurs). Route `/api/niveaux-fle` : GET `?eleveId=` (prof, même
garde que `/api/profil/*` : l'élève doit être dans une classe du prof), GET sans paramètre
(l'élève : `prenom` + positionnement le plus récent s'il a plusieurs fiches), PUT prof —
seules les paires (compétence connue, niveau connu) du référentiel passent.

**Radar** — `RadarFle` (SVG maison, `viewBox 520×470`) : N branches dans le **sens
horaire depuis le haut** (angles d'écran, à l'inverse de `CeinturesRoue`), anneaux =
niveaux visibles (le centre = pré-A1, pas d'anneau), étiquettes des anneaux sur l'axe
vertical, aire bleue `#4a7ba7`, légende « 0 = pré-A1 · 1 = A1 … » sous la figure.

**Panneau** — `NiveauFlePanel` : radar à gauche, à droite une ligne par compétence
(libellé · niveau en gras · curseur `<input type=range>` côté prof / crans pleins côté
élève), puis « Objectifs du mois » (textarea prof / texte élève, mois précédents en
`<details>`). Enregistrement **différé de 500 ms** (le dernier état gagne), envoi forcé au
démontage. Fiche élève : `EleveProfilModal` reçoit `classeType` et place le panneau
**avant** `ProfilPanel` pour une classe FLE.

**Espace élève** — page `/fle` (« Mon cours ») : bonjour + prénom, « Mon travail à faire »
(vide, texte « Rien pour l'instant. Bravo ! » en attendant les séquences), « Où j'en suis »
(radar + objectifs), « Mes classes ». Header **variant `fle`** (Mon cours · Mes classes ·
Mon vocabulaire · Mon profil). Aiguillage : `espaceFleSeulement(classes)` (toutes les
classes actives sont FLE) dans `/login` et `/accueil` → `/fle` ; classes mixtes →
`/accueil` avec entrée « Mon cours » (`avecCoursFle`). `/profil`, `/mes-classes`,
`/mes-ressources` prennent le header FLE pour un élève tout-FLE.

⚠ **Lint** : le motif `redirecting` imposé par AGENTS.md (setState dans un effet) est
signalé par `react-hooks/set-state-in-effect` — sur `/fle` comme sur `/login` et
`/mes-ressources` déjà en place. Le lint n'est pas dans le hook pre-push ni la CI (vérifié
le 2026-09-14) : rien de bloquant, mais le motif et le linter se contredisent.

## Étape 3 — ce qui a été écrit (2026-09-14, tard)

Trois choix de JP avant d'écrire : activités **existantes seulement** (le mode FLE du
formulaire de création viendra à part), théorie en **Tiptap** (`DocumentEditor` des
ressources), partage = **mes modules + duplication** (pas de partage nominatif en
co-édition comme les œuvres — la duplication suffit).

- `src/types/module-fle.ts` : `ModuleFle` { titre, description, type (id `typesModule`),
  niveau (id CECR), competences[], theorie (HTML), activites[] `{devoirId, intitule,
  typeTravail, atelier}`, profId/profName, shared, archive } ; id `MFL-YYYYMMDD-XXXX` ;
  `iconeTypeModule`, `theorieVide`.
- Routes `/api/modules-fle` (GET paniers, POST), `[id]` (GET, PATCH propriétaire ou admin,
  DELETE = archive), `[id]/dupliquer` (copie, les activités référencées restent celles du
  collègue). Helpers `src/lib/module-fle-server.ts`.
- `ModuleFlePanel` (onglet **Modules FLE** de Mes Ressources, dernier onglet) : la popup
  de création (titre, type, niveau) **enchaîne sur l'éditeur**. Archivage par popup.
- `ModuleFleEditor` : fiche à gauche (titre, description, type, niveau, compétences en
  puces, **« Je peux… » du référentiel** pour les compétences cochées au niveau choisi —
  une aide, pas un champ), théorie + activités à droite. Enregistrement **explicite** :
  bouton ambre « Enregistrer » tant que le brouillon diffère de l'enregistré.
  « Rattacher une activité » = popup avec recherche sur `/api/devoirs` (non archivées).
- `ModuleFleCard` réutilise `OeuvreCard.module.css` ; la carte « + » réutilise
  `CreateOeuvreCard.module.css` (pas de copie de CSS).

⚠ Une activité rattachée à un module **n'est pas encore ouvrable par l'élève** via le
module : c'est la voie d'autorisation « par séquence » de l'étape 4.

## Étape 4 — ce qui a été écrit (2026-09-14, très tard) — **REFAIT en option B**

⚠ Première version (collection `sequencesFle` à part, dans Mes Ressources) **abandonnée le
même soir** : JP voit la séquence « comme une activité constructible ». Option B retenue,
« avec choix des élèves de la classe qui accèdent à l'activité ».

- **La séquence est une ACTIVITÉ** : `TypeTravail`/`Dispositif` gagnent `'sequence'`,
  atelier `sequence-fle` (`ATELIER_SEQUENCE_FLE`, `estSequenceFle()`), `Devoir.sequenceFle`
  = `{ eleves: null | ids, modules[] {moduleId, titre, eleves: null | ids} }`
  (`src/types/sequence-fle.ts`). Classes, sessions, échéance, ouverture, ressources du
  verso : ceux de l'activité, sans une ligne.
- **Prof** : « Séquence FLE » dans le menu Type d'activité (création ET popup ✏️). Retours
  de JP appliqués le soir même : le menu des classes ne propose que les **classes FLE**
  (`useClasses` + `estClasseFle` dans les deux formulaires, la bascule d'atelier retire
  les classes non FLE déjà cochées) ; dès qu'une classe est cochée, le **choix des élèves**
  apparaît au **recto** sous les classes (`SequenceFleBuilder partie="eleves"`) ; les
  **modules** se composent au **verso** « Ajouter des contenus » (`partie="modules"`, ▲▼,
  pris dans Mes Ressources › Modules FLE, volet « tous / certains élèves » par module). Pas
  d'habiletés. La duplication recopie `sequenceFle`.
- **Serveur** : `/api/devoirs` (liste) mappe `sequenceFle` et, côté élève, **masque** les
  séquences réservées à d'autres ; `/api/devoirs/[id]` GET refuse (403) un élève hors
  restriction, PATCH accepte `sequenceFle` ; POST l'accepte (duplication). Nouvelle route
  `/api/devoirs/[id]/parcours-fle` : modules + état des activités (`TRV-…` : `a-faire`,
  `en-cours`, `fait`). `src/lib/sequence-server.ts` : `sequenceFlePourFirestore`,
  `lireSequenceFle`, `identiteEleve` (fiches, ids ET noms de classes), `sequenceOuverteA`
  (classe + `etatEffectif` + restriction), **`ouvertParSequence`** (requête
  `typeTravail == 'sequence'`, `getAll` des modules, puis `sequenceOuverteA`).
- **Élève** : `/activites/[id]` rend `SequenceFleActivity` **avant** les gardes sur le
  travail (barre minimale « ← Mon cours », pas de remise) : ligne de progression (un cran
  par module, vert = toutes ses activités rendues), modules dépliables (le premier non
  fait s'ouvre seul), théorie en `<details>` « À lire d'abord », activités en cartes avec
  pastille ○ ◐ ● → `/activites/{id}`. `/fle` › « Mon travail à faire » = les activités de
  type `sequence` de `/api/devoirs`.
- Supprimé : `/api/sequences-fle`, `SequenceFlePanel`, `SequenceFleEditor` (devenu
  `SequenceFleBuilder`). `ModuleFlePanel` n'a plus que la bibliothèque.
- ⚠ `useTravail` de `/activites/[id]` tourne quand même pour une séquence : une copie
  `TRV-{sequence}-{uid}` vide peut naître (brouillon). Sans effet, à nettoyer un jour.

### Élèves concernés — généralisé à TOUTES les activités (2026-09-14, fin de soirée)

Demande JP : « ligne 1 : Type d'activité, Intitulé ; ligne 2 : Classe, échéance,
évaluation ; pour classe, classe entière ou sélection d'élèves », puis « plutôt que
2 boutons : un menu déroulant avec cases à cocher : tous / case pour chaque élève ».

- **`Devoir.eleves: string[] | null`** (ids de fiches `eleves`, null = toute la classe) —
  plus de `sequenceFle.eleves` : la séquence utilise le même champ que les autres.
- **Formulaire de création réorganisé** : ligne 1 = Type d'activité + Intitulé (+ **Type
  de grille** en écriture : `formRowTypeIntituleGrille` 1fr 2fr 1fr, sinon
  `formRowTypeIntitule` 1fr 2fr), ligne 2 = Classes + Échéance + Évaluation (+
  **Auto-évaluation** quand elle a un sens : `formRowFour`, sinon `formRowThree`), puis le menu **`ElevesChoix`** dès qu'une classe est cochée
  (menu déroulant aux styles de `ClassesDropdown` : « Tous les élèves » + une case par
  élève ; cocher « Tous » = null). Ligne 3 = habiletés / œuvre (`formRow`). Popup ✏️ :
  même menu sous les classes ; `eleves` et `sequenceFle` sont dans la **signature de
  l'enregistrement automatique**.
- **Serveur** (`eleveExclu`, `restrictionElevesPourFirestore` dans
  `src/lib/sequence-server.ts`) : la restriction est appliquée dans `/api/devoirs`
  (liste élève), `/api/devoirs/[id]` GET (403), `travaux` POST et `travaux/mine` (403),
  `/api/accueil`, `/api/navigkid/activites-eleve`, et **`ensureTravaux` ne pré-crée pas de
  copie** pour un élève exclu (sinon « non rendu » chez le prof). La duplication d'une
  activité ne recopie pas `eleves` (la copie n'a pas de classe).
- `SequenceFleBuilder` = **ligne du temps EN SERPENTIN** (demandes JP) : le nombre
  d'encadrés par rangée se mesure (`ResizeObserver`, encadré 200 + « + » 34 + écarts), les
  rangées impaires sont en `row-reverse`, un trait vertical (`::after`) fait le virage. Le
  « + » ouvre une popup à **deux chemins** : un module de la bibliothèque, ou **« Créer un
  module ici »** (titre, type, niveau → POST `/api/modules-fle`, insertion dans la ligne,
  puis `ModuleFleEditor` ouvert en **popup large** ; à sa fermeture l'encadré relit titre et
  nb d'activités). Un trait, des encadrés
  (numéro, icône du type, titre, nb d'activités, bouton « tous les élèves / n élèves »,
  ◀ ▶ ✕), et un « + » entre chaque encadré et aux deux bouts qui **insère à cet endroit**
  (popup de choix dans mes modules). Le choix des élèves d'un module s'ouvre en popup
  (`ListeEleves` exportée par `ElevesChoix`), limité aux élèves de la séquence
  (`elevesDeLaSequence`). `SequenceFleModule` recopie `type` et `nbActivites` à l'ajout.
- **Tableau de bord** : quand le formulaire de création est ouvert, la section « Mes
  Activités » est **masquée** (`{!isFormVisible && …}`) — même parti que le détail d'une
  classe. Elle revient à la création ou à la fermeture (✕).
- ⚠ Non couvert : `/api/notifications` (cloche) et les compteurs prof par session lisent
  toujours toute la classe — la restriction n'y est pas appliquée.

### Étapes de deux natures, module = théorie (2026-09-14, nuit)

Retour de JP après test du serpentin : « quand tu ajoutes un module, automatiquement,
choix entre théorie et activité, quel que soit le type… le champ de texte de la colonne de
droite ≠ point théorique mais = indications, introduction ». Tranché par question :
**deux natures d'étapes**, et **une théorie = un module de Mes Ressources**.

- **`SequenceFleEtape`** `{ id ETP-…, nature: 'theorie' | 'activite', moduleId? | devoirId?,
  titre, type? / atelier? / typeTravail?, eleves }` ; `SequenceFleContenu = { etapes }` (plus
  de `modules`). Une même activité peut revenir deux fois (clé = `id` de l'étape).
- **`ModuleFle`** : `theorie` → **`introduction`** (indications, Tiptap) + **`ressources:
  DevoirRessource | null`** (la théorie elle-même : les 5 onglets de `RessourcesInput`,
  passés par `sanitizeRessources` avec `codeAutorise: auth.isAdmin`) ; **plus de
  `activites`**. `ModuleFleEditor` : colonne de droite = Introduction + « La théorie »
  (RessourcesInput). Carte : introduction / n ressources (`compterRessources`).
- **Le « + »** : la popup demande d'abord la nature (deux grands boutons 📖 Théorie /
  🎯 Activité), puis **s'allonge** : onglets « existant » (liste avec recherche : modules
  de la bibliothèque, ou activités de Mes Activités hors séquences) / « créer ici »
  (module : titre-type-niveau → POST puis `ModuleFleEditor` en popup large ; activité :
  **`CreationForm` en popup large**, POST `/api/devoirs`, comme `ModuleActivitesModal` de
  la scénarisation). Encadrés : bleu = théorie, vert = activité, libellé de nature.
- `ouvertParSequence` cherche désormais le `devoirId` **directement dans les étapes**
  (plus de lecture des modules). `parcours-fle` renvoie des `EtapeParcours` (théorie :
  introduction + ressources ; activité : état).
- **Élève** (`SequenceFleActivity`) : un cran par étape (📖 pour une théorie, numéro pour
  une activité, ✓ quand faite) ; une théorie se déplie sur l'introduction puis les
  ressources en volets (**`RessourcesTab` réutilisé** avec un devoir minimal `{ id,
  ressources }` — il ne lit que ces deux champs) ; une activité = carte-lien. L'étape
  ouverte par défaut = la théorie qui précède la première activité non faite.

**Test de bout en bout** : classe FLE → Mes Activités › + › « Séquence FLE », classe cochée,
créer → ✏️ › verso : « Certains élèves » (cocher un), ajouter deux modules, réserver le
second à un seul élève → Enregistrer → ouvrir l'activité (toggle Disponible) → l'élève
coché voit la séquence sur `/fle` et dans Mes Activités, l'ouvre, voit ses modules, ouvre
une activité SANS classe depuis un module (elle doit s'ouvrir), la rend → pastille verte.
L'élève non coché ne voit pas la séquence et reçoit 403 sur son id.

**À tester** (scénario) : créer une classe FLE → pastille sur la carte ; modifier son type ;
/admin › FLE : renommer une compétence, masquer B2, ajouter un descripteur, supprimer un
type de module (popup). Recharger : tout doit tenir.

## Résultat de la sonde (étape 0, 2026-09-14)

**1. Voie d'autorisation d'un devoir par séquence — bonne nouvelle, un seul patron.**
L'accès d'un élève à une activité se décide dans **trois routes seulement**, toutes sur le
même motif `classesDeLEleve()` → `sessionsDeLEleve()` → `etatEffectif()` → 403 si
`!etat.disponible` :

| Route | Rôle |
|---|---|
| `src/app/api/devoirs/[id]/route.ts` (GET, l. 74-106) | ouvrir l'activité |
| `src/app/api/travaux/route.ts` (POST, l. 47-56) | créer sa copie |
| `src/app/api/travaux/mine/route.ts` (GET, l. 51-60) | retrouver sa copie |

Les listes (`/api/devoirs` GET élève, `/api/accueil`, `/api/navigkid/activites-eleve`)
filtrent en plus par **nom de classe** (`devoir.classes` ∩ noms des classes de l'élève) —
mais elles ne servent pas à l'espace FLE, qui aura ses propres pages.

⚠ Repli à connaître : sans session, `etatEffectif` prend `devoir.disponible ?? true`.
Une activité FLE **sans classe et sans session** est donc ouvrable par tout élève qui en
connaît l'id. Conséquence : la voie « par séquence » doit **ajouter** une condition, pas
seulement en retirer une — une activité `referentiel: 'fle'` n'est ouvrable que si une
séquence de l'élève la contient (ou si elle a une session/classe classique).
→ Un helper unique `sequencesOuvrantLeDevoir(eleveIds, devoirId)` dans un futur
`src/lib/sequence-server.ts`, appelé aux trois endroits ci-dessus. Option 4-B du plan
confirmée, pas de repli nécessaire.

Les autres routes qui lisent un devoir par id sans contrôle de classe (`ai/*`,
`corrections`, `ressources/interactif`, `oeuvres/bilan`…) raisonnent sur la **propriété
du travail** (`studentId`), pas sur la classe : rien à changer.

**2. Extension Daspalecte** (`daspa-extension/manifest.json`, v2.0.1) :
`host_permissions: ['<all_urls>']` → le domaine `rectoversia.edukids.pedagokit.be` est
couvert, **aucune republication d'extension nécessaire**. L'URL de base est
`DEFAULT_API_BASE` dans `analytics.js` (l. 15), surchargeable sans code par
`chrome.storage.local.daspalecteApiBase`. Les appels partent du service worker → pas de
CORS.

**3. Module complémentaire** (`gas-addon/Code.gs`) : **n'a encore aucune ingestion**
(seuls la Cloud Function Claude et Google Translate, via `UrlFetchApp`). L'ingestion à
ajouter passera aussi par `UrlFetchApp` (côté serveur Google) → pas de CORS non plus.

**4. Jeton Google** : `daspa-app/src/lib/auth/verify-google-token.ts` vérifie via
`https://oauth2.googleapis.com/tokeninfo` contre `ALLOWED_AUDIENCES` (liste, env) — ne
dépend d'aucun projet Firebase. Se porte tel quel dans `src/lib/daspalecte/`. Il faudra
la variable `ALLOWED_AUDIENCES` sur le VPS (`.env` de PM2).

## Gotchas actifs

- `useDidactique` a un cache **unique au niveau module** (`let cache`) : à paramétrer
  par référentiel avant d'ajouter `configuration/didactique-fle`.
- `sanitizeHabiletes` (route `/api/didactique`) valide les ateliers contre `ATELIER_IDS`.
- `Devoir.classes` = **noms** de classes (la séquence FLE étant une activité, ses classes
  sont des noms aussi) ; `Classe.id` sert aux restrictions d'élèves via les fiches `eleves`.
- `CeinturesRoue` n'est **pas** réutilisé : le radar FLE est un composant neuf.

## TODO (ordre du plan)

1. ~~Classe FLE + référentiel FLE dans `/admin`~~ — écrit le 2026-09-14, à tester
2. ~~Radar CECR + curseurs prof + accueil élève `/fle`~~ — écrit et testé le 2026-09-14
3. ~~Bibliothèque de modules FLE~~ — écrit le 2026-09-14, à tester
4. ~~Séquences FLE + voie d'autorisation~~ — écrit le 2026-09-14 en **option B**, à tester
5. ~~Séquence côté élève~~ — écrit avec l'étape 4 (`SequenceFleActivity`, `/fle`), à tester
6. Daspalecte branché — étapes 1-2 écrites le 2026-09-19 (route `/api/ingest`), bascule à faire

## Historique

- 2026-09-14 — Décision de fusion prise dans la session Daspalecte ; plan écrit, six
  points tranchés par JP, sonde faite.
- 2026-09-14 (soir) — Étapes 1 (classe FLE + référentiel FLE) et 2 (radar, curseurs,
  `/fle`) écrites, puis testées par JP. Étapes 3 (bibliothèque de modules), 4 et 5 (séquence = activité,
  option B refaite le soir même, parcours élève) écrites tard le soir, non testées. Rien déployé.

## ⚠ À vérifier à la reprise (noté le 2026-09-19)

- (Mis à jour le 19/09) Une activité FLE n'a pas de classe : toutes ses copies s'affichent
  à plat, rien n'est caché. Pour une activité **classique** prise dans une séquence, la copie
  d'un élève d'une autre classe reste « sans classe » mais est désormais **atteignable**
  (voir plus haut). La question du rattachement reste ouverte.
- **Copies « sans classe » par la voie de la séquence** : depuis le 19/09,
  `POST /api/travaux` et `/api/travaux/mine` posent `sessionId: mes.sessions[0]?.id`
  (cf. gotcha `init.md` « Toute création d'un `travail` porte son `sessionId` »). Une
  activité ouverte **par `ouvertParSequence`** à un élève dont la classe n'est PAS une
  classe de l'activité n'a pas de session pour lui → `sessionId: null` → sa copie tombe
  dans « Copies sans classe ». Décider : rattacher à la session de la SÉQUENCE, créer la
  session manquante, ou accepter.

