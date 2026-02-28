import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateEleveId } from '@/lib/classe-utils';

interface BulkEleveInput {
  nom: string;
  prenom: string;
  email: string;
}

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
    const body = await request.json();
    const { classeId, eleves } = body as { classeId: string; eleves: BulkEleveInput[] };

    if (!classeId || !Array.isArray(eleves) || eleves.length === 0) {
      return NextResponse.json(
        { success: false, message: 'classeId et eleves[] sont requis' },
        { status: 400 }
      );
    }

    if (eleves.length > 500) {
      return NextResponse.json(
        { success: false, message: 'Maximum 500 élèves par import' },
        { status: 400 }
      );
    }

    // Vérifier que la classe existe et appartient au prof
    const classeDoc = await adminDb.collection('classes').doc(classeId).get();
    if (!classeDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Classe non trouvée' },
        { status: 404 }
      );
    }
    const classeData = classeDoc.data();
    if (classeData?.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    const now = new Date();
    const batch = adminDb.batch();
    const created: Array<{ id: string; nom: string; prenom: string; email: string; classeId: string; createdAt: string }> = [];

    for (const e of eleves) {
      if (!e.nom?.trim() || !e.prenom?.trim()) continue;

      const nom = e.nom.trim();
      const prenom = e.prenom.trim();
      let email = (e.email || '').trim().toLowerCase();

      // Auto-générer email si absent
      if (!email) {
        const normalizedPrenom = removeAccents(prenom).toLowerCase().replace(/\s+/g, '');
        const normalizedNom = removeAccents(nom).toLowerCase().replace(/\s+/g, '');
        email = `${normalizedPrenom}.${normalizedNom}@cnddinant.be`;
      }

      const eleveId = generateEleveId();
      const ref = adminDb.collection('eleves').doc(eleveId);

      batch.set(ref, {
        nom,
        prenom,
        email,
        classeId,
        createdAt: now,
      });

      created.push({
        id: eleveId,
        nom,
        prenom,
        email,
        classeId,
        createdAt: now.toISOString(),
      });
    }

    if (created.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Aucun élève valide à importer' },
        { status: 400 }
      );
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      data: {
        imported: created.length,
        eleves: created,
      },
    });
  } catch (error) {
    console.error('Erreur POST eleves/bulk:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
