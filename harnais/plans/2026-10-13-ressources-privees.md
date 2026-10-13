# 2026-10-13 — Ressources privées ou partagées

> ⚠ **Trace datée.** Ce plan dit ce qui a été proposé le 2026-10-13 et pourquoi.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **VALIDÉ par JP le 2026-10-13** (« go »). Étape 1 (grilles) ÉCRITE, **TESTÉE ET APPROUVÉE par JP** le jour même. **Étapes 2 et 3 (7 autres types + étiquettes) ÉCRITES le même soir** — bouton vu à l'écran par l'agent sur le point de théorie FLE et le formulaire d'activité FLE ; aucun enregistrement testé.

## Le besoin (JP)

Tout ce qu'un prof crée part aujourd'hui dans le bloc « … des professeurs » de ses collègues
(Mes ressources, classique et FLE). JP veut, à la création, un **double bouton Partagé / Privé**,
**Partagé par défaut**.

## Ce qui est concerné (relevé du code, 2026-10-13)

8 types ont un bloc « des professeurs ». Aucun n'a de notion de privé aujourd'hui.

| Type | Collection | Où on le crée | Où on le modifie |
|---|---|---|---|
| Grilles | `grilles` | `GrilleBuilder` | même éditeur |
| Listes de vocabulaire | `vocabulaire` | `VocabListEditor` | même éditeur |
| Questionnaires de lecture | `questionnairesLecture` | constructeur de `QuestionnaireLecturePanel` (+ création silencieuse depuis une activité de lecture) | même constructeur |
| Œuvres | `oeuvres` | popup de `OeuvrePanel` | `OeuvreBuilder` |
| Portfolios | `portfolios` | popup de `PortfolioPanel` | `PortfolioAtelier` |
| Conceptualisations (schémas du prof) | `schemasPersonnels` | page `/mes-ressources/schemas/nouveau` | même page |
| Points de théorie FLE | `modulesFle` | `ModuleFleEditor` | même éditeur |
| Activités FLE | `devoirs` (FLE) | `CreationForm` en mode FLE | `EditDevoirModal` |

Hors champ : les activités **classiques** (jamais montrées aux collègues), les séquences FLE et la
scénarisation (privées par nature), le partage de classe en coprofesseur, le partage nominatif
des œuvres (`partages`) — il continue de marcher, même sur une œuvre privée.

## Ce qui est proposé

| Sujet | Proposition |
|---|---|
| Champ | `prive?: boolean` sur les 8 types. **Absent = partagé** : tout l'existant reste partagé, aucune migration. (Pas `shared`, qui veut déjà dire « exemple » posé par l'admin.) |
| Le double bouton | Un composant commun **`PartageToggle`** : « 👥 Partagé » / « 🔒 Privé », Partagé sélectionné au départ, une ligne d'aide dessous (« Tes collègues la voient dans … des professeurs et peuvent la dupliquer »). Posé dans les 8 écrans de création **et** de modification (on change d'avis plus tard). |
| Ce que « privé » cache | La ressource sort du bloc « des professeurs », du choix d'œuvre et de liste de vocabulaire dans le formulaire d'activité des collègues, et la **duplication** par un collègue est refusée. |
| Ce qu'il ne cache pas | La lecture directe par identifiant reste ouverte : les **élèves** et les activités en ont besoin (une grille privée utilisée dans une activité doit rester lisible par les élèves). |
| Repère visuel | Étiquette **« Privé »** sur la carte, dans mes propres ressources (`RessourceCard` sait déjà afficher des étiquettes). |
| Exemple de l'admin | Une ressource marquée « Exemple partagé » par l'admin est forcément partagée (le bouton Privé est grisé). |
| Copie | Une ressource dupliquée repart **partagée** (valeur par défaut), quel que soit l'original. |

## Découvert au passage (à traiter à part)

Les listes de vocabulaire n'ont **aucune vérification de propriétaire** à la modification ni à la
suppression (`api/vocabulaire/themes/route.ts`) : un prof pourrait, techniquement, modifier la liste
d'un collègue. L'interface ne le propose pas, mais la porte est ouverte côté serveur.

→ **Fermé le 2026-10-13** (`peutModifier` dans la route) : auteur ou admin ; une liste ancienne sans auteur reste modifiable par tous les profs, comme l'interface la présente.

## Découpage proposé

1. Champ + `PartageToggle` + filtrage serveur sur **un type** (grilles) — à voir à l'écran.
2. Les 7 autres types, sur le même modèle.
3. Étiquette « Privé » sur les cartes.

## Ce qui a été écrit (2026-10-13)

| Type | Création | Modification | Filtre « des professeurs » | Duplication refusée côté serveur |
|---|---|---|---|---|
| Grilles | `GrilleBuilder` | idem | `api/grilles` | (copie côté client, depuis la liste) |
| Vocabulaire | `VocabListEditor` (mode création) | idem, enregistré aussitôt | `api/vocabulaire/themes` (profs seulement ; les élèves voient tout) | (copie côté client) |
| Questionnaires | constructeur de `QuestionnaireLecturePanel` | idem | `listerQuestionnaires` | `GET api/questionnaires-lecture/[id]` refuse le privé d'un autre |
| Œuvres | popup de `OeuvrePanel` | barre sous l'en-tête de `OeuvreBuilder` (auteur seul) | `api/oeuvres` | `api/oeuvres/[id]/dupliquer` (sauf partage nominatif) |
| Portfolios | popup de `PortfolioPanel` | fiche de `PortfolioAtelier` (enregistrement auto) | `api/portfolios` | (copie côté client) |
| Conceptualisations | page `/mes-ressources/schemas/…` (prof seul), nouveau réglage `reglages` de `DiagramWorkspace` | idem | `api/schemas/personnel` | `POST {duplicateOf}` |
| Théorie FLE | `ModuleFleEditor` | idem | `api/modules-fle` | `api/modules-fle/[id]/dupliquer` |
| Activités FLE | `CreationForm` (mode FLE, à la place des classes) | `EditDevoirModal` | `autresFle` de `api/devoirs` | (copie côté client) |

Les questionnaires créés **depuis une activité de lecture** (création silencieuse) naissent partagés.
