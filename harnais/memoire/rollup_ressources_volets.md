# Rollup — Les ressources de l'élève en volets titrés

Séance du **2026-09-01 (soir)**. Livré, **vu à l'écran et validé par JP**.
Non déployé.

## Ce qui posait problème

Le verso d'une fiche activité peut porter une image, trois vidéos, un contenu
interactif et un document. Tout était affiché **déplié**, groupé **par nature**
(« 🖼️ Images », « 🎬 Vidéos »…) : la colonne de droite de l'élève devenait un
rouleau où il ne retrouvait rien, et aucune ressource ne portait de nom.

## Ce qui a été livré

**Un volet dépliant par ressource**, portant le titre que le professeur lui
donne. Le premier est ouvert, les autres repliés.

| Ressource | D'où vient son titre |
|---|---|
| Image | `titre` (neuf) — à défaut le **nom du fichier** |
| Vidéo | `titre` (neuf) — à défaut « Vidéo 1 » |
| Contenu interactif | sa **`legende`**, qui existait déjà : rien à ressaisir |
| Liens / Document | `outilsTitre` / `documentTitre` (neufs) — à défaut « Outils » / « Document » |

Côté prof : un champ **« Titre de la ressource »** dans chacun des cinq onglets
du verso. Le mot « Légende » a disparu de cet écran — même libellé partout, le
libellé par défaut passant en infobulle.

## Décisions et pièges

### Les vidéos ont changé de forme, sans migration
`ressources.videos` était un `string[]` (des adresses nues) : il n'y avait
aucune place pour un titre. Le champ accepte désormais **les deux formes**
(`string` ou `{ url, titre }`) et **`normaliserVideos()`** (`src/types/devoir.ts`)
les ramène à une seule. On lit les deux, on n'écrit plus que la forme objet.
⇒ **Ne jamais lire `ressources.videos` directement.**

### Le document annotable n'est jamais démonté
Replié, il est **caché en CSS** (`.voletCorpsCache`), pas retiré du DOM :
l'éditeur d'annotations mesure la position de ses notes dans la marge, et le
remonter ferait sauter la gouttière. C'est le sens du drapeau `garderMonte`
d'un volet.

### Les volets sont indépendants, pas un accordéon
Ouvrir une image ne referme pas le document : un élève compare volontiers un
texte et l'image dont il parle. Rien n'est enregistré — c'est un confort de
lecture, pas une donnée.

### Aucun changement serveur
`sanitizeRessources` laisse déjà passer les champs qu'il ne connaît pas ; seul
l'onglet Interactif y est filtré, et il n'a pas bougé. Un titre vide n'est pas
posé (Firestore refuse `undefined`).

### `normaliserVideos` rend un tableau neuf
Il est dans les dépendances d'une dizaine de `useCallback` : mémoïsé dans
`RessourcesInput` (règle des objets instables, `AGENTS.md`).

## Ce qui reste

- [ ] À décider après usage : le premier volet ouvert est-il le bon choix quand
      la première ressource est une grosse image ?
- [ ] Le mot « Légende » subsiste **ailleurs**, volontairement : constructeur de
      questionnaire et éditeur d'œuvre (ce sont des légendes d'image *dans* un
      contenu), et légende des ceintures. À aligner seulement si JP le demande.
- [ ] En base, le champ des contenus interactifs s'appelle toujours `legende` —
      le renommer imposerait une migration pour un gain nul.
