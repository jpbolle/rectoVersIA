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
