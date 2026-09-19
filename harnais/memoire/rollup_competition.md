# Rollup — Mode Compétition (questionnaire en direct)

Chantier du **2026-09-07**, mené d'un bloc, étapes 1 à 3 sur 6 ; **étapes 4, 5 et 6 écrites le 2026-09-08 — le module est complet, rien de 4 à 6 n'est vu à l'écran**.
Plan et décisions datées : `harnais/plans/2026-09-07-mode-competition.md`
(il remplace `2026-09-01-direct-sondage-quiz.md`, dont le 6ᵉ dispositif `direct`
et le transport SSE sont abandonnés).

> **État au 2026-09-08** : étapes 1 à 3 **validées à l'écran par JP** (le
> scénario qui échouait — arrêter la question → les pastilles apparaissent —
> tient : la correction n° 1 du cache était la bonne). **Étapes 4 (score, podium,
> classement), 5 (versement dans `travaux`, détail par élève) et 6 (équipes)
> écrites le 2026-09-08, `tsc` et `eslint` propres, fonctions pures vérifiées
> par un script, RIEN VU À L'ÉCRAN — JP teste EN CLASSE le 2026-09-09.** Les six autres types et leur affichage des réponses n'ont toujours
> pas été joués en vrai. **Rien n'est déployé.**

> **2026-09-19** : JP a joué en classe « Prise de notes — Documentaire arte sur
> le cerveau ». **QCM : parfait.** **Glisser-déposer cassé** (remise en ordre :
> le fantôme restait collé, jusque sur les questions suivantes) — corrigé, cf.
> section du 19/09. **Compteur prof** passé à « X / Y ont répondu » sur ceux qui
> JOUENT. **Écrit, rien vu à l'écran, rien déployé.**

## 2026-09-19 — glisser-déposer et compteur de joueurs

- **Glisser-déposer** (`QuestionInteractions/pointerDrag.ts`) : les écouteurs du
  geste étaient posés sur l'élément saisi ; la remise en ordre le remplace par un
  trou au premier mouvement → écouteurs partis, lâcher jamais reçu, fantôme
  éternel. Écoute désormais sur `window` (filtrée par `pointerId`). En plus :
  `useFantome()` détruit le fantôme si la question disparaît en plein geste, et
  `OrdreField` garde l'ordre provisoire dans un `ref` (au lâcher, il relisait
  l'ordre d'avant le geste : le jeton serait revenu à sa place). Vaut aussi hors
  compétition (questionnaire de lecture, œuvres).
- **Compteur** : `attendus` = les élèves qui **jouent** (vus dans les 15 s par
  leur interrogation d’état, + ceux qui ont répondu), et non plus l’effectif inscrit.
  Présence tenue **en mémoire du processus** (option A de JP) — `signalerPresence`
  / `joueurs` dans `manche-server.ts`, branchés aussi dans le sondage. `effectif()`
  et `Entree.attendus` supprimés. Hors question : « N connectés » (`vue.presents`).
  ⚠ En dév, un rechargement du code peut séparer les caches : compte faussé.

## 2026-09-19 — les résultats après la partie (diagnostic sur la base de production)

Activité `DEV-20260915-8084`, jouée le 16/09 en 4C puis en 4D. Ce que JP a vu :
34 copies « sans classe », toutes « Non ouvert », sans réponse, 0/21, aucune
habileté. Lecture seule en base, trois causes distinctes :

1. **Les deux parties n'ont jamais été TERMINÉES** : les manches sont restées en
   `revele` (4C) et `question` (4D), `versement = null`. Les réponses dorment dans
   `manches/*/reponses` (16 et 18 copies) et n'ont jamais été versées dans `travaux`.
   → **Pas un oubli** : JP a répondu (19/09) que l'activité n'est PAS finie, les
   parties continuent à une prochaine séance. Au 19/09 à 13 h 30, aucune des deux
   n'était encore arrêtée.
   → Il suffira que JP clique « Arrêter la partie » dans chaque classe : le versement
   est idempotent et pose aussi `sessionId`. ⚠ Ne JAMAIS « Ouvrir la partie » à la
   place : `ouvrirManche` réécrit la manche à zéro.
2. **`POST /api/travaux` et `/api/travaux/mine` créaient la copie SANS `sessionId`**
   quand l'élève ouvrait l'activité avant que le prof ait affiché les travaux (donc
   avant `ensureTravaux`). D'où les 34 copies sans classe, créées le 16/09 entre
   7 h 50 et 8 h 31. **Corrigé** : `sessionId: mes.sessions[0]?.id ?? null`. Ces routes
   nomment aussi l'élève par son email (`britany.coclet`), pas par son nom.
   **Rattrapage des copies existantes** : `scripts/backfill-sessions.ts` (idempotent),
   complété le 19/09 pour ne jamais rattacher une copie à une session inexistante.
   Simulation : **59 copies rattachables** (cerveau 34, `DEV-20260910-4201` 14,
   `DEV-20260831-6632` 11), 1 laissée (élève hors des classes de l'activité), rien
   d'autre écrit. **APPLIQUÉ par JP le 19/09**, vérifié en base : les 40 copies du
   cerveau sont dans leur classe (4C 19, 4D 21), aucune sans classe. Reste 1 copie
   sans classe dans `DEV-20260831-6632` (élève hors des classes de l'activité).
3. **Les habiletés sont sur l'ACTIVITÉ** (`devoir.habiletes`, 4 ids), aucune sur les
   questions. Or « Par habileté » ne lit que `question.competences`. JP (19/09) : les
   questions n'avaient pas reçu d'habileté, c'est normal — **rien à faire**.

Demandé par JP, pas encore arbitré : pour une activité jouée en compétition, les
3 colonnes (Non ouvert / À corriger / Corrigés) n'ont pas de sens. Il veut le
podium 3/5/10/tous et des stats (répond trop vite, vite et bien). La copie ne compte
que la JUSTESSE, pas la vitesse : c'est déjà le cas (barème de lecture).

## 2026-09-19 — symboles littéraires sur les cases du QCM

JP : les formes ▲ ◆ ● ■ « font trop Kahoot », et au-delà de 4 propositions couleurs
et formes se répétaient (`i % 4`). Désormais **8 teintes** (ni vert ni rouge) et
**8 symboles `lucide-react`** : masque (`Drama`), loupe, épée, plume, sablier, miroir
(`MirrorRound`), parchemin (`ScrollText`), clé (`KeyRound`). **Dépendance
`lucide-react` ajoutée avec l'accord de JP** (option C, préférée aux emoji et au SVG
maison). Rien vu à l'écran.

## Ce qui posait problème

Rien dans Recto-versIA n'était **synchrone**. Les six ateliers supposent un
élève seul devant son travail. Le geste le plus courant du cours — poser une
question à toute la classe au même instant et voir les réponses tomber —
n'avait aucune place dans l'application.

## Le modèle

Un **troisième tempo** sur le questionnaire de lecture, et **c'est le seul axe
qui bouge** : `LectureQuizMode = 'worksheet' | 'quiz' | 'competition'`. Tout le
reste est du réemploi — types de questions, correction automatique,
bibliothèque, images et audios.

| Pièce | Où |
|---|---|
| Modèle de la partie | `src/types/manche.ts` |
| Pilotage, cache mémoire, répartition | `src/lib/manche-server.ts` |
| Routes | `/api/direct/{etat,pilote,reponse}` |
| Interrogation navigateur (1 s) | `src/hooks/useDirect.ts` |
| Écrans | `src/components/Competition/` · `src/app/direct/[sessionId]` |

Une **manche** = l'état en direct d'une **session** (activité × classe).
Document `manches/{MAN-SES-…}`, réponses en sous-collection. Accès **serveur
uniquement** — aucune règle Firestore à écrire ni déployer.

## Les cinq moments d'une question

`salle` → `question` → `resultat` → `revele` → `finie`.

⚠ **`resultat` et `revele` sont deux moments distincts**, et c'est une demande
de JP : le chrono qui s'arrête ne dit pas la réponse, il ouvre la discussion. On
montre d'abord **ce que la classe a répondu**, le prof commente, puis il clique
**« Révéler les réponses »**. Le corrigé ne part du serveur qu'en `revele`.

## Ce qui a été décidé, et qui coûterait cher à redécouvrir

- **Le transport n'est PAS du SSE** : interrogation à 1 s + **départ programmé**
  (« la question N démarre à telle heure », 2 s plus tard). Tous les navigateurs
  l'ont d'avance et l'affichent ensemble ; le décalage devient invisible et le
  VPS n'a rien à traverser. **Synchronisation vérifiée à l'écran sur deux
  navigateurs** — c'était le point qui pouvait faire s'effondrer le plan.
- **Le questionnaire est une RESSOURCE partagée.** Tout ce qui décrit *comment
  cette activité-ci s'en sert* vit sur l'**activité** : `devoirs.lectureMode` et
  `devoirs.hiddenQuestions` (l'œil qui écarte une question — même précédent que
  `hiddenCriteria`). Aucune migration : absent = comportement d'avant.
- **Le figeage d'une session protège les QUESTIONS, pas le MODE.** Les figer
  ensemble interdisait de passer en compétition une activité déjà ouverte une
  fois — l'élève recevait alors le questionnaire entier en worksheet.
- **L'élève ne reçoit AUCUNE question à l'ouverture** en compétition
  (`lectureQuizEnDirectPourEleve`) : elles arrivaient toutes dans son navigateur
  une heure avant la partie, lisibles dans l'onglet réseau.
- **Sept types de questions retenus** : QCM (1 ou n réponses, image jointe),
  réponse courte, appariement, remise en ordre, image à annoter, ensembles, bloc
  informatif. Écartés : réponse longue (ne se corrige pas seule), fluorage,
  matrice.
- **Le mélange des propositions est coupé pour le QCM et la matrice seulement.**
  Ailleurs (ordre, image annotée, ensembles) le mélange EST la question : le
  supprimer donnerait le corrigé.
- **Chrono par question**, 60 s par défaut, jamais déduit du type. Chrono à 0 =
  pas de chrono : c'est le cas du bloc informatif, qui reste affiché jusqu'à ce
  que le prof passe à la suite.
- **Score prévu** (étape 4) : vitesse dégressive 100 → 50 %, jamais « le plus
  rapide gagne ». Une bonne réponse lente vaut mieux qu'une mauvaise rapide.

## L'affichage des réponses — la forme de la question est préservée

Règle posée par JP après une première version en barres génériques, abandonnée :
**la question reste à l'écran telle qu'elle a été jouée, et une PASTILLE y porte
le nombre.**

| Type | Rendu |
|---|---|
| Choix multiple | Les mêmes cases, pastille à droite dans chaque encadré |
| Réponse courte | Nuage de mots, taille selon le nombre |
| Appariement | La grille du jeu, pastille au milieu de chaque lien |
| Remise en ordre | Les places 1→n, l'étiquette majoritaire dans chacune |
| Ensembles | Les boîtes ; un jeton hésitant apparaît dans deux à la fois |
| Image à annoter · bloc informatif | Rien |

⚠ **Aucune couleur de jugement** dans la répartition — ni vert ni rouge : c'est
la minute où la classe se demande encore qui a raison.

## Deux bugs ANTÉRIEURS trouvés en chemin

- **`/api/travaux/mine` et `/api/travaux` ignoraient les sessions** : ils
  lisaient le seul drapeau `disponible` de l'activité. Une activité ouverte pour
  la 4C mais fermée au niveau de l'activité renvoyait un 403 à toute la classe
  (« Ce devoir n'est pas disponible ») alors que le prof venait de l'ouvrir.
  **Touchait tous les dispositifs**, pas seulement la compétition. Corrigé.
- Le **spinner infini** est revenu, à l'identique du gotcha consigné : un
  `if (!headers) return` placé avant la ligne qui éteint le chargement laisse
  l'écran sur « Chargement… » pour toujours dans une fenêtre non connectée.

## Fin de nuit — cinq corrections écrites APRÈS le dernier essai, à vérifier en premier

1. **Le cache se resynchronise depuis la base** à chaque rafraîchissement
   (500 ms), en ne relisant que les copies modifiées (`updatedAt >=`). Avant, la
   reconstruction ne se faisait qu'une fois au démarrage : le serveur qui
   *enregistre* et celui qui *lit* pouvaient tenir deux copies du cache (le
   rechargement du code en dev les sépare ; un second processus en prod ferait
   pareil). **Symptôme vécu** : l'élève répond, le compteur du prof reste à
   `0 / 2`, et aucune pastille quand le prof arrête la question avant la fin.
   C'est la correction qui devrait régler les deux.
2. **Une réponse vide (`{}`) est refusée** et ignorée à la relecture — elle
   consommait l'unique droit de réponse de l'élève (« tu as déjà répondu »
   devant une question à laquelle il n'avait rien répondu). Trouvée en base.
3. **Bouton « Envoyer ma réponse » PARTOUT, QCM à réponse unique compris** —
   règle de JP, contre l'usage des jeux du genre. On compose librement, on
   change d'avis autant qu'on veut, on confirme, **et c'est figé** : le serveur
   refuse une seconde réponse.
4. **Reposer une question la remet à zéro** (réponses effacées chez tous, avec
   `updatedAt` bumpé pour que les autres processus le voient). Décision prise
   seul — JP peut préférer garder le premier tour.
5. Le **refus d'envoi est explicite** (« Trop tard », « Ta réponse est vide »,
   « Tu as déjà répondu ») et **attaché à sa question** — un drapeau simple
   survivait à la question suivante. La confirmation « Réponse envoyée ✓ »
   s'affiche dès le clic, sans attendre le sondage.

## Étape 4 — le score (2026-09-08)

**Option A choisie par JP : des POINTS DE JEU, pas le barème.** 1 000 points par
question quel que soit son `points` — le barème servira à l'étape 5 (versement
dans `travaux`), les deux ne se mélangent pas. Avec des questions à 1 point, le
podium se serait joué sur des décimales.

| Règle | Valeur | Où |
|---|---|---|
| Points d'une question | 1 000 × part de réussite (barème partiel existant, `partReussite`) | `POINTS_PAR_QUESTION` |
| Vitesse | × 1 à l'instant 0, × 0,5 à la fin du chrono, linéaire. Sans chrono : × 1 | `facteurVitesse` |
| Série | +10 % par bonne réponse consécutive (part ≥ 0,5) dès la 2ᵉ, plafond +50 % ; cassée par une mauvaise réponse OU une absence de réponse | `bonusSerie` |
| Égalités | Temps cumulé, le plus rapide devant. Ne pas répondre coûte le chrono entier | `classementDe` |
| Noms | **Prénom + initiale**, déchiffrés côté serveur (`eleves`, lien par `firebaseUid`), une lecture par manche | `nomsDeLaClasse` |

- **Rien n'est stocké** : le classement se recalcule depuis le cache à chaque
  vue en `revele` / `finie`. Une question reposée ou effacée se répercute seule.
- **La question courante n'entre au score qu'une fois RÉVÉLÉE** (ou la partie
  finie) : avant, le score dirait qui a raison.
- ⚠ `Manche.chronos` (`questionId → s`) mémorise le chrono **joué** : sans lui,
  le score des questions passées se calculerait sur un chrono deviné.
- **Prof** : bouton ambre « Afficher le podium » + sélecteur 1 / 3 / 5 / 10 dans
  la barre d'actions ; le podium **remplace la question** dans la colonne
  projetée, un second clic la ramène ; affiché d'office en fin de partie. Le
  choix visible/caché est attaché à l'index de la question — lancer la suivante
  le remet à zéro **sans effet React**. Onglet Statistiques : **classement
  complet** (rang, nom, points, série, réponses), les zéros en retrait.
- **Élève** : à la révélation, « + 820 pts · Total 2 340 pts · 7ᵉ sur 24 · 🔥
  série de 3 » ; en fin de partie, son total et son rang. **Jamais le
  classement des autres** (mineurs, en classe, devant leurs camarades).
- Le podium écarte les élèves à 0 — sauf si personne n'a marqué.
- Le **feedback par mauvaise réponse** (`feedbackParChoix`) s'affichait déjà à
  la révélation dans `CompetitionQcm` : rien à ajouter.

## Étape 5 — la partie devient des copies (2026-09-08)

- **Versement AUTOMATIQUE à « Arrêter la partie »** (`terminer` →
  `verserDansTravaux`), **rejouable sans doublon** (bouton « Verser à nouveau »
  dans Statistiques). Décision prise seul : JP peut préférer un geste séparé.
- Chaque élève ayant répondu à **au moins une** question reçoit son `travail` :
  `content = JSON {type:'lecture', answers}` (la forme exacte qu'écrit
  `LectureQuizActivity`), `status: 'submitted'`, `sessionId` posé. À partir de
  là, correction, onglet Évaluation et profil lisent la partie **sans une ligne
  de plus**.
- **Un élève sans aucune réponse n'est PAS rendu** : sa copie reste en
  brouillon, le prof la déclare « non rendue » s'il veut — comme ailleurs.
- ⚠ Le travail peut exister sous **deux identifiants** (pré-créé
  `TRV-{devoir}-{eleveDocId}` avec `studentId = eleveDocId`, ou créé par l'élève
  `TRV-{devoir}-{uid}`). Rattrapage comme `/api/travaux/mine` : par `studentId`,
  puis par **empreinte d'email** (`eleves` → `decrypt(email)` → `hashEmail`),
  créé en dernier recours. Le pré-créé est **réclamé** au passage
  (`studentId = uid`).
- `Manche.versement = { at, copies }` ; affiché dans Statistiques.
- **Détail par élève** dans Statistiques : une **puce par question** (verte
  juste / ambre partiel / rouge faux / grise sans réponse), le temps au survol.
  C'est là qu'on lit « vite et faux ». Seul endroit du module où les couleurs
  jugent — c'est l'onglet du prof, pas l'écran projeté.

## Étape 6 — jouer par équipes (2026-09-08)

⚠ **Confusion évitée de justesse, à ne pas refaire** : le plan du 7/09 disait
« Équipes : `groupes.ts` de quizKit porté ». Or `groupes.ts` forme des **groupes
de discussion** après une question (réponses identiques / différentes) — cela
appartient à l'activité **SONDAGE**, chantier à venir, **pas** à la compétition.
Les équipes de la compétition, telles que JP les a définies le 2026-09-08 :

- **Tous les élèves du groupe répondent ; le score de l'équipe est la SOMME**
  des scores de ses membres (départage au temps cumulé). Rien de stocké à part
  la composition (`Manche.equipes`, `null` = individuel).
- **Tirage au sort** par le prof (nombre d'équipes choisi), puis **étiquettes
  déplaçables** d'une colonne à l'autre — glisser-déposer natif, aucune
  bibliothèque. Colonne « Sans équipe » pour les non-placés (ils jouent pour
  eux seuls). Possible à toute phase : le score suit les membres.
- Noms = **couleurs** (Rouge, Bleu, Vert, Jaune, Violet, Orange, Rose,
  Turquoise), 8 max, pas renommables. `EQUIPE_TEINTES` pour l'affichage.
- **Podium** : interrupteur Élèves / Équipes à côté des tailles ; les équipes
  par défaut dès qu'il y en a. Statistiques : classement des équipes au-dessus
  de celui des élèves. **Élève** : son équipe et ses coéquipiers dès la salle
  d'attente ; à la révélation et en fin de partie, son score ET celui de son
  équipe.
- Action de pilotage `equipes` : `{ nombre }` (tirage) ou `{ equipes }`
  (composition ; `[]` = plus d'équipes). `tirerEquipes` et `normaliserEquipes`
  sont **pures et testées** (aléa injectable) : tailles à ±1, chacun placé une
  fois, plafond 8, un élève dans UNE équipe (la première), classe vide sans
  plantage.

## Ce qu'il reste

| Étape | Contenu |
|---|---|
| **6 — à tester** | Onglet Équipes → « Former au hasard » → colonnes → glisser une étiquette → la composition tient après rechargement ; l'élève lit son équipe dans la salle ; podium Équipes après révélation |
| **4 — à tester** | Une partie réelle : révéler → « Afficher le podium » → les noms et les points ; l'élève voit son score ; fin de partie → podium final. Vérifier qu'un élève sans réponse figure à 0 dans Statistiques |
| **5 — à tester** | Arrêter la partie → « N copies versées » → la copie s'ouvre dans l'écran de correction habituel avec les bonnes réponses ; l'élève voit son travail rendu dans son activité ; le profil compte la partie |

Puis, comme chantiers séparés : le **sondage** (atelier à part, **toujours
anonyme** — son vrai parent est le questionnaire d'auto-évaluation, pas celui
de lecture ; **c'est LÀ que va la répartition en groupes de discussion de
quizKit, `groupes.ts`**, précisé par JP le 2026-09-08), et la **popup de
l'extension NavigKid**.

## À essayer en priorité à la reprise

1. ~~Le scénario qui échouait~~ — **validé le 2026-09-08**.
2. **Les étapes 4, 5 et 6** (score, podium, classement, versement, équipes) :
   rien n'a été vu à l'écran. Test prévu EN CLASSE le 2026-09-09.
3. Les **sept types** en partie réelle et leur **affichage des réponses** —
   seul le QCM a été vu.
4. Le verrou après envoi, et la remise à zéro quand on repose une question.

Un vrai compte élève existe (`p1Fd0…`, dans la classe `CLS-mn6br10y-ya1vka`) :
c'est lui qui a servi aux derniers essais.
