# Recto-versIA — Roadmap

> Où va cette application. **Ce qui est déjà construit ne se lit pas ici** mais dans
> [`init.md`](./init.md) ; ce qui bouge cette semaine est dans la mémoire.
> La page `/roadmap` dans l'app (pilotée par Firestore) est la version montrée aux
> utilisateurs — ce fichier-ci est la version de travail.
>
> **Convention** : `[ ]` à faire · `[x]` fait (avec la date). Un item terminé est coché
> puis déplacé dans « Fait » à la session suivante, pour garder les listes lisibles.
> Aperçu visuel : ⌘⇧V dans VS Code (les cases se cochent d'un clic en mode aperçu).

## Maintenant

- [ ] **Contraction de texte** — la qualité de la correction IA et du résumé/plan produit
  laisse à désirer ; c'est la priorité 1 fixée en fin de session de mai 2026.

## Ensuite

**Vocabulaire personnel (suites de la session du 2026-08-08)** :

- [x] **Exercices de vocabulaire** — quand un élève travaille une série lexicale
  collective, y intégrer 3 à 5 mots tirés de sa liste personnelle
  (`vocabulairePersonnel/{uid}`, alimentée par l'aide dictionnaire app + NavigKid).
  *(fait le 2026-08-08)*
- [x] **Interface de consultation — côté élève** : liste personnelle + maîtrise lexicale
  dans l'onglet Vocabulaire du profil. *(fait le 2026-08-10)*
- [ ] **Interface de consultation — côté prof** : vue avec tous les résultats par élève
  (la route GET `?studentId=` existe déjà) — session ultérieure.
- [x] **RGPD** — décision prise le 2026-08-10 : `vocabulairePersonnel` est couvert par le
  chantier « Chiffrement des champs d'identité » (item 10 ci-dessous) — on chiffre
  l'email, pas les mots.

**Le reste, par priorité** :

1. [ ] **Choix du type de plan à la création d'une activité d'écriture** — le prof choisit
   explicitement le brouillon proposé (CRC, plan, libre) au lieu de la déduction
   automatique depuis la grille.
2. [ ] **Recherche (NavigKid)** — les élèves ont une aide IA et une interface revues.
3. [ ] **Aide IA aux plans** — l'assistance IA couvre aussi la construction du plan, pas
   seulement la rédaction.
4. [ ] **Statistiques générales** — le prof voit des métriques transverses (progression,
   usage IA, mots difficiles récurrents).
5. [ ] **Avis critique entre pairs (CRC)** — un élève lit et commente le CRC d'un autre,
   attribution aléatoire et anonyme.
6. [ ] **Grille de métacognition** — l'élève voit l'écart entre son auto-évaluation et la
   correction du prof, et l'évolution de son texte.
7. [ ] **Finalisation de correction** — versioning et verrouillage après envoi.
8. [ ] **Commentaires prof améliorés** — assistance IA + dictée vocale.
9. [ ] **Immersive Reader** (Microsoft Azure) — synthèse vocale et découpage syllabique pour
   les élèves.
10. [ ] **Écart visuel prof/élève** — comparaison détaillée dans la grille.

## Fait

- [x] **Profil d'écrilecteur en 5 onglets** — Général / Lire / Écrire / Rechercher /
  Vocabulaire, un appel API par onglet (fin de la page lente) ; nouveaux onglets
  Rechercher (recherches NavigKid remises) et Vocabulaire (maîtrise lexicale en
  3 colonnes par série + liste personnelle). *(2026-08-10 — à tester avec un compte
  élève, non déployé)*
- [x] **Page « Données personnelles » (`/rgpd`)** — accessible à tous via le menu avatar :
  données collectées, protection (chiffrement), services IA, droits RGPD. *(2026-08-10)*
- [x] **Roadmap : drag « À venir » → « Nouveautés »** — déposer sur une carte de date ou
  sur la colonne (release du jour créée au besoin). *(2026-08-10)*
- [x] **Sous-titre unifié « Aide à l'écrilecture »** (header élève, login, metadata).
  *(2026-08-10)*
- [x] **Chiffrement des champs d'identité** (RGPD) — pseudonymisation : nom, prénom et
  email chiffrés (AES-256-GCM) dans `eleves`, `travaux`, `users`, `vocabulairePersonnel`,
  `reponses` et `recherches` NavigKid ; requêtes par empreinte HMAC ; 650 documents
  migrés ; l'extension NavigKid ne touche plus Firestore ; règles Firestore réalignées
  (drift console résolu). Les contenus (productions, audio) restent en clair — décision
  assumée. *(2026-08-10)*
- [x] **Aide IA à la réécriture refondue** — panneau à 4 onglets par catégorie, conseils
  révélés un par un (navigation libre), synchro des bulles de l'éditeur avec le conseil
  affiché, ponctuation passée au bleu. *(2026-08-09)*
- [x] **Champ Évaluation sur les devoirs** — formative (entraînement) ou certificative
  (notée), tag sur les cards prof et élève ; sélection des classes en menu déroulant à
  cases. *(2026-08-09)*
- [x] **Exercices de vocabulaire enrichis** — mots de révision complétés par des mots
  connus, mots personnels injectés, indice syllabique sur le texte à trous (demi-point),
  stats pondérées. *(2026-08-08)*
- [x] **Anti-triche rédaction** — collage externe bloqué dans l'espace de rédaction,
  copier-coller interne (rédaction + planification) autorisé. *(2026-08-08)*

## Écarté

| Idée | Pourquoi non | Quand ça pourrait changer |
|---|---|---|

*Rien d'écarté à ce jour (demandé le 2026-08-06). Quand une idée sera rejetée, l'inscrire
ici avec son motif — sans ça elle reviendra tous les trois mois.*
