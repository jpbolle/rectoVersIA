'use client';

// Partager une classe avec un COPROFESSEUR — un remplaçant, par exemple
// (2026-10-04). Calqué sur `OeuvrePartageModal`, dont il reprend les styles :
// on choisit dans l'existant (les collègues qui ont un compte), et un mode
// par collègue.
//
//   • Lecture  — il voit la classe, ses élèves, les activités et les copies ;
//   • Écriture — il corrige, publie, ouvre / ferme, archive, crée SES
//                activités pour la classe et saisit les certifications.
//
// Dans les deux cas, il ne modifie JAMAIS les activités du titulaire, et ne
// gère pas les élèves (ajout, import, suppression). C'est dit à l'écran.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Classe, ClassePartage, ClassePartageMode } from '@/types/classe';
import styles from '@/components/OeuvreCard/OeuvrePartageModal.module.css';

interface Collegue {
  email: string;
  nom: string;
}

interface Props {
  classe: Classe;
  onFermer: () => void;
  /** Le partage est enregistré : la liste des classes doit se rafraîchir */
  onEnregistre: () => void;
}

const MODES: { id: ClassePartageMode; label: string; aide: string }[] = [
  {
    id: 'lecture',
    label: 'Lecture',
    aide: 'Il voit la classe, ses élèves, les activités et les copies. Il ne touche à rien.',
  },
  {
    id: 'edition',
    label: 'Écriture',
    aide: 'Il corrige, publie les corrigés, ouvre et ferme les activités pour cette classe, en crée pour elle et saisit les certifications.',
  },
];

export default function ClassePartageModal({ classe, onFermer, onEnregistre }: Props) {
  const { getAuthHeaders } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;

  const [collegues, setCollegues] = useState<Collegue[]>([]);
  const [partages, setPartages] = useState<ClassePartage[]>(classe.partages ?? []);
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

  const modeDe = (email: string): ClassePartageMode | null =>
    partages.find((p) => p.email === email)?.mode ?? null;

  const basculer = (c: Collegue, mode: ClassePartageMode | null) => {
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
      const res = await fetch(`/api/classes/${classe.id}`, {
        method: 'PATCH',
        headers: { ...(h || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ partages }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Enregistrement impossible');
      onEnregistre();
      onFermer();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setOccupe(false);
    }
  }, [classe.id, partages, onEnregistre, onFermer]);

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
            <h3>Coprofesseurs de « {classe.nom} »</h3>
            <p className={styles.sous}>
              Le collègue accède à <strong>la même classe</strong> : ses élèves, toutes ses
              activités et leurs copies. Il ne modifie jamais tes activités et ne gère pas
              les élèves.
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
                          title="Pas d’accès à la classe"
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
                  En <strong>écriture</strong>, il agit pour cette classe seulement : il corrige,
                  publie les corrigés, ouvre et ferme les activités, coche les « non rendu », crée
                  ses propres activités pour la classe et saisit les notes de certification. Tes
                  autres classes ne sont jamais touchées.
                </p>
              )}
            </>
          )}
        </div>

        <footer className={styles.pied}>
          <span className={styles.compteur}>
            {nbPartages === 0
              ? 'Aucun coprofesseur'
              : `${nbPartages} coprofesseur${nbPartages > 1 ? 's' : ''}`}
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
