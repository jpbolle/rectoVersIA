# 2026-10-11 — Mes Ressources : un seul gabarit de card

> ⚠ **Trace datée.** Ce plan dit ce qui a été proposé le 2026-10-11 et pourquoi.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : **validé et ÉCRIT le 2026-10-11** (gabarit + « Utiliser pour une classe » sur Grilles, Vocabulaire, Questionnaires, Œuvres, Portfolios, Conceptualisations) ; vu à l’écran le jour même (Grilles, Œuvres, Questionnaires), pas encore par JP.
- **Origine** : points 6 et 7 de JP (2026-10-11) — « Utiliser pour une classe » partout où
  c'est naturel ; uniformité CSS des cards de Mes Ressources, quel que soit l'onglet.

## Constat (inventaire du 2026-10-11)

9 cards, **3 gabarits** : boutons flottants en bas à droite (Grilles, Vocabulaire,
Scénarisation) · boutons centrés (Questionnaires, Œuvres, Théorie FLE) · boutons à droite
(Portfolio, Activités FLE). Trois dessins pour « Dupliquer » ; 🗑️ pour **archiver** (Œuvres,
Théorie) qu'on confond avec supprimer ; certaines cards s'ouvrent au clic, d'autres non ;
quatre libellés pour la card « Créer ».

## Décisions

| # | Sujet | Décision |
|---|---|---|
| 1 | Gabarit | **Celui du Portfolio** (emoji dans le titre, étiquettes, description, pied à filet : icônes puis bouton texte de l'action principale, card qui s'ouvre au clic) — **avec le fond vert « papyrus » des cards de grilles** (dégradé vert pâle + bordure verte) — JP |
| 2 | « Utiliser pour une classe » | Œuvres, Questionnaires, Vocabulaire, Grilles (atelier d’écriture direct : c’est le seul atelier à grille), Portfolios, Conceptualisations — pas Scénarisation, Théorie FLE, Activités FLE — JP |

## Mise en œuvre proposée

- **Un composant partagé `RessourceCard`** (+ un seul CSS) : icône, titre, étiquettes,
  description ou vignette, icônes d'action, action principale, état archivé, lecture seule
  (cards des collègues : « Dupliquer » seul, en texte).
- **Icônes `lucide-react`** partout (déjà dans le projet) : Dupliquer `Copy`, Archiver
  `Archive` / Restaurer `ArchiveRestore`, Supprimer `Trash2` (rouge, distinct de l'archive),
  Partager `Share2`, Voir `Eye`. **Plus de ✏️** : la card s'ouvre au clic.
- **Ordre des icônes**, de gauche à droite : Partager · Dupliquer · Archiver · Supprimer —
  puis l'action principale.
- **Card « Créer »** : un seul gabarit, libellé « Créer un/une … ».
- Migration onglet par onglet (Grilles, Vocabulaire, Questionnaires, Œuvres, Portfolios,
  Conceptualisations, Scénarisation, Théorie FLE, Activités FLE), chacun vu à l'écran.
