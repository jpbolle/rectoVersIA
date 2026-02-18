import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { getClassroomCourses } from '@/lib/google-classroom';

// GET - Liste des classes Google Classroom de l'utilisateur
export async function GET(request: NextRequest) {
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
    const courses = await getClassroomCourses(googleAccessToken);
    return NextResponse.json({ success: true, data: courses });
  } catch (error: unknown) {
    console.error('Erreur GET classroom courses:', error);

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
      { success: false, message: 'Erreur lors de la récupération des classes Classroom' },
      { status: 500 }
    );
  }
}
