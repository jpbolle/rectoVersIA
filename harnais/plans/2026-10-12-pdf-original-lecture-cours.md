# 2026-10-12 — Lecture de cours : le PDF d'origine dans « Le cours »

> ⚠ **Trace datée.** Ce plan dit ce qui a été décidé le 2026-10-12 et pourquoi.
> Il n'est pas mis à jour : depuis, la décision a **peut-être été dépassée**.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : proposé → validé le 2026-10-12 → livré et testé par JP le 2026-10-12
- **Demande initiale** : « Dans la colonne de droite, onglet "Le cours", que ce ne soit pas une
  transcription mais le PDF lui-même, ce qui suppose de le conserver via un dossier Drive, et
  d'avoir une bibliothèque PDF. Le but : pour l'élève, garder ses repères par rapport au document
  d'origine. Si besoin de transcription, elle peut apparaître en dessous du PDF. »

## Le problème

L'élève importe un PDF de cours (géo, histoire…), mais l'onglet « Le cours » n'en montre qu'une
**transcription** : plus de mise en page, plus d'images, plus de repères (« le paragraphe en haut à
droite de la page 2 »). Le PDF lui-même est jeté après la transcription. Et un PDF déjà importé ne
peut pas être repris : il faut le réimporter (et repayer la transcription).

## Options

| Question | Option | Ce que ça implique | Coût / risque |
|---|---|---|---|
| Stockage | **A — Firebase Storage** | Déjà utilisé (pièces jointes d'activités), zéro réglage | Invisible pour JP hors application |
| | **B — Dossier Google Drive** ✅ | Les PDF rangés dans un Drive que JP voit ; compte de service (le robot de l'application, celui de Google Sheets) avec l'API Drive (`googleapis`, **déjà installé**) | Exige un **Drive partagé** de l'école (un compte de service ne peut pas posséder de fichiers dans un Drive ordinaire) ; un aller-retour Drive à chaque affichage |
| Affichage | **A — Lecteur PDF intégré de Chrome** ✅ | Un cadre (`iframe`) qui affiche le PDF servi par notre route ; zoom, défilement, recherche natifs ; tourne sur Chromebook | Aucune dépendance |
| | B — Bibliothèque `pdf.js` | Contrôle fin (surligner, mots cliquables dans le PDF) | Dépendance nouvelle, lourde — pas demandée |
| Bibliothèque | **« Mes documents » (élève)** ✅ | L'élève retrouve ses PDF et relance une lecture sans réimporter | — |
| | Vue prof, bibliothèque partagée prof → élèves | — | Écartées par JP le 2026-10-12 |

**Retenu : Drive (choix JP) + lecteur intégré de Chrome + « Mes documents » élève.**

## Ce qu'on fait

1. **Réglage Drive** (par JP, guidé étape par étape) : un Drive partagé (ou un dossier dedans),
   le compte de service ajouté comme « Gestionnaire de contenu », l'API Drive activée sur son
   projet Google Cloud, l'identifiant du dossier dans `.env.local` (+ VPS) : `DRIVE_COURS_FOLDER_ID`.
2. **Dépôt du PDF dans Drive à l'import** — `src/lib/import-cours/drive.ts` (neuf),
   `src/lib/import-cours/pdf.ts`, `src/app/api/fle/lectures/route.ts`.
   Nom du fichier dans Drive : l'identifiant du document + le titre (**jamais le nom de l'élève**).
   Le fichier n'est **pas** partagé : seul le serveur le lit.
3. **Collection `documentsCours/{id}`** (serveur uniquement → aucune règle Firestore) :
   élève, nom d'origine, titre, pages, identifiant Drive, **transcription** (pour reprendre sans
   repayer). La lecture porte `documentId`. — `src/types/lecture-cours.ts`, `src/lib/lecture-cours-server.ts`
4. **Route d'affichage** `GET /api/fle/lectures/[id]/pdf` : vérifie que c'est l'élève ou l'un de
   ses profs, lit le PDF dans Drive et le renvoie. — route neuve
5. **Onglet « Le cours »** : le PDF en haut (cadre à hauteur réglée, bouton « Ouvrir en grand »),
   la transcription **en dessous**, repliable, avec ses mots cliquables (dictionnaire) intacts.
   Lectures anciennes ou importées par lien / texte : inchangées (transcription seule).
   — `src/app/fle/lectures/[id]/page.tsx` (+ son CSS)
6. **« Mes documents »** : 4e onglet de la popup d'import (« 📚 Mes documents ») — la liste des
   PDF de l'élève (titre, pages, date) ; un clic crée une nouvelle lecture **sans nouvel appel IA
   de transcription**. — `src/components/ImportCoursModal/ImportCoursModal.tsx`,
   `GET /api/fle/documents` (neuf), `POST /api/fle/lectures` (mode `document`)

## Ce qu'on ne fait pas dans ce chantier

- Pas d'affichage de l'original pour les **liens Google Docs / Slides** (le lien « Ouvrir
  l'original ↗ » existe déjà).
- Pas de reprise des PDF déjà importés (ils ont été jetés : leurs lectures restent en transcription seule).
- Pas de suppression de document par l'élève, pas de vue prof des PDF.
- Pas de surlignage ni de mots cliquables **dans** le PDF (ce serait `pdf.js`).

## Comment on saura que ça marche

- Un élève FLE importe un PDF → « Le cours » montre **le PDF tel quel** (pages, images), la
  transcription en dessous ; les mots de la transcription ouvrent toujours le dictionnaire.
- Le fichier apparaît dans le dossier Drive, nommé sans le nom de l'élève.
- Popup d'import › « Mes documents » → le PDF y est ; un clic ouvre une nouvelle lecture
  immédiatement (pas de « Lecture du PDF… »).
- Le prof qui ouvre la lecture de cet élève voit aussi le PDF.
- Un PDF de 6 pages est toujours refusé, et le fichier **n'arrive pas** dans Drive.

## Points à trancher par l'utilisateur

- [x] L'école a-t-elle des **Drive partagés** (Google Workspace for Education) et peux-tu en créer un ?
