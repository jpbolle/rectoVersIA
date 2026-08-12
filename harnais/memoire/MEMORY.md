# Mémoire — Recto-versIA

> Index chargé à chaque session. **Une ligne par entrée, jamais de contenu.**
> Migrée le 2026-08-06 depuis la mémoire auto de Claude Code (`~/.claude/projects/...`),
> qui ne se synchronisait pas entre les deux Macs.

- [rollup_vocabulaire](rollup_vocabulaire.md) — module vocabulaire : mots personnels/révision/demi-points ; fixes 2026-08-09 (popup portal, indice 2 lettres), TODO format JSON IA
- [rollup_dictionnaire](rollup_dictionnaire.md) — aide dictionnaire (app + NavigKid), vocabulaire personnel : déployé le 2026-08-10, TODOs interface/RGPD
- [rollup_editeur](rollup_editeur.md) — anti-triche collage dans l'espace de rédaction : testé et déployé (2026-08-10)
- [rollup_aide_ia](rollup_aide_ia.md) — panneau Aide IA réécriture refondu : onglets, un par un, synchro bulles, ponctuation bleue — testé et déployé (2026-08-10)
- [rollup_rgpd](rollup_rgpd.md) — chiffrement des identités élèves : **en production** (2026-08-10, 650 docs migrés) ; TODO : publier l'extension NavigKid avant la rentrée
- [rollup_devoirs](rollup_devoirs.md) — création d'activités recto/verso : corrigé IA prof, ressources en onglets, vidéos YouTube ; **critères masqués par devoir** (popup HideCriteriaModal, 2026-08-12) — TODO : test + déploiement
- [rollup_profil](rollup_profil.md) — profil élève en onglets (+ Parler) ; vocab refondu en stats par activité + chrono temps d'étude ; critères groupés par grille avec courbes (2026-08-12) — TODO : test + déploiement
- [rollup_lecture](rollup_lecture.md) — questionnaire de lecture : v1 testée, puis enrichie le 2026-08-11 soir (audio + limite d'écoutes, « Souligner du texte » + soulignage attendu, corrigé visible élève, builder accordéon, gestes dynamiques) — TODO : test + déploiement + profil Lire
- [rollup_admin](rollup_admin.md) — /admin refondu en onglets (header dédié) : didactique (UAA + gestes dynamiques, `configuration/didactique`), coûts (compteurs d'usage — ⚠️ pas de vrai suivi tokens) — livré 2026-08-11 soir, TODO : test + déploiement
- [rollup_classes](rollup_classes.md) — bloc Mes Élèves + fiche élève en popup ; renommage propagé aux devoirs + archive ZIP avant suppression (2026-08-12) — TODO : test + déploiement
- [rollup_remise](rollup_remise.md) — travaux non rendus (justifié / non justifié — 0), corrigé masqué, remise clôturée, archive de classe — testé élève 007 le 2026-08-12, TODO : déploiement
- [rollup_notifications](rollup_notifications.md) — cloche header 3 rôles, calcul à la lecture, horodatages posés au basculement — livré 2026-08-12, TODO : test + contenu section admin
- [rollup_recherche](rollup_recherche.md) — activités NavigKid : voile + popup de lancement, remise par l'extension, corrigé QCM, **fuite des bonnes réponses corrigée** (2026-08-12) — TODO : boucle d'envoi à tester, `key` du manifeste, republier l'extension
