# Rollup — Atelier « Lecture d'une œuvre »

> Session du 2026-08-15 (soir) : réflexion **puis** mise en œuvre.
> Le module est codé et l'anthologie est en base — mais **la liseuse élève
> n'a jamais été ouverte**. Les décisions de JP sont consignées telles quelles
> ci-dessous, avant le compte rendu de ce qui a été construit.

## L'intention

Reprendre ce que fait aujourd'hui le site Google Sites **moliere.cnddinant.be**
(anthologie Molière, 10 pièces, extraits par acte, vidéos intercalées, Google
Forms de vérification) — mais **dans l'application**, pour que la lecture cesse
d'être anonyme : savoir qui lit, où il en est, ce qu'il a compris, et faire
remonter tout cela dans le profil de l'élève.

Projet des **5 classes de 4ᵉ, reconduit depuis 5 ans** ⇒ la réutilisabilité
n'est pas un bonus, c'est la raison d'être du chantier.

## Décisions de JP

| Question | Décision |
|---|---|
| Architecture | **Option C** — un **nouvel atelier**, sur le **dispositif `lire` existant**. Pas de 6ᵉ dispositif : ni notation, ni correction, ni lucidité, ni profil ne sont redupliqués |
| Modèle de remise | **Parcours continu** — rien ne se « remet ». C'est du **formatif** : « je suis juste là pour les inviter à lire ». Le prof suit la progression, il ne clôt pas |
| Où vit l'œuvre | **Bibliothèque d'œuvres réutilisables** (modèle « comme les grilles »), pas un contenu collé dans une activité. Une activité dit : *cette œuvre, ces chapitres, cette classe* |
| Emplacement | Nouvel **onglet dans `/mes-ressources`** (qui n'a aujourd'hui que `vocabulaire` et `avenir`) |
| EPUB | **Non, pas pour l'instant.** Aucune dépendance nouvelle |

## Pourquoi C tient debout

Les blocs de questionnaire (`src/types/lecture.ts`) savent déjà presque tout
faire : bloc `info` (le commentaire du prof entre deux scènes), champ
`document` (l'extrait), image, audio à écoutes limitées, QCM, texte
court/long, fluorage, notation **par habileté**, corrigé, smiley d'assurance.

**Seule brique manquante** : la **vidéo posée à un endroit précis** du
parcours. Aujourd'hui `DevoirRessource.videos` n'existe qu'au niveau de
l'activité entière, pas du bloc.

## La liseuse — deux emplacements, un seul composant

Ce n'est **pas** un lecteur de fichier : c'est la façon d'afficher l'œuvre
composée dans l'app (texte + vidéos + questions dans le même flux, paginé).

1. **Colonne principale** — l'œuvre remplace l'éditeur, comme le fait déjà le
   questionnaire de lecture pour le dispositif `lire` ;
2. **Colonne 3** (`AssistancePanel`, onglets consignes/ressources/grille/IA) —
   l'œuvre devient une ressource de travail : l'élève lit à droite et rédige à
   gauche, sans changer d'onglet.

⚠️ Sur un Chromebook, trois colonnes sont étroites : la liseuse en colonne 3
doit être **repliable / agrandissable**.

## Firestore — découpage retenu

Un document unique ne convient pas : limite **1 Mo**, l'œuvre Molière pèserait
150–300 Ko, retéléchargés par chaque élève à chaque ouverture, et une
sauvegarde du prof réécrirait tout (cf. la **perte de données** vécue sur la
scénarisation).

| Où | Quoi |
|---|---|
| `oeuvres/{id}` | En-tête + **sommaire** (chapitres, titres de sections, ordre) — léger |
| `oeuvres/{id}/sections/{sectionId}` | Une section = **un écran** : extrait, vidéos, blocs de questions. Chargé **à la demande** |
| `ressourceImages` (existant) | Images et audio en base64 |
| `travaux/{id}` | Réponses (déjà en JSON) **+ progression** : section vue / terminée / date |

## Migration depuis le site Molière — testée le 2026-08-15, faisable

Vérifié en récupérant `https://www.moliere.cnddinant.be/le-tartuffe` (505 Ko de
HTML, **aucune authentification**) :

| Élément | Récupérable ? |
|---|---|
| Titres de sections | ✅ `<h1>` = « Contexte », « Extraits de l'acte 1 »… (7 sur la page Tartuffe) |
| Sous-sections | ✅ `<h2>` = « Scène 4 ORGON & DORINE », « Compléments de lecture »… (18) |
| Texte des extraits et analyses | ✅ 286 paragraphes `<p>` |
| Vidéos | ✅ 8 `<iframe>` — identifiants **YouTube** (`/embed/{id}`) et **Drive** (`/file/d/{id}/preview`) extractibles |
| **Questions des Google Forms** | ❌ **Mur de connexion** — `viewform` renvoie « Meld u aan bij je Google-account ». Le blob `FB_PUBLIC_LOAD_DATA_` est inaccessible anonymement |

⇒ **Contournement pour les formulaires** : JP est propriétaire des Forms. Un
**Apps Script** qui parcourt ses formulaires et exporte questions + bonnes
réponses en JSON réglerait le problème (terrain qu'il connaît).

⇒ **Pas de dépendance npm nécessaire** : l'extraction se fait en Python
(bibliothèque standard) dans un script jetable produisant du JSON, puis un
script d'import `firebase-admin` (déjà présent) écrit dans Firestore.

## Décisions du 2026-08-15 (2ᵉ tour)

| Question | Décision de JP |
|---|---|
| **Découpage** | **Chapitre = une pièce**, **section = une scène**. L'**acte** est conservé **à titre informatif** : ce n'est pas un niveau d'imbrication, c'est une étiquette portée par la section (le sommaire regroupe les scènes par acte) |
| **Progression** | Ce sont les **réponses aux formulaires** qui attestent la lecture — pas l'ouverture d'une page. Le prof pose sur la **card d'activité** un **minimum de formulaires** à compléter. La même œuvre peut donc être donnée avec une exigence différente selon la classe |
| **Points** | **Aucune importance** — c'est du formatif. D'où : les **réponses s'affichent directement** à l'élève. Piste à explorer plus tard : les **passages du texte se fluorent** au fil des bonnes réponses |
| **Partage** | **Oui**, sur le modèle des grilles : un prof voit les œuvres des autres et peut en **dupliquer** une pour la modifier, y ajouter, y retrancher. Le mécanisme existe déjà (`GrilleCard` + `/app/grilles/page.tsx`, champs `profId` / `profName` / `shared`, tri en trois paniers : les miennes / partagées / celles des autres profs) |

### ⚠️ RÈGLE À NE JAMAIS PERDRE — le corrigé est ouvert, **ici seulement**

Décision de JP, formulée avec insistance : dans la lecture d'œuvre, l'élève
**peut voir les réponses, même en trichant** — « c'est vraiment un outil pour
eux ». Aucune route de vérification n'est donc nécessaire : le corrigé peut
partir avec le contenu.

> **Ce comportement ne vaut QUE pour cet atelier.** Partout ailleurs, le
> dispositif `lire` continue de **filtrer `correctIndex` côté serveur** jusqu'à
> `corrigeDisponible` — la fuite des bonnes réponses a déjà dû être corrigée
> une fois sur les QCM de recherche.

⇒ L'exception se décide **côté serveur, d'après l'atelier de l'activité**,
jamais d'après un paramètre envoyé par le navigateur.

### Le minimum de formulaires

**Un nombre** (« 8 formulaires sur 15 »), pas une liste de sections
obligatoires : « l'élève choisit ceux qu'il veut puisqu'il ne sera pas obligé
de tout lire ».

### Ce qu'on garde en statistiques

**Ni points, ni habiletés** — la lecture d'œuvre ne nourrit **pas** l'onglet
Lire du profil. Deux indicateurs seulement :

1. la **fréquence de lecture** ;
2. la **vérification des formulaires** (combien de complétés, par rapport au
   minimum demandé).

### L'œuvre comme réservoir d'extraits

Puisqu'elle vit en **ressource**, JP veut pouvoir monter **en appoint** une
interrogation de lecture classique (dispositif `lire` ordinaire, celui-là
noté) en **tirant un ou plusieurs extraits de l'œuvre** au lieu de les
recopier. À prévoir dans le constructeur de questionnaire : un sélecteur
« prendre un extrait dans une œuvre ».

### Où les indicateurs remontent

| Endroit | Ce qu'on y voit |
|---|---|
| **Onglet 📖 Lire du profil** (élève) | Les deux indicateurs : fréquence de lecture, formulaires complétés / minimum demandé |
| **Onglet Général** | Un **rappel quand l'élève ne lit pas** — au même endroit et dans le même esprit que les travaux non rendus (`ProfilGeneral.nonRendusSanctionnes`), mais **sans sanction** : c'est un rappel, pas un zéro |
| **Cloche** | Une **notification de rythme** (voir ci-dessous) |
| Côté prof | Card d'activité et fiche élève |

### Le rythme de lecture — la notification

Le prof donne une **date** sur la card d'activité (échéance de lecture, pas une
remise : rien ne se remet) et un **minimum de formulaires**. Le rythme attendu
s'en déduit :

> 20 formulaires pour dans 40 jours ⇒ **1 formulaire tous les 2 jours**.
> Après une semaine sans aucun formulaire ⇒ « **œuvre pas encore entamée** ».

Attendu à une date = `minimum × (jours écoulés / jours totaux)`, comparé au
nombre de formulaires réellement complétés.

Trois états proposés (à valider) : **pas entamée** (0 fait alors qu'on est à
plus d'une semaine ou de 15 % du temps) · **en retard** (au moins 2 formulaires
sous l'attendu — la marge évite de harceler pour un jour de décalage) · **dans
les temps** (rien ne s'affiche).

**Ça tombe bien techniquement** : les notifications sont **calculées à la
lecture** (`/api/notifications`, types actuels `remise` · `activite` ·
`corrige` · `annonce`) — donc **aucune tâche planifiée** n'est nécessaire sur
le VPS. Il suffit d'un 5ᵉ type `lecture` et de la même mécanique
d'**horodatage posé au basculement** que celle déjà en place, pour que la
notification ne se répète pas à chaque ouverture.

**Sans date**, pas de rythme : on n'affiche que le compteur.

---

## Ce qui est CODÉ (session du 2026-08-15, soir) — **rien testé à l'écran**

`npx tsc --noEmit` passe, `npm run build` passe.

| Fichier | Rôle |
|---|---|
| `src/types/oeuvre.ts` | Modèle + `calculerRythme()` (seuils : marge de 2 vérifications, 7 jours avant « pas entamée ») |
| `src/lib/oeuvre-server.ts` | Normalisation ; **porte l'avertissement** sur le corrigé ouvert |
| `src/app/api/oeuvres/…` | Liste en 3 paniers, création, sommaire, sections (chargement paresseux), **duplication** |
| `src/components/OeuvreReader/OeuvreReader.tsx` | La liseuse + le questionnaire **en popup** |
| `src/components/OeuvreReader/OeuvreSommaire.tsx` | Le sommaire, rendu **dans la colonne de droite** |
| `src/hooks/useOeuvreLecture.ts` | Sommaire, navigation, progression (reprend à la dernière scène vue) |
| `src/hooks/useOeuvres.ts` | La bibliothèque, côté prof |
| `scripts/import-oeuvre-moliere.ts` | La migration |

Branchements : nouvel atelier **`lecture-oeuvre`** (dispositif `lire`) dans
`ATELIERS` ; champs `oeuvreId` / `oeuvreChapitres` / `oeuvreMinimum` sur le
devoir (POST, GET, PATCH) ; sélecteur d'œuvre + chapitres + minimum dans
`CreationForm` (avec le rythme annoncé en direct) ; `AssistancePanel` accepte
`oeuvreNav` et renomme alors son premier onglet.

### Décisions d'écran prises en codant

- **Sommaire à droite, pas de hamburger** : la liseuse EST la colonne de
  gauche ; un sommaire à demeure y prendrait la place du texte.
- **Précédent / Vérification / Suivant** dans la MÊME ligne d'actions encadrée
  de deux traits (`bottomActions`), reprise de `VocabulaireActivity` et
  `LectureQuizActivity`.
- **Deux colonnes** portées par la section (`colonnes: 1 | 2`), repli à une
  colonne sous 900 px — deux colonnes de 30 caractères sur un Chromebook
  seraient illisibles. `break-inside: avoid` sur les tirades.
- **Images et vidéos centrées**, `column-span: all` : un média coincé dans une
  demi-colonne est inregardable.
- La progression n'écrit que si quelque chose a changé (pas de réécriture à
  chaque ouverture).

### Résultat de la migration (simulation, 11 pages)

`11 chapitres · 67 sections · 1363 blocs dont 25 vidéos` ·
**20 Google Forms** signalés un par un (non importables) ·
**37 images** signalées (hébergées chez Google, à redéposer).

## Suite de la même session — bibliothèque, constructeur, import réel

**L'anthologie est EN BASE** : `OEU-20260815-20YF` — 11 chapitres, 67 sections,
1363 blocs dont 25 vidéos. Importée le 2026-08-15 avec l'UID de JP.

| Ajout | Fichier |
|---|---|
| **Bibliothèque d'œuvres** — 4ᵉ onglet de « Mes Ressources » (page `/grilles`, pas `/mes-ressources` qui est la page ÉLÈVE) | `src/components/OeuvrePanel/` |
| **Constructeur d'œuvre** — écran plein : sommaire éditable à gauche, section à droite | `src/components/OeuvreBuilder/` |

Le constructeur réutilise **`LectureQuizBuilder` tel quel** pour les
vérifications (c'est le même objet, il doit se construire pareil) et la même
chaîne de dépôt d'images que les questionnaires (`compressImage` →
`/api/ressources/upload`). **Enregistrement explicite, jamais automatique** —
bouton actif seulement si quelque chose a changé, pastille orange dans
l'en-tête, confirmation si on quitte une section modifiée (la scénarisation a
déjà coûté une perte de données).

Réglages verrouillés pour cet atelier dans `CreationForm` : évaluation
**toujours formative**, auto-évaluation **retirée** (le smiley d'assurance se
compare à une note, il n'y en a pas), et la date se libelle « **À lire pour
le** ».

### ⚠️ GOTCHA rencontré DEUX FOIS — Firestore refuse `undefined`

Un objet **relu** puis réécrit fait échouer la requête entière : les fonctions
de normalisation posent `undefined` sur les valeurs vides. Corrigé au niveau du
bloc (script d'import) puis du sommaire (`chapitresPourFirestore()` dans
`src/lib/oeuvre-server.ts`, par où passe toute route qui réécrit un sommaire).
Consigné dans `INIT.md` § Gotchas opérationnels.

### Ce qui a été vu à l'écran (2026-08-15)

- ✅ Formulaire de création : sélecteur d'œuvre, chapitres, minimum, rythme en direct
- ✅ Onglet Bibliothèque, l'anthologie et son sommaire
- ✅ Ajout d'un chapitre
- ⏳ Ajout de section : 500 corrigé, **à revérifier**
- ❌ **La liseuse élève n'a jamais été ouverte**

## Reste à faire
- [ ] **Suivi prof** : où en est chaque élève dans le livre.
- [ ] **Profil** : les deux indicateurs dans l'onglet Lire, le rappel dans
      Général, la notification de rythme (5ᵉ type).
- [ ] Les seuils de la notification (7 jours ? marge de 2 ?) — proposés, non validés.
- [ ] Le bouton « Prendre une note » de la maquette n'est **pas** implémenté :
      c'était une suggestion, pas une décision.

---

# Session du 2026-08-16 — l'atelier devient utilisable

> Premier test à l'écran de la liseuse. Tout ce qui suit est **livré et vérifié
> par `tsc` + `npm run build`**, mais **rien n'est testé** hors de ce que JP a
> vu en cours de session (partage, création d'activité).

## Le modèle a gagné deux champs

| Champ | Où | Pourquoi |
|---|---|---|
| `OeuvreBloc.face: 'recto' \| 'verso'` | `src/types/oeuvre.ts` | Deux faces dans la liseuse : **« Espace textuel »** et **« Espace multimédia »**. **L'absence de `face` vaut RECTO** — c'est ce qui laisse les 1363 blocs de Molière exactement où ils sont, vidéos intercalées comprises. Le verso ne remplace pas l'intercalage : il l'ajoute, pour ce qui n'a pas de place précise |
| `OeuvreBloc.type` gagne `'audio'` | idem | Dépôt d'enregistrement au verso, même chaîne que les questionnaires (base64 dans `ressourceImages`, refus au-delà de 700 Ko — pas de compression audio côté navigateur) |
| `Oeuvre.partages[]` | idem | Partage **nominatif** — voir plus bas |

Helpers : `blocsDeFace()`, `partageDe()`, `peutEditerOeuvre()`.
Garde-fou : **`blocsPourFirestore()`** dans `oeuvre-server.ts`, pendant de
`chapitresPourFirestore` — le piège `undefined` a déjà coûté deux 500.

## Deux partages qu'il ne faut JAMAIS confondre

| | Ce qui se passe | Panier |
|---|---|---|
| **Duplication** (existant, modèle des grilles) | le collègue repart avec **sa copie** ; l'original ne bouge pas | « Œuvres des professeurs » |
| **Partage nominatif** (2026-08-16) | le collègue accède au **même livre** — rien n'est copié | « **Partagées avec moi** » |

Le partage se fait **par EMAIL**, jamais par UID : la collection `professeurs` a
l'email pour identifiant, et un collègue qui ne s'est jamais connecté n'a pas
encore d'UID Firebase.

Deux niveaux, choisis collègue par collègue : **lecture seule** (il donne
l'œuvre à ses classes) ou **co-édition** (il écrit dedans). Décision de JP : le
choix est **proposé au moment du partage**, pas fixé une fois pour toutes.

- `peutEditerOeuvre()` est vérifié **côté serveur** sur l'œuvre ET sur ses
  sections — une interface qui cache un bouton n'est pas une permission.
- **Seul l'auteur décide des partages.** Un co-éditeur remanie le texte, il ne
  peut pas étendre le partage : sinon il s'étendrait sans que le propriétaire
  le sache.
- **La co-édition n'a aucun verrou**, et c'est dit à l'écran : l'enregistrement
  se fait section par section, donc deux profs sur deux scènes ne se gênent
  pas, mais sur la même scène le dernier gagne.
- Le collègue reçoit une **notification** (cible `collegue`, cf.
  `rollup_notifications.md`), écrite **par le serveur, après** l'écriture du
  partage, et **seulement** pour les nouveaux ou ceux dont le mode a changé.

## Vue prof — les 3 colonnes remplacées par un suivi de lecture

C'était le point n°1 du « Reste à faire », jamais entamé.

Dans cet atelier **rien ne se remet et rien ne se corrige** : « non ouvert / à
corriger / corrigé » ne décrivait aucune réalité, et taux de remise, moyenne et
critères faibles non plus. `/dashboard/travaux/[devoirId]` bascule donc
entièrement sur `OeuvreSuivi` dès que `devoir.oeuvreId` existe.

- **`/api/oeuvres/suivi`** (nouveau, prof) : toute la classe d'un coup —
  vérifications faites, scènes ouvertes, jours de lecture, rythme
  (`calculerRythme`), QCM justes/répondus, et les questions que la classe rate.
  Calculé **côté serveur** : les bonnes réponses vivent dans les sections, le
  navigateur du prof n'a pas à télécharger 67 sections pour compter des QCM.
- **Tableau** : Élève · Progression (barre + **repère de l'attendu du jour**,
  ce qui distingue l'avance du retard d'un coup d'œil) · État · Scènes
  ouvertes · Régularité · QCM · actions.
- **Clic sur un élève → sa FICHE en popup** (`EleveProfilModal`, la même que
  Mes Classes), jamais l'écran deux colonnes : il n'y a pas de copie.
  Un élève jamais connecté a son nom grisé.
- **❤️ / 💔 / 💬** : les deux premiers arrivent avec un **message pré-rédigé**,
  modifiable — un encouragement qu'il faut rédiger est un encouragement qu'on
  n'envoie pas.

## Vue élève

- **« Remettre le devoir » masqué** : rien ne se remet.
- **Onglet « Consignes et navigation »** — le renommage ne s'appliquait nulle
  part : le titre du panneau vient du **rail** (`PANEL_TITLES` dans la page),
  pas de l'`AssistancePanel`.
- **Sommaire refait** : son propre padding (il collait au bord — `.content` du
  panneau est à `padding: 0`), en-tête avec compteur et barre de progression,
  **chapitres repliables** (11 pièces × 67 scènes déroulées d'un bloc étaient
  inutilisables), le chapitre courant s'ouvre seul.
- **Onglet Évaluation** (`/api/oeuvres/bilan` + `OeuvreEvaluation`, nouveaux) :
  vérifications complétées · extraits ouverts (+ jours de lecture) · réussite
  moyenne · puis le détail **vérification par vérification, dans l'ordre du
  livre**. **Aucune note**, et c'est écrit en tête de l'onglet.
  Le degré de réussite ne porte que sur les **QCM** (seules questions
  auto-corrigeables) et le dénominateur ne compte que ceux **auxquels l'élève a
  répondu** — une question sautée n'est pas une erreur. Une vérification sans
  QCM affiche « pas de question à choix » plutôt qu'un 0 % mensonger.
- **Dictionnaire dans la colonne 1** (voir `INIT.md`) : l'élève pouvait cliquer
  les mots de la colonne de droite mais pas ceux du texte qu'il lit.

## Constructeur

- **Logo (→ accueil) + bouton ← Retour** : écran plein sans aucune sortie.
- **Bouton 👁 Prévisualiser** → `OeuvreSectionApercu`, qui réutilise
  `OeuvreBlocRendu` (extrait de la liseuse). Deux rendus parallèles auraient
  divergé au premier ajustement, et l'aperçu serait devenu un mensonge.
- **« Prose » → « Bloc informatif »**, **« Vers » → « Extrait »** : on nomme la
  fonction pédagogique, pas la forme littéraire (une consigne n'est pas de la
  prose, un extrait n'est pas toujours en vers).
- Barre **recto/verso** avec compteurs, flèche pour faire passer un bloc d'une
  face à l'autre, dépôt **audio**.
- **Sommaire éditable refondu** (`OeuvreSommaireEditable`, passé par
  `/impeccable`) — le problème n'était pas l'espacement mais la **topologie** :
  67 lignes de poids égal sur ~2 800 px, alors qu'on n'édite qu'une scène à la
  fois. Deux chemins seulement : **replier** (chapitres en accordéon, celui où
  l'on est s'ouvre seul et porte une assise verte) et **chercher** (champ de
  filtre au-delà de 12 sections, qui déplie les résultats, masque les chapitres
  sans résultat et rappelle l'acte sur la ligne). Outils au survol et au clavier
  seulement (3 × 67 = 201 cibles dans 300 px), icônes dessinées, « Ajouter une
  section » au bout de la liste qu'elle allonge.

## Bibliothèque (onglet de Mes Ressources)

- Cartes au **gabarit de `GrilleCard`**, carte « **+** » comprise, dans le même
  **bloc blanc** que les grilles et le vocabulaire (`grillesSection`) — sans
  quoi la largeur des cartes différait d'un onglet à l'autre.
- Boutons **icônes** avec infobulle. « Construire » → « **✏️ Éditer** ».
- **Œil retiré** des œuvres qu'on peut éditer (double emploi avec ✏️), **gardé**
  sur celles qu'on ne peut pas : sinon on dupliquerait le livre d'un collègue
  sans avoir pu y jeter un œil.

## Rappel confirmé le 2026-08-16 — le corrigé reste OUVERT

Vérifié sur les deux couches à la demande de JP : `oeuvre-server.ts` n'a
**jamais** filtré `correctIndex` / `reponseIdeale` / `fluoAttendu`, et la
liseuse dévoile la bonne réponse **au clic sur l'option**. « Ces lectures sont
purement formatives, tant pis s'il triche. » Ne pas « corriger » ce
comportement : l'exception est écrite en tête des deux fichiers.

## Reste à faire
- [ ] **Tout tester à l'écran** — c'est le gros du reste.
- [ ] **Profil** : les deux indicateurs dans l'onglet Lire, le rappel dans
      Général, la notification de rythme (5ᵉ type). Le calcul existe déjà
      (`calculerRythme`) et `/api/oeuvres/suivi` le fait tourner ; il ne reste
      qu'à le brancher au profil et à la cloche.
- [ ] Les seuils de la notification (7 jours ? marge de 2 ?) — toujours non validés.
- [ ] Sélecteur « prendre un extrait dans une œuvre » dans `LectureQuizBuilder`
      (l'œuvre comme réservoir d'extraits).
- [ ] Le bouton « Prendre une note » de la maquette : toujours pas implémenté.

---

# Session du 2026-08-16 (suite) — l'outil d'édition

> Tout est livré, `tsc` / `eslint` / `build` passent. **Testé et approuvé par
> JP** : le divider au sein d'un extrait (« c'est génial »), la découpe en
> nouvelle section, et le figement des barres après trois diagnostics erronés.

## Le problème que ça règle

Encoder une scène réplique par réplique — un bloc, une tirade, un locuteur, on
recommence — décourage avant la dixième. **On colle la scène entière dans un
bloc, puis on la découpe de l'intérieur.**

## L'outil d'édition (interrupteur, ligne des onglets)

La souris passe entre deux lignes → un trait apparaît, avec **six gestes** :

| Geste | Effet |
|---|---|
| ✂ Couper ici | Sépare le bloc en deux. **Intra-bloc seulement** — entre deux blocs il n'y a rien à séparer |
| ℹ Bloc informatif · 📝 Extrait · 🎬 Vidéo | **Popup de saisie** : on colle, le bloc arrive rempli |
| 🖼 Image | Ouvre directement le sélecteur de fichier — son « champ », c'est celui-là |
| 📄 Nouvelle section | Tout ce qui suit part dans une nouvelle section, **placée juste après** la scène courante |

- **Flux continu** : en édition, les cartes de blocs disparaissent et la scène
  s'affiche d'un seul tenant. C'est la lecture suivie qui permet de décider où
  couper ; les en-têtes de cartes la hachaient.
- **Traits entre les blocs aussi**, pas seulement à l'intérieur.
- **Rien au repos** à l'intérieur d'un bloc (JP : « je ne vois pas ce qu'elles
  apportent ») ; une frontière à peine soufflée entre deux blocs.
- Un **bloc vide** s'annonce dans le flux avec un ✕ Supprimer.
- Le prof colle son texte **là où il vient de décider de le poser** : poser un
  bloc vide l'obligeait à quitter l'outil, retrouver le bloc, coller, revenir.

## Détection du locuteur

`src/lib/oeuvre-decoupe.ts` — à la découpe, une ligne courte et en capitales
(« ORGON », « MADAME PERNELLE », « DORINE, à Orgon. ») sort du texte et remplit
le champ Locuteur, **sur les deux moitiés** : à la première coupure, le nom du
personnage de la première réplique est encore dans le haut.

Volontairement **strict** (≤ 60 caractères, ≥ 80 % de capitales avant la
virgule, pas de `!` `?` `…` final) : une fausse détection ampute le texte d'une
ligne, bien plus coûteux qu'un locuteur à retaper. Vérifié par 20 cas sur une
scène de Molière réelle.

Un bloc HTML se coupe **entre éléments de premier niveau**, jamais au milieu
d'une balise — une liste `<ul>` reste entière.

## ⚠️ `position: sticky` — le piège qui a coûté trois tours

Consigné dans `INIT.md` § Gotchas. En résumé :

- Une barre collante se cale **sous la marge intérieure haute** du conteneur
  qui défile, pas au bord visible → une bande transparente s'ouvre au-dessus
  d'elle et le texte y réapparaît.
- Une marge négative sur la barre **aggrave** : le calage retient la boîte des
  **marges**, pas le bord peint.
- Solution retenue : `.editeur` en **deux étages** — `.editeurScroll` (sans
  marge intérieure haute, l'espace rendu par un `::before` qui défile) et un
  pied **hors du défilement**, donc plus collant du tout.

Ce qui a permis de trancher : **une capture d'écran de JP**, où la ligne
d'aide — postérieure à la barre dans le code — s'affichait au-dessus d'elle.
Trois hypothèses (fond transparent, z-index, marge négative) avaient été
tentées à l'aveugle avant.

## Autres ajouts de la session

- **Couverture du livre** : premier élément déposé dans le constructeur
  (`Oeuvre.couverture`), vignette sur la carte de la bibliothèque à la place du
  `📖` générique. Enregistrée immédiatement — elle n'appartient à aucune
  section et serait perdue au premier changement de scène. Suit la duplication
  (même ressource, pas de copie du base64).
- **Pastille du sommaire élève à trois états** : gris (ouverte) · orange
  (activité : verso consulté, mot cherché au dictionnaire) · vert (vérification
  faite — ou activité suffisante si la scène n'a pas de formulaire). Nouveau
  champ `OeuvreSectionEtat.agiLe`, règle unique dans `etatPastille()`.
  `agiLe` ne s'écrit **qu'une fois par scène** : sinon chaque mot cliqué
  déclencherait une sauvegarde. N'entre dans **aucun** compteur de progression.
- **« Prendre un extrait dans une œuvre »** dans `LectureQuizBuilder` (demande
  du 15/08, cf. plus haut) : livre → scène → passages cochés, collés **en texte
  brut** dans le texte joint ou le texte à souligner. Pas une référence vivante :
  une citation d'interrogation notée ne doit pas changer sous les pieds de
  l'élève parce que le prof a corrigé une coquille.

## Reste à faire
- [ ] **Commentaires du prof sur des mots** — demandé, non commencé. Ancrage
      arbitré : par **indices de mots** (un seul mécanisme pour les blocs
      `texte` en HTML et `vers` en texte brut) ; `FluoExtrait` fait déjà le
      geste de sélection décrit par JP. Le 3ᵉ déclencheur de la pastille orange
      (« ouvrir un commentaire ») attend cette brique — le point d'entrée
      `onActivite` est déjà en place.
- [ ] Profil : les deux indicateurs dans l'onglet Lire, la notification de
      rythme (5ᵉ type) — inchangé depuis le 15.
- [ ] Les seuils de la notification (7 jours ? marge de 2 ?) — toujours non validés.

---

# Session du 2026-08-17 — refonte de l'outil d'édition + fluorage commenté

> Tout est livré, `tsc` / `eslint` / `build` passent. **Rien n'est testé à
> l'écran** sauf l'outil d'édition et la pose d'un commentaire, validés en
> cours de session par JP.

## L'écran d'édition, repensé (demande de JP : « l'UX n'est pas top »)

**TROIS ONGLETS** au lieu de deux : Espace textuel · Espace multimédia ·
**Évaluation de la compréhension**. Le troisième porte le `LectureQuizBuilder`,
qui vivait au bas de la scène — donc après trente répliques, donc jamais lu.
Compteurs sur chaque onglet.

**UN SEUL MODE.** La bascule « ✂ Outil d'édition » a disparu : le flux est
toujours modifiable. Clic sur un passage → il s'ouvre **à sa place** ; les
traits d'insertion restent entre les lignes. `SaisieBlocModal` **supprimé** :
un bloc inséré s'ouvre directement, la popup était un intermédiaire de plus.
Le bandeau « + Bloc informatif / + Extrait… » a disparu aussi — il posait un
bloc au bout de la scène, jamais là où on le voulait.

Autres changements : **zone de collage** sur une scène vide (le premier geste
du prof, c'est coller le texte d'un seul tenant) · **bloc informatif** teinté
d'ambre et bordé à gauche · les **médias s'affichent pour de vrai** dans le
flux (`OeuvreBlocRendu`, le rendu partagé) avec une barre « ✏️ Modifier » — le
clic ne peut pas servir, un cadre YouTube l'avale.

## La couverture est une PAGE

`COUVERTURE_ID` (`__couverture__`) : côté élève, la couverture est la première
entrée du sommaire et la première page qu'on tourne. Elle emprunte
l'identifiant d'une section pour que le parcours, les flèches et le sommaire
n'aient **qu'un seul cas** à connaître — mais rien ne se charge et **rien ne
s'écrit dans la progression** (une couverture ne se « travaille » pas).
N'existe que si le prof a déposé une image. Côté prof : réduite à une
**vignette** pleine largeur en tête du sommaire.

## `facesInversees` — quel espace s'ouvre en premier

Réglage **par scène** (pas par livre) : une scène qu'on aborde par un extrait
filmé présente le multimédia d'abord. Les blocs **gardent leur face** — c'est
un ordre d'arrivée, pas un déménagement. Le chapeau suit la face d'arrivée.
Garde-fou : « multimédia d'abord » sans verso déposé retombe sur le texte.

**Le sélecteur est `FlipChoice`** — extrait de `CreationForm` sur indication de
JP (« va voir dans création d'activité, tu trouveras une orga plus facile ») :
il existait déjà en DEUX copies (création + édition d'activité), ma liste
déroulante en aurait fait une troisième divergente. Mécanisme partagé,
contenus propres à chaque dispositif.

## LE FLUORAGE COMMENTÉ (le n°1 du reste-à-faire, livré)

`src/lib/oeuvre-commentaires.ts` + `BlocCommente` (rendu **partagé** prof/élève).

| Décision | Arbitrage de JP |
|---|---|
| Texte modifié | Le commentaire retient **les mots exacts** et se recherche lui-même ; introuvable → **orphelin**, retiré de la vue élève, listé en rouge chez le prof |
| Couleur | **Une seule** — l'élève n'a qu'un signe à apprendre |
| Ouverture | **Popup au clic** — « ce qui permettra de voir ce qu'il clique pour ses stats !!! » |

Le clic de l'élève est tracé (`OeuvreSectionEtat.commentairesOuverts`), fait
passer la pastille à l'orange (**3ᵉ déclencheur, celui qui manquait**) et
remonte dans `/api/oeuvres/suivi` → colonne « Commentaires » du tableau de
classe, affichée seulement si des élèves en ont ouvert.

### Ce qui a coûté trois allers-retours : LE GESTE DE SÉLECTION

JP : « je ne vois pas du tout comment le prof peut ajouter un commentaire ».
C'était implémenté et **invisible**, puis implémenté et **cassé** :

1. **rien ne le disait** → bouton flottant « 🖍 Commenter ces mots » au-dessus
   de la sélection + mention dans la ligne d'aide de l'onglet ;
2. **le double-clic ne pouvait pas marcher** : le premier clic ouvre le
   passage en édition avant que le second n'arrive ;
3. **dans le champ ouvert**, la sélection d'un `<textarea>` **n'existe pas**
   pour `window.getSelection()` → lecture par `selectionStart/End`
   (`indicesDepuisOffsets`), sur `onSelect` pour couvrir glisser, double-clic
   et Maj+flèches ;
4. **au repos**, je lisais les **deux extrémités** de la sélection — or les
   espaces entre les mots sont des nœuds nus sans `data-mot` : une sélection
   qui commence ou finit sur une espace (donc presque toutes) n'avait aucune
   extrémité identifiable → on prend désormais **tous les mots que la plage
   traverse** (`intersectsNode` + `compareBoundaryPoints`).

⚠️ Le bouton flottant distingue **deux sources** de sélection : au repos,
`selectionchange` le referme ; dans un champ, surtout pas — la sélection d'un
`<textarea>` étant invisible à `window.getSelection()`, le bouton
disparaîtrait à l'instant où il se pose.

## Bug corrigé au passage

`/api/oeuvres/[id]/dupliquer` écrivait `undefined` sur un `groupe` ou un
`chapeau` vide (`docToSection` les pose ainsi) → **Firestore refuse**, la
duplication échouait en 500. Même piège que `chapitresPourFirestore`, ici sur
une section entière.

## Reste à faire
- [ ] **Tout tester à l'écran** — c'est le gros du reste.
- [ ] Profil : les deux indicateurs dans l'onglet Lire, la notification de
      rythme (5ᵉ type) — inchangé depuis le 15.
- [ ] Les seuils de la notification (7 jours ? marge de 2 ?) — non validés.
- [ ] Le fluorage commenté ne vaut que pour les blocs **extrait** et **bloc
      informatif** — un média n'a pas de mots. Non demandé, à confirmer.

---

## Session du 2026-08-17 (fin) — la vidéo invisible au verso

**Symptôme** : côté élève, l'« Espace multimédia » d'une scène affichait ses
images mais **rien** à la place de la vidéo (un trait résiduel). Côté prof,
dans l'aperçu du constructeur, la même vidéo s'affichait. La console crachait
des messages Drive (`frame-ancestors`), qui ont **envoyé le diagnostic dans le
décor** pendant un bon moment.

**Cause** : `.media` (la figure d'un média) porte `margin: 24px auto` pour se
centrer. Chez l'élève elle vit dans `.verso`, un **flex en colonne** — et une
marge horizontale `auto` y **annule l'étirement** de l'enfant, qui se réduit
alors à la largeur de son contenu. Une image en a une ; un cadre vidéo, dont le
seul enfant est un `<iframe>` en position absolue, n'en a **aucune** → largeur
0, puis hauteur 0 par l'`aspect-ratio`. L'aperçu prof, lui, utilise un `<div>`
ordinaire : la figure s'y étire normalement. **Composant partagé, conteneurs
différents.**

**Correction** : `width: 100%` explicite sur `.media`
(`OeuvreReader.module.css`). Le **bloc « contenu interactif »** souffrait du
même défaut sans que personne l'ait encore vu — il aurait été invisible au
verso lui aussi.

**Vérifié à l'écran le 2026-08-17 sur localhost.** ⚠️ Le test avait d'abord été
fait **sur la production**, où la correction n'était évidemment pas — d'où un
faux « ça ne marche toujours pas ».

Deux gotchas consignés dans `init.md` §7 : la marge automatique dans un flex,
et le bruit permanent du lecteur Drive dans la console.
