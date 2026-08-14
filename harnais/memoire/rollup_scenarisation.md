# Rollup — Design & scénarisation didactique

> Sessions des 2026-08-14 et 2026-08-15. Nouvel outil prof : la **colonne
> vertébrale d'un cours**, dont les activités Recto-versIA ne sont qu'un
> aboutissement possible.
>
> **Livré, testé partiellement** — la session du 15 a corrigé ce que JP a vu à
> l'écran le 14. La refonte du 15 (genres de ligne, gestes automatiques) n'a
> **pas encore été vue**.

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

- [ ] **Tester la refonte du 15/08** : genres de ligne, gestes automatiques,
      objectifs dans le bandeau, colonne Critique, menus au premier plan.
- [ ] Glisser-déposer des modules d'une période de l'année à l'autre (vue par
      module) — aujourd'hui : menu déroulant + flèches ↑↓.
- [ ] Certification : la relier à une activité certificative (`devoirId` existe
      dans le modèle, l'interface ne le pose pas).
- [ ] Archivage d'une scénarisation (`archive` existe, aucun bouton).
