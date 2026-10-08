'use client';

// Ancienne adresse « Mes parcours FLE » (2026-10-08, matin) : devenue
// « Mes activités FLE » le soir même. `?section=theorie|activites` → Mes
// ressources FLE ; sinon le tableau de bord en espace FLE.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEspace } from '@/context/EspaceContext';

export default function ParcoursFleRedirect() {
  const router = useRouter();
  const { setEspace } = useEspace();
  useEffect(() => {
    setEspace('fle');
    const section = new URLSearchParams(window.location.search).get('section');
    router.replace(section === 'theorie' || section === 'activites' ? `/ressources-fle?section=${section}` : '/dashboard');
  }, [router, setEspace]);
  return null;
}
