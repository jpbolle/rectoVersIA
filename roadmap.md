# Recto-versIA — Roadmap

> Où va cette application. **Ce qui est déjà construit ne se lit pas ici** mais dans
> [`init.md`](./init.md) ; ce qui bouge cette semaine est dans la mémoire.
> Les **gros chantiers**, leur état réel et leur ordre :
> [`harnais/macro-plan.md`](./harnais/macro-plan.md).
> La page `/roadmap` dans l'app (pilotée par Firestore) est la version montrée aux
> utilisateurs — ce fichier-ci est la version de travail.
>
> **Convention** : `[ ]` à faire · `[x]` fait (avec la date). Un item terminé est coché
> puis déplacé dans « Fait » à la session suivante, pour garder les listes lisibles.
> Aperçu visuel : ⌘⇧V dans VS Code (les cases se cochent d'un clic en mode aperçu).

## Maintenant

- [ ] **Question « image à annoter » — les trois jeux sont ÉCRITS, rien n'est vu**
  (étapes 2 et 3 écrites le 2026-09-20 ; plan
  `harnais/plans/2026-09-19-image-annotee-trois-jeux.md`). Le sélecteur de **jeu**
  existe désormais dans le constructeur : **étiquettes à placer** (déjà là),
  **bulles à compléter** (l'élève écrit dans la zone, correction automatique
  tolérante) et **marqueurs à placer** (il pose ses propres marques ; les zones
  attendues ne lui sont jamais envoyées avant le corrigé). ⚠ **Reste à voir à
  l'écran et à jouer en classe** — c'est ce qui coche la case.
- [ ] **Contraction de texte** — la qualité de la correction IA et du résumé/plan produit
  laisse à désirer ; c'est la priorité 1 fixée en fin de session de mai 2026.

## Ensuite

**L'application change de nom : « Traces » (décidé le 2026-09-20)** :

- [ ] **Renommer Recto-versIA en Traces** — chantier à mener d'un bloc, jamais écran par
  écran : le nom est dans l'interface, les emails, la page `/roadmap`, les documents du
  harnais, l'URL de production (`rectoversia.edukids.pedagokit.be`), le chemin du VPS
  (`/var/www/rectoVersIA`), le process PM2, le dépôt Git et l'extension NavigKid.
  ⚠ **Distinguer ce qui se renomme de ce qui ne peut pas** : l'URL et le dépôt engagent
  des liens déjà distribués à des élèves et une extension publiée au Web Store — à trancher
  séparément du nom affiché. Commencer par les **strings d'interface**, qui ne cassent rien.
- [ ] **Remplacer les effets « flip » par de simples transitions** — l'animation de
  retournement (recto/verso) traverse ~24 fichiers : `FlipChoice`, `FlipEditor` et ses
  styles, `devoir.flipInverted`, `facesInversees` d'une scène d'œuvre, l'espace de
  rédaction de l'élève et la correction du prof. Viser un **fondu ou un glissement**, plus
  sobres et moins coûteux à l'affichage sur les Chromebooks.
  ⚠ **Le modèle de données reste** : `flipInverted` et `facesInversees` disent *quelle face
  s'ouvre en premier*, pas *comment on passe de l'une à l'autre*. Ne pas les supprimer en
  même temps que l'animation. Lié au changement de nom : « recto / verso » était la
  métaphore de l'ancien nom — décider si le **vocabulaire d'interface** change aussi.

**Un cahier de notes pour le prof (demandé le 2026-09-20)** :

- [ ] **Séparer « ce que je fais faire » de « ce que mes élèves ont obtenu »** — aujourd'hui
  les deux se mélangent : Mes Ressources et Design & scénarisation servent à *préparer*,
  mais c'est aussi par là qu'on va chercher les notes (popup « 📊 Notes des élèves » d'une
  certification, bloc Certifications d'une classe, statistiques d'une activité). Le prof
  qui veut simplement voir où en est sa 4C doit traverser une bibliothèque de ressources.
  **Piste** : un espace « Cahier de notes » à part — l'élève en ligne, l'activité en
  colonne — qui lise ce qui existe déjà (corrections, `certificationsEleves`, ceintures par
  UAA) sans créer de nouvelle vérité. ⚠ À cadrer par un plan : décider ce qui *déménage*
  et ce qui reste en place, sinon deux chemins mèneront aux mêmes notes.

**Système d'icônes (relevé à l'audit design du 2026-08-15)** :

- [ ] **Remplacer les émoji par un vrai jeu d'icônes** — toute l'application
  emploie des émoji comme iconographie fonctionnelle (🗓 ⭐ 💡 🔗 🗣 📋 ⧉ 🗑 ⚙ 👁 🙈 🎧 🖼).
  Trois défauts : le rendu **change selon le système** (Windows, macOS, ChromeOS
  — or les élèves sont sur Chromebook), le poids optique est incohérent avec
  Inter, et la taille apparente varie d'un glyphe à l'autre (⧉ dessine deux fois
  plus petit que 🗑 à taille égale). Sur le même écran cohabitent déjà `＋`
  (U+FF0B) et `➕`.
  **Chantier à mener à l'échelle de l'application, jamais panneau par panneau** :
  le faire dans un seul écran casserait la cohérence avec tous les autres.
  Piste : un fichier de SVG inline maison (une seule graisse de trait), sans
  dépendance nouvelle — la contrainte « zéro dépendance sans accord » tient.


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
