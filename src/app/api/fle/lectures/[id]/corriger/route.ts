import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { appelerClaudeJson } from '@/lib/claude';
import { COLL_LECTURES, chargerLecture } from '@/lib/lecture-cours-server';
import { consigneAvisResume, consigneCorrectionTexte, contexteCours, preambule } from '@/lib/prompts-lecture-cours';
import type { AvisResume, CorrectionPhrases } from '@/types/lecture-cours';

// POST { cle: 'passerelle' | 'resumeEleve', texte } — le bouton IA de l'élève.
//  · passerelle  → sa réponse corrigée phrase par phrase (CorrectionPhrases)
//  · resumeEleve → son résumé comparé au cours (AvisResume)
// Le texte de l'élève et le verdict sont enregistrés dans `reponses`
// (`passerelle` / `passerelle_correction`, `resume_eleve` / `resume_eleve_avis`).

const TEXTE_MAX = 4000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  if (auth.role !== 'eleve') {
    return NextResponse.json({ success: false, message: 'Accès réservé aux élèves' }, { status: 403 });
  }
  const { id } = await params;

  try {
    const body = await request.json();
    const cle = body?.cle;
    const texte = typeof body?.texte === 'string' ? body.texte.trim().slice(0, TEXTE_MAX) : '';
    if ((cle !== 'passerelle' && cle !== 'resumeEleve') || texte.length < 10) {
      return NextResponse.json({ success: false, message: 'Écris d’abord quelques phrases.' }, { status: 400 });
    }

    const lecture = await chargerLecture(id);
    if (!lecture) return NextResponse.json({ success: false, message: 'Lecture introuvable' }, { status: 404 });
    if (lecture.eleveUid !== auth.uid) {
      return NextResponse.json({ success: false, message: 'Cette lecture n’est pas la tienne' }, { status: 403 });
    }

    const ctx = { langue: lecture.langue, niveau: lecture.niveau };
    const ref = adminDb.collection(COLL_LECTURES).doc(id);
    const now = new Date().toISOString();

    if (cle === 'passerelle') {
      const { data, usage } = await appelerClaudeJson<Omit<CorrectionPhrases, 'at'>>({
        system: preambule(ctx.langue, ctx.niveau),
        contexteCache: contexteCours(lecture.titre, lecture.texte),
        user: consigneCorrectionTexte(texte, ctx),
        maxTokens: 4000,
      });
      const correction: CorrectionPhrases = {
        phrases: Array.isArray(data?.phrases)
          ? data.phrases.map((p) => ({
              phrase: String(p?.phrase ?? ''),
              remarques: String(p?.remarques ?? ''),
              reformulation: String(p?.reformulation ?? ''),
            }))
          : [],
        commentaire: typeof data?.commentaire === 'string' ? data.commentaire : '',
        at: now,
      };
      await ref.update({
        'reponses.passerelle': { texte },
        'reponses.passerelle_correction': correction,
        'reponses.passerelle_usage': usage,
        updatedAt: new Date(),
      });
      return NextResponse.json({ success: true, data: { cle, resultat: correction } });
    }

    const { data, usage } = await appelerClaudeJson<Omit<AvisResume, 'at'>>({
      system: preambule(ctx.langue, ctx.niveau),
      contexteCache: contexteCours(lecture.titre, lecture.texte),
      user: consigneAvisResume(texte, ctx),
      maxTokens: 5000,
    });
    const avis: AvisResume = {
      avis: data?.avis === 'positif' || data?.avis === 'negatif' ? data.avis : 'mitige',
      commentaire: typeof data?.commentaire === 'string' ? data.commentaire : '',
      ideesVues: Array.isArray(data?.ideesVues) ? data.ideesVues.map(String) : [],
      ideesManquantes: Array.isArray(data?.ideesManquantes) ? data.ideesManquantes.map(String) : [],
      phrases: Array.isArray(data?.phrases)
        ? data.phrases.map((p) => ({
            phrase: String(p?.phrase ?? ''),
            probleme: String(p?.probleme ?? ''),
            exemples: Array.isArray(p?.exemples) ? p.exemples.map(String) : [],
          }))
        : [],
      at: now,
    };
    await ref.update({
      'reponses.resume_eleve': { texte },
      'reponses.resume_eleve_avis': avis,
      'reponses.resume_eleve_usage': usage,
      updatedAt: new Date(),
    });
    return NextResponse.json({ success: true, data: { cle, resultat: avis } });
  } catch (error) {
    console.error('Erreur POST /api/fle/lectures/[id]/corriger:', error);
    const detail = process.env.NODE_ENV !== 'production' && error instanceof Error ? ` — ${error.message}` : '';
    return NextResponse.json({ success: false, message: `Correction impossible${detail}` }, { status: 502 });
  }
}
