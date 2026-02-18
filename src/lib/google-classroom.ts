import { google } from 'googleapis';

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  courseState?: string;
}

export interface ClassroomStudent {
  userId: string;
  fullName: string;
  emailAddress: string;
  givenName?: string;
  familyName?: string;
}

/**
 * Récupère la liste des classes Google Classroom de l'utilisateur
 * @param accessToken Token OAuth2 de l'utilisateur avec scope classroom.courses.readonly
 */
export async function getClassroomCourses(accessToken: string): Promise<ClassroomCourse[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

  try {
    const response = await classroom.courses.list({
      teacherId: 'me',
      courseStates: ['ACTIVE'],
      pageSize: 100,
    });

    const courses = response.data.courses || [];

    return courses.map((course) => ({
      id: course.id || '',
      name: course.name || '',
      section: course.section || undefined,
      descriptionHeading: course.descriptionHeading || undefined,
      courseState: course.courseState || undefined,
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des classes Classroom:', error);
    throw error;
  }
}

/**
 * Récupère la liste des élèves d'une classe Google Classroom
 * @param accessToken Token OAuth2 de l'utilisateur avec scope classroom.rosters.readonly
 * @param courseId ID de la classe Classroom
 */
export async function getClassroomStudents(
  accessToken: string,
  courseId: string
): Promise<ClassroomStudent[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

  try {
    const students: ClassroomStudent[] = [];
    let pageToken: string | undefined;

    console.log('getClassroomStudents: Fetching students for course:', courseId);

    do {
      console.log('getClassroomStudents: Calling courses.students.list...');
      const response = await classroom.courses.students.list({
        courseId,
        pageSize: 100,
        pageToken,
      });

      console.log('getClassroomStudents: Full API response:', JSON.stringify(response.data, null, 2));
      console.log('getClassroomStudents: Students in response:', response.data.students?.length || 0);

      const studentsList = response.data.students || [];

      for (const student of studentsList) {
        if (student.profile) {
          students.push({
            userId: student.userId || '',
            fullName: student.profile.name?.fullName || '',
            emailAddress: student.profile.emailAddress || '',
            givenName: student.profile.name?.givenName || undefined,
            familyName: student.profile.name?.familyName || undefined,
          });
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    console.log('getClassroomStudents: Total students found:', students.length);
    return students;
  } catch (error: unknown) {
    console.error('Erreur lors de la récupération des élèves Classroom:', error);

    // Log plus détaillé pour les erreurs Google API
    if (error && typeof error === 'object') {
      const err = error as { response?: { status?: number; data?: unknown }; message?: string };
      console.error('Error details:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });

      // Si c'est une erreur 403, c'est probablement un problème de scope
      if (err.response?.status === 403) {
        console.error('ERREUR 403: Le scope classroom.rosters.readonly n\'est probablement pas autorisé');
      }
    }

    throw error;
  }
}
