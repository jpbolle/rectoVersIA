# Rollup — Espace de travail élève (FlipEditor / WorkEditor)

## État actuel (session du 2026-08-08)

**Anti-triche collage** — livré, **non testé, non déployé** :
- Collage dans l'espace de rédaction bloqué, sauf si le texte a été copié/coupé dans
  l'espace de travail lui-même (rédaction **ou** planification).
- Mécanisme : module singleton `src/lib/internal-clipboard.ts` (texte normalisé,
  comparé au `text/plain` du presse-papiers au collage). WorkEditor alimente via
  `handleDOMEvents.copy/cut`, FlipEditor via `onCopy/onCut` sur la face planification
  (gère aussi les textarea/input du plan).
- Drag & drop : déplacement interne autorisé (`moved` de `handleDrop`), dépôt externe
  bloqué. Bandeau ambre 3,5 s en cas de blocage.
- Toujours actif (décision utilisateur : pas d'option par devoir).

## Limites assumées

- Rechargement de page → mémoire interne vide : un texte copié avant doit être recopié.
- N'empêche pas la retranscription manuelle depuis un autre écran.

## TODOs

- [ ] Tester : collage interne, collage externe (bloqué), plan → rédaction, drag & drop.
