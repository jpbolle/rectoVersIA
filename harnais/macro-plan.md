# Macro-plan — les gros chantiers de l'application

> **À quoi sert ce fichier.** `roadmap.md` dit *où va le produit*, fonctionnalité par
> fonctionnalité. `harnais/memoire/` dit *ce qui s'est passé*, session par session. Il
> manquait la vue du milieu : **les gros chantiers, leur état réel, et dans quel ordre
> on les mène**. Demandé par JP le 2026-09-20 — « plusieurs choses ont été entamées, pas
> toujours achevées ».
>
> Tenu à jour **à la fin d'un chantier**, pas à chaque session.

## La règle qui manque

Le défaut est visible dans toute la mémoire : *écrit d'un bloc, jamais vu à l'écran*. Un
chantier écrit et non vérifié n'est pas une avance, c'est une **dette** — au moment où le
bug se révèle, plus personne ne se souvient du code.

> **Un chantier n'avance pas tant que son étape précédente n'a pas été vue à l'écran.**
> Et « vu » veut dire : par JP, dans l'app, pas par `tsc`.

## État des chantiers entamés

⚠ Les états ci-dessous datent du 2026-09-20 et viennent de la mémoire du projet. JP teste
entre les sessions, souvent sur l'autre poste : **lui demander plutôt que déduire d'ici.**

| Chantier | Où il en est | Ce qui reste |
|---|---|---|
| **Types de questions manipulées** | 7 types écrits, socle `QuestionInteractions/` (2 moteurs). Les QCM et le glisser-déposer ont été joués en classe le 19/09 | **Image à annoter : les 3 jeux sont écrits** (bulles et marqueurs ajoutés le 20/09) — ⚠ **rien vu à l'écran**. Plusieurs types jamais ouverts à l'écran |
| **Espace FLE** (modules, activités, séquences) | Écrit les 14, 15 et 19/09. **Testé par JP** (confirmé le 20/09) | Copies « sans classe » d'un élève venu par une séquence |
| **Daspalecte** (ingestion) | Mots cliqués : déployé et validé le 19/09. Extension 2.0.2 au Web Store | Exercices et tests de lecture **jamais essayés** ; politique de confidentialité à relire |
| **Correction d'une copie** | Vu à l'écran et validé le 20/09 | Quand une **recherche** et une **auto-évaluation** sont-elles « corrigées » ? |
| **Compétition en direct** | Jouée en classe le 19/09 (QCM parfaits) | Les corrections du 19/09 (glisser-déposer, compteur, symboles) **pas revues à l'écran** |
| **Sondage en direct** | Écrit d'un bloc le 08/09 | **Rien vu à l'écran** |
| **Contraction de texte** | Priorité 1 fixée en mai 2026 | Jamais commencé |

## Les gros chantiers à venir

*(ordre donné par JP le 2026-09-20)*

### 1. Activité de schématisation / conceptualisation

**Aucun plan n'existe** — cherché le 20/09 dans `harnais/plans/`, dans tout le harnais du
projet, dans le dépôt `harnais`, dans celui de KitSchool et dans la roadmap Firestore de
l'app. C'est resté une conversation.

⚠ **Mais une maquette existe** : JP l'a travaillée **sur l'autre Mac** et ne l'a **pas
poussée sur GitHub** (confirmé le 2026-09-20 ; le distant était bien au même point que le
local ce soir-là). Elle est donc invisible de cette machine et d'un agent.
**Premier geste du chantier : récupérer la maquette**, la regarder, et écrire le plan
à partir d'elle — pas en repartant d'une page blanche.

Ce qu'on sait : plusieurs **types de schémas** (à recenser avec JP — carte mentale, carte
conceptuelle, ligne du temps, schéma actanciel, tableau à double entrée ?), côté élève
comme côté prof.

Deux clients immédiats, ce qui en fait un vrai chantier et pas un caprice :
- le **portfolio** (étape 2.2 : la mind map du personnage) ;
- les **questionnaires**, où un schéma à compléter serait un type de question de plus.

⚠ À trancher tôt : un schéma est-il un **dispositif** (une activité « schématiser ») ou
un **type de question** (donc un dépôt dans n'importe quelle activité) ? Les deux se
défendent ; la réponse commande tout le reste.

### 2. Terminer les types de questions — dont les questions à image

Le moins cher des quatre, et il **débloque le portfolio** (étape 1.2 de Molière, les
questions liées aux images).

- ~~finir `annotationJeu` : **bulles à compléter** et **marqueurs à placer**~~ —
  **écrit le 2026-09-20** (plan `harnais/plans/2026-09-19-image-annotee-trois-jeux.md`),
  **reste à voir à l'écran** ;
- ouvrir à l'écran les types jamais essayés en vrai ;
- travailler les questions **liées aux images** en général.

### 3. Portfolio d'apprentissage

Plan écrit le 20/09 : `harnais/plans/2026-09-20-portfolio-apprentissage.md`
(+ l'analyse du portfolio Molière, `2026-09-20-portfolio-analyse-moliere.md`).
8 étapes, **en attente de validation**.

**Dépend de** : la schématisation (étape 2.2) et les questions à image (étape 1.2) — mais
ni l'une ni l'autre ne bloque les étapes 1 à 7 du portfolio, qui peuvent commencer avant.

### 4. Recto-versIA devient **TRACES**

Décidé le 20/09. Rien n'est fait. Détail dans `roadmap.md` (§ Ensuite).

⚠ Ce chantier **traverse toute l'application** : interface, emails, page `/roadmap`,
documents du harnais, URL de production, chemin du VPS, process PM2, dépôt Git,
extension Chrome. Deux conséquences :
- il se mène **d'un bloc**, jamais écran par écran ;
- mené pendant qu'un autre chantier écrit du code, il multiplie les conflits.
  ⇒ **À faire dans un moment calme**, pas en parallèle.
- Ce qui se renomme n'est pas ce qui **peut** se renommer : l'URL et le dépôt engagent des
  liens déjà distribués à des élèves et une extension publiée au Web Store. Commencer par
  les **strings d'interface**, qui ne cassent rien.

## Ordre proposé

| Ordre | Chantier | Pourquoi là |
|---|---|---|
| **1** | Finir les **questions à image** | Le moins cher, débloque le portfolio, et referme une dette déjà ouverte |
| **2** | Écrire le plan de la **schématisation**, puis le construire | Bloquant pour le portfolio, utile partout ailleurs |
| **3** | **Portfolio**, étapes 1 à 7 | Le gros morceau ; ses deux dépendances sont levées |
| **4** | **TRACES** | Purement mécanique : à faire quand le code ne bouge plus |

Entre deux, **faire voir** ce qui dort : le sondage en direct, les corrections de la
compétition, les exercices Daspalecte. Ce sont des heures déjà payées.

## Ce qui reste à sa place

`roadmap.md` garde les fonctionnalités (contraction de texte, cahier de notes, icônes,
remplacement des effets *flip*, Immersive Reader…). Un item n'entre ici que s'il **traverse
plusieurs modules** ou **s'étale sur plusieurs sessions**.
