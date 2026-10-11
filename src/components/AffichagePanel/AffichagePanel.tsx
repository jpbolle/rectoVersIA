'use client';

// GESTION DE L'AFFICHAGE (administration, plan 2026-10-11-gestion-affichage) :
// une carte par bloc (ateliers, onglets de Mes Ressources, outils), une ligne
// par élément avec trois états — Visible · En test · Masqué — et, hors
// « Visible », une note lue au survol (« Disponible en janvier »). Puis les
// PROFS TESTEURS, qui voient le masqué comme l'admin (et leurs élèves aussi).
//
// Chaque geste s'enregistre aussitôt (optimiste, comme la gestion
// didactique) ; la note, à la sortie du champ.

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { setAffichageCache } from '@/hooks/useAffichage';
import {
  ELEMENTS_AFFICHAGE,
  ETAT_AFFICHAGE_LABELS,
  GROUPE_AFFICHAGE_LABELS,
  MAX_NOTE_AFFICHAGE,
  type ConfigAffichage,
  type EtatAffichage,
  type GroupeAffichage,
} from '@/types/affichage';
import styles from './AffichagePanel.module.css';

interface Prof {
  uid: string;
  nom: string;
  email: string;
}

const GROUPES: GroupeAffichage[] = ['ateliers', 'ressources', 'outils'];
const ETATS: EtatAffichage[] = ['visible', 'test', 'masque'];

function plat(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function AffichagePanel() {
  const { getAuthHeaders } = useAuth();
  const [config, setConfig] = useState<ConfigAffichage | null>(null);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [recherche, setRecherche] = useState('');
  // Les notes en cours de frappe (enregistrées à la sortie du champ)
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/affichage?admin=1', { headers });
        const json = await res.json();
        if (annule) return;
        if (json.success) {
          setConfig(json.data.config as ConfigAffichage);
          setProfs((json.data.profs as Prof[]) ?? []);
        } else setErreur(json.message || 'Impossible de charger la configuration.');
      } catch {
        if (!annule) setErreur('Impossible de charger la configuration.');
      }
    })();
    return () => {
      annule = true;
    };
  }, [getAuthHeaders]);

  const enregistrer = async (suivante: ConfigAffichage) => {
    const precedente = config;
    setConfig(suivante);
    setEnregistrement(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/affichage', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(suivante),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setConfig(json.data as ConfigAffichage);
        // L'admin voit toujours le masqué : son propre affichage suit tout de suite
        setAffichageCache({ elements: (json.data as ConfigAffichage).elements, voitMasque: true });
      } else {
        setConfig(precedente);
        setErreur(json.message || 'Erreur lors de l’enregistrement.');
      }
    } catch {
      setConfig(precedente);
      setErreur('Erreur de connexion pendant l’enregistrement.');
    } finally {
      setEnregistrement(false);
    }
  };

  const poserEtat = (cle: string, etat: EtatAffichage) => {
    if (!config) return;
    const elements = { ...config.elements };
    if (etat === 'visible') delete elements[cle];
    else elements[cle] = { etat, note: elements[cle]?.note ?? '' };
    void enregistrer({ ...config, elements });
  };

  const poserNote = (cle: string) => {
    if (!config || notes[cle] === undefined) return;
    const r = config.elements[cle];
    const note = notes[cle].trim().slice(0, MAX_NOTE_AFFICHAGE);
    setNotes(({ [cle]: _fini, ...reste }) => {
      void _fini;
      return reste;
    });
    if (!r || (r.note ?? '') === note) return;
    void enregistrer({ ...config, elements: { ...config.elements, [cle]: { ...r, note } } });
  };

  const basculerTesteur = (uid: string) => {
    if (!config) return;
    const testeurs = config.testeurs.includes(uid) ? config.testeurs.filter((t) => t !== uid) : [...config.testeurs, uid];
    void enregistrer({ ...config, testeurs });
  };

  const q = plat(recherche.trim());
  const profsFiltres = useMemo(
    () =>
      profs.filter((p) => !q || plat(`${p.nom} ${p.email}`).includes(q)).sort((a, b) => {
        // Les testeurs d'abord
        const ta = config?.testeurs.includes(a.uid) ? 0 : 1;
        const tb = config?.testeurs.includes(b.uid) ? 0 : 1;
        return ta - tb;
      }),
    [profs, q, config]
  );

  if (erreur && !config) return <p className={styles.erreur}>{erreur}</p>;
  if (!config) return <p className={styles.vide}>Chargement…</p>;

  const nbMasques = Object.values(config.elements).filter((r) => r.etat === 'masque').length;
  const nbTests = Object.values(config.elements).filter((r) => r.etat === 'test').length;

  return (
    <div className={styles.panneau}>
      <p className={styles.intro}>
        Ce que voient les autres professeurs — et leurs élèves. <b>Masqué</b> : un atelier ou un onglet reste visible
        mais grisé et non cliquable ; un outil disparaît. Vous et les <b>testeurs</b> (en bas de page) voyez tout, avec
        une étiquette « masqué aux profs » ; les élèves de vos classes et de celles des testeurs aussi.
      </p>
      <div className={styles.etatGlobal}>
        <span>
          {nbMasques} masqué{nbMasques > 1 ? 's' : ''} · {nbTests} en test · {config.testeurs.length} testeur
          {config.testeurs.length > 1 ? 's' : ''}
        </span>
        {enregistrement && <span className={styles.enregistrement}>Enregistrement…</span>}
        {erreur && <span className={styles.erreur}>{erreur}</span>}
      </div>

      {GROUPES.map((g) => (
        <section key={g} className={styles.carte}>
          <header className={styles.carteTete}>
            <h2>{GROUPE_AFFICHAGE_LABELS[g].titre}</h2>
            <span>{GROUPE_AFFICHAGE_LABELS[g].aide}</span>
          </header>
          <div className={styles.lignes}>
            {ELEMENTS_AFFICHAGE.filter((e) => e.groupe === g).map((e) => {
              const r = config.elements[e.cle];
              const etat = r?.etat ?? 'visible';
              return (
                <div key={e.cle} className={`${styles.ligne} ${etat === 'masque' ? styles.ligneMasquee : ''}`}>
                  <div className={styles.libelle}>
                    <b>{e.label}</b>
                    {e.aide && <small>{e.aide}</small>}
                  </div>
                  <div className={styles.seg} role="radiogroup" aria-label={`Affichage de ${e.label}`}>
                    {ETATS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={etat === s}
                        className={`${styles.segBtn} ${etat === s ? styles[`segActif_${s}`] : ''}`}
                        onClick={() => etat !== s && poserEtat(e.cle, s)}
                      >
                        {ETAT_AFFICHAGE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  {etat !== 'visible' && (
                    <input
                      className={styles.note}
                      value={notes[e.cle] ?? r?.note ?? ''}
                      onChange={(ev) => setNotes((n) => ({ ...n, [e.cle]: ev.target.value }))}
                      onBlur={() => poserNote(e.cle)}
                      onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
                      maxLength={MAX_NOTE_AFFICHAGE}
                      placeholder={etat === 'masque' ? 'Note au survol — « Bientôt disponible » par défaut' : 'Note au survol du badge (facultative)'}
                      aria-label={`Note pour ${e.label}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className={styles.carte}>
        <header className={styles.carteTete}>
          <h2>Professeurs testeurs</h2>
          <span>Ils voient le masqué comme vous ; leurs élèves aussi.</span>
        </header>
        <div className={styles.testeursOutils}>
          <input
            type="search"
            className={styles.recherche}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher un professeur…"
          />
        </div>
        {profsFiltres.length === 0 ? (
          <p className={styles.vide}>{profs.length === 0 ? 'Aucun autre professeur inscrit.' : 'Aucun professeur ne correspond.'}</p>
        ) : (
          <div className={styles.profs}>
            {profsFiltres.map((p) => (
              <label key={p.uid} className={`${styles.prof} ${config.testeurs.includes(p.uid) ? styles.profTesteur : ''}`}>
                <input type="checkbox" checked={config.testeurs.includes(p.uid)} onChange={() => basculerTesteur(p.uid)} />
                <span>
                  <b>{p.nom || p.email}</b>
                  {p.nom && <small>{p.email}</small>}
                </span>
              </label>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
