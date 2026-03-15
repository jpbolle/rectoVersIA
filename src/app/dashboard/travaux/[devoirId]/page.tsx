'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import UserAvatar from '@/components/UserAvatar';
import type { Devoir } from '@/types/devoir';
import type { Travail } from '@/types/travail';
import type { Correction } from '@/types/correction';
import Link from 'next/link';
import Footer from '@/components/Footer/Footer';
import styles from './travaux.module.css';

export default function TravauxPage() {
  const params = useParams();
  const router = useRouter();
  const devoirId = params.devoirId as string;

  const { isAuthenticated, role, isLoading: authLoading, getAuthHeaders } = useAuth();
  const [devoir, setDevoir] = useState<Devoir | null>(null);
  const [travaux, setTravaux] = useState<Travail[]>([]);
  const [corrections, setCorrections] = useState<Map<string, Correction>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!authLoading && role !== 'prof') {
      router.replace('/dashboard');
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    async function fetchData() {
      const headers = await getAuthHeaders();
      if (!headers) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch devoir
        const devoirRes = await fetch(`/api/devoirs/${devoirId}`, { headers });
        const devoirJson = await devoirRes.json();

        if (devoirJson.success) {
          setDevoir(devoirJson.data);
        } else {
          setError('Devoir non trouve');
          return;
        }

        // Fetch travaux + corrections en parallèle
        const [travauxRes, correctionsRes] = await Promise.all([
          fetch(`/api/travaux?devoirId=${devoirId}`, { headers }),
          fetch(`/api/corrections?devoirId=${devoirId}`, { headers }),
        ]);

        const travauxJson = await travauxRes.json();
        if (travauxJson.success) {
          setTravaux(travauxJson.data);
        }

        const correctionsJson = await correctionsRes.json();
        if (correctionsJson.success && Array.isArray(correctionsJson.data)) {
          const map = new Map<string, Correction>();
          for (const c of correctionsJson.data) {
            map.set(c.travailId, c);
          }
          setCorrections(map);
        }
      } catch (err) {
        console.error('Erreur fetch data:', err);
        setError('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    }

    if (isAuthenticated && role === 'prof') {
      fetchData();
    }
  }, [isAuthenticated, role, devoirId, getAuthHeaders]);

  // Déterminer si un travail est en retard
  const isLate = useCallback(
    (travail: Travail) => {
      if (!devoir?.dateRemise || !travail.submittedAt) return false;
      const deadline = new Date(devoir.dateRemise);
      // Fin de journée de la date de remise
      deadline.setHours(23, 59, 59, 999);
      return new Date(travail.submittedAt) > deadline;
    },
    [devoir]
  );

  // Detecter si un travail n'a pas ete ouvert par l'eleve
  const isNotOpened = useCallback((travail: Travail) => {
    return travail.status === 'draft' && travail.content === '';
  }, []);

  // Separer et trier les travaux en 3 groupes
  const { travauxNonOuverts, travauxNonCorriges, travauxCorriges } = useMemo(() => {
    const nonOuverts: Travail[] = [];
    const nonCorriges: Travail[] = [];
    const corriges: Travail[] = [];

    for (const t of travaux) {
      const correction = corrections.get(t.id);
      if (isNotOpened(t)) {
        nonOuverts.push(t);
      } else if (correction && correction.score > 0) {
        corriges.push(t);
      } else {
        nonCorriges.push(t);
      }
    }

    // Non ouverts : tri par nom
    nonOuverts.sort((a, b) => a.studentName.localeCompare(b.studentName));

    // Non corrigés : à temps d'abord, puis en retard
    nonCorriges.sort((a, b) => {
      const aLate = isLate(a) ? 1 : 0;
      const bLate = isLate(b) ? 1 : 0;
      if (aLate !== bLate) return aLate - bLate;
      // Sous-tri par nom
      return a.studentName.localeCompare(b.studentName);
    });

    // Corrigés : tri par nom
    corriges.sort((a, b) => a.studentName.localeCompare(b.studentName));

    return { travauxNonOuverts: nonOuverts, travauxNonCorriges: nonCorriges, travauxCorriges: corriges };
  }, [travaux, corrections, isLate, isNotOpened]);

  const handleCopyCode = useCallback(() => {
    if (!devoir?.codeAcces) return;
    navigator.clipboard.writeText(devoir.codeAcces);
    setCodeCopied(true);
    clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => setCodeCopied(false), 2000);
  }, [devoir?.codeAcces]);

  const handleBack = () => {
    router.push('/dashboard');
  };

  if (authLoading || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span>Chargement...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <span>⚠️</span>
        <h2>Erreur</h2>
        <p>{error}</p>
        <button onClick={handleBack} className={styles.backButton}>
          Retour au tableau de bord
        </button>
      </div>
    );
  }

  const notOpenedCount = travauxNonOuverts.length;
  const submittedCount = travaux.filter((t) => t.status === 'submitted').length;
  const draftCount = travaux.filter((t) => t.status === 'draft' && t.content !== '').length;

  const renderCard = (travail: Travail) => {
    const correction = corrections.get(travail.id);
    const hasScore = correction && correction.score > 0;
    const late = isLate(travail);
    const notOpened = isNotOpened(travail);

    return (
      <div
        key={travail.id}
        className={`${styles.travailCard} ${notOpened ? styles.travailCardNotOpened : ''}`}
        onClick={() => router.push(`/dashboard/travaux/${devoirId}/${travail.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && router.push(`/dashboard/travaux/${devoirId}/${travail.id}`)}
      >
        <div className={styles.travailHeader}>
          <div className={styles.headerTags}>
            <span className={styles.studentName}>{travail.studentName}</span>
            {notOpened ? (
              <span className={`${styles.statusBadge} ${styles.statusNotOpened}`}>
                Non ouvert
              </span>
            ) : (
              <span
                className={`${styles.statusBadge} ${
                  travail.status === 'submitted' ? styles.statusSubmitted : styles.statusDraft
                }`}
              >
                {travail.status === 'submitted' ? 'Remis' : 'Brouillon'}
              </span>
            )}
            {late && <span className={styles.lateBadge}>En retard</span>}
          </div>
          {hasScore && (
            <span className={styles.scoreBubble}>{correction.score}%</span>
          )}
        </div>
        {!notOpened && (
          <div className={styles.travailMeta}>
            <span className={styles.date}>
              {travail.submittedAt
                ? `Remis le ${new Date(travail.submittedAt).toLocaleDateString('fr-BE')}`
                : `Modifié le ${new Date(travail.updatedAt).toLocaleDateString('fr-BE')}`}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.logoLink}>
            <img src="/logoRecto.png" alt="Recto-VersIA" className={styles.logoImg} />
          </Link>
          <button className={styles.backBtn} onClick={handleBack}>
            ←
          </button>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>{devoir?.intitule || 'Travaux'}</h1>
            <p className={styles.subtitle}>Travaux des élèves</p>
            {devoir?.codeAcces && (
              <button
                className={styles.codeAccesBadge}
                onClick={handleCopyCode}
                title="Copier le code d'accès"
              >
                Code extension : <strong>{devoir.codeAcces}</strong>
                <span className={styles.codeAccesCopy}>
                  {codeCopied ? '✓' : '⎘'}
                </span>
              </button>
            )}
          </div>
        </div>
        <div className={styles.headerRight}>
          <UserAvatar />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{travaux.length}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValueSuccess}>{submittedCount}</span>
            <span className={styles.statLabel}>Remis</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValueWarning}>{draftCount}</span>
            <span className={styles.statLabel}>Brouillons</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValueNotOpened}>{notOpenedCount}</span>
            <span className={styles.statLabel}>Non ouverts</span>
          </div>
        </div>

        {travaux.length === 0 ? (
          <div className={styles.empty}>
            <span>📝</span>
            <p>Aucun élève dans les classes de ce devoir.</p>
          </div>
        ) : (
          <div className={styles.columns}>
            {/* Colonne gauche : non ouverts */}
            <div className={styles.column}>
              <h3 className={`${styles.columnTitle} ${styles.columnTitleNotOpened}`}>
                🔒 Non ouvert par l&apos;élève
                <span className={styles.columnCount}>{travauxNonOuverts.length}</span>
              </h3>
              {travauxNonOuverts.length === 0 ? (
                <p className={styles.columnEmpty}>Tous les élèves ont ouvert leur copie.</p>
              ) : (
                <div className={styles.travauxList}>
                  {travauxNonOuverts.map(renderCard)}
                </div>
              )}
            </div>

            {/* Colonne centrale : à corriger */}
            <div className={styles.column}>
              <h3 className={styles.columnTitle}>
                📝 À corriger
                <span className={styles.columnCount}>{travauxNonCorriges.length}</span>
              </h3>
              {travauxNonCorriges.length === 0 ? (
                <p className={styles.columnEmpty}>Aucun travail à corriger.</p>
              ) : (
                <div className={styles.travauxList}>
                  {travauxNonCorriges.map(renderCard)}
                </div>
              )}
            </div>

            {/* Colonne droite : corrigés */}
            <div className={styles.column}>
              <h3 className={`${styles.columnTitle} ${styles.columnTitleCorrected}`}>
                ✅ Corrigés
                <span className={styles.columnCount}>{travauxCorriges.length}</span>
              </h3>
              {travauxCorriges.length === 0 ? (
                <p className={styles.columnEmpty}>Aucun travail corrigé pour l&apos;instant.</p>
              ) : (
                <div className={styles.travauxList}>
                  {travauxCorriges.map(renderCard)}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
