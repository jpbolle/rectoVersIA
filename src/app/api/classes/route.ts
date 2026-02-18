import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateClasseId, getCurrentAnneeScolaire } from '@/lib/classe-utils';
import type { Classe, CreateClasseData } from '@/types/classe';

// GET - Liste des classes du prof
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: 'Non autorisé' },
      { status: 401 }
    );
  }

  if (auth.role !== 'prof') {
    return NextResponse.json(
      { success: false, message: 'Accès refusé' },
      { status: 403 }
    );
  }

  try {
    const snapshot = await adminDb
      .collection('classes')
      .where('profId', '==', auth.uid)
      .get();

    const classes: Classe[] = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          nom: data.nom || '',
          description: data.description || '',
          profId: data.profId || '',
          anneeScolaire: data.anneeScolaire || '',
          archive: data.archive || false,
          googleClassroomId: data.googleClassroomId,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
        };
      })
      .sort((a, b) => a.nom.localeCompare(b.nom));

    return NextResponse.json({ success: true, data: classes });
  } catch (error) {
    console.error('Erreur GET classes:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST - Créer une classe
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: 'Non autorisé' },
      { status: 401 }
    );
  }

  if (auth.role !== 'prof') {
    return NextResponse.json(
      { success: false, message: 'Accès refusé' },
      { status: 403 }
    );
  }

  try {
    const body: CreateClasseData = await request.json();

    if (!body.nom || body.nom.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'Le nom de la classe est requis' },
        { status: 400 }
      );
    }

    const now = new Date();
    const classeId = generateClasseId();

    const classe = {
      nom: body.nom.trim(),
      description: body.description?.trim() || '',
      profId: auth.uid,
      anneeScolaire: getCurrentAnneeScolaire(),
      archive: false,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('classes').doc(classeId).set(classe);

    return NextResponse.json({
      success: true,
      data: {
        id: classeId,
        ...classe,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Erreur POST classe:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
