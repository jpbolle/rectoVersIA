# 2026-09-08 — Atelier SONDAGE : le questionnaire d'opinion joué en direct

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-09-08 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **validé le 2026-09-08** par JP, avec quatre décisions qui amendent le
  texte ci-dessous : **pas de groupes de discussion** (l'anonymat prime — l'option 4 et
  l'étape 3 tombent, `groupes.ts` n'est pas porté) ; **chrono par question, fixé par le
  prof dans le constructeur** ; **réponses longues retenues**, projetées en cartes
  anonymes ; **aucune trace nominative** confirmée. Étape 1 entamée le soir même,
  dans des fichiers neufs.
- **Vient après** le mode Compétition (plan
  [`2026-09-07-mode-competition.md`](2026-09-07-mode-competition.md), six
  étapes écrites, test en classe le 2026-09-09). Il en **réutilise le transport**
  et en **écarte le score**.
- **Demande initiale** : « Nous avons terminé le mode compétition pour l'atelier
  questionnaire. Maintenant, il me semble que nous devons entamer l'atelier
  sondage. » Et, posé le 2026-09-07 en écrivant la compétition : « Le sondage est
  un **atelier à part entière**, **toujours anonyme**. Il se rapproche du
  questionnaire d'**auto-évaluation** (pas de bonne réponse, échelle 1→5, emojis)
  bien plus que du questionnaire de lecture. » Le 2026-09-08 : « C'est LÀ que va la
  répartition en **groupes de discussion** de quizKit (`groupes.ts`). »

## Le problème

Le prof veut poser à toute la classe, au même instant, une question **sans bonne
réponse** — « ce personnage a-t-il eu raison ? », « quel mot te vient ? », « où en
es-tu ? » — voir les réponses tomber, les projeter, en discuter, puis **former des
groupes de discussion** selon ce que chacun a répondu.

Aujourd'hui :
- la **compétition** sait jouer en direct, mais tout y est **coté** : chaque
  question a un corrigé, un chrono, un score, un podium — l'inverse d'un sondage ;
- l'**auto-évaluation** sait poser des questions sans bonne réponse (emojis,
  échelle 1→5, positions), mais **au rythme de l'élève**, seul, et ses réponses
  sont nominatives, lues par le prof dans un dispositif à deux regards.

Il manque le croisement des deux : **les questions de l'auto-évaluation, au tempo
de la compétition, anonymes.**

## Ce que le sondage est — et n'est pas

| | Compétition | **Sondage** | Auto-évaluation |
|---|---|---|---|
| Questions | celles du questionnaire de lecture | **celles de l'auto-évaluation** | celles de l'auto-évaluation |
| Bonne réponse | oui | **non** | non |
| Tempo | le prof | **le prof** | l'élève |
| Chrono | par question, 60 s | **aucun par défaut** — le prof ferme la question à la main (chrono facultatif) | — |
| Identité | nominative (podium, copies) | **anonyme** à l'écran et dans les statistiques | nominative (deux regards) |
| Après la question | répartition → révélation → score | **répartition → groupes de discussion** | — |
| Trace | versée dans `travaux`, profil | **la manche seule** — rien dans `travaux`, rien au profil | `travaux`, onglet Me connaître |

## Options

### 1 — Un atelier neuf, ou un mode de plus sur l'auto-évaluation ?

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Atelier `sondage`**, dispositif `autoevaluation` (comme `lecture-oeuvre` réutilise `lire`) | Entrée dans `ATELIERS`, constructeur `AutoEvalBuilder` **réutilisé tel quel**, l'atelier dit à lui seul « ça se joue en direct ». Le prof choisit « Sondage » à la création comme il choisit « Atelier de lecture » | Une ligne dans `ATELIERS`, un aiguillage dans `/activites/[id]` et `DevoirCard` sur `devoir.atelier === 'sondage'` |
| **B — Un mode `direct` sur l'auto-évaluation** (le précédent de `lectureMode`) | Rien de neuf dans la liste des ateliers | Le sondage n'aurait pas de nom dans l'app. Or JP l'a nommé : « atelier à part entière ». Et une auto-évaluation « en direct » resterait nominative — ce n'est pas la même chose |

**Retenue : A.** C'est la forme que JP a demandée, et le dispositif partagé
donne le constructeur gratuitement. Mode didactique par défaut : `parler` — un
sondage nourrit l'échange oral, ce n'est pas un geste sur soi.

### 2 — Le serveur : réécrire, généraliser, ou s'appuyer

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Généraliser `manche-server.ts`** : une manche porte un `genre`, et chaque fonction branche sur le genre | Un seul moteur | ❌ 1 259 lignes, **testées en classe demain**, dont rien n'est déployé. Y toucher ce soir, c'est risquer le test |
| **B — `sondage-server.ts` à part, qui IMPORTE la plomberie de la compétition** (cache mémoire, entrée, effectif, noms déchiffrés, phases, temps) | On ajoute le mot `export` devant cinq fonctions privées de `manche-server.ts`, **sans en changer une ligne** ; le sondage écrit le sien pour ce qui diverge : répartition par type, groupes, aucun score, aucun versement | La plomberie reste au même endroit ; deux moteurs mais **un seul cache**, **une seule collection `manches`** (le document porte `genre: 'sondage'`) |
| **C — Copier la plomberie** | Aucun contact avec la compétition | Deux caches, deux fois le même bug à corriger. Non |

**Retenue : B**, parce que c'est le seul moyen d'avancer ce soir sans toucher au
comportement de ce qui se joue demain en classe.

### 3 — Les routes et le sondage navigateur

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Les mêmes routes `/api/direct/*`**, qui aiguillent sur le genre de la manche | Rien de nouveau à appeler | Touche la route la plus appelée du projet, la veille du test |
| **B — `/api/sondage/{etat,pilote,reponse}`**, miroir des trois routes ; `useDirect` reçoit l'adresse de base en option | Trois petits fichiers ; **une ligne** dans `useDirect` (l'adresse de base, `/api/direct` par défaut) | Un peu de duplication dans les routes — elles font dix lignes chacune |

**Retenue : B.**

### 4 — Anonymat ET groupes par réponse : comment les deux tiennent ensemble

Le 2026-09-07, le plan disait « toujours anonyme — donc sans groupes par réponse,
les deux s'excluant ». Le 2026-09-08, JP a placé les groupes de discussion dans le
sondage. Les deux tiennent si l'on précise **où** l'anonymat vaut :

| Surface | Ce qu'on y voit |
|---|---|
| Écran projeté, en `resultat` | La **répartition** : des comptes, des mots, des positions — **jamais un nom** |
| Onglet Statistiques du prof | Les mêmes comptes, question par question. **Pas de détail par élève** (c'est le seul dispositif où le prof ne voit pas qui a dit quoi) |
| Groupes de discussion | Des **prénoms** dans des colonnes — c'est le but : chacun doit trouver sa table. En mode « réponses identiques », le groupe dit implicitement ce que ses membres ont répondu ; c'est le prof qui choisit ce mode, en connaissance de cause |
| Écran de l'élève | Sa propre réponse, puis **son groupe et ses coéquipiers** (prénoms) — jamais la réponse des autres |

Le serveur, lui, sait qui a répondu quoi (il le faut pour grouper et pour
refuser deux réponses) — mais **ne le sert jamais** en dehors de la composition des
groupes.

## Les types de questions retenus

Ceux de l'auto-évaluation, avec leur affichage de répartition — **la forme de la
question est préservée, une pastille y porte le nombre** (règle posée pour la
compétition, reconduite).

| Type | Retenu | Répartition projetée |
|---|---|---|
| Choix multiple (1 ou n) | ✅ | Les mêmes cases, pastille dans chacune (`Repartition` de la compétition, forme `choix`, **réutilisée**) |
| Réponse courte | ✅ | **Nuage de mots** (forme `mots`, réutilisée) |
| Sentiment de compétence 🤩 · Émotion 😌 | ✅ | Les cinq emojis en grand, pastille sous chacun |
| Échelle 1→5 (curseur) | ✅ | L'axe à cinq crans, une pastille par cran + la **moyenne** en repère |
| Échelle 1→5 à items · Matrice | ✅ | Le tableau, chaque cellule teintée selon le nombre (plus foncé = plus d'élèves), le compte dedans |
| Bloc informatif | ✅ | Rien — la « diapo » entre deux questions |
| Réponse longue | **à trancher** | Cartes anonymes défilantes, ou écarté (v1) |

Le nuage de mots et l'échelle 1→5 de quizKit **existent déjà** sous ces formes ;
le vrai/faux de quizKit est un choix multiple à deux cases.

## Les moments d'une question

`salle → question → resultat → (groupes) → question suivante… → finie`

- Pas de `revele` : rien à révéler.
- **Pas de chrono par défaut** (`chronoSec = 0`, déjà compris par `phaseEffective`
  comme « reste à l'écran jusqu'à ce que le prof passe »). Le prof **ferme la
  question** avec le bouton existant « Arrêter la question ». Un chrono reste
  réglable pour un « répondez en 20 secondes ».
- **Bouton « Envoyer ma réponse » partout**, une seule réponse par question,
  figée (règle de JP du 2026-09-08, reconduite).
- **Reposer une question la remet à zéro** (comme en compétition).

## Les groupes de discussion (`groupes.ts` de quizKit, porté)

Après une question close, dans la barre d'actions : **« Former des groupes »**.

| Réglage | Valeurs |
|---|---|
| Mode | **Réponses identiques** (les mêmes ensemble : « défendez votre position ») · **Réponses différentes** (mélangés : « confrontez-vous ») |
| Taille visée | 3, 4, 5 (mode « différentes » seulement) |

- `regrouperIdentique` / `regrouperDifferent` sont **portées telles quelles**
  (fonctions pures), avec `cleCanonique` / `formaterValeur` réécrites pour
  `AutoEvalQuestion` / `AutoEvalAnswer` — le cœur de quizKit est là.
- La composition est **stockée dans `Manche.equipes`** — le champ, le panneau à
  colonnes glissables `EquipesPanel`, `monEquipe` côté élève et
  `tirerEquipes`/`normaliserEquipes` **existent déjà** (étape 6 de la compétition).
  Le sondage y ajoute deux façons de remplir : par réponse identique, par réponse
  différente. Les noms restent des couleurs (huit au plus ; au-delà, mode
  « identiques » avec neuf réponses distinctes, on fusionne les moins nombreuses
  dans une équipe « Autres »).
- Projeté : les colonnes avec les prénoms, une teinte par groupe. Élève : « Tu es
  dans le groupe Bleu, avec Léa, Tom et Inès ».
- Les groupes ne survivent pas à la question suivante par défaut — mais restent
  affichables (« Revoir les groupes ») tant qu'on n'en forme pas d'autres.

## Ce qu'on fait

Chacune des étapes se termine sur quelque chose de visible à l'écran.

| Étape | Contenu | Ce que JP voit |
|---|---|---|
| **0** | **Déployer et tester la compétition en classe** (2026-09-09). Rien du sondage ne touche au comportement de la compétition, mais on ne mélange pas les deux tests | La partie en classe |
| **1** | Atelier `sondage` dans `ATELIERS` · aiguillage `DevoirCard` (« 📊 Lancer le sondage ») et `/activites/[id]` · `genre` sur `Manche` · `export` de cinq fonctions de `manche-server` · `sondage-server.ts` (ouvrir, lancer, stopper, terminer, enregistrer) · routes `/api/sondage/*` · `useDirect` paramétré | Le prof crée un sondage avec le constructeur habituel, l'ouvre pour une classe ; l'élève voit la salle d'attente |
| **2** | Écran prof `SondagePilote` (deux colonnes, comme la compétition : question projetée + onglets Questions / Statistiques) · écran élève `SondageActivity` (réutilise les champs de réponse d'`AutoEvalActivity`) · répartition par type | **Jouable en classe** : la question tombe chez tous, les réponses montent, la répartition s'affiche |
| **3** | `groupes.ts` porté (`src/lib/sondage-groupes.ts`) · « Former des groupes » · projection et écran élève | Les groupes se forment sur une réponse, les élèves se lèvent |
| **4** | Onglet Statistiques : les répartitions de toutes les questions posées, relisibles après la partie (la manche est la trace) | Le prof retrouve son sondage le lendemain |

### Fichiers principaux touchés

- `src/types/didactique.ts` — `ATELIERS` gagne `sondage` (dispositif `autoevaluation`)
- `src/types/manche.ts` — `Manche.genre?: 'competition' | 'sondage'` (absent = compétition, aucune migration) ; `SondageRepartition` (formes `emojis`, `echelle`, `grille` en plus des `choix` et `mots` existants)
- `src/lib/manche-server.ts` — **`export` seulement** sur `entree`, `effectif`, `nomsDeLaClasse`, `docToManche`, `reponsesA` (aucune autre ligne)
- `src/lib/sondage-server.ts` **(neuf)** — pilotage, vue, répartition par type, enregistrement, groupes
- `src/lib/sondage-groupes.ts` **(neuf)** — `groupes.ts` de quizKit adapté aux types de l'auto-évaluation
- `src/app/api/sondage/{etat,pilote,reponse}/route.ts` **(neuf)**
- `src/hooks/useDirect.ts` — option `base` (une ligne)
- `src/components/Sondage/` **(neuf)** — `SondagePilote`, `SondageActivity`, `SondageRepartition`, `GroupesDiscussion`
- `src/components/DevoirCard/DevoirCard.tsx`, `src/app/activites/[id]/page.tsx`, `src/app/direct/[sessionId]/page.tsx` — aiguillage sur l'atelier
- `src/components/AutoEvalBuilder/AutoEvalBuilder.tsx` — masquer « obligatoire » et le champ `document` quand l'atelier est `sondage` (sans objet en direct) ; rien d'autre

## Ce qu'on ne fait pas dans ce chantier

- **Aucun score, aucun podium, aucune bonne réponse.** Si un jour on veut « le
  bon mot », c'est la compétition.
- **Rien dans `travaux`, rien au profil, rien dans Me connaître.** Un sondage
  anonyme ne peut pas nourrir un profil nominatif — c'est sa définition.
- **Pas de détail par élève** dans les statistiques du prof.
- **On ne touche pas au comportement de `manche-server.ts`** ni aux routes
  `/api/direct/*` : la compétition se teste en classe le 2026-09-09 telle qu'elle
  est.
- **Pas l'extension NavigKid** (popup surgissante) : chantier séparé, comme pour la
  compétition.
- **On ne migre rien de quizKit** — ni ses sondages, ni ses participants. Seul
  `groupes.ts` est porté.
- **On ne recrée pas les types de questions** : ceux de l'auto-évaluation suffisent.

## Comment on saura que ça marche

Le prof crée un « Sondage » (« Ce personnage a-t-il eu raison ? » en choix
multiple, « Un mot pour ce chapitre » en réponse courte, « Où en es-tu ? » en
emojis), l'ouvre pour la 4C. Sur deux Chromebooks, la question apparaît au même
instant, sans chrono. Les élèves envoient ; le compteur monte « 17 / 24 » ; le prof
ferme la question : les cases se remplissent de pastilles, sans un nom. Il clique
« Former des groupes — réponses différentes, par 4 » : six colonnes de prénoms
s'affichent, chaque élève lit son groupe sur son écran. Le lendemain, les
répartitions se relisent dans Statistiques.

## Points à trancher par l'utilisateur

- [ ] **L'anonymat tel que décrit en option 4** (répartition et statistiques sans
      nom ; prénoms seulement dans les groupes) : c'est bien ça ?
- [ ] **Pas de chrono par défaut**, le prof ferme la question à la main — ou 60 s
      comme la compétition ?
- [ ] **Réponse longue** : retenue en cartes anonymes projetées, ou écartée en v1 ?
- [ ] **Aucune trace nominative** : le sondage ne verse rien dans `travaux` ni au
      profil. Confirmer — c'est irréversible pour les parties déjà jouées.
- [ ] **L'élève voit les prénoms de ses coéquipiers** sur son écran (nécessaire pour
      se retrouver) : OK ?
- [ ] **Ordre** : étape 0 (test compétition en classe demain) avant tout code du
      sondage, ou on écrit l'étape 1 ce soir dans des fichiers neufs ?
