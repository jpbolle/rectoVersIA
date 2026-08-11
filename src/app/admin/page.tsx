'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/auth-utils';
import { useProfesseurs } from '@/hooks/useProfesseurs';
import Header from '@/components/Header/Header';
import type { AdminHeaderTab } from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import DidactiquePanel from '@/components/DidactiquePanel/DidactiquePanel';
import type { CreateProfesseurData } from '@/types/professeur';
import styles from './admin.module.css';

interface ClasseStat { id: string; nom: string; nbEleves: number; }
interface DevoirStat { id: string; titre: string; accesIA: boolean; nbSoumis: number; nbCorrections: number; nbGridIA: number; }
interface GrilleStat { id: string; nom: string; nbCriteres: number; }
interface ProfStats {
  classes: ClasseStat[];
  devoirs: DevoirStat[];
  grilles: GrilleStat[];
  aiStats: { devoirsAvecIA: number; totalGridIA: number };
}

interface AdminStats {
  professeurs: number;
  classes: number;
  eleves: number;
  devoirs: number;
  travaux: number;
  travauxSoumis: number;
  corrections: number;
  correctionsFinalisees: number;
  // Compteurs d'usage IA (onglet « Gestion des coûts »)
  ia?: {
    gridEvaluations: number;
    devoirsAvecIA: number;
    dictionaryEntries: number;
  };
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
  // Onglet actif, piloté par les boutons du header (variant admin)
  const [activeTab, setActiveTab] = useState<AdminHeaderTab>('vue');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Panel stats prof
  const [selectedProfEmail, setSelectedProfEmail] = useState<string | null>(null);
  const [profStats, setProfStats] = useState<ProfStats | null>(null);
  const [profStatsLoading, setProfStatsLoading] = useState(false);

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
    if (authLoading && !isAuthenticated) return;
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

  const openProfPanel = useCallback(async (profEmail: string) => {
    setSelectedProfEmail(profEmail);
    setProfStats(null);
    setProfStatsLoading(true);
    const headers = await getAuthHeaders();
    if (!headers) { setProfStatsLoading(false); return; }
    try {
      const res = await fetch(`/api/admin/prof-stats/${encodeURIComponent(profEmail)}`, { headers });
      const json = await res.json();
      if (json.success) setProfStats(json.data);
    } catch {
      // Silently fail
    } finally {
      setProfStatsLoading(false);
    }
  }, [getAuthHeaders]);

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

  if (authLoading && !isAuthenticated) {
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
      <Header variant="admin" adminTab={activeTab} onAdminTabChange={setActiveTab} />

      <main className={styles.mainContent}>
        <h1 className={styles.pageTitle}>Administration du site</h1>

        {message && (
          <div className={`${styles.message} ${message.type === 'success' ? styles.messageSuccess : styles.messageError}`}>
            {message.text}
          </div>
        )}

        {/* Stats — onglet Vue d'ensemble */}
        {activeTab === 'vue' && stats && (
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

        {/* Didactique du français : UAA + gestes (listes dynamiques des formulaires) */}
        {activeTab === 'didactique' && <DidactiquePanel />}

        {/* Gestion des coûts : usage de l'IA */}
        {activeTab === 'couts' && (
          <section className={styles.statsSection}>
            <h2 className={styles.sectionTitle}>Usage de l&apos;IA</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats?.ia?.gridEvaluations ?? '—'}</span>
                <span className={styles.statLabel}>Évaluations IA de grilles</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats?.ia?.devoirsAvecIA ?? '—'}</span>
                <span className={styles.statLabel}>Devoirs avec IA activée</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats?.ia?.dictionaryEntries ?? '—'}</span>
                <span className={styles.statLabel}>Mots en cache dictionnaire</span>
              </div>
            </div>
            <p className={styles.coutsNote}>
              Ces compteurs mesurent l&apos;usage, pas la dépense : les appels à Claude et
              Whisper ne sont pas encore comptabilisés en tokens ni en euros. Un suivi
              détaillé des coûts par appel reste à mettre en place.
            </p>
          </section>
        )}

        {/* Professeurs */}
        {activeTab === 'membres' && (
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
                const isSelected = selectedProfEmail === prof.email;
                return (
                  <div
                    key={prof.id}
                    className={`${styles.profCard} ${isSelected ? styles.profCardSelected : ''}`}
                    onClick={() => openProfPanel(prof.email)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openProfPanel(prof.email)}
                  >
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
                        onClick={(e) => { e.stopPropagation(); handleDelete(prof.id, `${prof.prenom} ${prof.nom}`); }}
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
        )}

        {/* Panel stats prof */}
        {activeTab === 'membres' && selectedProfEmail && (
          <section className={styles.profStatsPanel}>
            <div className={styles.profStatsPanelHeader}>
              <h2 className={styles.sectionTitle}>
                Statistiques — {professeurs.find(p => p.email === selectedProfEmail)?.prenom}{' '}
                {professeurs.find(p => p.email === selectedProfEmail)?.nom}
              </h2>
              <button
                type="button"
                className={styles.closePanelBtn}
                onClick={() => { setSelectedProfEmail(null); setProfStats(null); }}
              >
                ✕
              </button>
            </div>

            {profStatsLoading && <div className={styles.panelLoading}>Chargement...</div>}

            {!profStatsLoading && profStats && (
              <div className={styles.profStatsContent}>
                {/* IA résumé */}
                {profStats.aiStats.devoirsAvecIA > 0 && (
                  <div className={styles.aiSummaryBar}>
                    <span>🤖</span>
                    <span>
                      <strong>{profStats.aiStats.devoirsAvecIA}</strong> devoir{profStats.aiStats.devoirsAvecIA > 1 ? 's' : ''} avec IA activée
                      {profStats.aiStats.totalGridIA > 0 && (
                        <> · <strong>{profStats.aiStats.totalGridIA}</strong> évaluation{profStats.aiStats.totalGridIA > 1 ? 's' : ''} IA de grille utilisée{profStats.aiStats.totalGridIA > 1 ? 's' : ''}</>
                      )}
                    </span>
                  </div>
                )}

                <div className={styles.profStatsColumns}>
                  {/* Classes */}
                  <div className={styles.profStatBlock}>
                    <h3 className={styles.profStatBlockTitle}>Classes ({profStats.classes.length})</h3>
                    {profStats.classes.length === 0 ? (
                      <p className={styles.profStatEmpty}>Aucune classe</p>
                    ) : (
                      <ul className={styles.profStatList}>
                        {profStats.classes.map((c) => (
                          <li key={c.id} className={styles.profStatItem}>
                            <span className={styles.profStatItemName}>{c.nom}</span>
                            <span className={styles.profStatItemMeta}>{c.nbEleves} élève{c.nbEleves > 1 ? 's' : ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Grilles */}
                  <div className={styles.profStatBlock}>
                    <h3 className={styles.profStatBlockTitle}>Grilles ({profStats.grilles.length})</h3>
                    {profStats.grilles.length === 0 ? (
                      <p className={styles.profStatEmpty}>Aucune grille</p>
                    ) : (
                      <ul className={styles.profStatList}>
                        {profStats.grilles.map((g) => (
                          <li key={g.id} className={styles.profStatItem}>
                            <span className={styles.profStatItemName}>{g.nom}</span>
                            <span className={styles.profStatItemMeta}>{g.nbCriteres} critère{g.nbCriteres > 1 ? 's' : ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Devoirs */}
                <div className={styles.profStatBlock}>
                  <h3 className={styles.profStatBlockTitle}>Devoirs ({profStats.devoirs.length})</h3>
                  {profStats.devoirs.length === 0 ? (
                    <p className={styles.profStatEmpty}>Aucun devoir</p>
                  ) : (
                    <div className={styles.devoirsTable}>
                      <div className={styles.devoirsTableHead}>
                        <span>Titre</span>
                        <span>Soumis</span>
                        <span>Corrections</span>
                        <span>Grille IA</span>
                        <span>IA</span>
                      </div>
                      {profStats.devoirs.map((d) => (
                        <div key={d.id} className={styles.devoirsTableRow}>
                          <span className={styles.devoirTitre}>{d.titre}</span>
                          <span className={styles.devoirStat}>{d.nbSoumis}</span>
                          <span className={styles.devoirStat}>{d.nbCorrections}</span>
                          <span className={styles.devoirStat}>{d.accesIA ? d.nbGridIA : '—'}</span>
                          <span>{d.accesIA ? <span className={styles.iaBadge}>✓</span> : <span className={styles.iaOff}>—</span>}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'membres' && showForm && (
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
