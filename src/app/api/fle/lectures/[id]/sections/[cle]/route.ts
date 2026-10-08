import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { appelerClaudeJson } from '@/lib/claude';
import { COLL_LECTURES, chargerLecture, estSectionCle } from '@/lib/lecture-cours-server';
import { consigneSection, contenuValide, contexteCours, preambule } from '@/lib/prompts-lecture-cours';
import { arbreVersDiagram } from '@/lib/lecture-cours-arbre';

// POST — génère UNE section d'une lecture de cours et l'enregistre.
//
// La page appelle les six sections l'une après l'autre (option 4-A du plan) :
// chaque appel tient en quelques dizaines de secondes, et ce qui est fait
// reste fait si l'élève s'en va. Le texte du cours est le préfixe commun des
// six appels — mis en cache côté API (`contexteCache`).

// Une section « en cours » depuis plus longtemps que ça est considérée
// abandonnée (onglet fermé pendant l'appel) et se relance
const EN_COURS_PERIME_MS = 3 * 60 * 1000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; cle: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  if (auth.role !== 'eleve') {
    return NextResponse.json({ success: false, message: 'Accès réservé aux élèves' }, { status: 403 });
  }
  const { id, cle } = await params;
  if (!estSectionCle(cle) || cle === 'resumeEleve') {
    return NextResponse.json({ success: false, message: 'Section inconnue' }, { status: 400 });
  }

  try {
    const lecture = await chargerLecture(id);
    if (!lecture) return NextResponse.json({ success: false, message: 'Lecture introuvable' }, { status: 404 });
    if (lecture.eleveUid !== auth.uid) {
      return NextResponse.json({ success: false, message: 'Cette lecture n’est pas la tienne' }, { status: 403 });
    }

    const section = lecture.sections[cle];
    // Déjà prête : on la rend telle quelle (la page peut redemander après un rechargement)
    if (section.statut === 'prete') {
      return NextResponse.json({ success: true, data: { cle, section } });
    }
    if (section.statut === 'en-cours') {
      const depuis = Date.now() - new Date(lecture.updatedAt || 0).getTime();
      if (depuis < EN_COURS_PERIME_MS) {
        return NextResponse.json({ success: false, message: 'Section en cours de préparation' }, { status: 409 });
      }
    }

    const ref = adminDb.collection(COLL_LECTURES).doc(id);
    await ref.update({ [`sections.${cle}.statut`]: 'en-cours', [`sections.${cle}.erreur`]: null, updatedAt: new Date() });

    try {
      const { data, usage } = await appelerClaudeJson<unknown>({
        system: preambule(lecture.langue, lecture.niveau),
        contexteCache: contexteCours(lecture.titre, lecture.texte),
        user: consigneSection(cle, { langue: lecture.langue, niveau: lecture.niveau }),
        maxTokens: cle === 'reformulation' || cle === 'vocabulaire' ? 12000 : 8000,
      });
      if (!contenuValide(cle, data)) throw new Error('Réponse incomplète du modèle.');
      // Phrases à la loupe : l'arbre emboîté devient un schéma du moteur
      if (cle === 'grammaire') {
        const d = data as { phrases: Array<Record<string, unknown>> };
        d.phrases = d.phrases.map((ph, i) => ({
          ...ph,
          arbre: arbreVersDiagram(ph.arbre, `Phrase ${i + 1}`),
        }));
      }

      const prete = { statut: 'prete', contenu: data, generatedAt: new Date(), erreur: null, usage };
      await ref.update({ [`sections.${cle}`]: prete, updatedAt: new Date() });
      return NextResponse.json({
        success: true,
        data: { cle, section: { ...prete, generatedAt: prete.generatedAt.toISOString() } },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Génération impossible.';
      console.error(`Erreur génération section ${cle} de ${id}:`, err);
      await ref.update({
        [`sections.${cle}.statut`]: 'erreur',
        [`sections.${cle}.erreur`]: message,
        updatedAt: new Date(),
      });
      return NextResponse.json({ success: false, message }, { status: 502 });
    }
  } catch (error) {
    console.error('Erreur POST /api/fle/lectures/[id]/sections/[cle]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
