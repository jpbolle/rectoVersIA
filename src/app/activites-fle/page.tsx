'use client';

// « Mes activités FLE » = Mes Activités en espace FLE (JP, 2026-10-08) : cette
// adresse pose l'espace et renvoie au tableau de bord.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEspace } from '@/context/EspaceContext';

export default function ActivitesFleRedirect() {
  const router = useRouter();
  const { setEspace } = useEspace();
  useEffect(() => {
    setEspace('fle');
    router.replace('/dashboard');
  }, [router, setEspace]);
  return null;
}
