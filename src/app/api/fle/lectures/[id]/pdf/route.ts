import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { accesLecture, chargerDocument } from '@/lib/lecture-cours-server';
import { lirePdf } from '@/lib/import-cours/drive';

// GET — le PDF d'origine d'une lecture de cours (plan du 2026-10-12), relu
// dans Google Drive. Même accès que la lecture : son élève ou un de ses profs.
// La page le demande avec ses en-têtes d'authentification et l'affiche dans le
// lecteur PDF de Chrome (un cadre ne peut pas envoyer ces en-têtes lui-même).

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  try {
    const r = await accesLecture(auth, id);
    if (!r.lecture) return NextResponse.json({ success: false, message: r.message }, { status: r.statut });
    const documentId = r.lecture.source.documentId;
    const documentCours = documentId ? await chargerDocument(documentId) : null;
    if (!documentCours?.driveFileId) {
      return NextResponse.json({ success: false, message: 'Pas de PDF conservé pour cette lecture.' }, { status: 404 });
    }
    const pdf = await lirePdf(documentCours.driveFileId);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/fle/lectures/[id]/pdf:', error);
    return NextResponse.json({ success: false, message: 'PDF illisible pour le moment.' }, { status: 502 });
  }
}
