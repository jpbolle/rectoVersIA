# 2026-09-20 — Le portfolio d'apprentissage

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-09-20 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **à valider** — rien n'est écrit.
- **Demande initiale** (2026-09-20) : « Activité nouvelle : portfolio d'apprentissage.
  J'aimerais me passer du document Google Docs et que les élèves aient leur portfolio,
  notamment leur portfolio Molière, sur l'app. Un portfolio d'apprentissage est un
  processus qui met en place différentes étapes pour atteindre un objectif. Le portfolio,
  un peu comme le parcours FLE e-learning, serait un serpentin d'activités. »
- **Rappel de JP** : « le portfolio Molière n'est qu'un **exemple** dont il faut
  **abstraire les propriétés** » — mais ce sera bien le premier portfolio construit
  dans l'app.
- **Analyse préalable** : `harnais/plans/2026-09-20-portfolio-analyse-moliere.md`
  (recensement complet du portfolio Molière et confrontation à l'existant).

## Le problème

1. **Le portfolio vit dans Google Docs**, un gabarit recopié par élève. Le prof y écrit
   des commentaires, accepte ou refuse des suggestions, colle la grille finale à la main.
   Rien n'en remonte : ni note, ni trace, ni progression.
2. **L'app sait enchaîner des activités** (le serpentin FLE, depuis le 2026-09-14) mais
   une étape n'y est qu'un **renvoi** vers autre chose : elle ne porte ni date, ni
   objectif, **ni dépôt**. Or un portfolio est fait de dépôts.
3. **L'élève ne peut rien déposer.** `POST /api/devoirs/upload` refuse tout ce qui n'est
   pas `role === 'prof'`, et l'enregistreur audio n'existe que dans les écrans prof.
4. **L'app ne connaît que l'élève seul.** Dans le portfolio Molière, la moitié des
   productions sont de groupe — d'où la méthodologie actuelle, qui est un aveu :
   « travailler sur un seul portfolio, copier/coller le nouveau texte dans les autres ».

## Ce que c'est, une fois Molière retiré

Un portfolio est **une suite d'étapes ordonnées qui mènent à une tâche finale**, où
chaque étape a la même forme :

| Propriété | Dans Molière |
|---|---|
| un **titre** et une **section** (deux niveaux) | « 1.2 Découverte de Molière », section « 1. Premiers préparatifs » |
| des **objectifs** | « découvrir la vie de Molière » |
| une **échéance** | « 7 octobre », « début novembre » |
| un **statut IA** à trois états | les trois logos « IA / IA partielle / pas d'IA » |
| des **ressources** | anthologie, 13 Genially, base documentaire de 8 liens |
| une **portée** : d'équipe ou personnelle | l'adaptation du texte (équipe) vs la mind map du personnage (personnelle) |
| un ou des **dépôts**, parfois **aucun** | un lien, une image, un tableau, des commentaires… ou « rien à faire dans le portfolio, en scène ! » |

Et trois traits d'ensemble : **le portfolio lui-même est coté** (« gestion de
l'eportfolio », « régulation du travail ») · l'évaluation est **plurielle** (soi, un pair,
le prof) · le travail se fait en **équipe** dans un portfolio qui reste **individuel**.

## Décisions prises avec JP le 2026-09-20

| Question | Réponse | Conséquence |
|---|---|---|
| Quelle forme ? | **Un nouvel atelier sur le dispositif `sequence`** | Le serpentin du FLE est réutilisé, l'étape est enrichie **en repli** (tout champ absent = comportement FLE actuel, aucune migration) |
| Où vivent les fichiers ? | **Lien Drive ou base64** | Pas de Firebase Storage, pas de fichiers sur le VPS. Image compressée dans le navigateur (≤ 700 Ko) ; audio et Genially par **lien collé** |
| Le groupe ? | **Vrai portfolio d'équipe partagé**, avec des étapes personnelles | Une notion d'équipe à créer, et des dépôts qui appartiennent à l'équipe |
| Deux élèves en même temps ? | **Co-édition maison, champ par champ** | Transport : l'**interrogation à 1 s** déjà écrite pour la compétition. Zéro dépendance, zéro service à héberger. Pas deux curseurs dans le même paragraphe |
| Cotation ? | **Une grille sur le portfolio entier** | La grille (6 niveaux) doit être ouverte à ce dispositif ; les étapes ne portent pas de note |
| Périmètre v1 | **Les quatre** : statut IA à 3 états · tableau de saisie libre · coévaluation par un pair · commentaire d'élève ancré | — |

## Le modèle

### L'étape (générique)

`SequenceEtape` gagne des champs **facultatifs**. Absents, une séquence FLE se comporte
exactement comme aujourd'hui.

| Champ | Rôle | Absent = |
|---|---|---|
| `section` | l'étiquette de regroupement (« 1. Premiers préparatifs ») — **informatif**, comme `groupe` sur une scène d'œuvre, pas un niveau d'imbrication | pas de section |
| `objectifs` | `string[]` | aucun |
| `echeance` | `Timestamp \| null` — libellé **« Échéance »** partout | aucune |
| `ia` | `'libre' \| 'partielle' \| 'aucune'` | on retombe sur `devoir.accesIA` |
| `portee` | `'equipe' \| 'personnelle'` | **`personnelle`** — rien n'est partagé par défaut |
| `depots` | `PortfolioDepot[]` | aucun dépôt : l'étape est un renvoi (FLE) ou une étape **sans trace** (répétitions, improvisations, passation), qui ne porte que ses objectifs et sa consigne |

Les deux natures existantes (`moduleId` = théorie, `devoirId` = activité) **restent** : une
étape de portfolio peut parfaitement renvoyer vers une lecture d'œuvre (l'anthologie
Molière est déjà en base) ou vers un atelier de recherche.

### Le dépôt

```
PortfolioDepot = {
  id, libelle, consigne?, exemple?, obligatoire?,
  type: 'texte' | 'tableau' | 'image' | 'lien' | 'commentaires'
}
```

| Type | Ce que l'élève fait | Notes |
|---|---|---|
| `texte` | écrit dans un champ qui grandit avec le contenu | **Pas de Tiptap** : un champ plat (`AutoGrowTextarea`). Un éditeur riche fusionné toutes les secondes est ingérable — c'est le prix de la co-édition maison, et il est assumé |
| `tableau` | colonnes définies par le prof, **lignes ajoutées par l'élève**, une cellule = un champ | le tableau de didascalies (3.2). C'est la brique qui rend la co-édition intéressante |
| `image` | choisit une image, compressée dans le navigateur (≤ 700 Ko) | affiche, selfie-BD, mind map photographiée |
| `lien` | colle une adresse | audio Adobe Podcast sur Drive, Genially, Canva, YouTube. Rendu en **lien cliquable** ; **embarqué** seulement si le domaine est dans `DOMAINES_INTEGRATION` |
| `commentaires` | commente des passages d'un texte fourni par le prof | réemploi de `src/lib/oeuvre-commentaires.ts` (ancrage par rang de mots + recalage), ouvert à l'**élève** |

`exemple` est l'équivalent du gris à effacer du Google Docs : affiché en filigrane,
jamais enregistré.

### L'équipe

- `portfolio.equipes: [{ id, nom, membres: eleveIds[] }]` sur l'activité, composées par
  le prof. Même forme que `Manche.equipes` (compétition) — on ne réinvente pas la ligne.
- Un élève **sans équipe** fait son portfolio seul : toutes les étapes d'équipe
  deviennent personnelles pour lui. Un portfolio sans aucune équipe est un portfolio
  individuel, et c'est un cas normal.

### Où vit ce que l'élève dépose

**Proposition (à valider)** : deux documents, jamais un seul.

| | Contenu | Pourquoi |
|---|---|---|
| `travaux` (`TRV-{devoirId}-{studentId}`) — **inchangé** | les dépôts **personnels**, en JSON dans `content` | C'est ce que lisent déjà la correction, l'onglet Évaluation, le profil, les stats. On n'y touche pas |
| `portfoliosEquipe/{PFE-{devoirId}-{equipeId}}` — **nouveau** | les dépôts **d'équipe** | Une seule vérité pour les 4 membres. Évite de toucher à `ensureTravaux`, au profil et aux statistiques, qui comptent une copie par élève |

Accès **serveur uniquement** (`adminDb`), donc **aucune règle Firestore**, conformément à
la règle du projet. L'écran de l'élève assemble les deux : il ne voit qu'un portfolio.

⚠ **Les images ne vont PAS dans `ressourceImages`.** Cette collection est servie par
`/api/ressources/image/[id]`, une route **publique par lien secret** — acceptable pour
un document pédagogique, **inacceptable pour la photo d'un élève** (selfie-BD). Nouvelle
collection `portfolioImages` + route **authentifiée** (l'auteur, ses coéquipiers, son
prof). C'est le point RGPD du chantier.

### La co-édition champ par champ

- Chaque champ a une **clé stable** : `{etapeId}/{depotId}[/{ligne}/{colonne}]`.
- `POST /api/portfolio/champ` écrit **un champ**, jamais l'étape entière : deux élèves
  dans deux champs voisins ne s'écrasent jamais.
- `GET /api/portfolio/etat` est interrogé **à 1 s** tant qu'une étape d'équipe est
  ouverte, avec le **cache mémoire de 500 ms** du moteur de la compétition
  (`manche-server.ts` en donne le patron). Charge : 4 à 5 élèves par équipe, contre 25
  en compétition.
- **Verrou léger** : le champ où quelqu'un tape lui appartient 5 s après sa dernière
  frappe ; les autres le voient en lecture, avec « Léa écrit ». Le verrou vit **en
  mémoire du processus**, comme la présence des joueurs — il n'a pas à survivre à un
  redémarrage.
- Deux élèves qui visent **le même champ** : le second est refusé tant que le verrou
  tient, et prévenu. Jamais d'écrasement silencieux.

### La navigation : le serpentin **et** le plan

Une étape-activité est une **activité à part entière** (son `devoirId`, sa copie, sa
correction) : le portfolio Molière, c'est une douzaine d'activités, et l'élève sort du
serpentin pour y entrer, puis revient. Pour qu'il ne s'y perde pas, deux entrées :

- le **serpentin**, qui montre le chemin et où il en est ;
- un onglet **« Plan du portfolio »** dans la **colonne de droite** de l'élève
  (`WorkspaceRail`), **sur le modèle du sommaire d'une œuvre** (`OeuvreSommaire`) :
  sections repliables, pastille d'état par étape, clic = j'y vais. Il navigue **sans
  repasser** par le serpentin. *(demandé par JP le 2026-09-20)*

### Le portfolio ouvert (« matrice »)

*(demandé par JP le 2026-09-20 — à un moment de l'année)*

Un portfolio dont le prof pose **la trame, pas le contenu** : l'élève y **ajoute ses
propres étapes et ses propres ressources**. La brique existe déjà côté élève — ses
**ressources personnelles** (`/mes-ressources` : vocabulaire personnel, mots Daspalecte)
— et le dépôt `lien` fait le reste.

Ce que ça suppose, et qui n'est **pas** dans les étapes 1 à 7 : une étape **créée par
l'élève** (aujourd'hui le serpentin n'est composé que par le prof), donc un drapeau
`ouvert` sur le portfolio et une distinction « étape du prof / étape de l'élève » dans la
correction. À faire quand les sept premières tiennent.

## Activité existante ou dépôt ? (précisé par JP le 2026-09-20)

Environ **70 %** des étapes du portfolio Molière tiennent dans un dispositif **déjà
écrit**. La règle de partage :

- **une activité existante** quand le dispositif apporte une machinerie (liseuse,
  questionnaire corrigé, éditeur avec aide IA et annotations, notation) ;
- **un dépôt dans l'étape** quand la trace est courte et n'a besoin d'aucune machinerie
  — c'est ce qui évite d'avoir dix-huit activités pour un seul projet.

| Étape de Molière | Ce qui la porte | Réserve |
|---|---|---|
| 1.0 Choix d'un sketch — **et plusieurs autres du même genre** | **Sondage** et **questionnaire d'auto-réflexion** (dispositif `autoevaluation`) | — |
| 1.1 Lecture de l'anthologie | **Lecture d'une œuvre** (l'anthologie est en base) | — |
| 1.2 Découverte de Molière — **et d'autres du même genre** | **Atelier de recherche** + questionnaire | ⚠ **les questions liées aux images sont à terminer** — dépend du chantier « types de questions » |
| 1.3 Lecture intégrale | **Lecture d'une œuvre**, ou étape sans trace | — |
| 2.0 Comprendre les répliques | **Questionnaire de lecture**, le texte de la scène posé en **ressource** | le commentaire ancré reste plus fin, mais le questionnaire suffit |
| 2.1 Adaptation du texte | **Écriture** | le mode suggestion reste hors périmètre |
| 2.2 Le personnage | **Écriture** + **schématisation** pour la mind map | ⚠ **la schématisation n'existe pas** — chantier à part |
| 2.2 Improvisations · 3.3 Répétitions | étape **sans trace** | — |
| 3.1 Intonation · 4.1 Affiche · 3.2 Selfie BD | **dépôt** (lien, image, tableau) | **nouveau** |
| 3.4 Bruits et musique · 4.2 Affiche collective | **Écriture** | 4.2 a besoin de l'**équipe** |
| 5. Coévaluation | moteur de l'**auto-évaluation** (le prof y répond déjà à l'aveugle) | l'appariement élève ↔ élève est **nouveau** |
| 6. Passation | **Certification** (note ou « fait ») | — |
| 7. Regards sur le travail | **Auto-évaluation** (remplace le Google Form) + grille du prof | — |

**Les vraies nouveautés sont donc trois** *(JP, 2026-09-20)* : la **schématisation**
(plan à écrire, chantier propre), les **lieux de dépôt**, la **coévaluation**.

## Ce qu'on fait — étapes

| Étape | Contenu | Ce que JP voit |
|---|---|---|
| **1** | **Le squelette.** Atelier `portfolio` (dispositif `sequence`), serpentin réutilisé, étape enrichie (section, objectifs, échéance, statut IA, portée), dépôts `texte`, étapes **sans trace**, et l'onglet **« Plan du portfolio »** dans le rail de l'élève. Tout personnel | Il **construit le portfolio Molière** de bout en bout et le remplit comme un élève, en naviguant par le plan |
| **2** | **Les équipes** : composition par le prof, `portfoliosEquipe`, dépôts d'équipe **sans co-édition** (relus à l'ouverture de l'étape) | Deux élèves d'une même équipe voient le même dépôt |
| **3** | **La co-édition** champ par champ (interrogation 1 s, verrou léger, « Léa écrit ») + dépôt **`tableau`** | Deux navigateurs côte à côte : ce que l'un écrit apparaît chez l'autre |
| **4** | Dépôts **`image`** (collection dédiée, route authentifiée, compression navigateur) et **`lien`** | L'affiche et le selfie-BD dans le portfolio ; l'audio par lien |
| **5** | Dépôt **`commentaires`** : l'élève commente les répliques d'un texte posé par le prof | L'étape 2.0 de Molière |
| **6** | **Coévaluation par un pair** : le prof apparie deux équipes, chacun s'évalue puis évalue un membre de l'autre équipe sur les mêmes critères, l'écart s'affiche | L'étape 5 de Molière, sans le dessin au bic |
| **7** | **La grille sur le portfolio entier** : `usesGrille` ouvert au dispositif, correction du portfolio comme on corrige une copie, rattachement à une **certification** | UAA 0 /100 et UAA 5 /100 saisies dans l'app |
| **8** | **Le portfolio ouvert** : l'élève ajoute ses propres étapes et y accroche ses **ressources personnelles** | Un portfolio dont le prof ne pose que la trame |

### Fichiers principaux touchés

- `src/types/sequence-fle.ts` → l'étape enrichie (à renommer ? **non** : on ne renomme
  rien tant que le FLE n'est pas stabilisé)
- `src/types/portfolio.ts` *(nouveau)* — dépôts, équipes, clés de champ
- `src/types/didactique.ts` — un atelier de plus dans la liste **fermée** `ATELIERS`
- `src/lib/portfolio-server.ts` *(nouveau)* — `portfoliosEquipe`, verrous, cache 500 ms
- `src/lib/sequence-server.ts` — `ouvertParSequence` vaut aussi pour un portfolio
- `src/components/SequenceFleBuilder/` — le serpentin, partagé
- `src/components/Portfolio/` *(nouveau)* — écran élève, étape, dépôts
- `src/app/api/portfolio/{etat,champ,equipes,image}/route.ts` *(nouveau)*

## Ce qu'on ne fait pas dans ce chantier

- **La co-édition dans le même paragraphe** (Yjs, serveur de synchro, service tiers) —
  écartée le 2026-09-20 : dépendance nouvelle + WebSocket à travers le proxy du VPS,
  jamais vérifié. Le précédent est net : en septembre, le flux poussé (SSE) de la
  compétition a été abandonné pour la même raison, et l'interrogation à 1 s a très bien
  tenu en classe.
- **Le mode suggestion** (l'élève propose une modification du texte de Molière, le prof
  accepte ou refuse, étape 2.1). Reste dans le Google Docs pour cette année.
- **Le dépôt d'un fichier audio** : l'élève colle un lien, comme aujourd'hui.
- **Le portfolio comme bibliothèque réutilisable** (dupliquer un portfolio d'une année
  sur l'autre) — à voir quand le premier aura servi.
- **L'activité de schématisation** (mind map, carte conceptuelle) : c'est un **chantier
  propre**, sans plan à ce jour, dont le portfolio sera un client. Voir
  `harnais/macro-plan.md`.
- **Les questions liées aux images** : elles manquent au portfolio (étape 1.2) mais
  relèvent du chantier « types de questions », déjà entamé.

## Comment on saura que ça marche

Le **portfolio Molière construit en entier dans l'app**, et une équipe de 4 élèves qui le
remplit en classe sans jamais rouvrir le Google Docs — y compris à deux dans la même
étape au même moment.

## Points à trancher avant l'étape 1

1. Le portfolio apparaît-il dans **Mes Activités** (comme une activité ordinaire) ou dans
   **Mes Ressources** (comme les séquences FLE, qui sont aux deux endroits) ?
2. Une étape **verrouille-t-elle** la suivante (le serpentin FLE, lui, laisse tout
   ouvert) ? Le portfolio Molière, sur papier, n'interdit rien.
3. Les équipes sont-elles propres au portfolio, ou **partagées par toutes les activités
   d'une classe** (« les groupes de la 4C ») ?
