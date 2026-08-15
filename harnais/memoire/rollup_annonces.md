
> Session du 2026-08-15. **Livré, non testé.**
# Annonces de l'administration — notifications poussées
## Le besoin

Toutes les notifications de l'app sont **calculées à la lecture** depuis des
événements existants (remise, corrigé rendu…). Une annonce n'a aucun événement
derrière elle : il fallait bien l'écrire quelque part.

## Ce qui a été fait

| Fichier | Rôle |
|---|---|
| `src/types/annonce.ts` | modèle, liste des pages de l'app, `normalizeLien` |
| `/api/annonces` + `/[id]` | créer / lister / retirer — **admin seulement** |
| `/api/notifications` | `annonceNotifications()` mêle les annonces au reste |
| `src/components/AnnonceModal/` | la popup d'envoi |
| `/admin` onglet Vue d'ensemble | bouton 📢 + historique des envois |

**Collection `annonces`** : accès serveur uniquement → **aucune règle Firestore
à déployer** (même choix que `scenarisations`).

## Décisions

- **Trois cibles** : Professeurs / Élèves / Tout le monde.
- **Le lien a trois modes** : aucun / une page choisie dans une liste
  **filtrée selon la cible** (pas de page prof proposée à des élèves) / un
  chemin tapé à la main pour viser une activité précise.
- **Chemin interne obligatoire** : `normalizeLien` refuse toute URL absolue et
  tout `//` en tête. Une annonce ne doit pas pouvoir sortir les élèves de l'app.
- **`auteurUid`, jamais l'email** — pas de donnée personnelle en clair.
- **14 jours** : l'annonce sort d'elle-même de la cloche, comme le reste. La
  poubelle sert à retirer tout de suite un envoi raté.

## La cloche, refondue au passage

- Une annonce a **sa propre mise en page** : message entier (pas de troncature),
  et son lien est un **bouton en pastille ambre** portant le nom de la page.
  Panneau élargi à 400 px.
- **Lu par notification** : nouveau champ `users.notifsRead` (60 ids max). Un
  clic éteint CETTE notification, les autres restent.
  Deux mécanismes coexistent, et c'est voulu : `notifsLastSeen` solde tout d'un
  coup (« Tout marquer comme lu »), `notifsRead` éteint une notification
  précise. Une notification est non lue si **les deux** la disent non lue.
- **Chaque notification mène à ce qu'elle annonce** : la copie à corriger pour
  le prof, l'activité pour l'élève.
- Le `PUT` relit `notifsRead` avant d'écrire, pour ne pas écraser ce qu'un
  autre onglet vient d'y poser.

## TODO

- [ ] Tester un envoi « Tout le monde » avec lien vers la Roadmap.
- [ ] La section « Administration » de la cloche est toujours vide.
