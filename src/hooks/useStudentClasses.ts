'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface StudentClasse {
  id: string;
  nom: string;
  description: string;
  anneeScolaire: string;
  archive: boolean;
}

export function useStudentClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<StudentClasse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);
  const userUidRef = useRef<string | null>(null);
  const userRef = useRef<typeof user>(null);

  // Keep userRef in sync — stable reference for fetchClasses
  userRef.current = user;

  const fetchClasses = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/classes/student', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setClasses(json.data);
      }
    } catch (err) {
      console.error('Erreur fetch student classes:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch une seule fois par user (basé sur uid)
  useEffect(() => {
    if (!user) {
      setClasses([]);
      setIsLoading(false);
      fetchedRef.current = false;
      userUidRef.current = null;
      return;
    }

    // Ne re-fetch que si le user a changé
    if (userUidRef.current === user.uid && fetchedRef.current) return;
    userUidRef.current = user.uid;
    fetchedRef.current = true;
    fetchClasses();
  }, [user, fetchClasses]);

  const joinClasse = async (code: string, nom: string, prenom: string) => {
    if (!user) throw new Error('Non connecté');
    const token = await user.getIdToken();
    const res = await fetch('/api/classes/join', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, nom, prenom }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.message || 'Erreur');
    }
    // Re-fetch après join
    fetchedRef.current = false;
    await fetchClasses();
    return json;
  };

  return { classes, isLoading, refetch: fetchClasses, joinClasse };
}
