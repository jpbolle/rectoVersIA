# PLAN — Ressources FLE : « Points de théorie » et « Activités », un « + » sans déferlement

> Statut : ✅ **VALIDÉ (« go ») et ÉCRIT le 2026-09-19 — étapes 1 à 4, rien vu à l'écran.**
> `tsc` passe, aucun lint nouveau.

### Ce qui a été écrit (2026-09-19)

- **« + »** : `.plus` / `.plusVide` enfin stylés ; départ en serpentin (`.depart*`).
- **Popup du « + »** (`SequenceFleBuilder`) : nature → recherche → liste (activités en deux
  groupes FLE / Mes Activités) → lien `/grilles?onglet=fle&section=…` en `target="_blank"`.
  Relecture de l'existant à chaque choix de nature et sur `window` `focus` (compteur
  `fraicheur`). Supprimés : `creerModule`, `creerActivite`, `fermerEditeur`, éditeur et
  formulaire en popup, CSS mort. Étape théorie : le type (Grammaire…) au lieu de « module ».
- **Copies introuvables** (`/dashboard/travaux/[devoirId]`) : `plusieursPaniers` — la liste
  des classes s'affiche aussi avec une seule session s'il y a des copies sans classe.
- **`/grilles`** : onglet « Modules FLE » (nom gardé, demande JP), `?onglet=fle&section=theorie|activites` lu au montage ;
  `RessourcesFlePanel` (bascule) → `ModuleFlePanel` (libellés « point de théorie ») /
  `ActiviteFlePanel` (neuf).
- **Activité FLE** : `Devoir.referentiel?: 'fle' | null` (+ `CreateDevoirData`). POST : classes
  `[]`, `eleves` null, **`disponible: false`**, pas de `disponibleAt`. PATCH : `classes`,
  `eleves` et `disponible: true` ignorés pour une activité FLE. GET liste : mappé.
- `CreationForm modeFle` (sans classes / élèves / échéance / habiletés / Disponible / type
  Séquence) ; `EditDevoirModal` idem, déduit de `devoir.referentiel`. `DevoirCard` : pas de
  toggle Disponible, « ouverte par les séquences FLE ».
- Masquage : tableau de bord (filtre AVANT les années) et `/archives`. Retour des copies
  d'une activité FLE → `/grilles?onglet=fle&section=activites`.
- Duplication extraite dans `src/lib/devoir-copie.ts` (`donneesDeCopie`), partagée ; elle
  recopie `referentiel`.
- **Hors plan, corrigé** : `parcours-fle` sautait les points de théorie ARCHIVÉS, alors que
  la popup d'archivage promet que les séquences continuent de les ouvrir.
- **Retour JP (19/09)** : plus de petite popup titre-type-niveau pour un point de théorie —
  la carte « + » ouvre directement `ModuleFleEditor` sur un point vierge (`id: ''`) ; le
  premier « Enregistrer » fait un POST (la route prend tous les champs), les suivants un
  PATCH. Quitter sans enregistrer ne crée rien. Idem pour l'onglet : il garde le nom
  « Modules FLE ».
- Pas de suppression d'activité FLE (seulement archiver) : pas de `confirm()`, à ajouter
  par popup si JP le veut.

## Point de départ — trois retours de JP après essai (2026-09-19)

1. **Le « + » de la ligne du temps était quasi invisible.** Cause : les classes `.plus` et
   `.plusVide` n'avaient jamais été écrites dans `SequenceFleBuilder.module.css` — un
   bouton brut du navigateur. Sur une séquence vide : juste ce « + ».
2. **Le « + » déclenche un déferlement de popups** (nature → existant/créer → éditeur de
   module ou formulaire de création en popup large). Pour JP, la popup n'a de sens que
   pour **prendre de l'existant**. Créer, c'est **basculer sur la page Ressources FLE**.
3. **Ressources › Modules FLE ne dit pas la différence** entre théorie et activité. JP veut
   **deux sous-sections : « Points de théorie » et « Activités »**.

Décision de JP (question du 2026-09-19) : les activités FLE vivent **seulement dans
Ressources FLE** — le tableau de bord (Mes Activités) ne montre que la **séquence**.

## Ce qu'on fait

### 1. Le « + » — ✅ écrit le 2026-09-19

Cercle pointillé bleu (34 px) entre les étapes ; séquence vide = grand cercle (56 px) avec
le début du serpentin (trait, virage, retour qui s'efface) et « Première étape : une
théorie ou une activité ».

### 2. Ressources › FLE : deux sous-sections

L’onglet « Modules FLE » de `/grilles` garde son nom (demande JP) et gagne un sélecteur en tête
(même pilule que `refSwitch` de l'admin) :

| Sous-section | Contenu | Créer |
|---|---|---|
| **Points de théorie** | les modules actuels (`modulesFle`), rien ne change dans les données — seul le mot change à l'écran | popup courte titre-type-niveau → éditeur (comme aujourd'hui) |
| **Activités** | les activités FLE du prof (cartes) | le **formulaire de création habituel, dans la page** (pas en popup) |

### 3. L'activité FLE — un marqueur, et elle naît fermée

- **`Devoir.referentiel?: 'fle'`** (le nom prévu par le plan du 14/09). Absent = activité
  classique. Ajouté aux trois listes explicites : POST `/api/devoirs`, PATCH
  `/api/devoirs/[id]`, mapping du GET liste (+ duplication du tableau de bord).
- Créée **sans classe** et **`disponible: false`** : seule la séquence l'ouvre
  (`ouvertParSequence`). Aujourd'hui une activité sans classe naît ouverte, donc ouvrable
  par tout élève qui en connaît l'id.
- `CreationForm` gagne un mode FLE : pas de menu des classes ni des élèves, pas
  d'habiletés, `referentiel: 'fle'` posé dans `buildData()`.
- **Masquée** du tableau de bord et des archives (filtre client dans
  `src/app/dashboard/page.tsx` et `src/app/archives/page.tsx`, AVANT le calcul des années).
  Pas de filtre dans `GET /api/devoirs` : le sélecteur de la séquence en a besoin.
- **La carte, dans Ressources FLE**, reprend ce que le tableau de bord offrait : ✏️ modifier
  (`EditDevoirModal`, montable hors tableau de bord), 📋 voir les copies
  (`/dashboard/travaux/[id]` — le bouton Retour doit ramener à `/grilles` pour une activité
  FLE), corrigé visible oui/non, dupliquer, archiver.

### 4. Le « + » de la séquence : l'existant seulement

Popup = nature (théorie / activité) → liste avec recherche → clic = inséré. Plus d'onglet
« créer ici », plus d'éditeur ni de formulaire en popup. À la place, un lien
**« Créer un point de théorie / une activité dans Ressources FLE »**. Supprimé avec :
`creerModule`, `creerActivite` (qui insérait d'ailleurs une étape **sans titre** : la
route POST ne renvoie que `{ id, codeAcces }`), l'éditeur en popup.

## Points tranchés par JP (2026-09-19)

1. ~~Lien « créer »~~ → **nouvel onglet** : `/grilles?onglet=fle&section=theorie|activites`
   ouvert en `target="_blank"` ; la liste du « + » se recharge quand la fenêtre reprend le
   focus.
2. ~~Liste du « + » › Activité~~ → **FLE + classiques**, en deux groupes (« Activités FLE »
   puis « Mes Activités »). ⇒ le bug ci-dessous est à corriger.
3. ~~Activités d'essai existantes~~ → **laissées** telles quelles (prenables dans le groupe
   « Mes Activités »).

## Bug à corriger avec (trouvé en sondant)

Activité classique à **une seule classe**, prise dans une séquence par un élève d'une
autre classe → sa copie (`sessionId: null`) est **introuvable** dans la liste des copies :
la session unique s'ouvre seule (`/dashboard/travaux/[devoirId]/page.tsx`, l. ~120) et
`SessionsListe` n'est jamais affiché. Correctif : la liste des sessions s'affiche aussi
quand il n'y a qu'une session **mais des copies sans classe**.

## Étapes (chacune testable seule)

1. ✅ Le « + » (cercle pointillé, départ en serpentin).
2. **Le « + » sans déferlement** : l'existant seulement, deux groupes pour les activités,
   lien « Créer dans Ressources FLE » en nouvel onglet, rechargement au retour. Suppression
   de la création sur place. + correctif des copies introuvables.
3. **Ressources › FLE en deux sous-sections** : nom d’onglet inchangé, sélecteur « Points de
   théorie / Activités », lecture de `?onglet=&section=`. « Activités » vide pour l'instant.
4. **L'activité FLE** : `referentiel: 'fle'` (types + POST/PATCH/GET), `CreationForm` en
   mode FLE dans la page, `disponible: false`, masquage tableau de bord + archives, cartes
   (✏️, copies, corrigé visible, dupliquer, archiver), Retour des copies vers `/grilles`.
