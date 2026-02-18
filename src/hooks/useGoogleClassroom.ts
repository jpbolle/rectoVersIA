'use client';

import { useState, useCallback } from 'react';
import { GoogleAuthProvider, signInWithPopup, getAuth } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
}

export interface ImportResult {
  classe: {
    id: string;
    nom: string;
    description?: string;
  };
  studentsCount: number;
}

interface UseGoogleClassroomReturn {
  isLoading: boolean;
  isAuthorized: boolean;
  courses: ClassroomCourse[];
  error: string | null;
  authorizeClassroom: () => Promise<boolean>;
  fetchCourses: () => Promise<ClassroomCourse[]>;
  importCourse: (courseId: string, courseName: string, courseSection?: string) => Promise<ImportResult | null>;
  reset: () => void;
}

// Scopes nécessaires pour Google Classroom
const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
];

export function useGoogleClassroom(): UseGoogleClassroomReturn {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const getFirebaseIdToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }, [user]);

  const authorizeClassroom = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const auth = getAuth(getFirebaseApp());
      const provider = new GoogleAuthProvider();

      // Ajouter les scopes Classroom
      CLASSROOM_SCOPES.forEach((scope) => {
        provider.addScope(scope);
      });

      // Forcer la sélection du compte et le consentement
      provider.setCustomParameters({
        prompt: 'consent',
      });

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      console.log('OAuth result:', {
        user: result.user.email,
        providerId: credential?.providerId,
        hasAccessToken: !!credential?.accessToken,
      });

      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        setIsAuthorized(true);
        console.log('Access token obtained successfully');
        return true;
      }

      setError('Impossible de récupérer le token d\'accès. Assurez-vous d\'autoriser l\'accès à Google Classroom.');
      return false;
    } catch (err: unknown) {
      console.error('Erreur autorisation Classroom:', err);
      if (err && typeof err === 'object' && 'code' in err) {
        const errorCode = (err as { code: string }).code;
        if (errorCode === 'auth/popup-closed-by-user') {
          setError('Autorisation annulée');
        } else if (errorCode === 'auth/popup-blocked') {
          setError('Popup bloquée. Veuillez autoriser les popups.');
        } else {
          setError('Erreur lors de l\'autorisation Google Classroom');
        }
      } else {
        setError('Erreur lors de l\'autorisation Google Classroom');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCourses = useCallback(async (): Promise<ClassroomCourse[]> => {
    if (!accessToken) {
      setError('Non autorisé. Veuillez d\'abord autoriser l\'accès à Google Classroom.');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const idToken = await getFirebaseIdToken();
      if (!idToken) {
        setError('Session expirée');
        return [];
      }

      const response = await fetch('/api/classroom/courses', {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-Google-Access-Token': accessToken,
        },
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || 'Erreur lors de la récupération des classes');
        return [];
      }

      setCourses(data.data);
      return data.data;
    } catch (err) {
      console.error('Erreur fetch courses:', err);
      setError('Erreur lors de la récupération des classes Classroom');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, getFirebaseIdToken]);

  const importCourse = useCallback(
    async (
      courseId: string,
      courseName: string,
      courseSection?: string
    ): Promise<ImportResult | null> => {
      if (!accessToken) {
        setError('Non autorisé. Veuillez d\'abord autoriser l\'accès à Google Classroom.');
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const idToken = await getFirebaseIdToken();
        if (!idToken) {
          setError('Session expirée');
          return null;
        }

        const response = await fetch('/api/classroom/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
            'X-Google-Access-Token': accessToken,
          },
          body: JSON.stringify({
            courseId,
            courseName,
            courseSection,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.message || 'Erreur lors de l\'import');
          return null;
        }

        return {
          classe: data.data.classe,
          studentsCount: data.data.studentsCount,
        };
      } catch (err) {
        console.error('Erreur import course:', err);
        setError('Erreur lors de l\'import de la classe');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, getFirebaseIdToken]
  );

  const reset = useCallback(() => {
    setIsAuthorized(false);
    setCourses([]);
    setError(null);
    setAccessToken(null);
  }, []);

  return {
    isLoading,
    isAuthorized,
    courses,
    error,
    authorizeClassroom,
    fetchCourses,
    importCourse,
    reset,
  };
}
