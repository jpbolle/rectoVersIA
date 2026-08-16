# Rollup — notifications (cloche du header)

> Livré le 2026-08-12. Architecture validée par JP : **calculées à la lecture**
> (pas de collection dédiée).

- `NotificationBell` (3 variantes du header) : cloche SVG monochrome (pas d'emoji),
  badge rouge non-lus, dropdown avec « Tout marquer comme lu ».
- `/api/notifications` GET : élève = activités ouvertes (`devoirs.disponibleAt`) +
  corrigés rendus (`corrections.visibleAt`, `devoirs.corrigeDisponibleAt`) ; prof =
  copies remises (`travaux.submittedAt`, requête range + filtre profId) ; admin =
  prof + section Administration (vide, à définir). Fenêtre 14 jours, 20 max.
- PUT : `users.notifsLastSeen` (badge) et `users.notifsEnabled` (toggle prof/admin
  dans le dropdown).
- Les 3 horodatages (`disponibleAt`, `corrigeDisponibleAt`, `visibleAt`) sont posés
  au **basculement** dans les routes devoirs/corrections — les événements antérieurs
  au 2026-08-12 n'en ont pas (pas de notification rétroactive).
- Rafraîchissement : montage + toutes les 5 min + ouverture du dropdown.

## TODO
- [ ] Test badge prof (remise élève) et badge élève (corrigé rendu)
- [ ] Définir le contenu de la section « Administration » (admin)

---

## Session du 2026-08-16 — notifications nominatives + rappel

### Deux nouvelles cibles, adressées à UNE personne

`AnnonceCible` gagne deux valeurs, les seules qu'un **prof** puisse viser :

| Cible | Adressée par | Qui l'écrit | Cas d'usage |
|---|---|---|---|
| `eleve` | `destinataireUid` (UID Firebase) | un prof, depuis le suivi de lecture | ❤️ / 💔 / 💬 à un de **ses** élèves |
| `collegue` | `destinataireEmail` | le **serveur**, au partage d'une œuvre | « X t'a partagé « Y » en co-édition » |

Elles ne sont **jamais** proposées dans `AnnonceModal`, qui liste ses cibles
lui-même (`CIBLES` local) : c'est ce qui a permis d'étendre le type sans toucher
à l'écran d'administration.

**Sécurité, entièrement côté serveur** : `/api/annonces` vérifie que l'élève
appartient à une classe de ce prof (`estMonEleve`), et `/api/notifications` ne
délivre une notification nominative qu'à son destinataire — jamais un filtrage
côté navigateur.

**`src/lib/annonce-server.ts`** (nouveau) : poser une annonce depuis le serveur,
sans passer par la route. Une notification qui est la **conséquence** d'une
autre action (le partage) doit s'écrire là où l'action se produit — un second
appel depuis le navigateur pourrait notifier un partage qui a échoué, ou
l'inverse. `poserAnnonce` n'échoue jamais bruyamment : le partage, lui, a eu
lieu, il ne doit pas être annulé par une cloche.

### Popup de rappel à 10 non lues

Passé ce seuil, le badge plafonne à « 9+ » : il signale un **volume**, plus un
contenu. Une popup s'ouvre alors à la première ouverture de l'app — la cloche
redessinée avec son badge, le rappel d'où elle vit, un séparateur, puis les
non-lues cliquables, et « Tout marquer comme lu » / « Plus tard ».

**Une fois par session du navigateur** (`sessionStorage`) : la rejouer à chaque
navigation la rendrait haïssable, l'oublier définitivement la rendrait inutile.

Décidée **à l'arrivée des données** dans `load()`, pas dans un effet : un
`setState` dans un effet déclenche un rendu en cascade, et le déclencheur est
bien un événement (la réponse du serveur).

## TODO
- [ ] Test badge prof (remise élève) et badge élève (corrigé rendu)
- [ ] Définir le contenu de la section « Administration » (admin)
- [ ] Tester la popup de rappel (il faut 10 non-lues) et les deux cibles nominatives
