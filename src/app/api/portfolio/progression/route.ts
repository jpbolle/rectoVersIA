import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesDevoir, copieVisible } from '@/lib/classe-acces';
import { decrypt } from '@/lib/crypto';
import { lirePortfolioContenu } from '@/lib/portfolio-server';
import { groupesDe } from '@/lib/portfolio-groupe-server';
import { lireSuivi } from '@/lib/portfolio-suivi-server';
import { enRetard, etatEtape, faite, lireContenuEleve, type EtapePortfolioVue, type EtatEtape } from '@/lib/portfolio-etat';
import { estEtapeSansTrace, SUIVI_VIDE, type SuiviPortfolio } from '@/types/portfolio';
import { SANS_CLASSE } from '@/types/session';
import type { EtatActiviteParcours } from '@/types/sequence-fle';

// Le TABLEAU D'ÉVOLUTION d'un portfolio (phase 4 du plan 2026-10-10) : une
// ligne par élève, une colonne par étape — à faire, en cours, soumise (à
// valider), validée, à reprendre, resoumise — et le retard. C'est de là que
// le prof relance ou félicite (cloche, comme le suivi de lecture).
//
// GET ?devoirId=[&sessionId=]  (prof : auteur, admin, titulaire / coprof —
// celui-ci ne voit que les copies de SES sessions)

export type CaseProgression = EtatEtape | 'cochee' | 'non-cochee';

export interface LigneProgression {
  travailId: string;
  studentId: string;
  studentName: string;
  groupe: string | null; // id du groupe accepté
  cases: Record<string, CaseProgression>;
  // Étape-activité → la copie de l'élève POUR CETTE ACTIVITÉ, quand elle existe :
  // la case y mène directement, prête à corriger (JP, 2026-10-11 — ces activités
  // ne sont plus listées dans Mes Activités)
  copies: Record<string, { devoirId: string; travailId: string }>;
  retards: string[]; // étapes en retard
  faites: number;
}

function etatDe(status: unknown): EtatActiviteParcours {
  if (status === 'submitted') return 'fait';
  if (status === 'draft') return 'en-cours';
  return 'a-faire';
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const params = request.nextUrl.searchParams;
    const devoirId = params.get('devoirId') || '';
    const sessionDemandee = params.get('sessionId');
    const devoirSnap = await adminDb.collection('devoirs').doc(devoirId).get();
    if (!devoirSnap.exists || devoirSnap.data()?.typeTravail !== 'portfolio') {
      return NextResponse.json({ success: false, message: 'Portfolio introuvable' }, { status: 404 });
    }
    let accesProf: Awaited<ReturnType<typeof accesDevoir>> = null;
    if (!auth.isAdmin) {
      accesProf = await accesDevoir(devoirId, auth);
      if (!accesProf) return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }

    const etapes = lirePortfolioContenu(devoirSnap.data()!.portfolio).etapes;

    // Les copies, filtrées en mémoire par session (pas d'index composite)
    const travauxSnap = await adminDb.collection('travaux').where('devoirId', '==', devoirId).get();
    const travaux = (!sessionDemandee
      ? travauxSnap.docs
      : sessionDemandee === SANS_CLASSE
        ? travauxSnap.docs.filter((d) => !d.data().sessionId)
        : travauxSnap.docs.filter((d) => d.data().sessionId === sessionDemandee)
    ).filter((d) => !accesProf || copieVisible(accesProf, d.data().sessionId));

    const uids = [...new Set(travaux.map((d) => String(d.data().studentId || '')).filter(Boolean))];

    // Fiche `eleves` de chaque uid (le groupe désigne ses membres par fiche)
    const eleveIdsParUid = new Map<string, string[]>();
    for (let i = 0; i < uids.length; i += 30) {
      const lot = uids.slice(i, i + 30);
      const snap = await adminDb.collection('eleves').where('firebaseUid', 'in', lot).get();
      for (const d of snap.docs) {
        const u = String(d.data().firebaseUid || '');
        eleveIdsParUid.set(u, [...(eleveIdsParUid.get(u) ?? []), d.id]);
      }
    }
    const groupes = (await groupesDe(devoirId)).filter((g) => g.statut === 'accepte');
    const groupeDeUid = (uid: string) => {
      const mes = eleveIdsParUid.get(uid) ?? [];
      return groupes.find((g) => g.membres.some((m) => mes.includes(m.eleveId) && m.statut !== 'decline')) ?? null;
    };

    // Les suivis (un par groupe, ou par élève), en une lecture
    const cleDe = (uid: string) => {
      const g = groupeDeUid(uid);
      return g ? `${devoirId}__G-${g.id}` : `${devoirId}__U-${uid}`;
    };
    const cles = [...new Set(uids.map(cleDe))];
    const suivis = new Map<string, SuiviPortfolio>();
    for (let i = 0; i < cles.length; i += 100) {
      const docs = await adminDb.getAll(...cles.slice(i, i + 100).map((c) => adminDb.collection('portfolioSuivi').doc(c)));
      docs.forEach((d) => suivis.set(d.id, d.exists ? lireSuivi(d.data()) : SUIVI_VIDE));
    }

    // L'état des activités renvoyées, pour chaque élève
    const renvois = [...new Set(etapes.filter((e) => e.nature === 'activite' && e.devoirId).map((e) => e.devoirId!))];
    const etatsRenvoi = new Map<string, EtatActiviteParcours>();
    const copiesExistantes = new Set<string>();
    const refs = uids.flatMap((u) => renvois.map((d) => adminDb.collection('travaux').doc(`TRV-${d}-${u}`)));
    for (let i = 0; i < refs.length; i += 100) {
      const docs = await adminDb.getAll(...refs.slice(i, i + 100));
      docs.forEach((d) => {
        etatsRenvoi.set(d.id, d.exists ? etatDe(d.data()?.status) : 'a-faire');
        if (d.exists) copiesExistantes.add(d.id);
      });
    }

    const lignes: LigneProgression[] = travaux.map((doc) => {
      const t = doc.data();
      const uid = String(t.studentId || '');
      const groupe = groupeDeUid(uid);
      const contenu = {
        ...lireContenuEleve(typeof t.content === 'string' ? t.content : ''),
        groupeStatut: groupe ? ('accepte' as const) : null,
        suivi: suivis.get(cleDe(uid)) ?? SUIVI_VIDE,
      };
      const cases: Record<string, CaseProgression> = {};
      const retards: string[] = [];
      const copies: LigneProgression['copies'] = {};
      let faites = 0;
      for (const e of etapes) {
        if (e.nature === 'activite' && e.devoirId && copiesExistantes.has(`TRV-${e.devoirId}-${uid}`)) {
          copies[e.id] = { devoirId: e.devoirId, travailId: `TRV-${e.devoirId}-${uid}` };
        }
        const vue: EtapePortfolioVue =
          e.nature === 'activite' && e.devoirId ? { ...e, etatRenvoi: etatsRenvoi.get(`TRV-${e.devoirId}-${uid}`) ?? 'a-faire' } : e;
        cases[e.id] = estEtapeSansTrace(e) ? (contenu.cochees.includes(e.id) ? 'cochee' : 'non-cochee') : etatEtape(vue, contenu);
        if (!e.introduction && faite(vue, contenu)) faites += 1;
        if (enRetard(vue, contenu)) retards.push(e.id);
      }
      return {
        travailId: doc.id,
        studentId: uid,
        // studentName est chiffré en base (RGPD) — jamais renvoyé tel quel
        studentName: decrypt(t.studentName) || 'Élève',
        // Un élève qui travaille SEUL n'est pas « membre d'un groupe » au tableau
        groupe: groupe && groupe.membres.length > 1 ? groupe.id : null,
        cases,
        copies,
        retards,
        faites,
      };
    });
    // Les membres d'un même groupe côte à côte, puis par nom
    lignes.sort((a, b) => (a.groupe ?? '~').localeCompare(b.groupe ?? '~') || a.studentName.localeCompare(b.studentName, 'fr'));

    return NextResponse.json({
      success: true,
      data: {
        etapes: etapes.map((e) => ({
          id: e.id,
          titre: e.titre,
          section: e.section ?? '',
          sansTrace: estEtapeSansTrace(e),
          introduction: e.introduction === true,
          bloquante: e.validation?.bloquante === true,
          echeance: e.echeance ?? null,
        })),
        lignes,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/portfolio/progression:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
