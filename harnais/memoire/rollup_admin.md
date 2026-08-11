# Rollup — Administration du site (/admin)

## État actuel (session du 2026-08-11 soir)

**Livré, non testé, non déployé** — page /admin refondue en onglets pilotés par le
header (nouveau variant `admin` de `Header` : sous-titre « Administration », nav
Accueil | Vue d'ensemble | Gestion des membres | Gestion didactique | Gestion des coûts).

- **Vue d'ensemble** (onglet d'arrivée) : stats globales existantes.
- **Gestion des membres** : bloc Professeurs (inchangé, juste déplacé sous l'onglet).
- **Gestion didactique** (`DidactiquePanel`) : listes **UAA de français** et **gestes
  de lecture / d'écriture / de recherche** — œil (masquer/afficher dans les
  formulaires), poubelle (supprimer, confirmation qui recommande de masquer), champ +
  « + » (ajouter ; UAA = numéro suivant, geste = slug généré). Document Firestore
  `configuration/didactique`, route `/api/didactique` (GET tout connecté, PUT admin),
  **pas de règle Firestore** (routes serveur). Défauts semés depuis `UAA_LIST` et les
  7 gestes historiques (`types/didactique.ts`).
- **Branchements dynamiques** (`useDidactique`, cache module partagé) : menu « Gestes »
  du builder de questionnaire, libellés dans la correction, chips UAA de
  `GrilleBuilder`, libellés d'`GrilleViewer`. Un élément masqué/supprimé mais déjà
  utilisé reste affichable (repli sur libellés historiques puis id brut).
- **Gestion des coûts** : compteurs d'usage IA ajoutés à `/api/admin/stats`
  (évaluations IA de grilles, devoirs avec IA, cache dictionnaire) + note explicite.
  ⚠️ **Aucun vrai suivi des coûts (tokens/euros) n'existe** — signalé à l'utilisateur,
  qui pensait que ça existait (confusion probable avec un autre projet). À implémenter
  si demandé : enregistrer la consommation à chaque appel IA (grid-eval, writing-help,
  dictionnaire, vocabulaire, NavigKid, Whisper) dans une collection dédiée.

## TODOs

- [ ] Tester /admin : onglets, ajout/masquage/suppression d'UAA et de gestes, effet
  dans les formulaires (grilles, questionnaire de lecture).
- [ ] Décision : implémenter le suivi réel des coûts IA (tokens par appel) ?
