---
name: deploy
description: Deploy Recto-versIA to Hostinger VPS. Build, push, and provide deployment commands.
---

# Deploy to Hostinger VPS

Deploy Recto-versIA to the Hostinger VPS at `srv948876.hstgr.cloud`.

## Steps

1. **Build locally** — Run `npm run build` and verify it succeeds with no errors
2. **Check git status** — Show uncommitted changes and ask the user to commit if needed
3. **Push to GitHub** — `git push origin main`
4. **Provide VPS commands** — Tell the user to open the **terminal web Hostinger** (hPanel → VPS → Terminal) and run:
   ```
   cd /var/www/rectoVersIA && git pull && npm install && npm run build && pm2 restart rectoVersia
   ```
   Note: l'accès SSH direct (`ssh root@...`) n'est pas configuré. Utiliser exclusivement le terminal web du panneau Hostinger.
5. **Remind checklist**:
   - If new env vars were added: update `.env.local` on the VPS (`nano /var/www/rectoVersIA/.env.local`)
   - If domain changed: update Firebase Auth authorized domains
   - Verify at: https://rectoversia.edukids.pedagokit.be
   - Check logs: `pm2 logs rectoVersia --lines 20`

## Important rules

- **NEVER** attempt SSH or run remote commands directly — always provide commands for the user to copy-paste
- **NEVER** push without user confirmation
- The app runs on **port 3003** (ports 3000-3002 are used by other apps)
- PM2 process name: `rectoVersia`
- App path on VPS: `/var/www/rectoVersIA`
- Full deployment guide: see `DEPLOYMENT.md` at project root
