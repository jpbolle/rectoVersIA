# Rollup — Iconographie (emoji)

> **Décision du 2026-08-17 : on ne change RIEN pour l'instant.**
> Chantier reporté, mesure faite pour ne pas la refaire.

## Ce que l'audit Impeccable reproche aux emoji

Rien de bloquant — une question de finition :

- rendu différent selon le système (Chromebook ≠ Mac ≠ Windows), or **chaque
  élève du Collège a un Chromebook** ;
- alignement vertical instable dans un bouton ;
- poids visuel qui écrase le texte à côté ;
- impossibles à recolorer avec les tokens Classica.

## La mesure (2026-08-17)

| | |
|---|---|
| Fichiers `.tsx` concernés | **88** |
| Occurrences (hors commentaires) | **584** |
| Symboles distincts | **94** |

Les plus chargés : `ProfilPanel` (41), `ScenarisationPanel` (29),
`OeuvreBuilder` (26), `LectureQuizBuilder` (21), `CreationForm` (19).

Les plus fréquents : `✕`(62) `→`(41) `✓`(34) `✏`(22) `🗑`(19) `📝`(18) `📄`(18)
`⚠`(16) `←`(16) `📋`(15) `📖`(12) `↓`(12) `🤖`(11) `🔍`(10) `📚`(10) `🔗`(10).

## Ce qui est tranché POUR LE JOUR OÙ on s'y met

**Périmètre du premier passage : les icônes d'ACTION seulement**
(`✕ ✓ ✏ 🗑 ← → ↑ ↓ ⚠ ⧉`) — environ **250 occurrences**, celles qui vivent dans
des boutons, là où l'alignement et la recoloration comptent vraiment.

**À NE PAS toucher au premier passage** : les emoji **de sens**, qui désignent
un domaine plutôt qu'une action et que JP a choisis un par un —
`📖 Lire`, `🧠 Vocabulaire`, `🪞 Me connaître`, `⭐ Certification`, `🧭 Parcours`,
`🥋 Ceintures`, les ateliers, les familles de gestes. Chacun demanderait son
arbitrage.

**Le moyen reste à choisir** (question posée, non tranchée) :

| Piste | Pour | Contre |
|---|---|---|
| Jeu SVG maison (`<Icone nom="…" />`) | aucune dépendance, trait piloté par `--c-*`, déploiement VPS inchangé | ~30 icônes à dessiner |
| `lucide-react` | ~1500 icônes, tree-shakées, standard actuel | une dépendance de plus (⚠ `npm install`, jamais un autre gestionnaire) |
