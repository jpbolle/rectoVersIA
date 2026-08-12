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
