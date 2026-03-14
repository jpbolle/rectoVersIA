import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateClasseCode } from '@/lib/classe-utils';

// POST - Générer des codes pour toutes les classes qui n'en ont pas (prof uniquement, one-shot)
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json(
      { success: false, message: 'Non autorisé' },
      { status: 401 }
    );
  }

  try {
    const snapshot = await adminDb.collection('classes').get();
    const usedCodes = new Set<string>();
    const toUpdate: { id: string }[] = [];

    // Collecter les codes existants
    for (const doc of snapshot.docs) {
      const code = doc.data().code;
      if (code) {
        usedCodes.add(code);
      } else {
        toUpdate.push({ id: doc.id });
      }
    }

    // Générer des codes uniques pour les classes sans code
    let updated = 0;
    for (const item of toUpdate) {
      let code = generateClasseCode();
      let attempts = 0;
      while (usedCodes.has(code) && attempts < 20) {
        code = generateClasseCode();
        attempts++;
      }
      usedCodes.add(code);

      await adminDb.collection('classes').doc(item.id).update({ code });
      updated++;
    }

    return NextResponse.json({
      success: true,
      message: `${updated} classe(s) mise(s) à jour avec un code`,
    });
  } catch (error) {
    console.error('Erreur migration codes:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
