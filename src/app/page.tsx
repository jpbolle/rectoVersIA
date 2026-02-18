'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { isAuthenticated, isLoading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (role === 'prof') {
      router.replace('/dashboard');
    } else if (role === 'eleve') {
      router.replace('/activites');
    }
  }, [isAuthenticated, isLoading, role, router]);

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
