# Rollup — Activité d'auto-évaluation

> Session du 2026-08-15. **Cinquième dispositif** de l'application, à côté
> d'écrire, lire, rechercher et vocabulaire.
>
> **Livré, rien testé à l'écran.**

## L'intention

Amener l'élève à porter un regard sur **l'un de ses travaux** ou sur **son
attitude pendant une période**. Ce n'est pas une évaluation du prof : rien n'y
est juste ou faux, et le questionnaire **ne produit aucune note**. Ce qu'il
produit, c'est une parole de l'élève sur son propre travail — puis, depuis la
demande du 15/08, une **confrontation à deux regards**.

## Le dispositif à deux regards (décision de JP, 2026-08-15)

> Le prof **ne lit pas** d'abord les réponses de l'élève. Il répond lui-même aux
> mêmes questions, en donnant son propre jugement sur cet élève. La réponse de
> l'élève ne se découvre qu'**ensuite**, juste à côté de la sienne.

Sans ce voile, le prof serait influencé et la comparaison ne vaudrait plus rien.
Le dévoilement se fait **question par question** : dès que le prof s'est
prononcé sur une question, l'élève se découvre sur celle-là.

### Ce que l'écart produit

| Position de l'élève vs celle du prof | Verdict |
|---|---|
| Même échelon | **Se voit juste** |
| En dessous | **Se sous-estime** |
| Au-dessus | **Se surestime** |

Seuils retenus : un écart d'**un cran** est une nuance, **deux crans ou plus**
un décalage « net ». Sous **un demi-cran** de moyenne, on dit que l'élève se
voit juste plutôt que de trancher.

### RÈGLE À NE JAMAIS PERDRE — seules les questions ordonnées se comparent

Sentiment de compétence et échelle 1-5 : oui. **Une émotion ne s'évalue pas** —
personne ne peut dire à un élève qu'il s'est trompé en se sentant découragé. Un
choix multiple et un texte ne se placent sur aucun axe.

⇒ Le prof **ne répond pas** à ces questions-là : elles lui sont montrées
d'emblée, comme un **témoignage à lire**.

## Les six manières de répondre

| Type | Ce que c'est |
|---|---|
| `competence` 🤩 | emoji : sentiment de compétence (5 échelons ordonnés) |
| `humeur` 😌 | emoji : émotion ressentie (5 échelons — **non comparables**) |
| `likert` 📊 | curseur de 1 à 5, bornes rédigées par le prof |
| `qcm` ☑ | choix multiple **sans bonne réponse** : des positions |
| `texte-court` / `texte-long` | l'élève explique |
| `info` ℹ️ | bloc informatif, pas une question |

La valeur **stockée est l'identifiant de l'échelon**, jamais l'emoji : les
libellés peuvent changer sans rendre illisibles les réponses déjà données.

## Ce qui a été livré

| Fichier | Rôle |
|---|---|
| `src/types/autoevaluation.ts` | Modèle, échelles, `parseAutoEvalAnswers` |
| `src/lib/autoevaluation-server.ts` | Nettoyage serveur (rien à filtrer pour l'élève : aucun corrigé à protéger) |
| `src/lib/autoeval-scoring.ts` | **Comparaison des deux regards** — `comparer()`, `estComparable()` |
| `AutoEvalBuilder` | Constructeur prof (verso), gestes limités au savoir-être et au réflexif |
| `AutoEvalActivity` | Écran élève — emojis en grandes cibles (Chromebook), curseur, barre de progression |
| `AutoEvalReview` | Écran prof — le voile et les deux colonnes |
| `AutoEvalEvaluation` | Onglet Évaluation — tendance, répartition, axe à 5 crans (● élève, ○ prof, ◆ les deux) |
| `/api/profil/reflexif` + onglet **🪞 Me connaître** | Lucidité dans le temps, et **par geste** |

- Dispositif : `TypeTravail` gagne `'autoevaluation'`, `ATELIERS` gagne
  « Activité d'auto-évaluation » (mode par défaut : **réflexif**).
- Le regard du prof vit dans `correction.autoEvalProf` (clé = question).
  Enregistré **immédiatement** au clic : c'est lui qui déverrouille l'écran.
- Visibilité : côté élève, le regard du prof et la comparaison n'apparaissent
  **qu'une fois la correction rendue** — sinon il lui suffirait de recopier.

## Conséquences à ne pas oublier

- Une auto-évaluation est **exclue des statistiques notées** du profil
  (`buildDevoirStats`) : l'y compter la ferait apparaître comme un **zéro**.
- Elle ne produit ni moyenne ni médiane de devoir. C'est voulu.
- Nouvelle famille didactique **« Gestes de savoir-être »** (`savoirEtre`) dans
  `TYPES_MODAUX` — 19 habiletés de départ posées en base le 2026-08-14 par
  `scripts/import-savoir-etre.ts` (rejouable sans risque).

## TODO

- [ ] **Tout tester** — rien n'a été vu à l'écran.
- [ ] Vérifier la remise : l'élève passe par le bouton « Remettre » habituel
      (ni voile NavigKid, ni cas vocabulaire) — non vérifié.
- [ ] Rien n'oblige encore l'élève à répondre aux questions marquées
      « obligatoire » avant de remettre : le champ existe, la remise ne le
      contrôle pas.
- [ ] Un prof qui n'a pas répondu ne voit jamais les réponses de l'élève : à
      confirmer que c'est bien ce que JP veut sur la durée (aucune échappatoire
      n'est prévue).

---

## Session du 2026-08-15 (suite)

- Constructeur : énoncé en `AutoGrowTextarea`, icône de duplication agrandie.
- **`devoir.autoEvaluation`** — le réglage d'auto-évaluation intégrée est
  MASQUÉ sur ce dispositif : une activité d'auto-évaluation EST déjà cela.
  Voir `rollup_lucidite`.

---

## Session du 2026-08-16 — premier test à l'écran

Le dispositif **plantait à la première réponse**. Trois défauts, tous nés du
fait qu'`AutoEvalActivity` n'avait pas hérité de ce qui avait déjà été corrigé
dans `LectureQuizActivity` :

| Symptôme | Cause | Correctif |
|---|---|---|
| « Cannot update a component while rendering a different component » dès qu'un élève coche | `onChange` appelé **dans** la fonction passée à `setAnswers` — React la rejoue pendant le rendu | Pattern `ref` (`answersRef` / `onChangeRef`), identique à `LectureQuizActivity` |
| Au-delà de 5 questions, les suivantes inatteignables | `.activity` sans `flex: 1 / min-height: 0 / overflow-y: auto` | Ajoutés |
| Remise absente du dispositif | « Remettre le devoir » vivait dans la barre du haut | **Bouton « Envoyer mes réponses » au bas du questionnaire**, `hideSubmit` dans la barre — même forme que la lecture |

Autres ajustements du 16 :

- Onglet **« Remarques du professeur » retiré** : il n'y a pas de copie annotée.
  Le regard du prof se lit dans l'onglet Évaluation, en face de celui de l'élève.
- Verso de la création : **« Ressources pour l'élève » masqué** — l'élève se
  prononce sur les cours qu'il vient de vivre, pas sur un dossier qu'on lui
  remettrait ici. Et les **intertitres du verso ne s'affichent plus que si les
  deux groupes sont présents** : seuls, ils répétaient le titre du verso
  (« Ajouter des contenus » suivi de « Contenus de l'activité »).
- Popup de confirmation reformulée : on n'y « remet » pas un travail, on envoie
  ce qu'on pense de soi.
- Le rappel « N questions sans réponse » passe **sous** le bouton, discret :
  à côté, il se lisait comme un avertissement qui retenait l'envoi.

**Toujours à tester** : le parcours complet élève → prof (réponse à l'aveugle) →
onglet Évaluation (lucidité).
