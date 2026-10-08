import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesClasseDepuisDoc, peutAgir } from '@/lib/classe-acces';
import { classesDeLEleve, syncSessions } from '@/lib/session-server';
import { COLL_EVALUATIONS, COLL_FICHIERS, estTypeEvaluation, evaluationsDesClasses, genererIdEvaluation } from '@/lib/evaluations-fle-server';
import { PDF_EVALUATION_MAX } from '@/types/evaluation-fle';
import type { SourceEvaluation } from '@/types/evaluation-fle';

// Évaluations d'une classe FLE (evaluationsFle).
//  GET ?classeId=  — prof (titulaire ou coprof) : celles de la classe
//  GET             — élève : celles de SES classes FLE, avec son avancement
//  POST            — prof : multipart { classeId, titre, type, kind, url | fichier | devoirId }

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  const classeId = new URL(request.url).searchParams.get('classeId');

  try {
    if (auth.role === 'prof') {
      if (!classeId) return NextResponse.json({ success: false, message: 'classeId requis' }, { status: 400 });
      const classe = await adminDb.collection('classes').doc(classeId).get();
      if (!classe.exists || !accesClasseDepuisDoc(classe.data(), auth)) {
        return NextResponse.json({ success: false, message: 'Classe inaccessible' }, { status: 403 });
      }
      return NextResponse.json({ success: true, data: await evaluationsDesClasses([classeId]) });
    }

    // Élève : ses classes FLE
    const mesClasses = await classesDeLEleve(auth.uid, auth.email);
    const fle: string[] = [];
    await Promise.all(
      mesClasses.map(async (id) => {
        const c = await adminDb.collection('classes').doc(id).get();
        if (c.exists && c.data()?.type === 'fle' && c.data()?.archive !== true) fle.push(id);
      })
    );
    const evaluations = await evaluationsDesClasses(fle);
    // Son avancement sur les activités
    const travaux = await adminDb.collection('travaux').where('studentId', '==', auth.uid).select('devoirId', 'status').get();
    const statuts = new Map<string, string>();
    travaux.docs.forEach((d) => statuts.set(String(d.data().devoirId), String(d.data().status ?? 'draft')));
    const data = evaluations.map((e) => {
      if (e.source.kind !== 'activite') return e;
      const s = statuts.get(e.source.devoirId);
      return { ...e, statut: !s ? 'non-commence' : s === 'submitted' ? 'remis' : 'en-cours' };
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /api/fle/evaluations:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ success: false, message: 'Accès réservé aux professeurs' }, { status: 403 });

  try {
    const form = await request.formData();
    const classeId = String(form.get('classeId') || '');
    const titre = String(form.get('titre') || '').trim().slice(0, 120);
    const type = form.get('type');
    const kind = String(form.get('kind') || '');
    if (!classeId || !titre || !estTypeEvaluation(type)) {
      return NextResponse.json({ success: false, message: 'Classe, titre et type requis' }, { status: 400 });
    }
    const classeDoc = await adminDb.collection('classes').doc(classeId).get();
    const acces = classeDoc.exists ? accesClasseDepuisDoc(classeDoc.data(), auth) : null;
    if (!acces || !peutAgir(acces)) {
      return NextResponse.json({ success: false, message: 'Classe inaccessible' }, { status: 403 });
    }
    const classeNom = String(classeDoc.data()?.nom ?? '');

    let source: SourceEvaluation;
    if (kind === 'lien') {
      const url = String(form.get('url') || '').trim();
      if (!/^https?:\/\//.test(url)) return NextResponse.json({ success: false, message: 'Lien invalide' }, { status: 400 });
      source = { kind: 'lien', url };
    } else if (kind === 'pdf') {
      const fichier = form.get('fichier');
      if (!(fichier instanceof File)) return NextResponse.json({ success: false, message: 'Dépose un PDF' }, { status: 400 });
      if (fichier.size > PDF_EVALUATION_MAX) {
        return NextResponse.json(
          { success: false, message: `PDF trop lourd (${Math.round(fichier.size / 1024)} Ko) : 700 Ko maximum. Au-delà, partage-le par lien.` },
          { status: 422 }
        );
      }
      const buffer = Buffer.from(await fichier.arrayBuffer());
      if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
        return NextResponse.json({ success: false, message: 'Ce fichier n’est pas un PDF' }, { status: 400 });
      }
      const ref = adminDb.collection(COLL_FICHIERS).doc();
      await ref.set({
        classeId,
        profId: auth.uid,
        nom: fichier.name || 'evaluation.pdf',
        mime: 'application/pdf',
        taille: buffer.length,
        data: buffer.toString('base64'),
        createdAt: new Date(),
      });
      source = { kind: 'pdf', fichierId: ref.id, nomFichier: fichier.name || 'evaluation.pdf' };
    } else if (kind === 'activite') {
      const devoirId = String(form.get('devoirId') || '');
      const devoirDoc = await adminDb.collection('devoirs').doc(devoirId).get();
      if (!devoirDoc.exists || devoirDoc.data()?.profId !== auth.uid) {
        return NextResponse.json({ success: false, message: 'Activité introuvable' }, { status: 404 });
      }
      const devoir = devoirDoc.data()!;
      // La classe doit être sur l'activité, sinon ses élèves ne peuvent pas l'ouvrir
      const classes: string[] = Array.isArray(devoir.classes) ? devoir.classes : [];
      if (classeNom && !classes.includes(classeNom)) {
        await devoirDoc.ref.update({ classes: FieldValue.arrayUnion(classeNom), fle: true, updatedAt: new Date() });
        await syncSessions(devoirId);
      }
      source = { kind: 'activite', devoirId, intitule: String(devoir.intitule ?? ''), typeTravail: String(devoir.typeTravail ?? 'ecrire') };
    } else {
      return NextResponse.json({ success: false, message: 'Forme inconnue' }, { status: 400 });
    }

    const id = genererIdEvaluation();
    const now = new Date();
    await adminDb.collection(COLL_EVALUATIONS).doc(id).set({ id, classeId, profId: auth.uid, titre, type, source, createdAt: now });
    return NextResponse.json({ success: true, data: { id, classeId, profId: auth.uid, titre, type, source, createdAt: now.toISOString() } });
  } catch (error) {
    console.error('Erreur POST /api/fle/evaluations:', error);
    const detail = process.env.NODE_ENV !== 'production' && error instanceof Error ? ` — ${error.message}` : '';
    return NextResponse.json({ success: false, message: `Erreur serveur${detail}` }, { status: 500 });
  }
}
