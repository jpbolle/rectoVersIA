'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/auth-utils';
import { useProfesseurs } from '@/hooks/useProfesseurs';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import type { CreateProfesseurData } from '@/types/professeur';
import styles from './admin.module.css';

export default function AdminPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
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

  // Champs du formulaire
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');

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

  const resetForm = () => {
    setNom('');
    setPrenom('');
    setEmail('');
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
      };
      await createProfesseur(data);
      setMessage({ text: 'Professeur ajouté', type: 'success' });
      resetForm();
      setShowForm(false);
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
              professeurs.map((prof) => (
                <div key={prof.id} className={styles.profCard}>
                  <h3 className={styles.profName}>{prof.prenom} {prof.nom}</h3>
                  <p className={styles.profEmail}>{prof.email}</p>
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
              ))
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
