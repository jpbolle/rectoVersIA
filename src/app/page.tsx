'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { isAuthenticated, isLoading, role } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (isLoading || redirecting) return;

    if (!isAuthenticated) {
      setRedirecting(true);
      router.replace('/login');
      return;
    }

    setRedirecting(true);
    if (role === 'prof') {
      router.replace('/dashboard');
    } else {
      // L'élève entre par sa page d'accueil : ses retards et sa progression
      // avant la liste de ses activités (2026-08-17)
      router.replace('/accueil');
    }
  }, [isAuthenticated, isLoading, role, router, redirecting]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '4px solid #e8eaed',
        borderTop: '4px solid #1a73e8',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
