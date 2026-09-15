import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { docToModuleFle, nomDuProf } from '@/lib/module-fle-server';
import { generateModuleFleId } from '@/types/module-fle';

// Dupliquer un module — le geste qui rend la bibliothèque partageable : on ne
// modifie jamais le module d'un collègue, on en prend une copie (introduction
// et ressources comprises ; les fichiers pointent vers les mêmes images).

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id } = await params;
    const sourceSnap = await adminDb.collection('modulesFle').doc(id).get();
    if (!sourceSnap.exists) {
      return NextResponse.json({ success: false, message: 'Module introuvable' }, { status: 404 });
    }
    const source = docToModuleFle(sourceSnap);
    const nouvelId = generateModuleFleId();
    const now = new Date();

    await adminDb.collection('modulesFle').doc(nouvelId).set({
      id: nouvelId,
      titre: `${source.titre} (copie)`,
      description: source.description || '',
      type: source.type,
      niveau: source.niveau,
      competences: source.competences,
      introduction: source.introduction,
      ressources: source.ressources,
      profId: auth.uid,
      profName: await nomDuProf(auth),
      shared: false, // une copie n'hérite jamais du statut d'exemple
      archive: false,
      anneeScolaire: calculateSchoolYear(),
      createdAt: now,
      updatedAt: now,
    });

    const cree = await adminDb.collection('modulesFle').doc(nouvelId).get();
    return NextResponse.json({
      success: true,
      data: docToModuleFle(cree),
      message: `« ${source.titre} » dupliqué — il est à toi, modifie-le`,
    });
  } catch (error) {
    console.error('Erreur POST /api/modules-fle/[id]/dupliquer:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
