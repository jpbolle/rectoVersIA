# 2026-10-11 — Atelier de conceptualisation : point de départ, corrigé du prof, pastilles, aide IA

> ⚠ **Trace datée.** Ce plan dit ce qui a été proposé le 2026-10-11 et pourquoi.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **validé par JP le 2026-10-11** (étape 2 revue : corrigé en vis-à-vis ; étape 3 : « je te fais confiance »).
- **Plans liés** : `2026-10-04-atelier-conceptualisation.md` (l'atelier tel qu'il est livré).
- **Règle de conduite** : 5 étapes ; **une étape n'avance pas tant que la précédente n'a pas
  été vue à l'écran par JP** (règle du macro-plan).

## Ce que JP a dit (2026-10-11)

| Sujet | Décision |
|---|---|
| Point de départ | Un **concept central** + éventuellement **d'autres concepts**, **mélangés** si case cochée |
| Où vont les autres concepts | Étiquettes de l'onglet **« À placer »** (mécanisme existant, vaut pour les 5 types) |
| Où le prof prépare tout ça | Verso « Ajout de contenus » → nouvelle sous-section **« Contenus de l'activité »** |
| Corrigé du prof | Un schéma dessiné dans **Mes Ressources › Conceptualisations** (les corrigés, pas les activités) |
| Comparaison IA côté prof | Lancée par le prof, **colonne de droite**, onglet **Aide IA** ; tableau **2 colonnes** présent / absent ; **✓ / ✗** sur chaque ligne ; ✗ = la ligne disparaît et ne compte plus |
| Compteurs | Sous le tableau : concepts présents, liens établis… **selon le type de schéma** |
| Ce que voit l'élève (✓) | Option A : les lignes acceptées, à côté du schéma du prof, **quand le corrigé est rendu visible** |
| Pastilles | Sur le schéma de l'élève en correction : **vertes** (concept trouvé, lien juste), **rouges** (faux) ; le prof en **ajoute** et en **supprime** — « comme le prof corrige dans la copie en écriture » |
| Aide IA côté élève | Si le prof l'active ; **un seul appel**, possible seulement si le schéma n'est pas vide ; même tableau 2 colonnes **sans boutons** ; colonne de droite = **seulement le nombre** d'idées absentes / en trop, **jamais lesquelles** (« une aide, pas une réponse ») |
| Plus tard | Une grille d'évaluation liée à la conceptualisation |

## Ce que le code impose (constats)

- L'onglet « Aide IA à la réécriture » n'existe **que chez l'élève** (4 boutons ortho, syntaxe…).
  Le prof n'a aujourd'hui, à droite : Consignes · Ressources · Évaluation → **onglet neuf** pour lui.
- Le corrigé de l'écriture (`Devoir.corrigeReference`) n'arrive chez l'élève que si la
  bascule **« Corrigé visible »** de sa classe est active **et** que sa copie n'est pas
  « non rendu » — filtré **côté serveur** (`GET /api/devoirs/[id]`). Le schéma du prof suit
  la même règle, par le même filtre.
- Carte mentale, hiérarchie, ligne du temps **n'acceptent pas de boîte isolée** → d'où les
  étiquettes « À placer » (glissées sur une boîte, elles deviennent une boîte rattachée).
- Nouveaux appels IA : helper `src/lib/claude.ts`, modèle `claude-sonnet-5-5` (règle du projet).

## Étape 1 — Point de départ du schéma (« Contenus de l'activité »)

**Prof** (création + modification de l'activité, verso) : sous-section « Contenus de l'activité »
avec **Concept central** (une ligne), **Autres concepts** (une ligne par concept), case
**« Mélanger les concepts »**.

**Élève** : à l'ouverture d'un schéma encore vide —
| Type | Concept central | Autres concepts |
|---|---|---|
| Carte conceptuelle, schéma libre | Une boîte au centre | Étiquettes « À placer » |
| Carte mentale, hiérarchie | La racine (aujourd'hui = titre de l'activité) | Étiquettes « À placer » |
| Ligne du temps | Le titre du schéma | Étiquettes « À placer » |

Mélanger = l'ordre des étiquettes est tiré au hasard **une fois**, puis gardé avec le schéma.
**Données** : `Devoir.schema` gagne `conceptCentral`, `concepts[]`, `melanger`.

## Étape 2 — Bibliothèque des corrigés + schéma du prof chez l'élève

- **Mes Ressources › onglet « Conceptualisations »** : cartes au gabarit de Mes Ressources,
  « Créer un schéma » (même éditeur plein écran que « Mes schémas » de l'élève), Dupliquer,
  Archiver, **« Utiliser pour une classe »** (crée l'activité avec ce corrigé déjà choisi) ;
  bloc **« Conceptualisations des professeurs »** toujours présent (règle du 09/10).
- **« Contenus de l'activité »** : « Corrigé du professeur » → choisir un schéma de la
  bibliothèque (aperçu), le changer, le retirer.
- **Élève** (JP, 2026-10-11) : les deux schémas **en vis-à-vis** — sa copie dans la colonne
  de gauche, le schéma du prof dans un onglet **« Corrigé »** de la colonne de droite (lecture
  seule). L'onglet n'est **cliquable que quand le prof a corrigé la copie**. Même onglet pour
  l'atelier d'écriture (voir la règle de « corrigée » à trancher, en fin de plan).
- **Corrigé copié dans l'activité** (validé par JP, 2026-10-11 : « copie ! ») — modifier la
  bibliothèque ensuite ne change pas les activités déjà données.
- **Données** : schémas du prof dans la collection existante `schemasPersonnels`, marqués
  `prof: true` (jamais mêlés à ceux des élèves) ; `Devoir.schema.corrige = { sourceId, titre, diagram }`,
  retiré des réponses à l'élève tant que le corrigé n'est pas visible.

### Règle de la copie corrigée (JP, 2026-10-11 — vaut pour l'écriture ET la conceptualisation)

| Geste du prof (page de correction) | Copie de l'élève | Onglet « Corrigé » | Corrections du prof (annotations, pastilles) |
|---|---|---|---|
| **« Rendre visible pour cet élève »** | passe en **rendu** → **verrouillée** (qu'il l'ait remise ou non : la remise n'est qu'une indication pour le prof) | **cliquable** | visibles |
| **« Remettre la copie à l'élève »** (l'actuel « renvoyer en correction ») | redevient **modifiable** | **fermé** | **visibles** — il corrige sa copie en les voyant, comme en écriture |

- Onglet « Corrigé » cliquable ⇔ correction visible **et** copie rendue.
- La bascule par classe « Corrigé visible / caché » (page des travaux) **disparaît** : le
  geste est désormais copie par copie.
- Écriture : l'onglet « Corrigé du professeur » remplace l'affichage actuel du corrigé dans
  « Remarques du professeur ».

## Étape 3 — Pastilles du prof sur le schéma de l'élève

- Page de correction, colonne de gauche : le schéma de l'élève en lecture seule reçoit des
  **pastilles discrètes** — vertes (juste) / rouges (faux) — sur les **boîtes** et sur les
  **liens**. Clic sur une boîte ou un lien : vert → rouge → aucune.
- **Élève** : voit les pastilles quand la correction est rendue visible (même règle que le
  commentaire général).
- **Données** : dans la correction (`corrections`), `schemaMarques` : `{ boites: {id: ok|faux}, liens: {id: ok|faux} }`.
- ⚠ Point dur : les trois sortes de boîtes de l'éditeur sont trois implémentations distinctes
  (dette héritée de SchémaKit) — la pastille doit être posée dans les trois. Pour les arbres,
  le « lien » est le rattachement au parent : pastille sur la branche si l'éditeur le permet
  sans détour, sinon second point sur la boîte (à trancher à l'écran).

## Étape 4 — Aide IA du prof (comparaison avec le corrigé)

- Onglet **« Aide IA »** dans la colonne de droite (atelier de conceptualisation seulement),
  bouton **« Comparer avec mon corrigé »** (grisé sans corrigé ; « Relancer » possible).
- **Tableau 2 colonnes** :
  | ✔ Présent dans le schéma de l'élève | ✘ Absent, en trop ou erroné |
  |---|---|
  | concepts trouvés · liens justes | concepts manquants · concepts en trop · liens manquants · liens faux |
  Chaque ligne : **✓** / **✗**. ✓ sur une ligne qui vise une boîte ou un lien de l'élève →
  la **pastille** correspondante (vert/rouge). ✗ → la ligne et sa pastille disparaissent.
- **Compteurs** sous le tableau, selon le type :
  | Type | Compteurs |
  |---|---|
  | Carte conceptuelle, schéma libre | Concepts présents (x / total du corrigé) · Liens justes · Liens faux · Liens manquants · Concepts en trop |
  | Carte mentale, hiérarchie | Idées présentes · Bien rattachées · Mal rattachées · Idées en trop |
  | Ligne du temps | Événements présents · Bien placés · Mal placés · En trop |
  Calculés sur l'état final : lignes acceptées **et** pastilles ajoutées à la main.
- **Élève** (option A) : les lignes acceptées s'affichent à côté du schéma du prof quand le
  corrigé est visible.
- **Données** : collection `aiSchemaComparaisons`, document `AISCHEMA-{travailId}` (résultat,
  décisions ✓/✗, instantané des deux schémas). L'IA reçoit les deux schémas **avec les
  identifiants des boîtes et des liens**, pour que chaque ligne vise une boîte précise.

## Étape 5 — Aide IA de l'élève

- Si le prof a activé l'accès IA : onglet **« Aide IA »** (libellé sans « réécriture » pour ce
  type), bouton **« Comparer mon schéma »** — **un seul appel par copie**, actif seulement si
  le schéma n'est pas vide (et si l'activité a un corrigé).
- Même tableau 2 colonnes, **sans boutons** : à gauche les concepts et liens trouvés ; à
  droite **seulement des nombres** (« 3 idées absentes », « 1 lien à revoir »).
- ⚠ Les lignes « absent / en trop » sont **retirées côté serveur** avant l'envoi : sinon
  l'élève les lirait dans l'onglet Réseau de la console.
- **Données** : `AISCHEMA-ELEVE-{travailId}` (séparé de la comparaison du prof).

## Repéré au passage

- ~~Le bouton « évaluation IA » côté prof dans l'atelier d'écriture appelle une route qui
  refuse le prof (403).~~ **Corrigé le 2026-10-11** : le prof qui peut agir sur la copie
  déclenche l'évaluation quand l'élève ne l'a pas fait (copie lue en base) ; au passage,
  l'élève ne peut plus la déclencher sur la copie d'un autre.
- La liste des activités élève (`GET /api/devoirs`) envoie le corrigé d'écriture **sans
  vérifier « non rendu »** (la page de l'activité, elle, le vérifie).
