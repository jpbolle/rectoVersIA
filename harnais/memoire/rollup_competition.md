# Rollup — Mode Compétition (questionnaire en direct)

Chantier du **2026-09-07**, mené d'un bloc, étapes 1 à 3 sur 6.
Plan et décisions datées : `harnais/plans/2026-09-07-mode-competition.md`
(il remplace `2026-09-01-direct-sondage-quiz.md`, dont le 6ᵉ dispositif `direct`
et le transport SSE sont abandonnés).

> **État en fin de séance (nuit du 7 au 8)** : étapes 1 et 2 **vues à l'écran
> et validées par JP** ; étape 3 écrite et essayée en partie — écran prof, salle
> d'attente, **pastilles du QCM vues** côté prof. Les cinq dernières corrections
> (ci-dessous, « Fin de nuit ») ont été écrites **après le dernier essai** et
> **n'ont pas été vérifiées** — JP teste le 2026-09-08. **Rien n'est déployé.**

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

## Ce qu'il reste

| Étape | Contenu |
|---|---|
| **4** | Score (vitesse dégressive + série), **podium 1/3/5/10**, classement général |
| **5** | Versement de la manche dans `travaux` → correction, Évaluation et profil sans une ligne de plus. Onglet **Statistiques** du prof (qui a répondu, qui n'a rien répondu, qui répond vite et faux) |
| **6** | **Équipes** (`groupes.ts` de quizKit, porté tel quel) |

Puis, comme chantiers séparés : le **sondage** (atelier à part, **toujours
anonyme**, donc sans groupes par réponse — son vrai parent est le questionnaire
d'auto-évaluation, pas celui de lecture), et la **popup de l'extension
NavigKid**.

## À essayer en priorité à la reprise (2026-09-08)

1. **Le scénario qui échouait** : question neuve → l'élève répond → le bandeau
   du prof passe à `1 / 2` → « Arrêter la question » avant la fin → les
   pastilles apparaissent. Si ça tient, la correction n° 1 est bonne.
2. Les **sept types** en partie réelle et leur **affichage des réponses** —
   seul le QCM a été vu.
3. Le verrou après envoi, et la remise à zéro quand on repose une question.

Un vrai compte élève existe (`p1Fd0…`, dans la classe `CLS-mn6br10y-ya1vka`) :
c'est lui qui a servi aux derniers essais.
