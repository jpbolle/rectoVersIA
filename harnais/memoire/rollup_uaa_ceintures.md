# Rollup — Certifications, UAA et ceintures

> Réflexion du 2026-08-15 (rien tranché), **livrée le 2026-08-17**.
> **Testé et validé par JP** : déclaration, saisie des notes, bloc Mes Classes,
> récapitulatif du profil. **La page `/accueil` et la roue restent à tester** —
> JP les vérifie le soir du 17.

## Ce qui a été tranché (2026-08-17)

| Point | Décision |
|---|---|
| Ordre des ceintures | blanche → jaune → verte → bleue → **noire** → **rouge** (dépassement) |
| **Blanche** | **acquise dès l'entrée dans le parcours**. Aucune certification ne l'accorde : elle est retirée des menus déroulants et **refusée par le nettoyage serveur** |
| Réussite d'une UAA | ceinture **noire** → le **badge** de l'UAA s'allume |
| Seuil | certification réussie à **≥ 60 %** → sa ceinture est acquise |
| Source du récapitulatif | **uniquement** les certifications déclarées dans la scénarisation |
| Pondération | **un % du total de l'UAA** (30 / 70…). L'écran annonce la somme par UAA et signale ≠ 100 % — **jamais un blocage**, l'année s'encode au fil des mois |
| **Certifications non cotées** | certaines accordent leur ceinture au seul fait d'avoir été **FAITES** (`cotation: 'note' \| 'fait'`, absent = `note`) |
| Saisie des notes | **deux portes** vers la même popup : ligne de certification (scénarisation) et bloc « Certifications » du détail d'une classe |
| Centre de la roue | « n/7 UAA acquises » — le mot « Progression » seul ne disait rien |
| Affichage de la roue | **toujours**, dès le premier jour : la blanche étant acquise d'emblée, aucune branche n'est vide, et c'est au début d'année que la roue est la plus utile — elle annonce l'année à venir. Les sept UAA du référentiel y figurent, certifiées ou non (`completerRoue`). ⚠ **Règle inverse** dans le bloc du PROFIL, qui ne montre que les UAA certifiées : sept lignes de tableau vides n'apprendraient rien |

## Le modèle

**La scénarisation est le REGISTRE des certifications.** Beaucoup ne passent pas
par l'application (épreuve orale, dossier papier) et n'existeraient nulle part
ailleurs. `ModuleDidactique` de genre `certification` gagne :

```ts
uaaCertifiees?: string[];         // distinct de `uaa` (hérité) — voir plus bas
ceinture?: string;                // id de CEINTURES_ATTRIBUABLES
ponderation?: number;             // % du total de l'UAA (défaut 100)
cotation?: 'note' | 'fait';       // absent = 'note'
```

`Scenarisation` gagne `classes?: string[]` (**noms** de classes, comme
`devoirs.classes`) et son `anneeScolaire` devient **modifiable** — « Français —
4e générale » revient chaque année, c'est l'année qui distingue deux parcours.

### Collection `certificationsEleves` (nouvelle)

Un document par **(certification, élève)** : `CRT-{moduleId}-{eleveId}`.
Champs : refs (`scenarisationId`, `chapitreId`, `moduleId`, `eleveId`, `profId`,
`anneeScolaire`), `percent: number | null`, `fait: boolean`, `commentaire`,
`date`, `updatedAt`.

- **Rien n'y est recopié** de la déclaration : une pondération corrigée après
  coup se répercute partout, il n'existe jamais deux vérités.
- Accès **serveur uniquement** (`adminDb`) ⇒ **aucune règle Firestore**.
- **Aucun index composite** : toutes les requêtes sont à champ unique
  (`moduleId ==`, `eleveId in`), Firestore les indexe seul.
- RGPD : `eleveId` est un identifiant de document, pas une identité — rien à
  chiffrer.

## Trois pièges qui ont coûté du temps

1. **`uaaCertifiees` est distinct de `uaa`.** `moduleUaa()` fait primer les UAA
   des activités sur celles du module — juste pour un module, faux pour une
   certification, où la déclaration du prof doit gagner (et où il n'y a souvent
   aucune activité).
2. **La duplication d'un parcours DOIT régénérer les identifiants.** Une note est
   classée par `moduleId` seul : deux certifications de même id verraient leurs
   notes d'élèves se confondre. `dupliquerScenarisation()` régénère chapitres,
   modules et activités, détache les `devoirId` et vide les classes.
3. **Une note héritée d'une activité rattachée doit être PRÉREMPLIE, pas
   suggérée.** En placeholder, elle n'était jamais écrite en base — et le profil
   ne lit que ce qui y est écrit. Elle n'atteignait donc jamais l'élève.

## Un « fait » n'est pas un 100 %

Une certification non cotée n'entre **ni au numérateur ni dans la somme des
poids** du pourcentage de l'UAA : la compter comme un 100 % gonflerait la
moyenne. Une UAA dont toutes les certifications sont « faites » affiche donc
`—` — il n'y a rien à moyenner, et c'est juste.

## Ce qui a été livré

**Socle** — `src/types/ceintures.ts` (6 ceintures, `SEUIL_CERTIFICATION`,
`CEINTURE_DEPART`, `CEINTURES_ATTRIBUABLES`, helpers). Images renommées :
`public/badges & ceintures/` → **`public/ceintures/`** (l'espace et le `&` dans
une URL sont un piège) ; les deux captures de référence ont quitté `public/`
pour `harnais/memoire/images/`.

**Prof** — bloc de déclaration dans la ligne ⭐ de `ScenarisationPanel`,
`CertificationNotesModal` (popup partagée), `ClasseCertifications` (Mes Classes),
routes `/api/certifications/notes` (GET/PUT) et `/api/certifications/classe`.
Une certification dépliée n'affiche plus le tableau des activités mais un bloc
**« L'épreuve »** : sa durée et l'activité rattachée. Elle n'a pas « des
activités » — elle est **une** épreuve.

**Élève** — bloc « Mes certifications par UAA » dans l'onglet Général du profil
(carte par UAA, ceinture en 76 px dans une colonne à droite, badge, détail ligne
à ligne) ; page **`/accueil`** (3 blocs + roue) et `CeinturesRoue`.

**Mes parcours** — l'onglet s'ouvre désormais sur des **cartes** (gabarit de
`GrilleCard`), avec **duplication** et popup de création/duplication à deux
champs. Plus aucun `prompt()`/`alert()` sur ce parcours.

## La roue — géométrie (état final du 2026-08-17)

7 branches sur **240°**, UAA 0 droit en haut (les UAA 3 et 4 descendent sous
l'horizontale, comme le tableau de bord de JP). 6 couronnes de `R_INT 110` à
`R_EXT 300`.

L'ordre des motifs sur une branche, du centre vers l'extérieur — **c'est ce qui
a demandé le plus d'allers-retours** :

```
couronnes → étiquette « UAA n » (R_EXT+38) → BOUCLIER (R_EXT+122)
```

- **Une seule ceinture par branche**, la dernière obtenue, **83 px**, centrée
  sur sa couronne qu'elle traverse. (Les six empilées à 44 px : illisible.)
- **Le bouclier est le motif le plus EXTÉRIEUR** : entre la roue et l'étiquette
  il s'intercalait dans la lecture au lieu de la terminer. 88 px.
- En attente : **transparent (0,22) mais EN COULEUR**. Le gris les rendait
  blafards — or c'est ce que l'élève vise.
- **L'intitulé de l'UAA est au SURVOL** de son étiquette (`<title>` + curseur
  `help`). Déployés, sept intitulés ceinturaient la roue de pavés de texte : on
  lisait des phrases avant de voir la progression.

Maquette de référence, tenue à jour avec le composant :
`harnais/plans/maquette-accueil-ceintures.html`.

⚠ **Gotcha SVG** consigné dans `INIT.md` : la géométrie travaille en angles
mathématiques (y vers le haut), le drapeau de balayage des arcs vaut donc **0**.

## TODO

- [ ] **Tester `/accueil` et la roue** (JP, soir du 2026-08-17).
- [ ] Suppression d'un parcours : encore un `confirm()` natif, alors que la
      création et la duplication ont leur popup soignée.
- [ ] Une même UAA visée par **deux parcours** additionne leurs pondérations
      (200 %) et déclenche l'avertissement. Cas non rencontré, non traité.
- [ ] Les libellés courts d'UAA du tableau de bord de JP (« Je prends du recul »)
      n'existent pas dans les données : la roue affiche le libellé complet,
      coupé en lignes. Un champ `court` dans `configuration/didactique` ferait
      l'affaire.
