# Rollup — didactique : habiletés, ateliers, notation de la lecture

> Session du 2026-08-13. Chantier non prévu au départ (le plan de la veille
> portait sur NavigKid), ouvert par une question de JP sur le champ
> « Code extension » puis élargi à toute la modélisation didactique.
>
> **Rien n'a été testé à l'écran au-delà de /admin → Gestion didactique.**

## La décision de fond

Deux choses étaient confondues sous le mot « type de travail » :

| Notion | Ce qu'elle dit | Où elle vit |
|---|---|---|
| **Mode principal** | Quelle compétence est en jeu : lire, écrire, parler, réfléchir, lexique | `devoir.modePrincipal`, liste `TYPES_MODAUX` |
| **Type d'activité (atelier)** | Dans quel dispositif on la travaille : écriture, lecture, recherche, vocabulaire | `devoir.atelier`, liste fermée `ATELIERS` |

⇒ **Chercher, c'est lire.** Une recherche guidée est un travail de *lecture*
mené dans un *atelier de recherche*. « Rechercher » a donc quitté les types
modaux ; le tableau source de JP le disait déjà (aucune de ses 63 lignes n'était
typée « rechercher » — les gestes de recherche y sont classés en Lire ou Écrire).

`devoir.typeTravail` **reste en base** comme identifiant de dispositif : les 35
branchements existants n'ont pas bougé, aucune migration.

## Geste et habileté — la hiérarchie (posée par JP le 2026-08-14)

> **Un geste cognitif englobe des habiletés.** Ce ne sont pas deux mots pour la
> même chose, et il ne faut surtout pas renommer l'un en l'autre.

| Niveau | Ce que c'est | Exemple |
|---|---|---|
| **Geste** | Le geste de lecture, d'écriture, de recherche… — l'opération intellectuelle. Niveau **macro** | « Identifier les idées essentielles » |
| **Habileté** | Sa déclinaison précise, évaluable : « je suis capable de… ». Niveau **fin** | « Je distingue l'idée principale des idées secondaires d'un paragraphe » |

Conséquences :
- la **scénarisation** raisonne en **gestes** (on planifie un cours au niveau
  macro) ; la **création d'activité** et la **notation** raisonnent en
  **habiletés** (c'est là qu'on évalue) ;
- techniquement le geste reste ce qu'il était : le libellé partagé par plusieurs
  habiletés (`Habilete.geste`), pas une collection à part ;
- **ne jamais** remplacer le mot « habiletés » par « gestes cognitifs » dans
  l'interface : les deux mots désignent deux niveaux différents.

## Modèle d'habileté

```ts
Habilete { id, type: TypeModal, geste, label, objets: string[], uaa: string[],
           ateliers: string[], visible }
```

- Le **geste** n'est pas une entité : c'est le libellé partagé par plusieurs
  habiletés. Le renommer dans la barre de groupe renomme tout le groupe.
- **objets** : tags (plusieurs), ex. « contraction de texte », « CRC ».
  L'ancien champ `objet` (valeur unique) est relu par l'API — pas de migration.
- **ateliers** : plusieurs possibles. Une même habileté vit en atelier de
  lecture *et* de recherche.

Source : feuille « Ceintures et habiletés » (63 lignes), importée **une fois**
depuis l'instantané `scripts/data/ceintures-et-habiletes.csv`. Le tableau Google
n'est plus la source de vérité — l'app l'est.

## Grille ou habiletés, jamais les deux

| Atelier | Évaluation |
|---|---|
| Écriture | **Grille** (filtrée sur les grilles typées « Écriture »), pas d'habiletés — les critères les portent |
| Lecture, Recherche, Vocabulaire | **Habiletés** (sélecteur en deux temps : gestes → habiletés), pas de grille |

La grille n'est donc plus exigée que pour l'écriture, côté client **et** serveur.

## Notation d'un questionnaire de lecture

`src/lib/lecture-scoring.ts`, partagé serveur et client.

- QCM : comptés automatiquement, **jamais stockés** (recalculés à chaque lecture,
  pour rester justes si le prof corrige le quiz).
- Questions ouvertes : points saisis par le prof, de 0 au maximum de la question
  → `correction.questionScores`.
- Question non notée : **hors total**, numérateur comme dénominateur.
- **Règle d'agrégation** : une question portant deux habiletés compte
  ENTIÈREMENT dans chacune. La somme des lignes ne retombe jamais sur le total,
  et c'est voulu — sinon une question à deux habiletés serait comptée à moitié
  dans les deux. Rappelée à l'écran sous le tableau.

Remonte dans : onglet Évaluation (élève et prof) et bloc « Habiletés
travaillées » de l'onglet Lire du profil.

## Ce qui a été livré

- `/admin` → **Gestion didactique** refondue : tableau des UAA permanent, puis
  un menu déroulant par type modal (replié par défaut), saisie en place,
  colonnes Objets (tags) / Ateliers / UAA, filtres, popup réservée à la création.
- Titre de page = nom de l'onglet dans tout `/admin` ; « Retour à l'accueil »
  passé en dernier bouton du header.
- Badge « Code extension » retiré de la page d'un devoir (vestige sans usage :
  aucune requête ne filtrait sur `codeAcces`, l'extension n'a pas de champ de
  saisie de code).
- Création / édition d'activité : Type d'activité + Mode principal (déduit,
  affiché en note), sélecteur d'habiletés, mise en page réorganisée.
- Grilles : champ **Type d'activité** en pastilles à côté des UAA ciblées.

## Sélecteur d'habiletés — replier n'est pas sélectionner (2026-08-15)

Bug signalé deux fois par JP. Le bloc « Habiletés travaillées » n'avait **aucun
moyen de se replier** : le seul geste qui refermait la liste était de recocher
« Toutes les habiletés »… ce qui resélectionnait tout. Replier pour alléger
l'écran effaçait donc le choix. Aggravant : toute la ligne était un `<label>`,
si bien qu'un clic sur le libellé basculait la case.

Corrigé : la **case à cocher** décide seule « toutes ou certaines », le **reste
de la ligne** (libellé + compteur + chevron) replie. Le bloc s'ouvre **replié**,
avec un résumé (« 3 habiletés retenues »).

⇒ **Règle générale** : dans tout sélecteur de ce projet, le pliage et la
sélection sont deux commandes distinctes, à tous les niveaux.

JP a clos la session du 15/08 sur le constat « bug corrigé ».

## Scripts

| Script | Rôle |
|---|---|
| `scripts/import-habiletes.ts` | Import unique des 63 habiletés. **Rejouable sans risque** : une habileté déjà en base est laissée strictement intacte |
| `scripts/prefill-ateliers.ts` | Pré-coche l'atelier évident (lecture → Lecture, écriture → Écriture, lexique → Vocabulaire). N'ajoute jamais un 2ᵉ atelier, n'en retire aucun. **Lancé le 2026-08-13** |

## TODO

- [x] **Testé à l'écran et déployé** (constaté le 2026-08-14 : aucun bug relevé).
- [x] **`competences` sur les questions NavigKid** — livré le 2026-08-14 avec
      la notation des recherches (voir `rollup_recherche.md`). Les habiletés se
      cochent question par question dans le constructeur ; l'agrégation suit la
      même règle qu'en lecture. **Reste à tester.**
- [ ] Associer habiletés d'écriture et grilles (roadmap, dit par JP).
- [ ] `eslint` : « Compilation Skipped » sur `CreationForm` — le React Compiler
      renonce à mémoriser le composant depuis les changements du jour. Sans
      effet fonctionnel, lint non bloquant en CI. Le régler demande de reprendre
      les `useCallback` de l'animation recto/verso.

## Conséquence à ne pas oublier

Une activité de lecture ou de recherche **créée désormais sans grille** ne
produit plus : auto-évaluation élève, évaluation IA, moyenne et médiane du
devoir, ni alimentation du profil **par critère**. Pour la lecture, la notation
par habileté prend le relais. Pour la recherche, **rien ne prend encore le
relais** — d'où le TODO ci-dessus. Les activités déjà créées gardent leur grille.

---

## Session du 2026-08-15

- **Gestion didactique** : UAA et Méthodes réunies dans un seul bloc
  « Référentiel du cours », en **deux colonnes** séparées par un filet (une
  seule colonne sous 900 px).
- **Ordre des familles de gestes** : Lecture → Écriture → Parole → **Lexique**
  → **Réflexifs** → **Savoir-être**. Les deux familles d'attitude ferment la
  marche, ce qui rejoint le regroupement déjà posé par `TYPES_SAVOIR_ETRE`.
  L'ordre vit dans `TYPES_MODAUX` ; seul le panneau d'administration le parcourt
  (les deux autres lecteurs y cherchent un libellé par identifiant).

## `AutoGrowTextarea` — un champ, trois constructeurs

Les trois constructeurs de questionnaires posaient le même problème de trois
façons : un `<input>` d'une seule ligne pour la lecture, et **deux formules
maison distinctes** estimant `rows` d'après le NOMBRE DE CARACTÈRES pour la
recherche et l'auto-évaluation. Cette estimation ne peut pas être juste : elle
ignore la largeur réelle du champ, la police et les retours à la ligne saisis.

`src/components/AutoGrowTextarea/` MESURE (`scrollHeight`) après chaque
changement, se réajuste quand le panneau est redimensionné (`ResizeObserver`),
et cesse de grandir au-delà d'un plafond (il défile alors).

**Ce qui reste volontairement différent d'un constructeur à l'autre** — règle
donnée par JP : « unifier le mécanisme, jamais les singularités ».

| Singularité | Où | Pourquoi |
|---|---|---|
| Éditeur Tiptap pour les blocs informatifs | Lecture | c'est du texte mis en forme |
| Icônes 🖼 / 🎧 à droite de l'énoncé | Lecture | image et audio n'existent que là |
| Icône 📄 texte joint | Recherche | — |
| `minRows` 3 | Recherche | les consignes de recherche sont longues |
| `minRows` 2 | Lecture, auto-évaluation | questions plus brèves |
| Placeholders distincts, dont un pour les blocs informatifs | Auto-évaluation | un bloc informatif et une question ne s'amorcent pas pareil |
