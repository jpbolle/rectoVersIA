'use client';

// Partager une œuvre avec un collègue — à ne pas confondre avec la
// duplication.
//
//   Dupliquer  : il repart avec SA copie, les deux vivent leur vie.
//   Partager   : il accède au MÊME livre. Une correction profite aux deux.
//
// Deux niveaux, choisis collègue par collègue :
//   • Lecture seule — il donne l'œuvre à ses classes, il ne la remanie pas ;
//   • Co-édition    — il écrit dedans, comme moi.
//
// La co-édition n'a AUCUN verrou : le constructeur enregistre section par
// section, donc deux profs sur deux scènes différentes ne se gênent pas — mais
// sur la MÊME scène, le dernier enregistrement gagne. C'est dit à l'écran :
// une limite tue, c'est une perte de données un soir de préparation.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Oeuvre, OeuvrePartage, OeuvrePartageMode } from '@/types/oeuvre';
import styles from './OeuvrePartageModal.module.css';

interface Collegue {
  email: string;
  nom: string;
}

interface Props {
  oeuvre: Oeuvre;
  onFermer: () => void;
  /** Le partage est enregistré : la bibliothèque doit se rafraîchir */
  onEnregistre: (partages: OeuvrePartage[]) => void;
}

const MODES: { id: OeuvrePartageMode; label: string; aide: string }[] = [
  {
    id: 'lecture',
    label: 'Lecture seule',
    aide: 'Il donne l’œuvre à ses classes. Il ne peut pas la modifier.',
  },
  {
    id: 'edition',
    label: 'Co-édition',
    aide: 'Il écrit dans l’œuvre comme toi — mêmes sections, mêmes vérifications.',
  },
];

export default function OeuvrePartageModal({ oeuvre, onFermer, onEnregistre }: Props) {
  const { getAuthHeaders } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;

  const [collegues, setCollegues] = useState<Collegue[]>([]);
  const [partages, setPartages] = useState<OeuvrePartage[]>(oeuvre.partages ?? []);
  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const h = await headersRef.current();
        const res = await fetch('/api/professeurs/collegues', { headers: h || undefined });
        const json = await res.json();
        if (annule) return;
        if (!json.success) throw new Error(json.message || 'Liste indisponible');
        setCollegues(json.data || []);
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFermer]);

  const modeDe = (email: string): OeuvrePartageMode | null =>
    partages.find((p) => p.email === email)?.mode ?? null;

  const basculer = (c: Collegue, mode: OeuvrePartageMode | null) => {
    setPartages((prev) => {
      const sans = prev.filter((p) => p.email !== c.email);
      return mode ? [...sans, { email: c.email, nom: c.nom, mode }] : sans;
    });
  };

  const enregistrer = useCallback(async () => {
    setOccupe(true);
    setErreur(null);
    try {
      const h = await headersRef.current();
      const res = await fetch(`/api/oeuvres/${oeuvre.id}`, {
        method: 'PATCH',
        headers: { ...(h || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ partages }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Enregistrement impossible');
      onEnregistre(json.data?.partages ?? partages);
      onFermer();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setOccupe(false);
    }
  }, [oeuvre.id, partages, onEnregistre, onFermer]);

  const filtres = recherche.trim()
    ? collegues.filter((c) =>
        `${c.nom} ${c.email}`.toLowerCase().includes(recherche.trim().toLowerCase())
      )
    : collegues;

  const nbPartages = partages.length;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onFermer()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <header className={styles.entete}>
          <div>
            <h3>Partager « {oeuvre.titre} »</h3>
            <p className={styles.sous}>
              Le collègue accède au <strong>même livre</strong> — rien n’est copié. Pour qu’il
              reparte avec sa propre version, c’est « Dupliquer ».
            </p>
          </div>
          <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </header>

        <div className={styles.corps}>
          {erreur && <p className={styles.erreur}>{erreur}</p>}

          {chargement ? (
            <p className={styles.vide}>Chargement des collègues…</p>
          ) : collegues.length === 0 ? (
            <p className={styles.vide}>
              Aucun autre professeur n’a de compte pour l’instant. Les comptes se créent dans
              l’administration.
            </p>
          ) : (
            <>
              {collegues.length > 6 && (
                <input
                  type="search"
                  className={styles.recherche}
                  placeholder="Chercher un collègue…"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              )}

              <ul className={styles.liste}>
                {filtres.map((c) => {
                  const mode = modeDe(c.email);
                  return (
                    <li key={c.email} className={`${styles.ligne} ${mode ? styles.ligneActive : ''}`}>
                      <div className={styles.identite}>
                        <span className={styles.nom}>{c.nom}</span>
                        <span className={styles.email}>{c.email}</span>
                      </div>

                      <div className={styles.modes}>
                        <button
                          type="button"
                          className={`${styles.modeBtn} ${!mode ? styles.modeActif : ''}`}
                          onClick={() => basculer(c, null)}
                          title="Pas de partage"
                        >
                          Aucun
                        </button>
                        {MODES.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={`${styles.modeBtn} ${mode === m.id ? styles.modeActif : ''}`}
                            onClick={() => basculer(c, m.id)}
                            title={m.aide}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
                {filtres.length === 0 && <li className={styles.vide}>Aucun collègue trouvé.</li>}
              </ul>

              {partages.some((p) => p.mode === 'edition') && (
                <p className={styles.avertissement}>
                  ⚠️ En co-édition, rien n’empêche deux personnes d’écrire en même temps. Le
                  constructeur enregistre <strong>section par section</strong> : travailler chacun
                  sur des scènes différentes ne pose aucun problème, mais sur la même scène, le
                  dernier enregistrement l’emporte.
                </p>
              )}
            </>
          )}
        </div>

        <footer className={styles.pied}>
          <span className={styles.compteur}>
            {nbPartages === 0
              ? 'Partagée avec personne'
              : `Partagée avec ${nbPartages} collègue${nbPartages > 1 ? 's' : ''}`}
          </span>
          <div className={styles.piedActions}>
            <button type="button" className={styles.btnGhost} onClick={onFermer}>
              Annuler
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={enregistrer}
              disabled={occupe || chargement}
            >
              {occupe ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
