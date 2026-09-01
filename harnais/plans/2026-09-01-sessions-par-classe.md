# 2026-09-01 — Sessions par classe, et questionnaires en ressources

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-09-01 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : validé le 2026-09-01 — **les 4 étapes livrées**. Rattrapages
  exécutés : 31 sessions, 706 travaux rattachés, 11 sessions et 3 classes
  réétiquetées, 1 questionnaire extrait en bibliothèque.
  **Le figeage est branché** : une session prend sa copie du questionnaire à sa
  première ouverture (trois points d'entrée : ouverture d'une classe, ouverture
  depuis l'activité, création d'une session déjà ouverte), et les sessions
  antérieures se rattrapent à la première consultation du professeur.
  Le questionnaire d'**auto-évaluation** (`autoEvalQuiz`) reste **délibérément**
  embarqué dans l'activité : ce sont toujours les mêmes questions, il n'y a rien
  à réutiliser ni à faire évoluer d'une année sur l'autre. **Ne pas en faire une
  ressource** *(décision de JP, 2026-09-01)*.
- ⚠ Découvert en route : **deux règles d'année scolaire se contredisaient**
  (25 août pour les activités, 1er septembre pour les classes). Corrigé, et
  consigné dans `init.md` §2 « L'année scolaire ».
- **Demande initiale** : « Quand je crée une activité, tous les résultats de mes
  classes s'y retrouvent, et ce d'année en année. Ne devrait-on pas créer un
  atelier et, chaque fois qu'on y ajoute une classe, une session propre à cette
  classe ? »

## Le problème

Trois symptômes observables aujourd'hui :

1. **Mes Activités ne filtre rien.** Le tableau de bord trie sur `archive` et
   `corrige`, jamais sur l'année (`dashboard/page.tsx`). `anneeScolaire` est
   stocké sur chaque devoir et n'est lu par aucune requête. Tout s'empile.
2. **Le corrigé s'ouvre pour tout le monde à la fois.** `corrigeDisponible` est
   un seul drapeau par devoir. Le diagnostic du 2026-09-01 visait la 4C **et**
   la 4D : ouvrir le corrigé pour la classe qui a fini le donne à celle qui
   passe l'épreuve plus tard. C'est le point qui a décidé du chantier.
3. **Rejouer une activité oblige à la dupliquer entièrement.** Le questionnaire
   de lecture vit **dans** le devoir, contrairement à la grille, à l'œuvre et au
   questionnaire NavigKid qui sont des documents à part. La duplication a déjà
   produit des coquilles vides parce qu'un champ neuf n'avait pas été ajouté à
   la liste de copie (commentaire dans `dashboard/page.tsx`) : c'est la dette
   structurelle de ce choix.

## Options

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Filtrer par année, ne rien changer au modèle** | Le tableau de bord s'ouvre sur l'année courante ; interdire d'accrocher une classe d'une autre année | Faible. Ne règle **ni** le corrigé partagé **ni** la duplication |
| **B — Sortir le matériel, garder un devoir = une mise en œuvre** | Les questionnaires deviennent des documents de Mes Ressources | Moyen. Ne règle pas le corrigé partagé |
| **C — Atelier + session par classe** | Une session par (activité, classe), avec sa date, sa disponibilité, son corrigé, son archivage | Le plus lourd, mais le seul qui règle le corrigé par classe |

**Retenues : A, puis C, puis B**, dans cet ordre — A soulage tout de suite sans
rien fermer, C règle le vrai handicap, B élimine la dette de duplication.

### Ce qui rend C faisable

Un travail s'appelle `TRV-{devoirId}-{studentId}` et **un élève n'appartient
qu'à une classe** : le couple (activité, élève) désigne déjà sa session sans
ambiguïté. Les travaux, corrections et notes de certification **ne changent donc
pas d'identifiant** — on leur **ajoute** un `sessionId` calculé une fois. Le
chantier passe d'une refonte à l'ajout d'une couche.

## Ce qu'on fait

### Étape 1 — Filtre par année
Sélecteur d'année sur Mes Activités, ouvert sur l'année courante.
Fichiers : `src/app/dashboard/page.tsx`, `src/hooks/useDevoirs.ts`.
Aucun changement de modèle, aucune migration.

### Étape 2 — Sessions par classe
Collection `sessions` : `{ id, devoirId, classeId, classeNom, anneeScolaire,
profId, dateRemise, disponible, disponibleAt, corrigeDisponible,
corrigeDisponibleAt, archive }`.
`disponible`, `corrigeDisponible`, `dateRemise` et `archive` **descendent** du
devoir vers la session. `travaux` gagne `sessionId` (script de migration, une
fois, **sauvegarde Firestore d'abord**).
`ensureTravaux` travaille par session. Les notifications, `/accueil`,
`/activites` et le profil résolvent la session de l'élève par sa classe.

### Étape 3 — La card d'activité s'ouvre sur ses sessions
Trois sections, dans cet ordre : **sessions de l'année en cours** ·
**terminées / archivées** · **années scolaires antérieures**. Les élèves sont
**dans** une session, plus directement sous l'activité.
Bloc « Activités de cette classe » dans le détail d'une classe — c'est une
**vue**, elle ne demande aucun modèle nouveau (précédent : `ClasseCertifications`).
Action **« ouvrir pour toutes les classes »** dans la card : le moins de clics
possible (demande explicite de JP).

### Étape 4 — Questionnaires dans Mes Ressources
`lectureQuiz` et `autoEvalQuiz` sortent du devoir vers une collection propre,
au même rang que les grilles et les œuvres. L'activité y **renvoie**.
Le constructeur est partagé entre Mes Ressources et le verso de la création,
comme `VocabListEditor` l'est déjà pour les listes de vocabulaire.
**Figeage : la session garde une copie du questionnaire, prise au moment où elle
devient disponible. Aucun bouton de resynchronisation.** JP a écarté l'idée :
s'il retouche un questionnaire pendant l'épreuve, c'est parce que l'application
est jeune, et il faut apprendre à s'en passer. Les copies d'une année restent
lues avec le questionnaire de cette année-là, définitivement.

## Ce qu'on ne fait pas dans ce chantier

- **Le code d'accès NavigKid reste porté par l'activité**, pas par la session.
  Le rendre propre à chaque classe serait cohérent, mais imposerait une nouvelle
  version publiée de l'extension — la 1.4 vient d'être approuvée par le Chrome
  Web Store (2026-09-01). **À porter dans la roadmap de l'application.**
- **Une activité sans classe n'a aucune session** : ni échéance, ni
  disponibilité. La disponibilité devient strictement une affaire de session.
  « Prévisualiser l'espace élève » doit donc fonctionner sans session (accord de
  JP).
- Pas de versionnement des questionnaires (graphe de versions) : une copie par
  session suffit.
- Les scénarisations continuent de pointer l'**activité**, pas la session.

## Comment on saura que ça marche

- Mes Activités s'ouvre sur l'année en cours ; les activités des années passées
  ne s'y trouvent que si on va les chercher.
- On ouvre le corrigé du diagnostic pour la 4C : un élève de 4D qui recharge sa
  copie ne voit **rien** de neuf.
- On clique une card d'activité : on voit des sessions, pas des élèves. On entre
  dans une session : on voit ses élèves à elle.
- Le détail d'une classe liste les activités qui la visent.
- Une session ouverte l'an dernier montre encore ses questions telles qu'elles
  étaient, alors que le questionnaire a été retouché depuis.

## Points à trancher par l'utilisateur

- [x] Figeage strict, sans resynchronisation — **tranché le 2026-09-01**
- [x] Code NavigKid laissé sur l'activité — **tranché le 2026-09-01**
- [x] Activité sans classe = jamais disponible — **tranché le 2026-09-01**
- [x] Ouverture en lot pour toutes les classes — **tranché le 2026-09-01**
- [x] Une classe qui gagne un élève **après** l'ouverture de la session : il
      reçoit la version du questionnaire **de la session**, pas la dernière —
      **tranché le 2026-09-01**
