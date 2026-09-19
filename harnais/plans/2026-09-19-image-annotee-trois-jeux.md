# PLAN — Image à annoter : trois jeux, dépôt SUR l'image

> Statut : ✅ **VALIDÉ le 2026-09-19** (« go »). **Étape 1 écrite le 2026-09-19, rien vu
> à l'écran** ; étapes 2 et 3 pas commencées.

### Étape 1 — ce qui a été fait (2026-09-19)

- `LectureAnnotationCible` : `forme` / `w` / `h` ; `cote` n'est plus lu ni écrit ;
  `annotationsReserve` supprimé (la réserve est toujours au-dessus, collante).
- `lecture-server.ts` : garde forme et taille (un encadré sans taille redevient un point).
- `EditeurImageAnnotee` : 3 outils (point / encadré / cercle). Un clic sans glisser avec
  l'encadré ou le cercle pose une zone de 14 × 10 %. Zones numérotées sur l'image.
- `AnnotationField` réécrit : zones posées sur l'image, dépôt dedans, étiquette posée
  affichée dans la zone, attendu en rouge sous une zone ratée. Image plafonnée à 65vh,
  réserve collante (`.annotBank`), masquée en lecture seule.
- La correction et le format des réponses sont inchangés.

## Point de départ

Joué en classe (compétition « Documentaire arte sur le cerveau ») : **aucun élève
n'a su placer une étiquette.**

- **Cause trouvée et corrigée le 19/09** : l'image de la question s'affichait **deux
  fois**. D'abord en atelier de tracé (crayon, cadre, ellipse), sans étiquettes ni
  cases, puis, une image plus bas, l'exercice réel. Les élèves dessinaient sur la
  première. Corrigé dans `LectureQuizActivity` (élève) et `LectureQuizReview` (prof).
- **Reste un défaut de conception** : les bulles à gauche et à droite, reliées par
  des traits, ne marchent pas sur un écran de Chromebook. Elles sont petites, loin de
  l'image, et la réserve est à une image de distance.

## Ce que JP demande

Un réglage **« Jeu »** sur la question, avec trois valeurs :

| Jeu | L'élève… | Réponse |
|---|---|---|
| **Étiquettes à placer** (actuel, refait) | tire des étiquettes de la réserve **sur l'image même** | l'étiquette posée dans chaque zone |
| **Bulles à compléter** | n'a pas d'étiquettes : il **écrit** un groupe de mots dans chaque zone | un texte par zone |
| **Marqueurs à placer** | pose un ou plusieurs **marqueurs** sur l'image | la position des marqueurs |

Plus de bulles latérales ni de traits : **le dépôt se fait sur l'image.**

## Le socle commun : des ZONES posées par le prof

Chaque zone a une **forme** au choix du prof :

- **point** : un rond numéroté, comme aujourd'hui, agrandi pour être une vraie cible
  au doigt ;
- **encadré** : un rectangle tracé à la souris sur l'image ;
- **zone circulaire** : une ellipse tracée de même.

Coordonnées en **% de l'image**, comme partout (`DrawShape`) : indépendantes de
l'écran. Le constructeur gagne un sélecteur d'outil (point / encadré / cercle) au-dessus
de l'image. Clic = point ; glisser = encadré ou cercle.

**Réserve collante** : dans le jeu « étiquettes », la réserve reste visible en haut
pendant qu'on fait défiler une grande image. On ne peut pas faire défiler en tenant
une étiquette sous le doigt.

## Modèle de données — tout en REPLI

| Champ (question) | Rôle | Absent = |
|---|---|---|
| `annotationJeu` | `'etiquettes' \| 'bulles' \| 'marqueurs'` | `'etiquettes'` |
| `annotations[].forme` | `'point' \| 'rect' \| 'cercle'` (+ `w`, `h` en %) | `'point'` |
| `annotations[].acceptees` | bulles : autres réponses admises | — |
| `marqueurOutil` | marqueurs : `'point' \| 'rect' \| 'cercle'` | `'point'` |
| `marqueurMultiple` | marqueurs : plusieurs marques permises ? | une seule |

Réponse élève : `annotations` inchangé pour les étiquettes, donc **les copies
existantes restent justes**. Nouveaux champs : `annotationsTexte` (bulles) et
`marques` (marqueurs). `cote` n'est plus lu.

⚠ **Les questions déjà écrites** passent d'elles-mêmes au nouvel affichage : leurs
points deviennent des zones « point », les bulles disparaissent. Aucune migration.

## Correction

- **Étiquettes** : inchangée (zone juste = la bonne étiquette dedans).
- **Bulles** : ✅ **automatique tolérante** (décision de JP, 2026-09-19). Même
  normalisation que la réponse courte (`normaliserReponseCourte` : majuscules, accents,
  espaces). Pour chaque zone, le prof saisit **plusieurs réponses admises** (la
  première est celle affichée au corrigé). Sa note manuelle prime, comme partout.
- **Marqueurs** : ✅ **automatique, sans pénalité** (décision de JP, 2026-09-19). Le
  prof trace les zones attendues (mêmes outils point / encadré / cercle). Une zone est
  juste si le CENTRE d'au moins un marqueur tombe dedans (zone « point » : tolérance
  d'un rayon fixe). Score = zones trouvées ÷ zones attendues. Un marqueur hors zone ne
  coûte rien. Avec une seule marque permise, la question ne se pose pas.

## Étapes

1. **Zones sur l'image + jeu « étiquettes » refait** : modèle, constructeur (3 outils),
   champ élève (dépôt sur l'image, réserve collante), vue de correction du prof. C'est
   ce qui débloque la question déjà jouée en classe.
2. **Bulles à compléter.**
3. **Marqueurs à placer.**
4. (plus tard, si voulu) En compétition, « ce que la classe a répondu » pour les
   marqueurs : **tous les marqueurs de la classe superposés sur l'image**. Aujourd'hui
   l'image à annoter ne se résume pas.

Chaque étape est testable seule.

## Questions ouvertes (une à la fois)

1. ~~Bulles~~ → automatique tolérante, plusieurs réponses admises par zone.
2. ~~Marqueurs~~ → automatique, zones trouvées ÷ zones attendues, pas de pénalité.
3. ~~Gros point~~ → taille FIXE (~28 px), tolérance de correction fixe en conséquence.
