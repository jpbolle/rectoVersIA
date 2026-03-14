'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { StudentProfil } from '@/types/profil';

export function useStudentProfil() {
  const { user } = useAuth();
  const [profilData, setProfilData] = useState<StudentProfil | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const userUidRef = useRef<string | null>(null);

  const fetchProfil = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/profil', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setProfilData(json.data);
      } else {
        setError(json.message || 'Erreur');
      }
    } catch (err) {
      console.error('Erreur fetch profil:', err);
      setError('Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) {
      setProfilData(null);
      setIsLoading(false);
      fetchedRef.current = false;
      userUidRef.current = null;
      return;
    }

    if (userUidRef.current === user.uid && fetchedRef.current) return;
    userUidRef.current = user.uid;
    fetchedRef.current = true;
    fetchProfil();
  }, [user, fetchProfil]);

  return { profilData, isLoading, error, refetch: fetchProfil };
}
