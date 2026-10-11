# 2026-10-11 — Administration : « Gestion de l'affichage »

> ⚠ **Trace datée.** Ce plan dit ce qui a été proposé le 2026-10-11 et pourquoi.
> Ce qui existe réellement se lit dans `init.md` et dans `harnais/memoire/`.

- **Statut** : principe **validé par JP** le 2026-10-11 (idées 1, 2, 3 : « tb / ok / ok » ; visibilité
  option **B**). Une question ouverte (côté élève) avant d'écrire.

## Le besoin (JP)

Masquer aux autres profs un outil en cours de développement que JP teste dans ses classes. Un atelier
masqué reste **visible, grisé transparent, non cliquable** — on sait qu'il arrive.

## Ce qui est décidé

| Sujet | Décision |
|---|---|
| Où | Onglet **« Gestion de l'affichage »** de l'administration, juste après « Gestion didactique » (`Header.tsx` `ADMIN_TABS`, `admin/page.tsx`) |
| Trois états par élément | **Visible** · **En test** (utilisable, badge « Nouveau — en test ») · **Masqué** (grisé, non cliquable, « Bientôt disponible ») |
| Note par élément | Texte libre de JP, affiché au survol du grisé (« Disponible en janvier ») |
| Qui voit le masqué | **JP (admin) + des profs testeurs** désignés par adresse dans la page (option B) — pour eux, l'élément est normal, avec une étiquette « masqué aux profs » |

## Les éléments réglables

| Bloc | Éléments (identifiants du code) |
|---|---|
| Ateliers (popup « Choix de l'activité » `AtelierChoiceGrid`, menu du `CreationForm`) | `ecriture`, `recherche`, `vocabulaire`, `conceptualisation`, `portfolio`, `lecture-oeuvre`, `lecture`, `sondage` |
| Onglets de Mes Ressources (`/grilles`, `/ressources-fle`) | `grilles`, `vocabulaire`, `questionnaires`, `oeuvres`, `portfolios`, `conceptualisations`, `scenarisation` ; FLE `theorie`, `activites` |
| Outils | Aide IA élève · Aide IA prof · Ceintures · Roue de progression · Compétition en direct · Sondage en direct · Espace FLE · Roadmap |

## Technique (proposée)

- Document **`configuration/affichage`** (collection existante, fermée au client par `firestore.rules`) :
  `{ elements: { [cle]: { etat: 'visible'|'test'|'masque', note } }, testeurs: [uid…] }`.
  Les testeurs se **choisissent dans la liste des profs** (celle de l'onglet Membres, noms déchiffrés
  côté serveur) : on stocke leur **uid**, jamais une adresse — aucun nouveau champ d'identité.
- Route `GET /api/affichage` (tout connecté — renvoie la configuration **résolue pour lui** : « vois-tu
  le masqué ? ») ; `PUT` admin seulement.
- Hook `useAffichage` avec cache module (patron `useDidactique`), `setAffichageCache` après enregistrement.
- **Masquer = interface seulement** (grisé, onglet absent ou grisé) : les routes ne refusent rien. Une
  activité déjà créée avec un atelier masqué continue de fonctionner.

## Question ouverte

Côté **élève**, les outils qui le concernent (aide IA élève, ceintures, roue) : qui les voit quand ils
sont masqués ? (JP les teste « dans ses classes ».)
