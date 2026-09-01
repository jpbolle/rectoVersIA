# 2026-09-01 — Sondage et jeu-questionnaire EN DIRECT (reprise de quizKit)

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-09-01 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **proposé** — analyse faite et options tranchées le 2026-09-01
  en fin de séance, **rien n'a été écrit**. Reprendre à l'étape 1 (la sonde).
- **Demande initiale** : « J'aimerais ajouter une activité sondage en direct /
  live : but, jouer avec les élèves. J'avais créé une app, `~/Documents/quizKit`.
  Un questionnaire si coté, un sondage si pas de bonne réponse, mais des
  questions lancées en live comme Kahoot, quand le prof décide. Pour le prof,
  cela se passe sur l'app. Pour l'élève, cela passerait bien par l'extension
  NavigKid, puisque mes élèves ont un Chromebook : quand le prof active la
  question, elle apparaît chez l'élève sous la forme d'une popup surgissante.
  Possibilité de créer des groupes en fonction des réponses. Possibilité de jeu
  Kahoot avec podium des élèves les plus rapides et efficaces. Le prof voit les
  résultats du sondage (collectif) ou du questionnaire (par élève / collectif). »

## Le problème

Il n'existe aujourd'hui **aucun dispositif synchrone** dans Recto-versIA. Les
cinq ateliers supposent un élève seul devant son travail, à son rythme. Rien ne
permet de poser une question à toute une classe au même instant et de voir les
réponses tomber — ce qui est pourtant le geste le plus courant en classe.

Une application séparée existe (`~/Documents/quizKit`, projet Firebase
`quizkit-7116e`, en ligne via App Hosting), mais elle vit à côté : ses
apprenants sont anonymes (PIN + prénom tapé à la main), rien ne remonte au
profil de l'élève, rien ne se rattache à une classe ni à une UAA.

## Ce que quizKit apporte, et ce qu'il ne peut pas apporter

| De quizKit | Verdict |
|---|---|
| `src/lib/groupes.ts` — répartition par réponse (identique / varié), recettes par groupe, round-robin, réaffectation à l'arrivée d'un vote | **Portable tel quel.** Fonctions pures, sans dépendance Firebase. La plus belle pièce du lot |
| Le pilotage prof : `currentQuestionIndex`, `questionVisible`, `showResults` | Modèle juste — le prof lance **question par question**. À reprendre |
| Les 4 types de questions (QCM, vrai/faux, nuage de mots, évaluation 1→5) | À reprendre, **plus une image jointe** (décision de JP) |
| Le design Kahoot (Tailwind, Montserrat, formes) | **À refaire en Classica.** L'app n'a pas Tailwind ; les tokens `--c-*` sont sa langue |
| `src/lib/sondages.ts` — Firestore client + `onSnapshot` | **Non transposable.** Règle du projet : aucun accès Firestore client aux données d'élèves, et l'extension ne touche plus Firestore du tout |
| PIN à 6 chiffres + prénom saisi | **Supprimé.** Les élèves sont authentifiés et les **sessions** disent déjà quelle classe joue. Un prénom tapé à la main serait en outre une donnée hors RGPD |

Ce que quizKit **ne sait pas faire** et qu'il faut écrire : les bonnes réponses,
le score, le podium, et tout le rattachement didactique (UAA, habiletés, profil).

## Options

### Le transport du direct — la décision qui commande tout

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Flux poussé (SSE)** | Le navigateur garde une ligne ouverte vers le serveur, qui pousse la question à tous **au même instant**. Tout passe par les routes serveur | Seule option qui rend le podium équitable. ⚠ À vérifier : un proxy qui met le flux en tampon sur le VPS le rendrait muet ; un service worker MV3 est tué au bout de 30 s d'inactivité |
| **B — Interrogation périodique** | L'élève demande « du neuf ? » toutes les 1 à 2 s | Sans risque technique, marche partout. Mais **le départ n'est pas commun** : ±2 s d'écart entre deux élèves. Le podium de rapidité devient approximatif, ou doit être chronométré par le navigateur de l'élève — donc falsifiable |
| **C — Firestore en direct (le modèle quizKit)** | On garde le code existant | Vrai temps réel, déjà écrit. Mais ouvre l'accès Firestore **client** à des données d'élèves — contre la règle du projet — avec des règles à déployer à la main, et **l'extension ne peut pas s'en servir** |

**Retenue : A (flux poussé)**, parce que c'est la seule qui tient l'équité du
podium sans rien céder sur la règle « les données d'élèves passent par les
routes serveur ». B est le repli connu si la sonde échoue.

### Les types de questions

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Les 4 de quizKit** | QCM, vrai/faux, nuage de mots, évaluation 1→5 | Conçus pour répondre en dix secondes sur un petit écran. Le nuage de mots et l'échelle 1→5 n'existent nulle part ailleurs dans l'app. Type neuf, indépendant de l'existant |
| **B — Ceux de l'app (`LectureQuestion`)** | On réutilise le moteur de correction déjà écrit et testé | La moitié des types (appariement, remise en ordre, image à annoter) demandent deux minutes de manipulation : inutilisables dans un jeu. Et il manque le nuage de mots et l'échelle |
| **C — Les 4 de quizKit, moteur de l'app** | Les quatre types, branchés sur le moteur existant là où c'est possible | Une seule façon de corriger un QCM dans toute l'app, mais plus de travail au départ |

**Retenue : A, augmentée d'une image jointe par question** *(décision de JP)*.
L'image passe par la mécanique **`ressourceImages`** déjà en place : base64,
≤ 700 Ko, compression navigateur (`src/lib/image-compress.ts`), servie par
`/api/ressources/image/[id]`. Rien à réinventer, et cette route est déjà pensée
pour du contenu pédagogique sans donnée personnelle.

### La surface de l'élève

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — L'extension d'abord** | L'élève est dans Chrome, n'importe où : la popup surgit | C'est l'expérience voulue *(« l'élève est sur son Chromebook = Chrome : une popup apparaît »)*. Mais un élève dont l'extension est désactivée ne voit rien |
| **B — L'app d'abord** | L'élève doit avoir l'app ouverte | Contraint le déroulement du cours |

**Retenue : A**, avec une page `/direct` dans l'app qui affiche **exactement la
même carte de question**. Ce n'est pas un doublon : c'est ce qui permet de
développer et de faire tester **avant** que le Chrome Web Store ait examiné la
nouvelle version de l'extension, et c'est le filet pour l'élève dont l'extension
est coupée.

## Le dispositif retenu

**Prof, dans l'app** : il compose son questionnaire, **ouvre une manche** pour
une classe — donc pour une **session** —, lance les questions une à une, voit
les réponses tomber, répartit en groupes.

**Élève, dans Chrome** : une popup surgit, il répond, elle se referme.

### Comment la question arrive — deux étages

Une ligne poussée ne peut pas rester ouverte toute la journée pour 1300 comptes.

| Étage | Ce qui circule | Rythme |
|---|---|---|
| **Veille** — « une manche est-elle ouverte pour moi ? » | quelques octets | ~60 s |
| **Direct** — dès qu'une manche est ouverte, la ligne poussée s'ouvre | les questions, poussées à tous au même instant | instantané |

L'élève rejoint donc la partie dans la minute qui suit l'ouverture de la salle,
puis **toutes les questions partent simultanément** : le podium est équitable.

### Le modèle

Un **6ᵉ dispositif `direct`**, portant **deux ateliers** — comme `lecture` et
`lecture-oeuvre` partagent aujourd'hui le dispositif `lire` :

| Atelier | Coté ? |
|---|---|
| **Sondage en direct** | non — rien n'y est juste ni faux |
| **Jeu-questionnaire en direct** | oui — bonnes réponses, score, podium |

Le questionnaire va en **bibliothèque**, à côté de `questionnairesLecture`
(même modèle : on le rejoue d'une classe à l'autre sans dupliquer l'activité).
La **manche** en cours se rattache à une **session** : c'est exactement ce que
le chantier du même jour a rendu possible.

## Ce qu'on fait

| Étape | Contenu | Ce qu'on voit à l'écran |
|---|---|---|
| **1** | **La sonde** : une route qui pousse l'heure toutes les 5 s, jusqu'à une popup d'extension | l'heure qui défile — mais les deux risques sont levés |
| **2** | Dispositif `direct`, les deux ateliers, bibliothèque de questionnaires, les 4 types + image jointe | le prof compose son sondage |
| **3** | Ouverture d'une manche sur une session, lancement question par question, résultats collectifs | **jouable en classe**, sans score |
| **4** | Popup de l'extension NavigKid | l'expérience voulue |
| **5** | Bonnes réponses, score rapidité + justesse, podium | le jeu complet |
| **6** | Groupes (`groupes.ts` porté tel quel), remontée au profil de l'élève | |

### L'étape 1 n'est pas une formalité

Ce sont les deux seuls endroits où le plan peut s'effondrer, et ils se testent
en une heure :

1. **Le flux poussé traverse-t-il le VPS ?** Si un proxy met la réponse en
   mémoire tampon, rien n'arrive chez l'élève.
2. **Le service de fond de l'extension survit-il ?** Chrome tue un service
   worker MV3 après 30 s d'inactivité ; une ligne poussée avec un **battement
   régulier** (~15 s) le maintient éveillé. Technique connue, à vérifier.

Si l'un des deux échoue, on bascule sur l'interrogation périodique (option B)
en le sachant tout de suite — et non après trois soirées de travail.

## Ce qu'on ne fait pas dans ce chantier

- **On ne touche pas à l'échelle d'évaluation.** Un podium de rapidité n'est
  pas une cote : le direct reste **formatif**.
- **On ne migre pas quizKit.** Aucune reprise de données, aucun lien avec le
  projet Firebase `quizkit-7116e`, qui continue sa vie de son côté.
- **On ne garde ni le PIN ni le prénom saisi** : les élèves sont authentifiés.
- **On ne refait pas le design Kahoot** : Classica, comme le reste de l'app.
- **On ne branche pas le direct sur la certification** (pas de note, pas de
  ceinture) tant que les étapes 1 à 5 n'ont pas tourné en classe.

## Comment on saura que ça marche

Le prof ouvre une manche pour la 4C depuis l'app. Sur le Chromebook d'un élève,
dans Chrome, sur n'importe quelle page, une popup surgit avec la question. Il
répond ; l'écran du prof voit la barre monter. À la question suivante, le
podium affiche qui a été juste et rapide.

## Points à trancher par l'utilisateur

- [ ] **Un élève qui rejoint en retard** (arrivé après le lancement d'une
      question) : il répond quand même, ou il attend la suivante ?
- [ ] **Le temps de réponse** est-il limité (un compte à rebours, comme Kahoot)
      ou le prof ferme-t-il la question à la main ?
- [ ] **Le nuage de mots et l'échelle 1→5** ont-ils leur place dans un
      questionnaire **coté**, ou seulement dans un sondage ?
- [ ] **Les résultats du direct remontent-ils au profil de l'élève** (onglet
      Général / Me connaître), ou restent-ils dans la manche ?
- [ ] La popup peut-elle être **refusée** par l'élève (bouton « pas maintenant »),
      ou s'impose-t-elle ?
