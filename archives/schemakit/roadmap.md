# SchémaKit — Roadmap

> Où va cette application. **Ce qui est déjà construit ne se lit pas ici** mais dans
> [`init.md`](./init.md) ; ce qui bouge cette semaine est dans la mémoire.

## Maintenant

- **Finir la frise** — glisser un événement le long de l'axe (changer sa date, aimantée à
  la graduation) et d'un étage à l'autre. Le formulaire existe déjà ; c'est le geste qui
  rend la frise vivante.

## Ensuite

1. La refonte dans **Recto-versIA** : activité `schematiser`, le `Diagram` dans `travaux`,
   vue prof en lecture seule, passerelle « schéma → document » via le Markdown.
2. Un schéma **modèle** fourni par le prof (l'élève complète) — le format est stable.
3. Étirement de l'axe de la frise (échelle horizontale seule), si le zoom uniforme gêne.

## Écarté

| Idée | Pourquoi non | Quand ça pourrait changer |
|---|---|---|
| Firebase pour « Mes schémas » dans la maquette | Stockage local suffisant pour valider l'expérience ; Recto-versIA a la vraie base (décision du 2026-09-13) | Jamais dans la maquette |
| jsPDF pour l'export PDF | L'impression du navigateur suffit (Chromebook enregistre en PDF nativement) | Si une mise en page PDF contrôlée devient nécessaire |
| Axe vertical ou échelle logarithmique pour la frise | Pas demandé ; frises scolaires horizontales et linéaires | Préhistoire / géologie |
| Formes libres (rectangles, flèches libres, texte flottant) | Ce serait un tableau blanc ; un « encadré » reste une boîte de schéma stylée | — |
| Connexion, classes, devoirs, interface prof **dans SchémaKit** | C'est une maquette ; Recto-versIA a déjà tout cela (décision du 2026-09-13) | Si la maquette devait vivre seule (formation hors Collège) — alors code de classe, cf. README §6.2 |
| Google OAuth avec le compte de l'école pour les élèves | L'app doit servir aussi en formation hors Collège ; le code de classe fonctionne partout | Si l'usurpation d'identité entre élèves devient un vrai problème en classe |
| tldraw / Excalidraw comme éditeur | Tableau blanc trop libre : impossible d'imposer les règles d'un type de schéma | — |
| Tailwind | Cohérence avec les autres projets (CSS Modules) et piège des classes dynamiques | — |
| Chiffrement applicatif des noms d'élèves | Prénom + nom seulement, sans email ; prototype interne | Avant toute mise en service au-delà des classes de l'utilisateur |
| Images dans les schémas | Demande Firebase Storage et des règles en plus | Quand les trois éditeurs sont livrés |
| Schéma modèle fourni par le prof | Le format de données doit d'abord se stabiliser | Après les trois éditeurs |
| Travail à plusieurs en temps réel | Complexité élevée, pas demandé | — |
