'use client';

// LA FICHE D'UN PROFESSEUR (administration › Gestion des membres) — une popup
// (JP, 2026-10-11), en-tête ambre, deux onglets sur la deuxième ligne :
//  - Informations générales : identité, adresse, école, date d'ajout, accès ;
//  - Activité : dernière connexion, classes, grilles, devoirs (`/api/admin/prof-stats`).
// L'ÉTOILE à droite de l'en-tête fait du prof un TESTEUR (Gestion de
// l'affichage : il voit les outils masqués, ses élèves aussi). Les testeurs
// sont désignés par uid (`configuration/affichage`) : un prof qui ne s'est
// jamais connecté n'en a pas encore — l'étoile est alors inactive.
// Le CRAYON (2026-10-11) passe les informations générales en modification :
// prénom, nom, accès (permanent, ou 1 semaine / 1 mois à partir d'aujourd'hui),
// école (accès permanent seulement — même règle qu'à la création). L'adresse
// ne se modifie pas : c'est l'identifiant du compte et celui de la connexion.
// Fermeture : la croix, un clic sur le fond, Échap.

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { Professeur } from '@/types/professeur';
import type { ConfigAffichage } from '@/types/affichage';
import popup from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
import styles from '@/app/admin/admin.module.css';

interface ClasseStat { id: string; nom: string; nbEleves: number; }
interface DevoirStat { id: string; titre: string; accesIA: boolean; nbSoumis: number; nbCorrections: number; nbGridIA: number; }
interface GrilleStat { id: string; nom: string; nbCriteres: number; }
interface ProfStats {
  classes: ClasseStat[];
  devoirs: DevoirStat[];
  grilles: GrilleStat[];
  aiStats: { devoirsAvecIA: number; totalGridIA: number };
  // ISO — null : jamais connecté
  derniereConnexion?: string | null;
}

/** « le 9 octobre 2026 à 21 h 14 — il y a 2 jours » */
function connexionLisible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const jour = d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });
  const heure = d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  const jours = Math.floor((Date.now() - d.getTime()) / 86400000);
  const ilYa = jours <= 0 ? 'aujourd’hui' : jours === 1 ? 'hier' : `il y a ${jours} jours`;
  return `le ${jour} à ${heure} — ${ilYa}`;
}

type Onglet = 'infos' | 'activite';

function dateLongue(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function acces(expiresAt?: string | null): string {
  if (!expiresAt) return 'Permanent';
  const jours = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (jours <= 0) return `Expiré (le ${dateLongue(expiresAt)})`;
  return `${jours === 1 ? 'Expire demain' : `Expire dans ${jours} jours`} (le ${dateLongue(expiresAt)})`;
}

type Acces = 'inchange' | 'permanent' | '1week' | '1month';

function expirationDe(acces: Acces, actuelle: string | null | undefined): string | null {
  if (acces === 'inchange') return actuelle ?? null;
  if (acces === 'permanent') return null;
  const d = new Date();
  if (acces === '1week') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

interface Modification {
  nom: string;
  prenom: string;
  ecole: string;
  expiresAt: string | null;
}

export default function ProfFiche({
  prof,
  onClose,
  onModifier,
  ouvrirEnEdition = false,
}: {
  prof: Professeur;
  onClose: () => void;
  // Ouverte par le crayon de l'étiquette : directement en modification
  ouvrirEnEdition?: boolean;
  onModifier: (data: Modification) => Promise<Professeur>;
}) {
  const { getAuthHeaders } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>('infos');
  const [profStats, setProfStats] = useState<ProfStats | null>(null);
  const [chargement, setChargement] = useState(true);
  // Testeur : la configuration d'affichage et l'uid de ce prof (par son adresse)
  const [config, setConfig] = useState<ConfigAffichage | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [etoileEnCours, setEtoileEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Le mode MODIFICATION (crayon) et son brouillon
  const [edition, setEdition] = useState<{ prenom: string; nom: string; ecole: string; acces: Acces } | null>(() =>
    ouvrirEnEdition
      ? { prenom: prof.prenom, nom: prof.nom, ecole: prof.ecole ?? '', acces: prof.expiresAt ? 'inchange' : 'permanent' }
      : null
  );
  const [enregistrement, setEnregistrement] = useState(false);
  const ouvrirEdition = () => {
    setOnglet('infos');
    setErreur(null);
    setEdition({ prenom: prof.prenom, nom: prof.nom, ecole: prof.ecole ?? '', acces: prof.expiresAt ? 'inchange' : 'permanent' });
  };
  const accesPermanent = edition ? expirationDe(edition.acces, prof.expiresAt) === null : !prof.expiresAt;
  const editionValide = !!edition && !!edition.prenom.trim() && !!edition.nom.trim() && (!accesPermanent || !!edition.ecole.trim());
  const enregistrer = async () => {
    if (!edition || !editionValide) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      await onModifier({
        prenom: edition.prenom.trim(),
        nom: edition.nom.trim(),
        expiresAt: expirationDe(edition.acces, prof.expiresAt),
        ecole: accesPermanent ? edition.ecole.trim() : '',
      });
      setEdition(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Modification impossible.');
    } finally {
      setEnregistrement(false);
    }
  };

  useEffect(() => {
    let annule = false;
    (async () => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const [stats, affichage] = await Promise.all([
        fetch(`/api/admin/prof-stats/${encodeURIComponent(prof.email)}`, { headers }).then((r) => r.json()).catch(() => null),
        fetch('/api/affichage?admin=1', { headers }).then((r) => r.json()).catch(() => null),
      ]);
      if (annule) return;
      if (stats?.success) setProfStats(stats.data as ProfStats);
      setChargement(false);
      if (affichage?.success) {
        setConfig(affichage.data.config as ConfigAffichage);
        const lui = (affichage.data.profs as { uid: string; email: string }[]).find(
          (p) => p.email.trim().toLowerCase() === prof.email.trim().toLowerCase()
        );
        setUid(lui?.uid ?? null);
      }
    })();
    return () => {
      annule = true;
    };
  }, [getAuthHeaders, prof.email]);

  useEffect(() => {
    // Échap : quitte d'abord la modification, puis ferme la fiche
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (edition) setEdition(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, edition]);

  const testeur = !!uid && !!config?.testeurs.includes(uid);

  const basculerTesteur = useCallback(async () => {
    if (!uid || !config) return;
    setEtoileEnCours(true);
    setErreur(null);
    const testeurs = testeur ? config.testeurs.filter((t) => t !== uid) : [...config.testeurs, uid];
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/affichage', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, testeurs }),
      });
      const json = await res.json();
      if (json.success) setConfig(json.data as ConfigAffichage);
      else setErreur(json.message || 'Enregistrement impossible.');
    } catch {
      setErreur('Erreur de connexion.');
    } finally {
      setEtoileEnCours(false);
    }
  }, [uid, config, testeur, getAuthHeaders]);

  const titreEtoile = !config
    ? 'Chargement…'
    : !uid
      ? 'Ce professeur ne s’est jamais connecté : il pourra devenir testeur après sa première connexion'
      : testeur
        ? 'Professeur testeur — il voit les outils masqués (Gestion de l’affichage). Cliquer pour retirer.'
        : 'Faire de ce professeur un testeur : il verra les outils masqués (Gestion de l’affichage)';

  return (
    <div className={popup.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${popup.popup} ${styles.profStatsPopup}`} role="dialog" aria-modal="true" aria-label={`${prof.prenom} ${prof.nom}`}>
        <header className={styles.ficheEntete}>
          <h3>
            {prof.prenom} {prof.nom}
            {testeur && <span className={styles.ficheTesteur}>testeur</span>}
          </h3>
          <button
            type="button"
            className={`${styles.ficheEtoile} ${edition ? styles.ficheEtoileOn : ''}`}
            onClick={() => (edition ? setEdition(null) : ouvrirEdition())}
            aria-pressed={!!edition}
            title={edition ? 'Quitter la modification sans enregistrer' : 'Modifier les informations du professeur'}
            aria-label={edition ? 'Quitter la modification' : 'Modifier'}
          >
            <Pencil size={18} />
          </button>
          <button
            type="button"
            className={`${styles.ficheEtoile} ${testeur ? styles.ficheEtoileOn : ''}`}
            onClick={basculerTesteur}
            disabled={!uid || !config || etoileEnCours}
            aria-pressed={testeur}
            title={titreEtoile}
            aria-label={titreEtoile}
          >
            <Star size={20} fill={testeur ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className={styles.ficheFermer} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <nav className={styles.ficheOnglets} role="tablist" aria-label="Fiche du professeur">
          {(['infos', 'activite'] as Onglet[]).map((o) => (
            <button
              key={o}
              type="button"
              role="tab"
              aria-selected={onglet === o}
              className={`${styles.ficheOnglet} ${onglet === o ? styles.ficheOngletActif : ''}`}
              onClick={() => setOnglet(o)}
            >
              {o === 'infos' ? 'Informations générales' : 'Activité'}
            </button>
          ))}
        </nav>
        <div className={popup.popupCorps}>
          {erreur && <p className={styles.ficheErreur}>{erreur}</p>}

          {onglet === 'infos' && edition && (
            <div className={styles.ficheEdition}>
              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="fiche-prenom">Prénom</label>
                  <input
                    id="fiche-prenom"
                    className={styles.formInput}
                    value={edition.prenom}
                    onChange={(e) => setEdition({ ...edition, prenom: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="fiche-nom">Nom</label>
                  <input
                    id="fiche-nom"
                    className={styles.formInput}
                    value={edition.nom}
                    onChange={(e) => setEdition({ ...edition, nom: e.target.value })}
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Adresse</label>
                  <input className={styles.formInput} value={prof.email} disabled title="L’adresse est l’identifiant du compte : elle ne se modifie pas" />
                </div>
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="fiche-acces">Accès</label>
                <select
                  id="fiche-acces"
                  className={styles.formInput}
                  value={edition.acces}
                  onChange={(e) => setEdition({ ...edition, acces: e.target.value as Acces })}
                >
                  {prof.expiresAt && <option value="inchange">Inchangé — {acces(prof.expiresAt).toLowerCase()}</option>}
                  <option value="permanent">Permanent</option>
                  <option value="1week">1 semaine à partir d’aujourd’hui</option>
                  <option value="1month">1 mois à partir d’aujourd’hui</option>
                </select>
              </div>
              {accesPermanent && (
                <div className={styles.formField}>
                  <label className={styles.formLabel} htmlFor="fiche-ecole">École</label>
                  <input
                    id="fiche-ecole"
                    className={styles.formInput}
                    value={edition.ecole}
                    onChange={(e) => setEdition({ ...edition, ecole: e.target.value })}
                    placeholder="Collège Notre-Dame de Dinant"
                    maxLength={120}
                  />
                </div>
              )}
              <div className={styles.formActions}>
                <button type="button" className={styles.submitButton} onClick={enregistrer} disabled={!editionValide || enregistrement}>
                  {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button type="button" className={styles.cancelButton} onClick={() => setEdition(null)}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {onglet === 'infos' && !edition && (
            <dl className={styles.ficheInfos}>
              <dt>Prénom</dt>
              <dd>{prof.prenom || '—'}</dd>
              <dt>Nom</dt>
              <dd>{prof.nom || '—'}</dd>
              <dt>Adresse</dt>
              <dd>{prof.email}</dd>
              <dt>École</dt>
              <dd>{prof.ecole?.trim() || (prof.expiresAt ? '— (accès temporaire)' : '—')}</dd>
              <dt>Ajouté le</dt>
              <dd>{dateLongue(prof.createdAt)}</dd>
              <dt>Accès</dt>
              <dd>{acces(prof.expiresAt)}</dd>
              <dt>Testeur</dt>
              <dd>{testeur ? 'Oui — voit les outils masqués' : uid ? 'Non' : 'Non (jamais connecté)'}</dd>
            </dl>
          )}

          {onglet === 'activite' && (
          <>
            {chargement && <div className={styles.panelLoading}>Chargement...</div>}

            {!chargement && profStats && (
              <div className={styles.profStatsContent}>
                {/* La dernière connexion (JP, 2026-10-11) */}
                <p className={styles.ficheConnexion}>
                  <span>Dernière connexion</span>
                  {profStats.derniereConnexion ? connexionLisible(profStats.derniereConnexion) : 'jamais connecté'}
                </p>
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
          </>
          )}
        </div>
      </div>
    </div>
  );
}
