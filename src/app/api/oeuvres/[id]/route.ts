// Une œuvre : son sommaire (léger), sa modification, son archivage.
// Le CONTENU des sections vit dans la sous-collection — voir
// /api/oeuvres/[id]/sections. C'est tout l'intérêt du découpage : ouvrir une
// œuvre ne télécharge que des titres.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import {
  chapitresPourFirestore,
  docToOeuvre,
  normaliserPartages,
  rafraichirSommaire,
} from '@/lib/oeuvre-server';
import { poserAnnonce } from '@/lib/annonce-server';
import { peutEditerOeuvre } from '@/types/oeuvre';
import type { Oeuvre, OeuvreChapitre } from '@/types/oeuvre';

// Comment nommer celui qui partage, dans la notification. `profName` est
// rempli à la création de l'œuvre ; en dernier recours, l'email — mieux vaut
// une adresse qu'un « quelqu'un » qui n'apprend rien au destinataire.
function auteurLisible(
  oeuvre: Oeuvre,
  auth: { email?: string | null }
): string {
  return oeuvre.profName || auth.email || 'Un collègue';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const { id } = await params;
    const snap = await adminDb.collection('oeuvres').doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    }

    const oeuvre = docToOeuvre(snap);
    // Le sommaire stocké peut avoir vieilli (une question ajoutée à une
    // section ne le met pas à jour) : on le recalcule depuis les sections.
    oeuvre.chapitres = await rafraichirSommaire(id);

    return NextResponse.json({ success: true, data: oeuvre });
  } catch (error) {
    console.error('Erreur GET /api/oeuvres/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id } = await params;
    const ref = adminDb.collection('oeuvres').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    }

    // On ne modifie que ses propres œuvres — ou celle d'un collègue qui nous
    // l'a partagée EN CO-ÉDITION. Sans partage, il faut dupliquer.
    const oeuvre = docToOeuvre(snap);
    if (!peutEditerOeuvre(oeuvre, auth)) {
      return NextResponse.json(
        { success: false, message: 'Cette œuvre appartient à un autre professeur — duplique-la pour la modifier' },
        { status: 403 }
      );
    }
    const estProprietaire = oeuvre.profId === auth.uid || auth.isAdmin;

    const body = await request.json();
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.titre === 'string' && body.titre.trim()) update.titre = body.titre.trim();
    if (typeof body.auteur === 'string') update.auteur = body.auteur.trim();
    if (typeof body.description === 'string') update.description = body.description.trim();
    // Couverture : `null` explicite pour la retirer. On ne fait confiance
    // qu'à une référence complète (url + fileId d'une ressourceImages) —
    // une URL seule ouvrirait la porte à une image hébergée n'importe où.
    if (body.couverture === null) {
      update.couverture = null;
    } else if (
      body.couverture &&
      typeof body.couverture === 'object' &&
      typeof (body.couverture as { url?: unknown }).url === 'string' &&
      typeof (body.couverture as { fileId?: unknown }).fileId === 'string'
    ) {
      const c = body.couverture as { url: string; fileId: string };
      update.couverture = { url: c.url, fileId: c.fileId };
    }
    if (typeof body.archive === 'boolean') update.archive = body.archive;
    if (auth.isAdmin && typeof body.shared === 'boolean') update.shared = body.shared;

    // Qui partage l'œuvre reste SON AUTEUR. Un co-éditeur peut remanier le
    // texte, jamais décider qui d'autre y accède — sans quoi le partage
    // s'étendrait sans que le propriétaire le sache.
    if (Array.isArray(body.partages)) {
      if (!estProprietaire) {
        return NextResponse.json(
          { success: false, message: 'Seul l’auteur de l’œuvre décide de ses partages.' },
          { status: 403 }
        );
      }
      update.partages = normaliserPartages(body.partages).filter(
        // On ne se partage pas une œuvre à soi-même
        (p) => p.email !== (auth.email || '').toLowerCase()
      );
    }

    // Qui apprend qu'on lui a partagé une œuvre ? Personne, si on ne le lui
    // dit pas : le livre apparaîtrait dans sa bibliothèque sans qu'il le sache.
    // On ne prévient QUE les nouveaux, et QUE si le mode a changé — un
    // enregistrement sans modification ne doit pas renotifier tout le monde.
    const nouveaux = Array.isArray(update.partages)
      ? (update.partages as typeof oeuvre.partages)!.filter((p) => {
          const avant = oeuvre.partages?.find((q) => q.email === p.email);
          return !avant || avant.mode !== p.mode;
        })
      : [];

    // Le sommaire est envoyé en entier quand le prof réordonne chapitres et
    // sections. Les sections elles-mêmes ne bougent pas : seul l'ordre change.
    if (Array.isArray(body.chapitres)) {
      // Même garde-fou que partout : aucun `undefined` ne part vers Firestore
      update.chapitres = chapitresPourFirestore(
        (body.chapitres as OeuvreChapitre[]).map((c) => ({
          ...c,
          sections: Array.isArray(c.sections) ? c.sections : [],
        }))
      );
    }

    await ref.update(update);

    // Après l'écriture seulement : une notification pour un partage qui aurait
    // échoué serait un mensonge. `poserAnnonce` n'échoue jamais bruyamment —
    // le partage a bien eu lieu, il ne doit pas être annulé par une cloche.
    const titre = (update.titre as string) || oeuvre.titre;
    await Promise.all(
      nouveaux.map((p) =>
        poserAnnonce({
          message:
            p.mode === 'edition'
              ? `${auteurLisible(oeuvre, auth)} t’a partagé « ${titre} » en co-édition : tu peux la donner à tes classes ET la modifier.`
              : `${auteurLisible(oeuvre, auth)} t’a partagé « ${titre} » : tu peux la donner à tes classes.`,
          cible: 'collegue',
          destinataireEmail: p.email,
          auteurUid: auth.uid,
          lien: '/grilles',
        })
      )
    );

    const apres = await ref.get();
    return NextResponse.json({ success: true, data: docToOeuvre(apres) });
  } catch (error) {
    console.error('Erreur PATCH /api/oeuvres/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id } = await params;
    const ref = adminDb.collection('oeuvres').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    }
    if (docToOeuvre(snap).profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }

    // Une œuvre peut être donnée à des activités en cours : on ARCHIVE, on ne
    // supprime pas. Les activités qui la référencent continuent de l'ouvrir.
    await ref.update({ archive: true, updatedAt: new Date() });
    return NextResponse.json({ success: true, message: 'Œuvre archivée' });
  } catch (error) {
    console.error('Erreur DELETE /api/oeuvres/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
