# Rollup — RGPD : chiffrement des identités élèves

## Décision (2026-08-10)

Pseudonymisation plutôt que chiffrement intégral : on chiffre les **champs d'identité**
(nom, prénom, email) partout, pas les contenus (productions, audio, mots de vocabulaire).
Casser le lien identité↔contenu suffit pour cette app. Les annotations audio du prof
restent en clair (limite assumée, l'élève peut y être cité de vive voix).

## Livré (2026-08-10) — codé, tsc OK, **non déployé, migration non exécutée**

- `src/lib/crypto.ts` : AES-256-GCM (modèle KitSchool) + `hashEmail` (HMAC-SHA256) pour
  les requêtes d'identification. Serveur uniquement.
- `src/lib/eleve-lookup.ts` : `queryElevesByEmail` — requête sur `emailHash`, repli sur
  l'email en clair (documents non migrés). Utilisée par link, join, classes/student,
  profil, devoirs, navigkid/activites-eleve.
- Champs chiffrés : `eleves.nom/prenom/email` (+`emailHash`),
  `travaux.studentName/studentEmail` (+`studentEmailHash` ; requête `travaux/mine`
  basculée sur l'empreinte avec repli), `users.email/displayName` (déchiffrés dans
  grilles + vocabulaire/themes pour les noms de profs), `vocabulairePersonnel.studentEmail`
  (2 points d'écriture : dictionary + vocabulaire/personnel).
- `scripts/encrypt-existing-identities.ts` : dry-run par défaut, `--apply` pour migrer ;
  sauvegarde JSON préalable dans `backups/` (gitignoré).
- `ENCRYPTION_KEY` générée et ajoutée au `.env.local` du MacBook — **à recopier sur le
  VPS et sur le Mac Studio** (même clé partout, obligatoire).

## Ordre de mise en service (IMPORTANT)

1. Clé sur le VPS (`.env.local`) **avant** de déployer le code ;
2. commit + push + `/deploy` ;
3. **ensuite seulement** la migration (`--apply`) depuis un Mac — le code déployé lit
   les deux formats, l'ancien code ne lit pas le chiffré ;
4. clé sur le Mac Studio ;
5. tests : login élève, listes d'élèves prof, correction, vocabulaire personnel ;
6. vérifier en console Firebase que les champs sont au format `iv:tag:données`.

## Hors périmètre (à trancher plus tard)

- **NavigKid `reponses`/`recherches`** (`eleveNom`, `eleveEmail`) : l'extension écrit
  **directement** dans Firestore (SDK client, `sidebar/app.js`) — chiffrer exigerait de
  faire passer l'extension par une API route (+ redéploiement Chrome Web Store).
- **Anomalie détectée** : `firestore.rules` (versionné) ne contient **aucune règle** pour
  `questionnaires/*/reponses` ni `recherches` — or l'extension y écrit. Soit les règles
  déployées divergent du fichier (drift), soit ces écritures échouent en silence.
  À vérifier en console Firebase.
