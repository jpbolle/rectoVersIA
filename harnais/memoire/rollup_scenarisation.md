# Rollup — Design & scénarisation didactique

> Sessions des 2026-08-14 et 2026-08-15. Nouvel outil prof : la **colonne
> vertébrale d'un cours**, dont les activités Recto-versIA ne sont qu'un
> aboutissement possible.
>
> **Livré et testé** — la refonte du 15 (genres de ligne, gestes automatiques,
> fiche de module, suggestions, aplat de bandeau) a été vue à l'écran par JP le
> 2026-08-15 : « top ».

## Le modèle

```
Parcours (= une scénarisation, un cours) > Chapitres > Modules > Activités
```

| Niveau | Ce qu'il porte |
|---|---|
| **Parcours** | nom du cours et réglages horaires — **rien d'autre** |
| **Chapitre** | plusieurs objectifs généraux (liste), affichés dans son bandeau |
| **Module** | période de l'année, objectifs en trois registres, activités. **Synthèse** pour tout le reste |
| **Activité** | la didactique fine : durée, méthode, UAA, gestes, outils, **critique** |

### Décisions de fond (JP)

- **Le parcours ne porte ni objectif général ni certification** (2026-08-15) :
  à ce niveau, un objectif est « trop général pour dire quelque chose ». Les
  deux vivent dans les chapitres.
- **Un chapitre vise plusieurs objectifs généraux** — liste éditable dans le
  bandeau, pas dans le corps (on doit les lire chapitre replié).
- **La didactique se saisit sur l'ACTIVITÉ, pas sur le module** : « sauf quand
  un module est égal à une activité, c'est dans les activités qu'il est
  intéressant de préciser la méthode, les outils, les UAA, les gestes, le
  nombre de périodes ». Le module **affiche** la somme et la réunion.
- **Le prof saisit des périodes**, jamais des heures (`dureePeriodeMin`, 90 par
  défaut). Capacité d'une période de l'année = semaines × h/semaine ÷ durée.
- **Plusieurs scénarisations** coexistent — une par cours, sélecteur en haut.

### Les trois GENRES de ligne (2026-08-15)

Décision structurante : **module, certification et suggestion vivent dans la
même liste** (`ModuleDidactique.genre`). Ils ont exactement le même
comportement — mêmes colonnes, mêmes flèches ↑↓ — ce qui permet à une
certification de **s'intercaler entre deux modules**, comme JP l'a demandé.

| Genre | Couleur | Compte dans les périodes ? |
|---|---|---|
| `module` | teinte du chapitre | oui |
| `certification` ⭐ | ambre | oui |
| `suggestion` 💡 | violet, pointillés | **non** — c'est une idée pour l'année suivante |

Les anciennes `certifications[]` sont converties en modules de genre
`certification` **à la lecture** (`normaliserScenarisation`) *et* côté serveur
(`sanitizeChapitre`) : l'écran ne connaît qu'un seul modèle.

## Gestes : saisis sur l'activité, répartis sur le module

La colonne **Gestes** d'une activité propose **toutes les familles**, groupées
(gestes de lecture, d'écriture, de parole, lexicaux, réflexifs, de savoir-être) :
on voit d'abord les familles, on déplie celle qu'on veut.

Le module ne les saisit plus : ses deux registres **se remplissent** depuis les
activités et se répartissent selon la famille de chaque geste — cognitifs d'un
côté, savoir-être/réflexifs de l'autre.

> Rappel : **geste ⊃ habileté**. La scénarisation coche des **gestes** (niveau
> macro, on planifie), la création d'activité coche des **habiletés** (niveau
> fin, on évalue). Voir `rollup_didactique.md`.

## Les deux vues

- **🗓 L'année** — par module (cartes dans les cinq périodes, capacité et jauge
  par colonne) ou par chapitre (une bande à travers l'année).
- **✎ Encodage** — un tableau par chapitre.
  **Règle dure de JP : tout se modifie sur place, aucune icône crayon.**
  Les champs sont des `AutoTextarea` qui **grandissent avec le texte** : le
  texte doit toujours se voir en entier, jamais être coupé.

## La passerelle, à double sens

Trois chemins depuis un module (`ModuleActivitesModal`) : hors application,
rattacher une activité existante, ou **créer** avec le `CreationForm` habituel.
En retour, le PUT pose `devoir.scenarisationRef` et `DevoirCard` affiche 🧭.

## Technique

- Collection `scenarisations` — **un document par scénarisation**, tout
  imbriqué. Accès **serveur uniquement** ⇒ **aucune règle Firestore**.
- Le PUT **réécrit le document entier** ; `sanitizeScenarisation` filtre tout
  ce qui n'est pas reconnu.
- **Méthodes d'enseignement** : liste `methodes` dans `configuration/didactique`,
  tenue dans /admin.

### Enregistrement — incident de perte de données (2026-08-14)

JP a perdu des données pendant son test. **Trois trous**, tous rebouchés :

1. `charger()` écrasait l'état local par la version du serveur — au retour sur
   l'onglet, le GET doublait un PUT encore en vol, l'écran revenait en arrière
   et la modification suivante réécrivait cette version périmée ;
2. `enAttente` était vidé **avant** la réponse du serveur : un échec réseau
   perdait la modification en silence ;
3. rien ne partait si l'onglet se fermait avant la fin du délai (2,5 s).

Désormais : écriture **immédiate** pour tout ce qui n'est pas de la frappe
(case cochée, menu, ajout, suppression), 1,2 s pour la frappe, envoi forcé au
`blur` du panneau, `keepalive` + `beforeunload`, et un témoin lisible en haut
(**✓ Enregistré** / ● Modifications en attente).

## Gotcha — menu déroulant dans un tableau

Le menu du `TagField` était **rogné en bas** : un `<table>` crée son propre
contexte d'empilement, aucun `z-index` n'y peut rien. Remède : rendu dans un
**portail** à la racine du document, en `position: fixed`, avec repositionnement
au défilement (et retournement vers le haut s'il manque de place en bas).

## TODO

- [x] **Tester la refonte du 15/08** — fait le 2026-08-15, validé.
- [ ] Glisser-déposer des modules d'une période de l'année à l'autre (vue par
      module) — aujourd'hui : menu déroulant + flèches ↑↓.
- [ ] Certification : la relier à une activité certificative (`devoirId` existe
      dans le modèle, l'interface ne le pose pas).
- [ ] Archivage d'une scénarisation (`archive` existe, aucun bouton).

---

## Session du 2026-08-15 — fiche de module, suggestions, refonte visuelle

**Livré et testé.** Un seul retour d'usage : le chevron de dépliage du bandeau
de chapitre était **quasi invisible** (13 px, blanc translucide sur l'aplat).
Devenu une **pastille blanche ronde de 30 px** avec ombre portée, flèche vers le
bas quand le chapitre est fermé.

### La ligne de module ne dit plus que l'essentiel
Module · Période de l'année · **Périodes** · **UAA** · **Activités**.
Les colonnes *Méthodes* et *Gestes* ont disparu : elles se déduisaient déjà des
activités et alourdissaient la ligne.

### Fiche descriptive du module (`ModuleFicheModal.tsx`)
Popup ouverte par **📋 Fiche du module**, dans le menu du module. Elle porte :
- les chiffres en tête, sur bandeau plein (périodes / activités / UAA) ;
- **Concepts et connaissances** — seul champ éditable ;
- méthodes, UAA, gestes cognitifs, savoir-être — **tout se déduit** des
  activités, regroupé sur un fond retiré pour qu'on voie d'un regard ce qui se
  saisit et ce qui se calcule ;
- les activités **en résumé**.

Le menu déroulant du module reste celui des **ACTIVITÉS**, où se fait la saisie.
Une colonne **Concepts** y a été ajoutée (`ModuleActivite.concepts`) — distincte
de `objectifs.concepts`, qui appartient au module.

### Les suggestions sortent de la liste des modules
Une suggestion n'a ni durée, ni période, ni évaluation : la ranger parmi les
modules lui donnait un poids qu'elle n'a pas. Elle devient **du texte attaché
au chapitre** (`ChapitreDidactique.suggestions`), repliée derrière une **ampoule
💡 dans le bandeau** qui annonce leur nombre.
`GENRES` garde `suggestion` pour relire l'ancien ; `GENRES_AJOUTABLES` ne
propose plus que module et certification. **Double migration** (client +
serveur) : un document jamais rouvert ne perd rien au premier enregistrement.

### Refonte visuelle (audit Impeccable)
JP trouvait l'écran « fort terne ». L'audit l'a confirmé, chiffres à l'appui :
trois plans de surface séparés par **1,19:1** au maximum, **77 % des bordures**
en `1px --c-border` (1,56:1), une amplitude typographique réelle de 3 px, et
**3 transitions en 1836 lignes**. Score Nielsen moyen : **2,0/4**.

Corrigé :
- **Bandeau de chapitre en aplat plein** de sa couleur, texte blanc (recette de
  `DidactiquePanel`). C'est le point d'entrée qui manquait. La pastille de
  couleur, redondante, a disparu.
- **La couleur du chapitre est persistée** (`ChapitreDidactique.couleur`) et
  descend en propriété CSS `--ch-color`. Elle était indexée sur la POSITION :
  déplacer un chapitre changeait sa couleur. Deux teintes assombries
  (`#b7950b` → `#8a6f08`, `#4a9a6a` → `#3d7d55`) — elles rendaient trois
  chapitres sur six illisibles.
- **Bande de charge de l'année dans l'en-tête**, visible dans les DEUX vues, et
  chaque option du menu « Période de l'année » annonce sa charge (`Nov — Déc ·
  12/16`). Les jauges n'existaient que dans la vue où l'on ne saisit rien.
- Survol de ligne, transitions, deux poids de bordure, tableau des activités
  qui **défile** au lieu de se comprimer.
- Accessibilité : `--c-text-muted` (3,92:1) → `--c-text-secondary` (7,57:1) sur
  tous les en-têtes ; anneau de focus visible ; bloc `:focus-visible` ;
  `:focus-within` pour les commandes révélées au survol (inatteignables au
  clavier) ; cibles à 26 px ; `TagField` devient un vrai bouton.
- **`supprimerModule` demande confirmation** — il n'en demandait aucune, alors
  que la suppression de chapitre en demandait une.

Détecteur Impeccable : **0 constat** (5 au départ, tous `side-tab`).

### Ce que l'audit a soulevé et qui n'est PAS fait
- **« La belle vue est celle qu'on ne peut pas toucher »** : la vue par chapitre
  est la seule où l'année ressemble à une année, et elle est en lecture seule.
  La rendre manipulable (glisser un module d'une période à l'autre) ferait du
  tableau le mode de repli. C'est une refonte, arbitrage de JP en attente.
- Les **émoji comme iconographie** : refusés par le référentiel Impeccable,
  gardés ici — les remplacer dans ce seul panneau casserait la cohérence avec
  le reste de l'app. Chantier à mener à l'échelle de l'application.
- `prompt()` / `confirm()` natifs dans un système entièrement custom.
- Pas d'annulation, pas de déplacement d'un module d'un chapitre à l'autre.
