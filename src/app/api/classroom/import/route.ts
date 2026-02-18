import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateClasseId, generateEleveId, getCurrentAnneeScolaire } from '@/lib/classe-utils';
import { getClassroomStudents } from '@/lib/google-classroom';

interface ImportRequest {
  courseId: string;
  courseName: string;
  courseSection?: string;
}

// POST - Importer une classe depuis Google Classroom
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

  // Récupérer le Google Access Token depuis le header
  const googleAccessToken = request.headers.get('X-Google-Access-Token');
  if (!googleAccessToken) {
    return NextResponse.json(
      { success: false, message: 'Token Google Classroom manquant' },
      { status: 400 }
    );
  }

  try {
    const body: ImportRequest = await request.json();

    if (!body.courseId || !body.courseName) {
      return NextResponse.json(
        { success: false, message: 'ID et nom de la classe requis' },
        { status: 400 }
      );
    }

    // Vérifier si la classe n'existe pas déjà (par googleClassroomId)
    const existingClasse = await adminDb
      .collection('classes')
      .where('profId', '==', auth.uid)
      .where('googleClassroomId', '==', body.courseId)
      .get();

    if (!existingClasse.empty) {
      return NextResponse.json(
        { success: false, message: 'Cette classe a déjà été importée' },
        { status: 409 }
      );
    }

    // Récupérer les élèves de la classe Classroom
    console.log('Import: Récupération des élèves pour le cours:', body.courseId);
    const classroomStudents = await getClassroomStudents(googleAccessToken, body.courseId);
    console.log('Import: Nombre d\'élèves trouvés:', classroomStudents.length);

    // Créer la classe dans Firestore
    const now = new Date();
    const classeId = generateClasseId();
    const classeName = body.courseSection
      ? `${body.courseName} - ${body.courseSection}`
      : body.courseName;

    const classe = {
      nom: classeName,
      description: `Importée depuis Google Classroom`,
      profId: auth.uid,
      anneeScolaire: getCurrentAnneeScolaire(),
      archive: false,
      googleClassroomId: body.courseId,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('classes').doc(classeId).set(classe);

    // Créer les élèves dans Firestore
    const batch = adminDb.batch();
    const importedStudents: { nom: string; prenom: string; email: string }[] = [];

    for (const student of classroomStudents) {
      const eleveId = generateEleveId();
      const eleveRef = adminDb.collection('eleves').doc(eleveId);

      // Extraire nom et prénom
      const prenom = student.givenName || student.fullName.split(' ')[0] || '';
      const nom = student.familyName || student.fullName.split(' ').slice(1).join(' ') || '';

      // Utiliser l'email si disponible, sinon générer un placeholder
      const email = student.emailAddress
        ? student.emailAddress.toLowerCase()
        : `${prenom.toLowerCase()}.${(nom || student.fullName).toLowerCase().replace(/\s+/g, '')}@cnddinant.be`;

      batch.set(eleveRef, {
        nom: nom || student.fullName,
        prenom,
        email,
        classeId,
        googleClassroomId: student.userId,
        createdAt: now,
      });

      importedStudents.push({
        nom: nom || student.fullName,
        prenom,
        email,
      });
    }

    if (importedStudents.length > 0) {
      await batch.commit();
      console.log('Import: Élèves créés dans Firestore:', importedStudents.length);
    } else {
      console.log('Import: Aucun élève à créer');
    }

    return NextResponse.json({
      success: true,
      data: {
        classe: {
          id: classeId,
          nom: classeName,
          description: classe.description,
          profId: auth.uid,
          anneeScolaire: classe.anneeScolaire,
          archive: false,
          googleClassroomId: body.courseId,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        studentsCount: importedStudents.length,
        students: importedStudents,
      },
    });
  } catch (error: unknown) {
    console.error('Erreur POST classroom import:', error);

    // Gérer les erreurs d'autorisation Google
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as { code: number }).code;
      if (errorCode === 401 || errorCode === 403) {
        return NextResponse.json(
          { success: false, message: 'Autorisation Google Classroom requise' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { success: false, message: 'Erreur lors de l\'import de la classe' },
      { status: 500 }
    );
  }
}
