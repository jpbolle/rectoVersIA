---
name: deploy
description: Deploy Recto-versIA — les 3 surfaces independantes (app VPS, regles Firestore, extension Chrome)
user_invocable: true
trigger: "deploy", "déployer", "mettre en prod", "push prod"
---

# Déployer Recto-versIA — 3 surfaces INDÉPENDANTES

⚠️ Le piège central : il n'y a pas **un** déploiement, mais trois, découplés. En oublier
un = production incohérente, et le symptôme apparaît chez l'utilisateur, pas chez le
développeur. Cas typique : du code livré qui utilise une nouvelle collection côté client,
mais les règles Firestore pas redéployées → `Missing or insufficient permissions` en prod
alors que tout fonctionne en local.

## Surface 1 — l'application (VPS Hostinger, MANUEL)

1. `npx tsc --noEmit` doit passer (le hook pre-push le bloque sinon), puis
   `npm run build` en local pour vérifier le build complet.
2. `git status` — montrer les changements, proposer un commit (anglais, conventionnel).
3. `git fetch` — vérifier que l'autre Mac n'a pas avancé (consigne durable).
4. `git push origin main` — **jamais sans accord explicite de l'utilisateur.**
   La CI revérifie en parallèle sur machine neutre.
5. Fournir la commande VPS à l'utilisateur — **ne JAMAIS tenter de SSH** ; il l'exécute
   dans le **terminal web Hostinger** (hPanel → VPS → Terminal) :
   ```
   cd /var/www/rectoVersIA && git pull && npm install && npm run build && pm2 restart rectoVersia
   ```
6. Vérifier ensuite : https://rectoversia.edukids.pedagokit.be — en particulier les pages
   touchées. Logs : `pm2 logs rectoVersia --lines 20`.

## Surface 2 — règles et index Firestore (MANUEL)

Si `firestore.rules` a changé, ou si une nouvelle collection est lue/écrite **côté
client** :

```
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes   # si firestore.indexes.json a changé
```

Puis vérifier dans l'app **et** commiter le fichier : il doit toujours refléter ce qui
est réellement déployé.

## Surface 3 — extension Chrome NavigKid (MANUEL)

Si `rechercheNavigChrome/eleve-extension` a changé : bump de version dans le
`manifest.json` → reconstruire le zip (`navigkid-extension.zip`) → publier sur le
**Chrome Web Store en diffusion interne** (réservée au domaine `cnddinant.be`) → noter la
version publiée dans le rollup mémoire. La validation du Store peut prendre quelques
heures : les élèves ne reçoivent pas la mise à jour immédiatement.

## Checklist post-déploiement

Ces réglages **ne voyagent pas avec le code** :

- Nouvelle variable d'environnement ? → `nano /var/www/rectoVersIA/.env.local` sur le VPS,
  puis `pm2 restart rectoVersia` — sinon crash au runtime après un build pourtant réussi.
- Domaine changé ? → mettre à jour les authorized domains dans Firebase Auth.
- Nouveau contenu piloté par Firestore (roadmap, grilles partagées) ? → à créer dans
  l'interface d'administration, pas dans le code.

## Rappels

- Port **3003** (3000-3002 occupés par d'autres apps) — process PM2 `rectoVersia`.
- Guide détaillé : `DEPLOYMENT.md` à la racine.
