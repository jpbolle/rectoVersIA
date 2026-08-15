# Rollup — Onglet UAA et roue des ceintures

> Session de **réflexion** du 2026-08-15 (soir). **Rien de codé, rien tranché.**
> JP : « garde en mémoire notre réflexion, on y reviendra demain. »

## L'intention

Un **8ᵉ onglet du profil élève** (🥋) qui, pour chaque UAA :

- affiche le **total des évaluations certificatives** ;
- liste ces évaluations et leurs points respectifs ;
- montre une **roue des UAA** où l'élève progresse et gagne des **ceintures**,
  puis un **badge** quand l'UAA est au bout.

Référence visuelle : le tableau de bord « Ceintures par UAA certificative » de
JP (demi-roue à 7 branches, UAA 0 en haut, arcs de couleur = ceintures,
silhouettes de karatéka placées sur l'arc atteint, mention « Attendus du mois »).
**JP possède déjà toutes les images** (badges, ceintures, boucliers d'UAA).

## État du code au 2026-08-15

| Brique | État |
|---|---|
| `evaluation: 'formatif' \| 'certificatif'` | **Existe** sur chaque activité, mais n'est qu'une **pastille d'affichage** (`DevoirCard`). **Aucun calcul ne l'utilise.** L'onglet en serait le premier usage réel — pas de migration, les données sont collectées depuis la création du champ |
| UAA d'une activité | **Deux chemins** : écriture → les UAA de la **grille** (`devoir.uaa`, nombres, enrichi côté serveur) ; lecture / recherche / vocabulaire / auto-éval → union des UAA des **habiletés** cochées (seule l'écriture utilise une grille, cf. `CreationForm` L175). Rien n'agrège les deux |
| Profil | 7 onglets dans `ProfilPanel` — un 8ᵉ s'ajoute sans rien casser |
| **Ceintures** | ❌ **Absentes des données.** Le CSV importé (`scripts/data/ceintures-et-habiletes.csv`, **62 habiletés**) porte : ID, UAA, type modal, geste, habileté. **Pas de colonne ceinture.** Le niveau visible sur les captures de JP ne vit que dans son tableau Google |

Répartition des 62 habiletés : uaa2 → 20 · uaa0 → 11 · uaa5 → 10 · uaa1 → 9 ·
uaa6 → 8 · uaa4 → 3 · uaa3 → 2. (Les 19 habiletés de savoir-être ont été
importées à part.)

## Trois modèles de ceinture présentés à JP

| | Règle | Coût | Ce que ça dit à l'élève |
|---|---|---|---|
| **A. Seuil de score** | La ceinture suit le % certificatif de l'UAA, sur l'échelle à 6 niveaux (0/15/35/60/80/100) | Zéro donnée nouvelle | Un pourcentage repeint en couleur |
| **B. Ceinture = niveau d'habileté** (modèle d'origine de JP) | Chaque habileté porte une ceinture ; l'élève gagne la ceinture N quand les habiletés de niveau ≤ N sont acquises | Champ `ceinture` sur `Habilete` + **taguer 62 habiletés** dans /admin + définir « acquise » (seuil, nombre d'occurrences) | **Actionnable** : « pour la verte, il me reste *référencer mes sources* » |
| **C. Hybride** *(recommandé, non validé)* | La **roue** montre la ceinture (B) ; sous la roue, le **total certificatif** et la liste des évaluations (A) | B + A | Les deux lectures |

## Piste repérée — « Attendus du mois »

La mention figure sur le tableau de bord de JP. Elle peut se **déduire de la
scénarisation** : celle-ci sait déjà quelles UAA sont travaillées à quelle
période de l'année (`ModuleActivite.uaa`, `periodeAnnee`). La roue pourrait
annoncer la ceinture attendue **sans double saisie**.

## Deux questions à trancher avant tout code

1. **Quelle unité pour le total d'une UAA ?** L'écriture produit un % sur
   grille, la lecture des points/max, la recherche **deux** scores (réponses +
   démarche). Additionner des points venus de trois dispositifs ne veut rien
   dire ⇒ tout ramener en pourcentage, pondéré par quoi (points ? périodes ?
   moyenne simple) ?
2. **Une activité vise souvent plusieurs UAA.** Son score compte-t-il **en
   entier dans chacune** (comme le font déjà les habiletés dans l'onglet Lire —
   la somme des lignes ne retombe pas sur un total) ou se **répartit-il** ?
   Penchant proposé : en entier dans chacune, **à condition de l'écrire dans
   l'interface**.
