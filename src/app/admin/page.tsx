'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/auth-utils';
import { useProfesseurs } from '@/hooks/useProfesseurs';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import type { CreateProfesseurData } from '@/types/professeur';
import styles from './admin.module.css';

interface AdminStats {
  professeurs: number;
  classes: number;
  eleves: number;
  devoirs: number;
  travaux: number;
  travauxSoumis: number;
  corrections: number;
  correctionsFinalisees: number;
}

export default function AdminPage() {
  const { user, isAuthenticated, isLoading: authLoading, getAuthHeaders } = useAuth();
  const router = useRouter();
  const {
    professeurs,
    isLoading: profsLoading,
    createProfesseur,
    deleteProfesseur,
  } = useProfesseurs();

  const [isReady, setIsReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Champs du formulaire
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [accessDuration, setAccessDuration] = useState<'permanent' | '1day' | '1week'>('permanent');

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Redirection si non-admin
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!isAdmin(user?.email || '')) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, authLoading, user, router]);

  // Charger les stats
  const fetchStats = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch('/api/admin/stats', { headers });
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {
      // Silently fail
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (isAuthenticated) fetchStats();
  }, [isAuthenticated, fetchStats]);

  const resetForm = () => {
    setNom('');
    setPrenom('');
    setEmail('');
    setAccessDuration('permanent');
  };

  const computeExpiresAt = (duration: 'permanent' | '1day' | '1week'): string | null => {
    if (duration === 'permanent') return null;
    const now = new Date();
    if (duration === '1day') now.setDate(now.getDate() + 1);
    if (duration === '1week') now.setDate(now.getDate() + 7);
    return now.toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim() || !email.trim()) return;

    setIsSubmitting(true);
    try {
      const data: CreateProfesseurData = {
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim(),
        expiresAt: computeExpiresAt(accessDuration),
      };
      await createProfesseur(data);
      const durationLabel =
        accessDuration === '1day' ? ' (accès 1 jour)' :
        accessDuration === '1week' ? ' (accès 1 semaine)' : '';
      setMessage({ text: `Professeur ajouté${durationLabel}`, type: 'success' });
      resetForm();
      setShowForm(false);
      fetchStats();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Erreur lors de l\'ajout',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, displayName: string) => {
    if (!confirm(`Supprimer le professeur "${displayName}" ?`)) return;

    try {
      await deleteProfesseur(id);
      setMessage({ text: 'Professeur supprimé', type: 'success' });
      fetchStats();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Erreur lors de la suppression',
        type: 'error',
      });
    }
  };

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (authLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span>Chargement...</span>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-BE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getExpirationLabel = (expiresAt?: string | null) => {
    if (!expiresAt) return null;
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expiré';
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Expire demain';
    return `Expire dans ${diffDays} jours`;
  };

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="prof" />

      <main className={styles.mainContent}>
        <h1 className={styles.pageTitle}>Administration du site</h1>

        {message && (
          <div className={`${styles.message} ${message.type === 'success' ? styles.messageSuccess : styles.messageError}`}>
            {message.text}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <section className={styles.statsSection}>
            <h2 className={styles.sectionTitle}>Vue d&apos;ensemble</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats.professeurs}</span>
                <span className={styles.statLabel}>Professeurs</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats.classes}</span>
                <span className={styles.statLabel}>Classes</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats.eleves}</span>
                <span className={styles.statLabel}>Élèves</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats.devoirs}</span>
                <span className={styles.statLabel}>Devoirs</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {stats.travauxSoumis}<span className={styles.statTotal}>/{stats.travaux}</span>
                </span>
                <span className={styles.statLabel}>Travaux soumis</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {stats.correctionsFinalisees}<span className={styles.statTotal}>/{stats.corrections}</span>
                </span>
                <span className={styles.statLabel}>Corrections finalisées</span>
              </div>
            </div>
          </section>
        )}

        {/* Professeurs */}
        <section className={styles.professeursSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Professeurs</h2>
            {!showForm && (
              <button
                type="button"
                className={styles.addButton}
                onClick={() => setShowForm(true)}
              >
                + Nouveau professeur
              </button>
            )}
          </div>

          <div className={styles.professeursGrid}>
            {profsLoading ? (
              <div className={styles.emptyState}>Chargement...</div>
            ) : professeurs.length === 0 ? (
              <div className={styles.emptyState}>
                Aucun professeur enregistré. Ajoutez-en un pour commencer.
              </div>
            ) : (
              professeurs.map((prof) => {
                const expirationLabel = getExpirationLabel(prof.expiresAt);
                return (
                  <div key={prof.id} className={styles.profCard}>
                    <h3 className={styles.profName}>{prof.prenom} {prof.nom}</h3>
                    <p className={styles.profEmail}>{prof.email}</p>
                    {expirationLabel && (
                      <span className={styles.expirationBadge}>{expirationLabel}</span>
                    )}
                    <div className={styles.profFooter}>
                      <span className={styles.profDate}>Ajouté le {formatDate(prof.createdAt)}</span>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => handleDelete(prof.id, `${prof.prenom} ${prof.nom}`)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {showForm && (
          <section className={styles.formSection}>
            <h3 className={styles.formTitle}>Nouveau professeur</h3>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="prof-nom">Nom</label>
                  <input
                    id="prof-nom"
                    type="text"
                    className={styles.formInput}
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Dupont"
                    required
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="prof-prenom">Prénom</label>
                  <input
                    id="prof-prenom"
                    type="text"
                    className={styles.formInput}
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Marie"
                    required
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="prof-email">Adresse email</label>
                  <input
                    id="prof-email"
                    type="email"
                    className={styles.formInput}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="marie.dupont@exemple.be"
                    required
                  />
                </div>
              </div>

              <div className={styles.durationField}>
                <label className={styles.formLabel}>Durée de l&apos;accès</label>
                <div className={styles.durationOptions}>
                  <label className={`${styles.durationOption} ${accessDuration === 'permanent' ? styles.durationActive : ''}`}>
                    <input
                      type="radio"
                      name="duration"
                      value="permanent"
                      checked={accessDuration === 'permanent'}
                      onChange={() => setAccessDuration('permanent')}
                      className={styles.durationRadio}
                    />
                    Permanent
                  </label>
                  <label className={`${styles.durationOption} ${accessDuration === '1day' ? styles.durationActive : ''}`}>
                    <input
                      type="radio"
                      name="duration"
                      value="1day"
                      checked={accessDuration === '1day'}
                      onChange={() => setAccessDuration('1day')}
                      className={styles.durationRadio}
                    />
                    1 jour
                  </label>
                  <label className={`${styles.durationOption} ${accessDuration === '1week' ? styles.durationActive : ''}`}>
                    <input
                      type="radio"
                      name="duration"
                      value="1week"
                      checked={accessDuration === '1week'}
                      onChange={() => setAccessDuration('1week')}
                      className={styles.durationRadio}
                    />
                    1 semaine
                  </label>
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isSubmitting || !nom.trim() || !prenom.trim() || !email.trim()}
                >
                  {isSubmitting ? 'Ajout en cours...' : 'Ajouter'}
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => { setShowForm(false); resetForm(); }}
                >
                  Annuler
                </button>
              </div>
            </form>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
