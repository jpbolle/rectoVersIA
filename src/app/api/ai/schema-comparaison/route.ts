import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesTravail, peutAgir } from '@/lib/classe-acces';
import { appelerClaudeJson, MODELE_CLAUDE, suivreIa } from '@/lib/claude';
import { estDiagramPlausible } from '@/lib/schemas-personnels';
import { schemaPourFirestore } from '@/lib/schema-devoir';
import {
  decrireSchema,
  estArbre,
  lignesDepuisModele,
  totauxCorrige,
  vueEleve,
  statsCorrection,
  type ComparaisonSchema,
  type Decision,
  type ReponseModele,
} from '@/lib/schema-comparaison';
import type { Diagram } from '@/types/diagram';

// ── Aide IA du prof : le schéma de l'élève comparé au corrigé (étape 4 du
// plan 2026-10-11) ──
// aiSchemaComparaisons/AISCHEMA-{travailId} : les lignes (concepts, liens) et
// les décisions du prof (✓ accepte / ✗ refuse).
//
// UN SEUL document par copie, pour le prof ET l'élève (étape 5, JP : « économie
// de tokens ») : l'élève qui use de son aide (une seule fois) produit la
// comparaison complète ; il n'en reçoit que la vue allégée (`vueEleve`), le
// prof la retrouve entière sans nouvel appel. `demandeParEleve` garde la date.
//   GET   ?travailId=…            → prof : la comparaison ; élève : sa vue, ou null
//   POST  { travailId }           → prof : lance (ou relance) ; élève : sa seule demande
//   PATCH { travailId, ligneId, decision: 'accepte'|'refuse'|null }   (prof)

const COLL = 'aiSchemaComparaisons';
const docId = (travailId: string) => `AISCHEMA-${travailId}`;

const refus = (message: string, status: number) => ({ erreur: NextResponse.json({ success: false, message }, { status }) });

/** Le prof qui a accès à la copie (`agir` : en écriture), ou l'élève propriétaire. */
async function copieAutorisee(request: NextRequest, travailId: string, agir: boolean) {
  const auth = await verifyAuth(request);
  if (!auth) return refus('Non autorisé', 401);
  if (!travailId) return refus('Copie manquante', 400);
  const snap = await adminDb.collection('travaux').doc(travailId).get();
  if (!snap.exists) return refus('Copie introuvable', 404);
  const travail = snap.data()!;
  if (auth.role === 'prof') {
    const acces = await accesTravail(travail, auth);
    if (!acces || (agir && !peutAgir(acces.acces))) return refus('Accès refusé', 403);
    return { travail, auth, eleve: false as const };
  }
  if (travail.studentId !== auth.uid) return refus('Accès refusé', 403);
  return { travail, auth, eleve: true as const };
}

export async function GET(request: NextRequest) {
  const travailId = request.nextUrl.searchParams.get('travailId') || '';
  const ok = await copieAutorisee(request, travailId, false);
  if ('erreur' in ok) return ok.erreur;
  const doc = await adminDb.collection(COLL).doc(docId(travailId)).get();
  const data = doc.exists ? (doc.data() as ComparaisonSchema & { demandeParEleve?: string }) : null;
  if (!ok.eleve) return NextResponse.json({ success: true, data });

  // ?stats=1 — les statistiques de la correction du prof, pour l'onglet
  // Évaluation de l'élève : dès que la correction lui est visible (renvoyée
  // pour réécriture ou rendue comme corrigée) — JP, 2026-10-11
  if (request.nextUrl.searchParams.get('stats') === '1') {
    const corr = await adminDb.collection('corrections').doc(`CORR-${travailId}`).get();
    if (!corr.exists || corr.data()?.visibleParEleve !== true) return NextResponse.json({ success: true, data: null });
    const devoirSnap = await adminDb.collection('devoirs').doc(String(ok.travail.devoirId || '')).get();
    const corrige = schemaPourFirestore(devoirSnap.data()?.schema).corrige;
    if (!corrige) return NextResponse.json({ success: true, data: null });
    let type = corrige.diagram.type;
    try {
      const parsed = JSON.parse(String(ok.travail.content || ''));
      if (estDiagramPlausible(parsed)) type = parsed.type;
    } catch {
      /* copie vierge : le type du corrigé */
    }
    return NextResponse.json({
      success: true,
      data: statsCorrection(type, totauxCorrige(corrige.diagram), data, corr.data()?.schemaMarques),
    });
  }
  // Élève : sa vue allégée, et seulement s'il l'a lui-même demandée
  return NextResponse.json({
    success: true,
    data: data?.demandeParEleve ? vueEleve(data, data.demandeParEleve) : null,
  });
}

const SYSTEME = `Tu aides un professeur de français du secondaire (Belgique) à corriger le SCHÉMA d'un élève : carte conceptuelle, carte mentale, hiérarchie, ligne du temps ou schéma libre. Tu compares le schéma de l'élève au CORRIGÉ du professeur.

Règles :
- Un concept de l'élève est « present » s'il dit la même chose qu'un concept du corrigé, même formulé autrement (synonyme, reformulation, orthographe approximative). Sois juste, ni laxiste ni pointilleux.
- « absent » : concept du corrigé que l'élève n'a pas. « en_trop » : concept de l'élève qui n'a pas sa place (hors sujet, faux). Un concept pertinent mais absent du corrigé n'est PAS « en_trop » : ne le cite pas.
- Liens : « juste » si l'élève relie les mêmes concepts que le corrigé (le sens et le mot de liaison comptent quand le corrigé en donne un) ; « faux » si l'élève relie des concepts qui ne vont pas ensemble, ou avec un mot de liaison qui dit le contraire ; « absent » si un lien du corrigé manque.
- Carte mentale / hiérarchie : le « lien » est le RATTACHEMENT d'une idée à son parent (« juste » = bon parent).
- Ligne du temps : le « lien » est la PLACE de l'événement (date, ordre) : « juste » ou « faux » ; utilise l'identifiant de la BOÎTE de l'événement.
- Pour chaque ligne qui vise un élément du schéma de l'élève (present, en_trop, juste, faux), donne son identifiant EXACT, tel qu'il figure entre crochets. Pour « absent », id = null.
- Commentaire : une phrase courte, en français, adressée au professeur. Peut être vide.

Réponds UNIQUEMENT par un objet JSON :
{"concepts":[{"statut":"present|absent|en_trop","corrige":"…|null","eleve":"…|null","id":"…|null","commentaire":"…"}],
 "liens":[{"statut":"juste|faux|absent","corrige":"A → B|null","eleve":"A → B|null","id":"…|null","commentaire":"…"}],
 "synthese":"deux ou trois phrases pour le professeur"}`;

export async function POST(request: NextRequest) {
  let body: { travailId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Corps de requête invalide' }, { status: 400 });
  }
  const travailId = typeof body.travailId === 'string' ? body.travailId : '';
  const ok = await copieAutorisee(request, travailId, true);
  if ('erreur' in ok) return ok.erreur;

  try {
    const devoirSnap = await adminDb.collection('devoirs').doc(String(ok.travail.devoirId || '')).get();
    const corrige = schemaPourFirestore(devoirSnap.data()?.schema).corrige;
    if (devoirSnap.data()?.typeTravail !== 'schematiser' || !corrige) {
      return NextResponse.json({ success: false, message: 'Cette activité n’a pas de corrigé à comparer.' }, { status: 400 });
    }
    const ref = adminDb.collection(COLL).doc(docId(travailId));

    // ÉLÈVE : l'aide doit être ouverte par le prof, et ne sert qu'UNE fois
    if (ok.eleve) {
      if (devoirSnap.data()?.accesIA !== true) {
        return NextResponse.json({ success: false, message: 'L’aide IA n’est pas ouverte pour cette activité.' }, { status: 403 });
      }
      const existant = await ref.get();
      const deja = existant.exists ? (existant.data() as ComparaisonSchema & { demandeParEleve?: string }) : null;
      if (deja?.demandeParEleve) {
        return NextResponse.json({ success: true, data: vueEleve(deja, deja.demandeParEleve) });
      }
      // Le prof a déjà comparé : l'élève reçoit cette comparaison, sans nouvel appel
      if (deja) {
        const le = new Date().toISOString();
        await ref.update({ demandeParEleve: le });
        return NextResponse.json({ success: true, data: vueEleve(deja, le) });
      }
    }
    let eleve: Diagram | null = null;
    try {
      const parsed = JSON.parse(String(ok.travail.content || ''));
      if (estDiagramPlausible(parsed)) eleve = parsed;
    } catch {
      /* copie vierge */
    }
    if (!eleve || eleve.nodes.length === 0) {
      return NextResponse.json({ success: false, message: 'Le schéma de l’élève est vide.' }, { status: 400 });
    }

    const { data } = await appelerClaudeJson<ReponseModele>({
      system: SYSTEME,
      // Le corrigé est le même pour toute la classe : mis en cache
      contexteCache: `CORRIGÉ DU PROFESSEUR\n${decrireSchema(corrige.diagram, false)}`,
      user: `SCHÉMA DE L'ÉLÈVE (identifiants entre crochets)\n${decrireSchema(eleve, true)}\n\n${
        estArbre(eleve.type) ? 'Rappel : ici, un lien = un rattachement parent → idée.\n' : ''
      }Compare et réponds en JSON.`,
      maxTokens: 6000,
      suivi: suivreIa('schema.comparaison', request, ok.auth, String(ok.travail.devoirId || '') || null),
    });

    const totaux = totauxCorrige(corrige.diagram);
    const comparaison: ComparaisonSchema & { demandeParEleve?: string } = {
      travailId,
      devoirId: String(ok.travail.devoirId || ''),
      type: eleve.type,
      lignes: lignesDepuisModele(data, eleve),
      synthese: typeof data.synthese === 'string' ? data.synthese.trim().slice(0, 1200) : '',
      totalConceptsCorrige: totaux.concepts,
      totalLiensCorrige: totaux.liens,
      decisions: {},
      createdAt: new Date().toISOString(),
      modele: MODELE_CLAUDE,
      ...(ok.eleve ? { demandeParEleve: new Date().toISOString() } : {}),
    };
    // Prof qui relance : l'éventuelle demande de l'élève reste notée
    if (!ok.eleve) {
      const avant = await ref.get();
      const demande = avant.exists ? (avant.data()?.demandeParEleve as string | undefined) : undefined;
      if (demande) comparaison.demandeParEleve = demande;
    }
    await ref.set(comparaison);
    if (ok.eleve) return NextResponse.json({ success: true, data: vueEleve(comparaison, comparaison.demandeParEleve!) });
    return NextResponse.json({ success: true, data: comparaison });
  } catch (error) {
    console.error('Erreur POST /api/ai/schema-comparaison:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ success: false, message: `Comparaison impossible : ${message}` }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let body: { travailId?: unknown; ligneId?: unknown; decision?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Corps de requête invalide' }, { status: 400 });
  }
  const travailId = typeof body.travailId === 'string' ? body.travailId : '';
  const ok = await copieAutorisee(request, travailId, true);
  if ('erreur' in ok) return ok.erreur;
  if (ok.eleve) return NextResponse.json({ success: false, message: 'Réservé au professeur' }, { status: 403 });
  const ligneId = typeof body.ligneId === 'string' && /^l\d{1,4}$/.test(body.ligneId) ? body.ligneId : '';
  const decision: Decision | null = body.decision === 'accepte' || body.decision === 'refuse' ? body.decision : null;
  if (!ligneId) return NextResponse.json({ success: false, message: 'Ligne manquante' }, { status: 400 });

  const ref = adminDb.collection(COLL).doc(docId(travailId));
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ success: false, message: 'Aucune comparaison' }, { status: 404 });
  // Champ par champ : deux clics rapprochés sur deux lignes ne s'écrasent pas
  await ref.update({ [`decisions.${ligneId}`]: decision ?? FieldValue.delete() });
  return NextResponse.json({ success: true });
}
