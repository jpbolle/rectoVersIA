# Rollup — Design & scénarisation didactique

> Session du 2026-08-14. Nouvel outil prof : la **colonne vertébrale d'un
> cours**, dont les activités Recto-versIA ne sont qu'un aboutissement possible.
> Livré, **jamais testé à l'écran**.

## Le modèle

```
Parcours (= une scénarisation, un cours) > Chapitres > Modules > Activités
```

| Niveau | Ce qu'il porte |
|---|---|
| **Parcours** | nom du cours, objectif général, certification, réglages horaires |
| **Chapitre** | objectif général propre, certification propre (facultative) |
| **Module** | période de l'année, nombre de **périodes**, méthodes, UAA, habiletés, outils, objectifs particuliers en **trois registres** (concepts et connaissances / habiletés / savoir-être), activités |
| **Activité** | fiche à part entière : elle peut être **hors application** (un débat, une lecture à voix haute) ou porter une activité Recto-versIA |

Décisions prises avec JP :
- **objectif général aux deux niveaux** (parcours ET chapitre) — deux
  certifications possibles ;
- **le prof saisit des périodes**, jamais des heures : la durée est calculée
  (`dureePeriodeMin`, 90 min par défaut, réglable) ;
- **la capacité d'une période de l'année se calcule** :
  semaines × heures/semaine ÷ durée d'une période. Sept-oct = 9 sem. × 5 h ÷
  1 h 30 = **30 périodes**. Le nombre de semaines se corrige dans l'en-tête de
  la colonne (les congés bougent d'une année à l'autre) ;
- **plusieurs scénarisations** coexistent — une par cours, sélecteur en haut.

## Les deux vues

- **🗓 L'année** — vision spatiale, avec deux lectures :
  - *Par module* : cartes réparties dans les cinq périodes de l'année, chaque
    colonne annonçant sa capacité, sa jauge et ce qui reste libre (ambre
    au-delà de 85 %, rouge en dépassement) ;
  - *Par chapitre* : une bande par chapitre à travers l'année — on voit où un
    chapitre commence, où il finit, s'il chevauche le suivant, où tombe sa
    certification.
- **✎ Encodage** — un tableau par chapitre, replié en accordéon.
  **Règle dure posée par JP : tout se modifie sur place, aucune icône crayon.**
  Titres, objectifs, périodes, outils : champs dont la bordure n'apparaît qu'au
  survol. Période de l'année et grille : menus déroulants qui ont l'air de
  texte. Méthodes, UAA, habiletés : champs à pastilles (`TagField`) qui ouvrent
  une liste à cocher.

## La passerelle, à double sens

Trois chemins depuis un module (`ModuleActivitesModal`) :
1. **hors application** — un intitulé, rien d'autre ;
2. **rattacher** une activité existante (liste de `/api/devoirs`) ;
3. **créer** — le `CreationForm` **habituel**, ouvert dans la popup. L'activité
   créée est une activité normale : elle apparaît dans Mes Activités.

En retour, `/api/scenarisations/[id]` PUT pose `devoir.scenarisationRef`
(`{ scenarisationId, nom }`) sur chaque activité rattachée et l'efface sur
celles qu'on a détachées. `DevoirCard` affiche une pastille 🧭.

## Technique

- Collection `scenarisations` — **un document par scénarisation**, chapitres et
  modules **imbriqués**. Pas de sous-collection, pas d'index composite : l'écran
  les édite ensemble et une année de cours pèse quelques dizaines de Ko.
- Accès **serveur uniquement** (`adminDb`) ⇒ **aucune règle Firestore à
  déployer**.
- Le PUT **réécrit le document entier** ; `sanitizeScenarisation`
  (`src/lib/scenarisation-server.ts`) filtre tout ce qui n'est pas reconnu.
- Enregistrement **différé de 2,5 s** après la dernière frappe
  (`useScenarisations`), vidé au changement de scénarisation et au démontage.
- **Méthodes d'enseignement** : nouvelle liste `methodes` dans
  `configuration/didactique`, tenue dans /admin → Gestion didactique (même
  forme que les UAA : œil, corbeille, ajout). Six valeurs par défaut
  (`DEFAULT_METHODES`) posées automatiquement sur les documents antérieurs.

## TODO

- [ ] **Tout tester** — rien n'a été vu à l'écran.
- [ ] Glisser-déposer des modules d'une période de l'année à l'autre (vue par
      module) — aujourd'hui on change la période dans le menu de l'encodage.
- [ ] Réordonner les chapitres et les modules (pas de drag & drop non plus).
- [ ] Certification : la relier à une activité certificative (`devoirId` existe
      dans le modèle, rien ne le pose encore dans l'interface).
- [ ] Archivage d'une scénarisation (le champ `archive` existe, filtré à la
      lecture, mais aucun bouton ne le bascule).
