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

## Scripts

| Script | Rôle |
|---|---|
| `scripts/import-habiletes.ts` | Import unique des 63 habiletés. **Rejouable sans risque** : une habileté déjà en base est laissée strictement intacte |
| `scripts/prefill-ateliers.ts` | Pré-coche l'atelier évident (lecture → Lecture, écriture → Écriture, lexique → Vocabulaire). N'ajoute jamais un 2ᵉ atelier, n'en retire aucun. **Lancé le 2026-08-13** |

## TODO

- [ ] **Tester à l'écran** — seul `/admin → Gestion didactique` a été vérifié.
      Restent la création d'activité (les 4 ateliers), la correction d'un
      questionnaire de lecture, l'onglet Évaluation élève, le profil.
- [ ] **`competences` sur les questions NavigKid** (`NavigKidQuestion`) : une
      activité de recherche déclare ses habiletés mais aucune trace **par
      habileté** ne remonte au profil, faute de savoir quelle question travaille
      quoi. Le pendant de ce qui a été fait pour la lecture.
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
