# Plan — Les consignes deviennent une feuille de route cochable

> **Date : 2026-10-09 (soir). Validé par JP (option A), écrit le jour même.**
> **Testé et approuvé par JP le 2026-10-09 (midi), déployé sur le VPS le même jour.**
> Ce plan décrit une intention qui a peut-être été dépassée depuis : ce qui existe
> réellement se lit dans `init.md` et dans `harnais/memoire/`.

## Demande

« Le prof peut ajouter des consignes qui apparaissent dans la colonne de droite de
l'élève, onglet Consignes. J'aimerais que celles-ci soient cochables comme une feuille de
route (voir le journal › ateliers personnalisés de KitSchool). » Puis : « j'aurais préféré
qu'un Entrée agglutine les items en tâches de manière plus visuelle ».

## Les deux options présentées

| | A — une ligne = une étape | B — liste d'étapes structurée |
|---|---|---|
| Côté prof | Le texte reste, chaque ligne devient une case | Nouvel éditeur de liste dans 2 formulaires + aperçu |
| Données | Aucun champ nouveau sur l'activité ; coches = textes de lignes sur `travail` | `Devoir.consignesEtapes: {id, texte}[]` + ids cochés |
| Ligne corrigée après coup | Sa coche seule se réinitialise (clé = texte) | Rien ne bouge (clé = id) |
| Activités existantes | Fonctionnent d'emblée | Migration ou double lecture |

**Choix de JP : A.** Argument retenu : le piège de KitSchool (coches par position qui se
décalent, corrigé le 2026-08-20 par des ids stables) est évité en clé-ant sur le **texte**
de la ligne ; B n'apportait que la réorganisation par glisser.

## Ce qui a été écrit

- `src/lib/consignes-etapes.ts` : `decouperConsignes` (ligne non vide = étape ; `:` final =
  titre ; puces de tête retirées ; doublons suffixés), `avancementConsignes`,
  `basculerConsigne`, `nettoyerConsignesCochees` (garde-fou serveur).
- `Travail.consignesCochees?: string[]` ; routes `travaux/mine` et `travaux/[id]` (GET
  champ par champ + PATCH, permis après remise) ; `useTravail.toggleConsigneCochee`
  (un clic = une écriture, optimiste, retour arrière si refus).
- `ConsignesTab` : cases, texte barré, compteur « faites / total », liens cliquables sans
  cocher ; `AssistancePanel` passe `consignesCochees` / `onConsigneToggle` ; page élève
  (cochable, pas en aperçu) et page de correction prof (lecture seule).
- `ConsignesEditor` (partagé par `CreationForm` et `EditDevoirModal`) : ligne par ligne,
  Entrée / Retour arrière / flèches / collage multi-lignes / « + Ajouter une consigne ».

## Scénario de test

1. Créer une activité avec 4 consignes dont une ligne « Pour ce travail : » (titre) et une
   ligne avec un lien `https://…`.
2. Élève : ouvrir l'onglet Consignes, cocher deux lignes, recharger → les coches restent,
   le compteur dit « 2 / 3 », le lien s'ouvre sans cocher.
3. Prof : ouvrir la copie → mêmes cases, non cliquables.
4. Prof : reformuler une des deux lignes cochées → chez l'élève, seule celle-là est décochée.
