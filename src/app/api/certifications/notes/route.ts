import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { accesClasse, peutAgir } from '@/lib/classe-acces';
import {
  COLLECTION_NOTES,
  buildLignes,
  elevesConcernes,
  noteId,
  notesAutomatiques,
  faitsAutomatiques,
  notesSaisies,
  trouverCertification,
} from '@/lib/certification-server';
import { devoirCertificatif, estCotee, ponderationDe, uaaCertifiees } from '@/types/scenarisation';
import type { CertificationNotesPayload, MajNoteCertification } from '@/types/certification';

// Notes d'une certification, élève par élève.
//
// La certification vit dans la scénarisation ; seules les notes vivent ici.
// Accès prof uniquement, et uniquement sur SES scénarisations — d'où le
// passage systématique par trouverCertification(auth.uid, moduleId).

// ── Coprofesseur (2026-10-04) ──
// Les certifications vivent dans la scénarisation du TITULAIRE de la classe.
// Quand la popup s'ouvre depuis une classe partagée (`classeId`), on les
// cherche donc chez lui — et seulement pour CETTE classe. Sans classe, ou pour
// une classe qui est la sienne : le prof appelant, comme avant.
async function proprietaireDesNotes(
  auth: { uid: string; email?: string | null },
  classeId: string | null
): Promise<{ profId: string; classeId: string | null; peutEcrire: boolean } | null> {
  if (!classeId) return { profId: auth.uid, classeId: null, peutEcrire: true };
  const c = await accesClasse(classeId, auth);
  if (!c) return null;
  return {
    profId: c.acces === 'titulaire' ? auth.uid : String(c.data.profId || ''),
    classeId,
    peutEcrire: peutAgir(c.acces),
  };
}

// GET ?moduleId=…&classeId=… — classeId restreint à une classe (Mes Classes)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const moduleId = searchParams.get('moduleId');
  const classeId = searchParams.get('classeId');
  if (!moduleId) {
    return NextResponse.json({ success: false, message: 'moduleId requis' }, { status: 400 });
  }

  try {
    const proprio = await proprietaireDesNotes(auth, classeId);
    if (!proprio) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }
    const trouve = await trouverCertification(proprio.profId, moduleId);
    if (!trouve) {
      return NextResponse.json(
        { success: false, message: 'Certification introuvable' },
        { status: 404 }
      );
    }

    const { scenarisation, module } = trouve;
    const eleves = await elevesConcernes(scenarisation, proprio.profId, classeId);
    const devoirId = devoirCertificatif(module);
    const [saisies, autos, faitsAuto] = await Promise.all([
      notesSaisies(moduleId),
      notesAutomatiques(devoirId, eleves),
      // Certification non cotée : la copie corrigée vaut « fait ». Inutile de
      // le calculer pour une certification notée, où le prof saisit un %.
      estCotee(module) ? Promise.resolve(new Set<string>()) : faitsAutomatiques(devoirId, eleves),
    ]);

    const data: CertificationNotesPayload = {
      moduleId,
      titre: module.titre,
      uaa: uaaCertifiees(module),
      ceinture: module.ceinture || '',
      ponderation: ponderationDe(module),
      cotation: estCotee(module) ? 'note' : 'fait',
      devoirId,
      // La date de l'épreuve est celle de la dernière saisie : elle sert à
      // dater la ligne dans le profil de l'élève, rien de plus.
      date: [...saisies.values()][0]?.date || '',
      lignes: buildLignes(eleves, saisies, autos, faitsAuto),
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /api/certifications/notes:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT — enregistre un lot de notes. `percent: null` efface la note.
export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const body = await request.json();
    const moduleId = typeof body.moduleId === 'string' ? body.moduleId : '';
    const date = typeof body.date === 'string' ? body.date : '';
    const majs: MajNoteCertification[] = Array.isArray(body.notes) ? body.notes : [];
    if (!moduleId) {
      return NextResponse.json({ success: false, message: 'moduleId requis' }, { status: 400 });
    }

    const classeId = typeof body.classeId === 'string' && body.classeId ? body.classeId : null;
    const proprio = await proprietaireDesNotes(auth, classeId);
    if (!proprio || !proprio.peutEcrire) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }

    const trouve = await trouverCertification(proprio.profId, moduleId);
    if (!trouve) {
      return NextResponse.json(
        { success: false, message: 'Certification introuvable' },
        { status: 404 }
      );
    }

    // Les notes ne peuvent porter que sur des élèves du prof : sans ce filtre,
    // un eleveId forgé écrirait dans la classe d'un collègue. Un coprofesseur
    // est en plus borné à SA classe partagée.
    const autorises = new Set(
      (await elevesConcernes(trouve.scenarisation, proprio.profId, proprio.classeId)).map((e) => e.eleveId)
    );

    // Notée ou « faite » : la nature de la certification décide de ce qu'une
    // ligne veut dire, et le client ne peut pas en décider — c'est le module qui
    // le dit.
    const cotee = estCotee(trouve.module);
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    let ecrites = 0;

    majs.forEach((maj) => {
      if (!maj?.eleveId || !autorises.has(maj.eleveId)) return;
      const ref = adminDb.collection(COLLECTION_NOTES).doc(noteId(moduleId, maj.eleveId));

      const nombre = Number(maj.percent);
      const noteVide =
        maj.percent === null || maj.percent === undefined || Number.isNaN(nombre);
      // Rien à retenir : la case décochée d'une non cotée efface le document,
      // comme un champ vidé sur une certification notée.
      const rien = cotee ? noteVide : maj.fait !== true;
      if (rien) {
        batch.delete(ref);
      } else {
        batch.set(ref, {
          scenarisationId: trouve.scenarisation.id,
          chapitreId: trouve.chapitreId,
          moduleId,
          eleveId: maj.eleveId,
          // Le titulaire, même quand c'est son remplaçant qui saisit
          profId: proprio.profId,
          anneeScolaire: trouve.scenarisation.anneeScolaire || calculateSchoolYear(),
          // Un « fait » n'est pas un 100 % : le pourcentage reste nul, et c'est
          // `fait` qui porte l'information. Le document n'existe que si l'épreuve
          // a eu lieu — `fait` vaut donc toujours true.
          percent: cotee ? Math.max(0, Math.min(100, Math.round(nombre))) : null,
          fait: true,
          commentaire: typeof maj.commentaire === 'string' ? maj.commentaire.slice(0, 500) : '',
          date: date || now.slice(0, 10),
          updatedAt: now,
        });
      }
      ecrites += 1;
    });

    await batch.commit();
    return NextResponse.json({ success: true, data: { ecrites } });
  } catch (error) {
    console.error('Erreur PUT /api/certifications/notes:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
