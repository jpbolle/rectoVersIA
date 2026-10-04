import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { isClasseType } from '@/types/classe';
import type { Classe } from '@/types/classe';
import { accesClasseDepuisDoc, nomDuProf, normaliserPartagesClasse } from '@/lib/classe-acces';
import { poserAnnonce } from '@/lib/annonce-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Récupérer une classe
export async function GET(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const doc = await adminDb.collection('classes').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Classe non trouvée' },
        { status: 404 }
      );
    }

    const data = doc.data()!;

    // Le titulaire, ou un coprofesseur à qui la classe est partagée
    const monAcces = accesClasseDepuisDoc(data, auth);
    if (!monAcces) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    const classe: Classe = {
      id: doc.id,
      nom: data.nom || '',
      description: data.description || '',
      type: isClasseType(data.type) ? data.type : 'francais',
      profId: data.profId || '',
      anneeScolaire: data.anneeScolaire || '',
      archive: data.archive || false,
      googleClassroomId: data.googleClassroomId,
      monAcces,
      ...(monAcces === 'titulaire'
        ? { partages: normaliserPartagesClasse(data.partages) }
        : { titulaireNom: data.titulaireNom || '' }),
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
    };

    return NextResponse.json({ success: true, data: classe });
  } catch (error) {
    console.error('Erreur GET classe:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// PATCH - Modifier une classe
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const doc = await adminDb.collection('classes').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Classe non trouvée' },
        { status: 404 }
      );
    }

    const data = doc.data()!;
    if (data.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const now = new Date();
    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    if (body.nom !== undefined) updates.nom = body.nom.trim();
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.archive !== undefined) updates.archive = body.archive;
    // Changer le type d'une classe est possible (une classe créée « français »
    // par erreur) : le référentiel présenté aux nouveaux contenus suit, les
    // contenus déjà créés ne bougent pas
    if (body.type !== undefined && isClasseType(body.type)) updates.type = body.type;

    // ── COPROFESSEURS (2026-10-04) ──
    // Seul le titulaire décide (la garde ci-dessus l'assure : cette route
    // reste réservée au propriétaire de la classe). `partageEmails` double la
    // liste à plat — c'est par lui que le collègue retrouve la classe.
    // `titulaireNom` est recopié pour que le collègue sache de qui elle est,
    // sans jointure à chaque affichage.
    let nouveauxPartages: ReturnType<typeof normaliserPartagesClasse> = [];
    if (Array.isArray(body.partages)) {
      const moi = (auth.email || '').toLowerCase();
      const partages = normaliserPartagesClasse(body.partages).filter((p) => p.email !== moi);
      const avant = normaliserPartagesClasse(data.partages);
      updates.partages = partages;
      updates.partageEmails = partages.map((p) => p.email);
      // Une classe qui a eu un coprofesseur peut porter SES activités, même
      // une fois l'accès retiré : c'est tout l'objet du retour du titulaire.
      // Le marqueur ne redescend jamais (cf. `classesAccessibles`).
      if (partages.length > 0) updates.aEuDesCoprofs = true;
      updates.titulaireNom = (await nomDuProf(auth.uid)) || auth.email || '';
      // Ne prévenir que les nouveaux, ou ceux dont le mode change
      nouveauxPartages = partages.filter((q) => {
        const a = avant.find((x) => x.email === q.email);
        return !a || a.mode !== q.mode;
      });
    }

    await adminDb.collection('classes').doc(id).update(updates);

    // Après l'écriture seulement : prévenir d'un partage qui aurait échoué
    // serait mentir. `poserAnnonce` n'échoue jamais bruyamment.
    const nomClasse = (updates.nom as string) || data.nom || '';
    await Promise.all(
      nouveauxPartages.map((q) =>
        poserAnnonce({
          message:
            q.mode === 'edition'
              ? `${updates.titulaireNom} t’a ajouté comme coprofesseur de la classe « ${nomClasse} » : tu peux corriger, publier, ouvrir les activités et en créer pour elle.`
              : `${updates.titulaireNom} t’a ajouté comme coprofesseur de la classe « ${nomClasse} », en lecture : tu vois ses élèves, ses activités et ses copies.`,
          cible: 'collegue',
          destinataireEmail: q.email,
          auteurUid: auth.uid,
          lien: '/classes',
        })
      )
    );

    // Les devoirs référencent les classes par NOM : un renommage doit se
    // propager, sinon les devoirs existants deviennent invisibles pour les
    // élèves (incident forcoGosselies → forcoBraine, 2026-08-12).
    const newNom = updates.nom as string | undefined;
    if (newNom && newNom !== data.nom) {
      // Requête par profId seul (index simple), filtre du nom en code — pas
      // d'index composite requis
      const devoirsSnap = await adminDb
        .collection('devoirs')
        .where('profId', '==', auth.uid)
        .get();
      const toUpdate = devoirsSnap.docs.filter((d) =>
        Array.isArray(d.data().classes) && d.data().classes.includes(data.nom)
      );
      // Les activités d'un AUTRE prof sur cette classe (coprofesseur,
      // 2026-10-04) la nomment aussi : on les retrouve par leurs sessions,
      // sans quoi elles disparaîtraient de chez les élèves au renommage
      if (data.aEuDesCoprofs === true) {
        const sessionsSnap = await adminDb.collection('sessions').where('classeId', '==', id).get();
        const autres = [...new Set(
          sessionsSnap.docs
            .filter((d) => d.data().profId !== auth.uid)
            .map((d) => String(d.data().devoirId || ''))
            .filter(Boolean)
        )];
        const docs = autres.length
          ? await adminDb.getAll(...autres.map((d) => adminDb.collection('devoirs').doc(d)))
          : [];
        docs.forEach((d) => {
          if (d.exists && Array.isArray(d.data()!.classes) && d.data()!.classes.includes(data.nom)) {
            toUpdate.push(d as FirebaseFirestore.QueryDocumentSnapshot);
          }
        });
      }
      if (toUpdate.length > 0) {
        const batch = adminDb.batch();
        for (const devoirDoc of toUpdate) {
          const classes = (devoirDoc.data().classes as string[]).map((n) =>
            n === data.nom ? newNom : n
          );
          batch.update(devoirDoc.ref, { classes });
        }
        await batch.commit();
      }
    }

    const updatedClasse: Classe = {
      id,
      nom: (updates.nom as string) ?? data.nom,
      description: (updates.description as string) ?? data.description ?? '',
      type: isClasseType(updates.type)
        ? updates.type
        : isClasseType(data.type)
          ? data.type
          : 'francais',
      profId: data.profId,
      anneeScolaire: data.anneeScolaire,
      archive: (updates.archive as boolean) ?? data.archive ?? false,
      googleClassroomId: data.googleClassroomId,
      partages: Array.isArray(updates.partages)
        ? (updates.partages as ReturnType<typeof normaliserPartagesClasse>)
        : normaliserPartagesClasse(data.partages),
      monAcces: 'titulaire',
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
      updatedAt: now.toISOString(),
    };

    return NextResponse.json({ success: true, data: updatedClasse });
  } catch (error) {
    console.error('Erreur PATCH classe:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer une classe (et ses élèves)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const doc = await adminDb.collection('classes').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Classe non trouvée' },
        { status: 404 }
      );
    }

    const data = doc.data()!;
    if (data.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    // Supprimer tous les élèves de la classe
    const elevesSnapshot = await adminDb
      .collection('eleves')
      .where('classeId', '==', id)
      .get();

    const batch = adminDb.batch();
    elevesSnapshot.forEach((eleveDoc) => {
      batch.delete(eleveDoc.ref);
    });
    batch.delete(adminDb.collection('classes').doc(id));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE classe:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
