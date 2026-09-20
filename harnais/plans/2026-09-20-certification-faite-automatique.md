# 2026-09-20 — Une certification « faite » se coche toute seule

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-09-20 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : validé le 2026-09-20 → livré et vérifié à l'écran le 2026-09-20
- **Demande initiale** : « Dans la scénarisation français, les 2 classes ont cette
  certification mais je dois encore aller noter FAIT. Ce serait bien que dès qu'une copie
  est corrigée, ce soit automatisé. Ici la certif ne repose pas sur des points mais sur le
  simple fait de l'avoir fait. Possible de créer une route entre le résultat de l'élève et
  la scénarisation, qui a une incidence sur la roue des ceintures de la page d'accueil ? »

## Le problème

Une certification **non cotée** (`cotation: 'fait'`) est acquise dès que l'élève a fait
l'épreuve. L'activité correspondante est pourtant déjà rattachée à la ligne de
certification (bouton « 🔗 Rattacher une activité », champ `ModuleActivite.devoirId`), et
le prof a corrigé les copies une à une.

Il doit malgré tout rouvrir la popup « 📊 Notes des élèves », cocher chaque élève, puis
enregistrer — une saisie qui ne fait que recopier ce que l'application sait déjà. Tant
qu'il ne l'a pas faite, la roue des ceintures de `/accueil` et l'onglet certifications du
profil montrent « à faire » à des élèves qui ont fini.

### Ce qui existe déjà

| Brique | État |
|---|---|
| certification → activité | ✅ `ModuleActivite.devoirId`, lu par `devoirCertificatif()` |
| activité → parcours | ✅ `devoir.scenarisationRef` (mais **sans** `moduleId`) |
| correction → note | 🟡 `notesAutomatiques()` **propose** déjà la note dans la popup — jamais persistée sans clic |
| sémantique de `fait` | ✅ nette : le document `certificationsEleves` existe ⇔ c'est fait |

### Ce qui manque vraiment

**Aucun instant où le serveur décrète qu'une copie est corrigée.** La correction est un
flux d'enregistrements temporisés ; `status: 'finalized'` existe dans le type mais n'est
envoyé par aucun écran. Il n'y a ni Cloud Function ni déclencheur Firestore dans le
projet : tout effet de bord doit vivre dans une route Next.

## Options

| Option | Ce que ça implique | Coût / risque |
|---|---|---|
| **A — Écrire la note à un moment choisi** | Un `certificationsEleves` est créé automatiquement quand un repère est franchi (correction rendue visible, ou bouton « correction terminée » à créer) | Lecture rapide ensuite. Mais aucun repère n'existe naturellement : soit on en invente un (geste de plus pour le prof), soit on s'accroche à « rendre visible » — or JP garde parfois une correction cachée par stratégie, et ces élèves resteraient « à faire ». **Deux sources de vérité** à tenir d'accord. |
| **B — Déduire à la lecture** | Rien de nouveau en base. Là où l'on affiche une certification, on regarde si la copie de l'élève est corrigée | Toujours juste, jamais périmé, rien à migrer. Quelques lectures Firestore de plus au chargement de `/accueil`, du profil et du compteur de Mes Classes. Le prof ne peut plus **décocher** un élève dont la copie est corrigée. |

**Retenue : B**, décidée avec JP le 2026-09-20. Motif : la copie corrigée **est** la
preuve ; la recopier en base créerait un second état à entretenir, qui se périmerait au
premier ajustement de note. JP a explicitement accepté de perdre le décochage
(« la copie fait foi »).

### Définition retenue de « copie corrigée »

Celle qu'on vient de poser pour la colonne « Corrigés » de la liste des copies
(2026-09-20) : **plus rien n'attend le professeur**.

| Dispositif | Critère |
|---|---|
| Écriture (grille) | `correction.score > 0` |
| Questionnaire de lecture | `scoreLectureQuiz(...).aNoter === 0` |
| Recherche NavigKid, auto-évaluation | à trancher à l'étape 2 — aujourd'hui aucun de leurs scores n'est rangé en base |

⚠ Une activité **entièrement auto-corrigeable** est donc « faite » dès la remise, sans que
le prof ait rien ouvert. C'est cohérent avec le critère (il n'avait rien à y faire), mais
c'est à voir à l'écran avant de conclure.

## Ce qu'on fait

1. **L'index inverse manquant** — une fonction « les certifications non cotées qui portent
   ce `devoirId` », et son symétrique pour un élève. Aujourd'hui seul
   `trouverCertification(profId, moduleId)` existe ; le `moduleRef` évoqué en commentaire
   dans `scenarisation.ts` n'a jamais été écrit.
   Fichier : `src/lib/certification-server.ts`.

2. **« Cette copie est-elle corrigée ? », côté serveur** — le test vit aujourd'hui dans la
   page du prof, en client. Le remonter en une fonction unique, réutilisable.
   ⚠ Éviter le défaut de `notesAutomatiques()`, qui prend une correction simplement
   ouverte (créée avec `score: 0`) pour un 0 %.
   Fichiers : `src/lib/correction-etat.ts` (nouveau), `src/lib/lecture-scoring.ts` (déjà
   utilisable côté serveur).

3. **La roue et le profil** — `obtenue` d'une certification non cotée vaut
   `note.fait === true` **ou** « la copie de l'élève est corrigée ».
   Fichiers : `src/lib/certification-server.ts` (`buildCertificationsProfil`), consommé par
   `/api/accueil` et `/api/profil/general`.

4. **La popup de saisie** — la case se coche d'elle-même et devient non modifiable quand la
   copie est corrigée, avec la raison écrite à côté (« copie corrigée »). Les élèves sans
   copie dans l'application (jamais connectés, épreuve papier) restent cochables à la main.
   Fichiers : `src/components/CertificationNotesModal/`, `src/app/api/certifications/notes/route.ts`.

5. **Le compteur de Mes Classes** — même règle, sinon il annoncera « 0/19 » alors que tout
   est fait. Fichier : `src/app/api/certifications/classe/route.ts`.

## Ce qu'on ne fait pas dans ce chantier

- **Les certifications cotées ne changent pas.** La note reste la décision du prof ; la
  proposition automatique reste une proposition.
- Pas de champ « refusé » : JP a tranché que la copie fait foi.
- Pas de `moduleRef` sur le devoir. On scanne les scénarisations du prof, qui sont peu
  nombreuses ; ajouter un champ dénormalisé créerait un troisième état à tenir d'accord.
- Pas de reprise du défaut de `notesAutomatiques()` sur les **cotées** (proposition à 0 %
  d'une correction juste ouverte) — signalé, à traiter à part.

## Comment on saura que ça marche

JP corrige la dernière copie d'un élève de 4C sur l'activité rattachée à la certification
non cotée. Sans rien faire d'autre :

- l'onglet certifications du profil de cet élève passe de « à faire » à « fait » ;
- la roue des ceintures de sa page `/accueil` lui accorde la ceinture de cette
  certification ;
- la popup « 📊 Notes des élèves » montre sa case cochée, grisée, avec « copie corrigée » ;
- le compteur de Mes Classes avance d'une unité.

## Points à trancher par l'utilisateur

- [ ] Recherche NavigKid et auto-évaluation : qu'est-ce qu'une copie « corrigée » pour
      elles ? (question posée à l'étape 2, elle ne bloque pas le démarrage)
- [ ] Une activité entièrement auto-corrigeable devient « faite » dès la remise : à
      confirmer une fois vu à l'écran.
