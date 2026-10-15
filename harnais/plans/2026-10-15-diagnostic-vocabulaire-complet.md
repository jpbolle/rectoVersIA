# 2026-10-15 — Diagnostic de vocabulaire complet (tous les mots déclarés connus sont testés)

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-10-15 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : proposé → **validé le 2026-10-15** (« applique ton plan ; pour réduire les coûts, oui, Haiku »)
- **Demande initiale** : retours d'un prof testeur (« impossible de cocher tous les mots,
  ça fausse le diagnostic ») ; JP : « diagnostic = diagnostic : il doit vérifier ce que
  l'élève considère comme connu. 30 mots à vérifier = 30 mots à vérifier », avec trois
  pistes : des **paliers** selon le nombre de mots, les **mêmes exercices plusieurs fois**
  pour tout tester, une **génération IA en plusieurs fois** comme pour l'import d'un cours.

## Le problème

Le diagnostic initial ne teste qu'une partie des mots que l'élève coche (lu dans le code,
`VocabulaireActivity.tsx` et `api/vocabulaire/generate`) : les définitions prennent les
**10 premiers** mots seulement, puis 4 paires de synonymes, 3 d'antonymes, 5 trous et
environ 5 phrases. Avec 30 mots cochés, une quinzaine au plus sont testés.
**Les mots cochés mais non testés restent « inconnus »** : un élève qui connaît toute la
liste se retrouve avec la moitié de ses mots « inconnus » (exemple réel en base : 10 mots
testés, 17/17 réussis, le reste de la liste inconnu). De plus, il faut cocher les mots
un par un.

## Options

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Diagnostic en manches** (pistes de JP) | les mots cochés sont répartis en lots de 10 ; chaque lot est une **manche** avec la même série d'exercices ; la manche suivante est générée **pendant** que l'élève fait la précédente | autant d'appels IA que de manches ; l'élève avance par étapes courtes et peut s'arrêter entre deux manches |
| **B — Un seul gros diagnostic** | tous les mots dans chaque exercice (30 définitions à associer, etc.) | un exercice de 30 associations est illisible sur un Chromebook ; un seul appel IA, mais très long |
| **C — Échantillon** | on teste 10 mots tirés au hasard, les autres restent « à vérifier » | rapide, mais ce n'est plus un diagnostic (contraire à la demande) |

**Retenue proposée : A.**

## Ce qu'on fait

1. **Tous les mots cochés d'office** au démarrage du diagnostic, avec une couleur « à
   vérifier ». L'élève **décoche** ceux qu'il ne connaît pas. Nouvelle consigne :
   « Tous les mots sont cochés : décoche ceux que tu ne connais pas, puis vérifie tes
   connaissances. »
   Fichiers : `VocabulaireActivity.tsx` (état initial, consigne), `VocabulaireList.tsx`
   (couleur, compteur).
2. **Les paliers** : nombre de manches = nombre de mots cochés ÷ 10, arrondi au-dessus
   (1 à 10 mots → 1 manche ; 11 à 20 → 2 ; 21 à 30 → 3…). Les lots sont équilibrés
   (25 mots → 9 + 8 + 8, pas 10 + 10 + 5) et mélangés.
3. **Chaque manche reprend la série actuelle** sur son lot : définitions, synonymes,
   antonymes (construits sans IA), texte à trous à menu et emploi en contexte (IA).
   Un bandeau indique « Manche 2 / 3 ».
4. **Génération en plusieurs fois** : la manche 1 est générée au clic ; la manche 2 est
   préparée en arrière-plan pendant que l'élève fait la 1 (pas d'attente entre deux
   manches). Même principe que les sections de la lecture de cours FLE.
5. **Reprise** : les lots et la manche en cours sont enregistrés dans le travail. Un élève
   qui part après la manche 1 reprend à la manche 2, sans refaire la 1.
6. Le diagnostic n'est **terminé** qu'après la dernière manche. Il compte alors 1 seul
   diagnostic, et le plafond de 3 études par jour ne s'y applique pas.

## Ce qu'on ne fait pas dans ce chantier

- Pas de changement des exercices eux-mêmes ni de l'échelle « connu / méconnu / inconnu ».
- Pas de changement des études (6 à 10 mots), ni de l'évaluation finale.
- La remarque 2 du prof (« l'élève tourne en boucle ») n'est pas traitée ici : elle
  attend sa confirmation.

## Coût estimé (à valider)

Une manche = 1 appel IA. Sur Sonnet 4.5 (modèle actuel du diagnostic), environ 0,05 $
par manche, soit environ 3,75 $ pour une classe de 25 élèves qui cochent 30 mots.
Sur Haiku 5.5, environ 0,002 $ par manche (moins de 0,20 $ pour la classe).

## Comment on saura que ça marche

Un élève qui garde les 30 mots cochés fait 3 manches de 10. À la fin, **aucun** mot
coché ne reste « inconnu » : chacun est « connu » ou « méconnu ». La manche suivante
s'affiche sans attente.

## Points à trancher par l'utilisateur (un à la fois)

- [x] Taille d'une manche : 10 mots (proposition retenue d'office avec le plan)
- [x] Modèle du diagnostic : **Haiku 5.5** (JP)
- [x] Diagnostic intermédiaire : **aussi en manches** (même mécanisme, proposition retenue d'office)
