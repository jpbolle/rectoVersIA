# 2026-10-08 — Deux espaces (classique / FLE), accueil prof, renommage « RectoVerso », fin du flip

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-10-08 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : proposé → **validé (« continue ! ») et écrit le 2026-10-08, soir** — hypothèses
  retenues : nom « RectoVerso », partage activités/ressources FLE du tableau 4, flashcards
  conservées, retards sur 30 jours. Rien vu à l'écran.
- **Demande initiale** (JP, 2026-10-08, soir) :
  1. l'app s'appelle **RectoVerso** (plus Recto-versIA), partout ; et plus d'effet de page qui
     se tourne dans les espaces de travail — le double bouton recto/verso suffit, avec une
     transition simple ;
  2. dans l'en-tête, à côté de la cloche, un **double bouton Espace classique / Espace FLE**,
     pour le prof et pour l'élève d'une classe FLE ;
  3. **espace classique** (prof) : **Accueil** (encadrés À corriger · Échéances à venir ·
     Élèves en retard, sur le modèle de la page d'accueil élève) · Mes Activités · Mes
     Classes · Mes Ressources — et plus rien de FLE ;
  4. **espace FLE** (prof) : Accueil (même structure) · **Mes activités FLE** (ex « Mes
     parcours FLE ») · Mes classes · Mes ressources FLE. L'élève classique ne change pas ;
     l'élève FLE a le double bouton et les deux espaces.

## Le problème

- Le FLE s'est glissé partout : un bouton de plus dans l'en-tête, un onglet déménagé, des
  classes FLE mêlées aux autres. Le prof FLE et le prof de français sont souvent la même
  personne, mais pas au même moment : il lui faut **deux postes de travail**, pas un
  mélange.
- Le prof n'a pas d'accueil : il arrive sur Mes Activités. Il n'a nulle part la vue « qu'est-ce
  qui m'attend aujourd'hui » que l'élève a déjà (`/accueil`).
- Le nom : « Recto-versIA » apparaît dans 29 fichiers de `src` (titre, logo, login, RGPD,
  roadmap, scénarisation, User-Agent). ⚠ **Conflit** : le 2026-09-20, JP avait décidé
  « Traces » (`roadmap.md` › Ensuite). Aujourd'hui : « RectoVerso ». À confirmer.
- Le flip : l'animation 3D traverse 19 fichiers (`FlipEditor`, `FlipChoice`, `CreationForm`,
  `EditDevoirModal`, `OeuvreBuilder`, vocabulaire, `devoir.flipInverted`…). La donnée
  `flipInverted` (quelle face d'abord) reste utile ; seule l'animation part.

## Options

### 1. Le renommage — jusqu'où

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Les strings visibles seulement** : titre d'onglet, en-têtes, login, RGPD, roadmap, textes de la scénarisation, `alt` des logos, User-Agent. **Rien d'infra** : URL `rectoversia.edukids.pedagokit.be`, chemin VPS, PM2, dépôt Git, extension NavigKid, clés `localStorage` et canaux (`rectoversia-navigkid`, `recto-versia-editor-theme`) | Une session ; rien ne casse | Le logo `logoRecto.png` reste (il dit déjà « Recto ») |
| **B — Tout, infra comprise** | Nouvelle URL (liens distribués aux élèves !), nouveau chemin VPS, extension à republier (examen Web Store), dépôt | Plusieurs jours, et des liens cassés chez 1 300 personnes |

**Retenue : A** — exactement ce que `roadmap.md` recommandait pour « Traces » (« commencer
par les strings d'interface, qui ne cassent rien »).

### 2. Le flip

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Garder le double bouton, remplacer l'animation 3D par un fondu court** (CSS : `flipOut`/`flipIn`/`rotateY` → `opacity`) dans les espaces de travail et les formulaires recto/verso | Quelques fichiers CSS, aucune logique | Les **fiches à retourner** du vocabulaire (flashcards) gardent leur retournement : ce sont des cartes, pas des pages |
| **B — Supprimer recto/verso** (une seule face) | Refonte des formulaires de création et d'édition | Hors demande |

**Retenue : A.**

### 3. Où vit « l'espace » courant

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Un contexte React + `localStorage`** (`espace-actif` : `classique` \| `fle`), lu par l'en-tête, Mes Classes, Mes Activités, l'accueil | Un seul réglage, qui survit à la navigation et au rechargement ; aucune URL ne change | Deux onglets du navigateur partagent le réglage (acceptable) |
| **B — Dans l'URL** (`?espace=fle` partout) | Partageable | À propager dans chaque lien de l'app |

**Retenue : A.** Défaut : `classique` ; **`fle` pour un élève dont toutes les classes sont
FLE**. Le double bouton n'apparaît que pour un prof, et pour un élève qui a une classe FLE.

### 4. Ce que chaque espace montre (prof)

| | Espace classique | Espace FLE |
|---|---|---|
| **Accueil** (`/accueil`, neuf pour le prof) | À corriger · Échéances à venir · Élèves en retard, sur ses classes **non FLE** | Les mêmes trois encadrés, sur ses classes **FLE** |
| **Activités** | `/dashboard` : les activités dont au moins une classe est non FLE | **Mes activités FLE** (`/activites-fle`, ex `/parcours-fle`) : séquences + activités données à une classe FLE |
| **Classes** | `/classes` : classes non FLE | `/classes` : classes FLE seulement |
| **Ressources** | `/grilles` : comme aujourd'hui | **Mes ressources FLE** (`/ressources-fle`) : points de théorie + activités FLE sans classe (ex onglets Théorie / Activités) |
| En-tête | Accueil · Mes Activités · Mes Classes · Mes Ressources | Accueil · Mes activités FLE · Mes classes · Mes ressources FLE |

Élève FLE : classique = `/accueil`, `/activites`, `/mes-classes`… (l'en-tête élève actuel) ;
FLE = `/fle` (l'en-tête FLE actuel). Le renvoi automatique de `/accueil` vers `/fle` ne
vaut plus que si l'espace courant est `fle`.

### 5. Les trois encadrés de l'accueil prof

- **À corriger** : copies remises (`status: submitted`, non « non rendu ») sans correction
  visible, par activité, avec le nombre et le lien vers les copies.
- **Échéances à venir** : sessions ouvertes dont l'échéance tombe dans les 14 jours, par
  date, avec l'état des remises (n/N).
- **Élèves en retard** : sessions dont l'échéance est passée et où des élèves n'ont pas
  remis — l'activité, la classe, les noms (déchiffrés serveur).
- Servis par `GET /api/accueil-prof?espace=classique|fle`, calculés à la demande (pas de
  stockage), même gabarit visuel que `/accueil` élève (blocs, lignes cliquables).

## Ce qu'on fait

1. **Renommage A** — `layout.tsx` (titre), `Header`, `WorkTopBar`, pages copies, `login`,
   `rgpd`, `roadmap`, scénarisation, `OeuvreBuilder`, User-Agents. Visible : l'onglet du
   navigateur et l'en-tête disent RectoVerso.
2. **Fin du flip** — CSS de `FlipEditor`, `CreationForm`, `EditDevoirModal`, `OeuvreBuilder`,
   `VocabulaireListReadOnly`, `VocabulaireActivity` (hors flashcards). Visible : le double
   bouton change la face en un fondu, sans rotation.
3. **Contexte d'espace + double bouton** — `src/contexts/EspaceContext.tsx`,
   `Header` (bouton ambre « Espace classique | Espace FLE » à côté de la cloche, menus par
   espace et par rôle). Visible : le bouton, les menus qui changent.
4. **Pages FLE prof** — `/activites-fle` (séquences + activités FLE avec classe),
   `/ressources-fle` (théorie + activités FLE sans classe), `/parcours-fle` redirige ;
   `/classes` et `/dashboard` filtrés par espace. Visible : plus rien de FLE en classique,
   que du FLE en FLE.
5. **Accueil prof** — `/accueil` (rôle prof) + `/api/accueil-prof`. Visible : les trois
   encadrés, dans chaque espace.
6. **Élève FLE** — double bouton, défaut `fle` si classes toutes FLE, renvoi conditionnel.

## Ce qu'on ne fait pas dans ce chantier

- Pas d'infra renommée (URL, VPS, PM2, dépôt, extension, clés techniques).
- Pas de refonte recto/verso : la donnée `flipInverted` et le double bouton restent.
- Pas de retouche de la page d'accueil élève.
- Les documents du harnais gardent « Recto-versIA » dans l'historique ; seuls `init.md`
  et `AGENTS.md` reçoivent une ligne « nom affiché : RectoVerso ».

## Comment on saura que ça marche

- JP prof : l'onglet dit RectoVerso ; en classique, Mes Classes ne montre pas FLE 4 et
  l'accueil liste ses copies à corriger ; il bascule en FLE : FLE 4 apparaît, Mes activités
  FLE montre ses séquences, l'accueil ne parle que de FLE 4.
- eleve07 (classes mixtes) : double bouton, classique = son accueil habituel, FLE = Mon
  cours FLE. Un élève FLE-only arrive sur Mon cours FLE et peut passer en classique.
- Le formulaire de création bascule recto/verso en fondu.

## Points à trancher par l'utilisateur

- [ ] **Le nom** : RectoVerso (aujourd'hui) remplace Traces (20/09) ? Et l'orthographe
      exacte : « RectoVerso », « Recto-Verso », « Recto/Verso » ?
- [ ] **Mes ressources FLE** = points de théorie + activités FLE sans classe ; **Mes activités
      FLE** = séquences + activités données à une classe FLE. D'accord avec ce partage ?
- [ ] **Flashcards** : elles gardent leur retournement (cartes), seul l'effet « page » part ?
- [ ] **Élèves en retard** : échéance passée et copie non remise — sur 30 jours glissants,
      ou sans limite ?
