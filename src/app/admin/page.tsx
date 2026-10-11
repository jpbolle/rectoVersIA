'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/auth-utils';
import { useProfesseurs } from '@/hooks/useProfesseurs';
import Header, { ADMIN_TABS } from '@/components/Header/Header';
import type { AdminHeaderTab } from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import DidactiquePanel from '@/components/DidactiquePanel/DidactiquePanel';
import AffichagePanel from '@/components/AffichagePanel/AffichagePanel';
import DidactiqueFlePanel from '@/components/DidactiquePanel/DidactiqueFlePanel';
import AnnonceModal from '@/components/AnnonceModal/AnnonceModal';
import ProfFiche from '@/components/ProfFiche/ProfFiche';
import { Pencil, Trash2 } from 'lucide-react';
import type { ActiviteProf } from '@/app/api/admin/profs-activite/route';
import type { CreateProfesseurData } from '@/types/professeur';
import { CIBLE_LABELS } from '@/types/annonce';
import type { Annonce, AnnonceCible } from '@/types/annonce';
import popup from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
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
    updateProfesseur,
    deleteProfesseur,
  } = useProfesseurs();

  const [isReady, setIsReady] = useState(false);
  // Onglet actif, piloté par les boutons du header (variant admin)
  const [activeTab, setActiveTab] = useState<AdminHeaderTab>('vue');
  // Gestion didactique : deux référentiels, celui du cours de français (UAA,
  // habiletés) et celui des classes FLE (compétences du CECR, niveaux)
  const [referentiel, setReferentiel] = useState<'francais' | 'fle'>('francais');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Annonces poussées dans la cloche
  const [annonces, setAnnonces] = useState<Annonce[] | null>(null);
  const [showAnnonceModal, setShowAnnonceModal] = useState(false);

  // Panel stats prof
  const [selectedProfEmail, setSelectedProfEmail] = useState<string | null>(null);

  // Champs du formulaire
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  // Durées d'accès (JP, 2026-10-11) : permanent, 1 semaine, 1 mois — plus de « 1 jour »
  const [accessDuration, setAccessDuration] = useState<'permanent' | '1week' | '1month'>('permanent');
  // L'ACTIVITÉ de chaque prof (classes, devoirs, grilles) pour le filtre
  // « Profs sans aucune activité » — chargée avec l'onglet Membres
  const [activite, setActivite] = useState<Record<string, ActiviteProf> | null>(null);
  const [seulementInactifs, setSeulementInactifs] = useState(false);
  // L'école : demandée pour un accès PERMANENT seulement (JP, 2026-10-11)
  const [ecole, setEcole] = useState('');

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
      router.replace('/accueil');
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

  // ── Annonces ───────────────────────────────────────────────────────────
  const fetchAnnonces = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch('/api/annonces', { headers });
      const json = await res.json();
      setAnnonces(json.success ? json.data : []);
    } catch {
      setAnnonces([]);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (isAuthenticated) fetchAnnonces();
  }, [isAuthenticated, fetchAnnonces]);

  const sendAnnonce = useCallback(
    async (data: { message: string; cible: AnnonceCible; lien: string | null }) => {
      const headers = await getAuthHeaders();
      if (!headers) return false;
      try {
        const res = await fetch('/api/annonces', {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) return false;
        setAnnonces((prev) => [json.data, ...(prev || [])]);
        setMessage({ text: 'Notification envoyée.', type: 'success' });
        return true;
      } catch {
        return false;
      }
    },
    [getAuthHeaders]
  );

  const deleteAnnonce = useCallback(
    async (annonce: Annonce) => {
      if (!window.confirm(`Retirer cette notification ?\n\n« ${annonce.message} »`)) return;
      const headers = await getAuthHeaders();
      if (!headers) return;
      try {
        const res = await fetch(`/api/annonces/${annonce.id}`, { method: 'DELETE', headers });
        const json = await res.json();
        if (json.success) setAnnonces((prev) => (prev || []).filter((a) => a.id !== annonce.id));
      } catch {
        setMessage({ text: 'Suppression impossible.', type: 'error' });
      }
    },
    [getAuthHeaders]
  );

  // `enEdition` : ouverte par le crayon de l'étiquette, la fiche s'ouvre en modification
  const [ficheEnEdition, setFicheEnEdition] = useState(false);
  const openProfPanel = useCallback((profEmail: string, enEdition = false) => {
    setFicheEnEdition(enEdition);
    setSelectedProfEmail(profEmail);
  }, []);
  const fermerProfPanel = useCallback(() => setSelectedProfEmail(null), []);

  const resetForm = () => {
    setNom('');
    setPrenom('');
    setEmail('');
    setEcole('');
    setAccessDuration('permanent');
  };

  // L'activité : chargée à l'ouverture de l'onglet Membres, et à chaque
  // changement de la liste (un prof ajouté n'a encore rien créé)
  useEffect(() => {
    if (activeTab !== 'membres' || !isAuthenticated) return;
    let annule = false;
    (async () => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      try {
        const res = await fetch('/api/admin/profs-activite', { headers });
        const json = await res.json();
        if (!annule && json.success) setActivite(json.data as Record<string, ActiviteProf>);
      } catch {
        // Le filtre reste indisponible
      }
    })();
    return () => {
      annule = true;
    };
  }, [activeTab, isAuthenticated, getAuthHeaders, professeurs.length]);

  const sansActivite = useCallback(
    (p: { email: string }) => {
      const a = activite?.[p.email.toLowerCase()];
      return !!a && a.classes === 0 && a.devoirs === 0 && a.grilles === 0;
    },
    [activite]
  );

  // Les profs groupés PAR ÉCOLE (ordre alphabétique, « non renseignée » en dernier)
  const groupesEcole = useMemo(() => {
    const liste = seulementInactifs ? professeurs.filter(sansActivite) : professeurs;
    const parEcole = new Map<string, typeof professeurs>();
    for (const p of liste) {
      const cle = (p.ecole ?? '').trim();
      parEcole.set(cle, [...(parEcole.get(cle) ?? []), p]);
    }
    return [...parEcole.entries()]
      .sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b, 'fr')))
      .map(([ecole, profs]) => ({ ecole, profs }));
  }, [professeurs, seulementInactifs, sansActivite]);

  const fermerFormulaire = useCallback(() => {
    setShowForm(false);
    setNom('');
    setPrenom('');
    setEmail('');
    setEcole('');
    setAccessDuration('permanent');
  }, []);

  // La popup « Nouveau professeur » se ferme aussi avec Échap
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fermerFormulaire();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm, fermerFormulaire]);

  const computeExpiresAt = (duration: 'permanent' | '1week' | '1month'): string | null => {
    if (duration === 'permanent') return null;
    const now = new Date();
    if (duration === '1week') now.setDate(now.getDate() + 7);
    if (duration === '1month') now.setMonth(now.getMonth() + 1);
    return now.toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim() || !email.trim()) return;
    if (accessDuration === 'permanent' && !ecole.trim()) return;

    setIsSubmitting(true);
    try {
      const data: CreateProfesseurData = {
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim(),
        expiresAt: computeExpiresAt(accessDuration),
        ecole: accessDuration === 'permanent' ? ecole.trim() : '',
      };
      await createProfesseur(data);
      const durationLabel =
        accessDuration === '1week' ? ' (accès 1 semaine)' :
        accessDuration === '1month' ? ' (accès 1 mois)' : '';
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
        <h1 className={styles.pageTitle}>
          {ADMIN_TABS.find((t) => t.key === activeTab)?.label}
        </h1>

        {message && (
          <div className={`${styles.message} ${message.type === 'success' ? styles.messageSuccess : styles.messageError}`}>
            {message.text}
          </div>
        )}

        {/* Stats — onglet Vue d'ensemble */}
        {activeTab === 'vue' && stats && (
          <section className={styles.statsSection}>
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

        {/* Annonces — le seul message poussé à la main dans la cloche */}
        {activeTab === 'vue' && (
          <section className={styles.annoncesSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Notifications envoyées</h2>
              <button
                type="button"
                className={styles.addButton}
                onClick={() => setShowAnnonceModal(true)}
              >
                📢 Envoyer une notification
              </button>
            </div>

            {annonces === null ? (
              <p className={styles.annonceEmpty}>Chargement…</p>
            ) : annonces.length === 0 ? (
              <p className={styles.annonceEmpty}>
                Aucune notification envoyée. Elles apparaissent dans la cloche des
                destinataires pendant 14 jours, puis disparaissent d&apos;elles-mêmes.
              </p>
            ) : (
              <div className={styles.annonceList}>
                {annonces.map((a) => (
                  <div key={a.id} className={styles.annonceItem}>
                    <span className={styles.annonceCible}>{CIBLE_LABELS[a.cible]}</span>
                    <div className={styles.annonceBody}>
                      <span className={styles.annonceMessage}>{a.message}</span>
                      {a.lien && <span className={styles.annonceLien}>→ {a.lien}</span>}
                    </div>
                    <span className={styles.annonceDate}>
                      {new Date(a.createdAt).toLocaleDateString('fr-BE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                    <button
                      type="button"
                      className={styles.annonceDelete}
                      onClick={() => deleteAnnonce(a)}
                      title="Retirer cette notification"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {showAnnonceModal && (
          <AnnonceModal onClose={() => setShowAnnonceModal(false)} onSend={sendAnnonce} />
        )}

        {/* Gestion didactique : sélecteur de référentiel, puis le panneau
            correspondant. Français = UAA + gestes ; FLE = compétences du
            radar, niveaux du CECR, descripteurs « Je peux… ». */}
        {activeTab === 'didactique' && (
          <>
            <div className={styles.refSwitch} role="tablist" aria-label="Référentiel">
              <button
                type="button"
                role="tab"
                aria-selected={referentiel === 'francais'}
                className={`${styles.refBtn} ${referentiel === 'francais' ? styles.refBtnActive : ''}`}
                onClick={() => setReferentiel('francais')}
              >
                Cours de français
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={referentiel === 'fle'}
                className={`${styles.refBtn} ${referentiel === 'fle' ? styles.refBtnActive : ''}`}
                onClick={() => setReferentiel('fle')}
              >
                Français langue étrangère (FLE)
              </button>
            </div>
            {referentiel === 'francais' ? <DidactiquePanel /> : <DidactiqueFlePanel />}
          </>
        )}

        {/* Gestion de l'affichage : ce que voient les autres profs (plan 2026-10-11) */}
        {activeTab === 'affichage' && <AffichagePanel />}

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

          {/* Filtre (JP, 2026-10-11) : repérer les profs qui n'ont jamais rien créé */}
          {!profsLoading && professeurs.length > 0 && (
            <div className={styles.membresOutils}>
              <label className={styles.filtreInactifs}>
                <input
                  type="checkbox"
                  checked={seulementInactifs}
                  onChange={(e) => setSeulementInactifs(e.target.checked)}
                  disabled={!activite}
                />
                Profs sans aucune activité
                {activite && <span className={styles.filtreCompte}>{professeurs.filter(sansActivite).length}</span>}
              </label>
              <span className={styles.filtreAide}>
                {activite ? 'Aucune classe, aucun devoir, aucune grille.' : 'Calcul de l’activité…'}
              </span>
            </div>
          )}

          {profsLoading ? (
            <div className={styles.emptyState}>Chargement...</div>
          ) : professeurs.length === 0 ? (
            <div className={styles.emptyState}>
              Aucun professeur enregistré. Ajoutez-en un pour commencer.
            </div>
          ) : groupesEcole.length === 0 ? (
            <div className={styles.emptyState}>Aucun professeur sans activité : tout le monde a créé quelque chose.</div>
          ) : (
            // Tri PAR ÉCOLE : un filet et l'intitulé de l'école au-dessus de ses étiquettes
            groupesEcole.map(({ ecole: nomEcole, profs }) => (
              <div key={nomEcole || '__sans'} className={styles.groupeEcole}>
                <div className={styles.groupeEcoleTitre}>
                  <span>{nomEcole || 'École non renseignée'}</span>
                  <small>{profs.length}</small>
                </div>
                <div className={styles.professeursGrid}>
                  {profs.map((prof) => {
                    const expirationLabel = getExpirationLabel(prof.expiresAt);
                    const isSelected = selectedProfEmail === prof.email;
                    const act = activite?.[prof.email.toLowerCase()];
                    return (
                      <div
                        key={prof.id}
                        className={`${styles.profCard} ${isSelected ? styles.profCardSelected : ''}`}
                        onClick={() => openProfPanel(prof.email)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && openProfPanel(prof.email)}
                      >
                        {/* L'étiquette : le nom seul (l'adresse est dans la fiche) et la
                            pastille chiffrée ; en 2e ligne, à droite, les petits gestes */}
                        <div className={styles.profLigne}>
                          <h3 className={styles.profName} title={prof.email}>{prof.prenom} {prof.nom}</h3>
                          {/* Pastille CHIFFRÉE (JP, 2026-10-11) : ce que le prof a
                              créé (classes + devoirs + grilles), détail au survol ;
                              orange à 0 */}
                          {act && (
                            <span
                              className={`${styles.activitePastille} ${sansActivite(prof) ? styles.activitePastilleVide : ''}`}
                              title={`${act.classes} classe${act.classes > 1 ? 's' : ''} · ${act.devoirs} devoir${act.devoirs > 1 ? 's' : ''} · ${act.grilles} grille${act.grilles > 1 ? 's' : ''}${act.connecte ? '' : ' — jamais connecté'}`}
                            >
                              {act.classes + act.devoirs + act.grilles}
                            </span>
                          )}
                        </div>
                        <div className={styles.profLigne}>
                          {expirationLabel ? <span className={styles.expirationBadge}>{expirationLabel}</span> : <span />}
                          <span className={styles.profGestes}>
                            <button
                              type="button"
                              className={styles.profAction}
                              onClick={(e) => { e.stopPropagation(); openProfPanel(prof.email, true); }}
                              title="Modifier"
                              aria-label={`Modifier ${prof.prenom} ${prof.nom}`}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              className={styles.profAction}
                              onClick={(e) => { e.stopPropagation(); handleDelete(prof.id, `${prof.prenom} ${prof.nom}`); }}
                              title="Supprimer"
                              aria-label={`Supprimer ${prof.prenom} ${prof.nom}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
        )}

        {/* La fiche d'un prof : une POPUP à deux onglets (JP, 2026-10-11) */}
        {activeTab === 'membres' && selectedProfEmail && professeurs.find((p) => p.email === selectedProfEmail) && (
          <ProfFiche
            prof={professeurs.find((p) => p.email === selectedProfEmail)!}
            onClose={fermerProfPanel}
            ouvrirEnEdition={ficheEnEdition}
            onModifier={(data) => updateProfesseur(selectedProfEmail, data)}
          />
        )}

        {/* Nouveau professeur : une POPUP (JP, 2026-10-11 — plus un bloc) */}
        {activeTab === 'membres' && showForm && (
          <div className={popup.overlay} onClick={(e) => e.target === e.currentTarget && fermerFormulaire()}>
          <div className={`${popup.popup} ${styles.formPopup}`} role="dialog" aria-modal="true" aria-label="Nouveau professeur">
            <header className={styles.ficheEntete}>
              <h3>Nouveau professeur</h3>
              <button type="button" className={styles.ficheFermer} onClick={fermerFormulaire} aria-label="Fermer">
                ✕
              </button>
            </header>
            <form onSubmit={handleSubmit} className={styles.formPopupCorps}>
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
                  <label className={`${styles.durationOption} ${accessDuration === '1month' ? styles.durationActive : ''}`}>
                    <input
                      type="radio"
                      name="duration"
                      value="1month"
                      checked={accessDuration === '1month'}
                      onChange={() => setAccessDuration('1month')}
                      className={styles.durationRadio}
                    />
                    1 mois
                  </label>
                </div>
              </div>

              {/* L'école : pour un accès permanent seulement */}
              {accessDuration === 'permanent' && (
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="prof-ecole">École</label>
                  <input
                    id="prof-ecole"
                    type="text"
                    className={styles.formInput}
                    value={ecole}
                    onChange={(e) => setEcole(e.target.value)}
                    placeholder="Collège Notre-Dame de Dinant"
                    maxLength={120}
                    required
                  />
                </div>
              )}

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={
                    isSubmitting ||
                    !nom.trim() ||
                    !prenom.trim() ||
                    !email.trim() ||
                    (accessDuration === 'permanent' && !ecole.trim())
                  }
                >
                  {isSubmitting ? 'Ajout en cours...' : 'Ajouter'}
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={fermerFormulaire}
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
