import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesDevoir, copieVisible } from '@/lib/classe-acces';
import { generateTravailId } from '@/lib/travail-utils';
import { classesDeLEleve, etatEffectif, sessionsDeLEleve } from '@/lib/session-server';
import { eleveExclu, identiteEleve, ouvertParSequence } from '@/lib/sequence-server';
import { ensureTravaux } from '@/lib/precreate-travaux';
import { syncSessions } from '@/lib/session-server';
import { decrypt, encrypt, hashEmail } from '@/lib/crypto';
import type { Travail, CreateTravailData } from '@/types/travail';

// POST - Creer un nouveau travail (eleve uniquement)
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'eleve') {
    return NextResponse.json({ error: 'Seuls les eleves peuvent creer des travaux' }, { status: 403 });
  }

  try {
    const body: CreateTravailData = await request.json();

    if (!body.devoirId) {
      return NextResponse.json(
        { success: false, message: 'devoirId est requis' },
        { status: 400 }
      );
    }

    // Verifier que le devoir existe et est disponible
    const devoirRef = adminDb.collection('devoirs').doc(body.devoirId);
    const devoirSnap = await devoirRef.get();

    if (!devoirSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Devoir non trouve' },
        { status: 404 }
      );
    }

    const devoirData = devoirSnap.data()!;
    // La SESSION prime, le devoir sert de repli — même correction que dans
    // /api/travaux/mine : ces deux routes lisaient le seul drapeau de
    // l'activité et étaient restées en arrière du chantier des sessions.
    const mesClasses = await classesDeLEleve(auth.uid, auth.email);
    const mes = await sessionsDeLEleve(body.devoirId, mesClasses);
    const etat = etatEffectif(
      { disponible: devoirData.disponible, corrigeDisponible: devoirData.corrigeDisponible },
      mes.sessions
    );
    // Une SÉQUENCE FLE de l'élève peut ouvrir ce que la session refuse
    // (plan espace FLE, étape 4) : porte de plus, jamais de moins.
    if (!etat.disponible && !(await ouvertParSequence(auth.uid, auth.email, body.devoirId))) {
      return NextResponse.json(
        { success: false, message: 'Ce devoir n\'est pas disponible' },
        { status: 403 }
      );
    }
    // Activité réservée à certains élèves de la classe
    if (Array.isArray(devoirData.eleves)) {
      const identite = await identiteEleve(auth.uid, auth.email);
      if (eleveExclu(devoirData.eleves, identite.eleveIds)) {
        return NextResponse.json(
          { success: false, message: 'Ce devoir n\'est pas disponible' },
          { status: 403 }
        );
      }
    }

    // Generer l'ID du travail
    const travailId = generateTravailId(body.devoirId, auth.uid);

    // Verifier si un travail existe deja
    const existingRef = adminDb.collection('travaux').doc(travailId);
    const existingSnap = await existingRef.get();

    if (existingSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Un travail existe deja pour ce devoir' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const travail: Travail = {
      id: travailId,
      devoirId: body.devoirId,
      // La classe de l'élève : sans elle, la copie tombe dans « Copies sans
      // classe » chez le prof (vu le 2026-09-19 : 34 copies d'une partie en
      // compétition, créées à l'ouverture par les élèves).
      sessionId: mes.sessions[0]?.id ?? null,
      studentId: auth.uid,
      studentEmail: auth.email,
      studentName: auth.email.split('@')[0],
      content: body.content || '',
      status: 'draft',
      selfEvaluation: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
    };

    await existingRef.set({
      ...travail,
      studentEmail: encrypt(travail.studentEmail),
      studentEmailHash: hashEmail(travail.studentEmail),
      studentName: encrypt(travail.studentName),
    });

    return NextResponse.json({
      success: true,
      data: travail,
      message: 'Travail cree avec succes',
    });
  } catch (error) {
    console.error('Erreur POST /api/travaux:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// GET - Liste des travaux (prof uniquement, filtre par devoirId optionnel)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const devoirId = searchParams.get('devoirId');

    // ── L'activité est obligatoire, et doit être accessible ──
    // Sans activité, la route listait TOUTES les copies de l'application à
    // n'importe quel compte prof (aucun écran ne s'en servait). Désormais :
    // l'auteur voit toutes les copies ; un titulaire ou coprofesseur de classe
    // ne voit que celles de SES sessions (2026-10-04).
    if (!devoirId) {
      return NextResponse.json({ success: false, message: 'devoirId requis' }, { status: 400 });
    }

    // L'accès d'abord : un compte prof quelconque ne déclenche aucune écriture
    // sur l'activité d'un autre en devinant son identifiant
    let acces = await accesDevoir(devoirId, auth);
    if (!acces) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    // Pre-creer les travaux manquants pour les eleves des classes du devoir.
    // Les sessions d'abord : c'est à l'une d'elles que chaque travail créé
    // s'attachera (une activité, une classe).
    try {
      await syncSessions(devoirId);
      await ensureTravaux(devoirId);
    } catch (err) {
      console.error('Erreur ensureTravaux:', err);
    }
    // Une session a pu naître ci-dessus (classe ajoutée à l'activité) : on
    // relit l'accès pour qu'un coprofesseur en voie les copies tout de suite
    if (acces.sessionIds) acces = (await accesDevoir(devoirId, auth)) ?? acces;

    const query = adminDb.collection('travaux')
      .where('devoirId', '==', devoirId)
      .orderBy('updatedAt', 'desc');

    const snapshot = await query.get();
    const travaux: Travail[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Seulement les copies des sessions de MES classes (titulaire,
      // coprofesseur, ou auteur sur une classe qu'on ne lui a pas retirée)
      if (!copieVisible(acces, data.sessionId)) return;
      travaux.push({
        id: data.id || doc.id,
        devoirId: data.devoirId,
        // La classe qui a rendu cette copie — c'est par là que la page des
        // travaux sépare les sessions les unes des autres.
        sessionId: data.sessionId ?? null,
        studentId: data.studentId,
        studentEmail: decrypt(data.studentEmail),
        studentName: decrypt(data.studentName),
        content: data.content || '',
        status: data.status || 'draft',
        selfEvaluation: data.selfEvaluation || null,
        nonRendu: data.nonRendu || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        submittedAt: data.submittedAt || null,
      });
    });

    return NextResponse.json({ success: true, data: travaux });
  } catch (error) {
    console.error('Erreur GET /api/travaux:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
