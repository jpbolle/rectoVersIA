import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decrypt, encrypt, hashEmail } from '@/lib/crypto';
import { generateTravailId } from '@/lib/travail-utils';
import { computeRechercheResume } from '@/lib/navigkid-server';
import type { NavigKidQuestion, NavigKidQuestionData } from '@/types/navigkid';

/**
 * Retrouve le travail de l'élève pour un devoir : par identifiant généré, puis par
 * empreinte d'email (travail pré-créé par `ensureTravaux`, dont le `studentId` est
 * encore l'identifiant de la fiche élève). Même stratégie que `/api/travaux/mine`.
 */
async function findTravailRef(devoirId: string, uid: string, email: string) {
  const direct = adminDb.collection('travaux').doc(generateTravailId(devoirId, uid));
  if ((await direct.get()).exists) return direct;

  const parEmpreinte = await adminDb
    .collection('travaux')
    .where('devoirId', '==', devoirId)
    .where('studentEmailHash', '==', hashEmail(email))
    .limit(1)
    .get();
  if (!parEmpreinte.empty) return parEmpreinte.docs[0].ref;

  const parEmail = await adminDb
    .collection('travaux')
    .where('devoirId', '==', devoirId)
    .where('studentEmail', '==', email.toLowerCase())
    .limit(1)
    .get();
  return parEmail.empty ? null : parEmail.docs[0].ref;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const questionnaireId = request.nextUrl.searchParams.get('questionnaireId');
  // Un élève ne peut lire que sa propre réponse
  const eleveId =
    auth.role === 'eleve' ? auth.uid : request.nextUrl.searchParams.get('eleveId');

  if (!questionnaireId || !eleveId) {
    return NextResponse.json({ error: 'questionnaireId et eleveId requis' }, { status: 400 });
  }

  try {
    const doc = await adminDb
      .collection('questionnaires')
      .doc(questionnaireId)
      .collection('reponses')
      .doc(eleveId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ success: true, data: null });
    }

    const data = doc.data()!;
    const reponses: NavigKidQuestionData[] = data.questions || [];

    // Récapitulatif calculé ici : les bonnes réponses ne quittent jamais le serveur.
    const questionnaireSnap = await adminDb
      .collection('questionnaires')
      .doc(questionnaireId)
      .get();
    const questions: NavigKidQuestion[] = questionnaireSnap.exists
      ? questionnaireSnap.data()?.questions || []
      : [];

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        eleveNom: decrypt(data.eleveNom) || '',
        eleveEmail: decrypt(data.eleveEmail) || '',
        questions: reponses,
        soumisLe: data.soumisLe?.toDate?.()?.toISOString?.() || '',
        resume: computeRechercheResume(questions, reponses),
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/navigkid/reponse:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// POST - Soumettre les réponses de l'élève connecté (extension NavigKid)
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }
  if (auth.role !== 'eleve') {
    return NextResponse.json({ error: 'Réservé aux élèves' }, { status: 403 });
  }

  let body: { questionnaireId?: string; eleveNom?: string; questions?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  if (!body.questionnaireId || !Array.isArray(body.questions)) {
    return NextResponse.json(
      { error: 'questionnaireId et questions[] requis' },
      { status: 400 }
    );
  }

  try {
    const questionnaireRef = adminDb.collection('questionnaires').doc(body.questionnaireId);
    const questionnaireSnap = await questionnaireRef.get();
    if (!questionnaireSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Questionnaire non trouvé' },
        { status: 404 }
      );
    }

    await questionnaireRef.collection('reponses').doc(auth.uid).set({
      eleveNom: encrypt(body.eleveNom || auth.email.split('@')[0]),
      eleveEmail: encrypt(auth.email),
      questions: body.questions,
      soumisLe: FieldValue.serverTimestamp(),
    });

    // L'envoi depuis l'extension EST la remise : il n'y a pas de bouton
    // « Remettre le devoir » sur une activité de recherche. Sans cette bascule,
    // l'activité resterait un brouillon pour le prof (listes, compteurs,
    // notifications) et pour le classement de la page /activites.
    const devoirId: string | undefined = questionnaireSnap.data()?.devoirId;
    if (devoirId) {
      try {
        const travailRef = await findTravailRef(devoirId, auth.uid, auth.email);
        if (travailRef) {
          const now = new Date().toISOString();
          await travailRef.update({
            studentId: auth.uid,
            status: 'submitted',
            submittedAt: now,
            updatedAt: now,
          });
        }
      } catch (err) {
        // La remise ne doit jamais faire perdre les réponses déjà enregistrées
        console.error('Erreur bascule travail en remis (NavigKid):', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur POST /api/navigkid/reponse:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
