'use client';

// Bloc « Évaluations » du détail d'une classe FLE (JP, 2026-10-08).
//
// Le prof y glisse ses évaluations — diagnostique, régulative, certificative —
// sous trois formes : un lien, un PDF (≤ 700 Ko), ou une activité existante de
// Mes Activités (la classe lui est ajoutée au passage). Les élèves les voient
// dans la card « Mes évaluations » de « Mon cours FLE ».
// Même gabarit que le bloc Activités juste au-dessus (styles partagés).

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Devoir } from '@/types/devoir';
import { TYPES_EVALUATION, labelTypeEvaluation } from '@/types/evaluation-fle';
import type { EvaluationFle, TypeEvaluation } from '@/types/evaluation-fle';
import { atelierLabel } from '@/types/didactique';
import listeStyles from '@/components/ClasseDetailForm/ClasseActivites.module.css';
import styles from './ClasseEvaluationsFle.module.css';

const ICONE_SOURCE = { lien: '🔗', pdf: '📄', activite: '📝' } as const;

type Forme = 'lien' | 'pdf' | 'activite';

export default function ClasseEvaluationsFle({ classeId, lectureSeule }: { classeId: string; lectureSeule?: boolean }) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [evaluations, setEvaluations] = useState<EvaluationFle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [popup, setPopup] = useState(false);
  // Retrait en deux clics (confirmation dans la ligne, jamais de popup native)
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/fle/evaluations?classeId=${encodeURIComponent(classeId)}`, { headers });
      const json = await res.json();
      if (json.success) setEvaluations(json.data);
    } catch (err) {
      console.error('Erreur chargement des évaluations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAuthHeaders, classeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const retirer = async (e: EvaluationFle) => {
    if (aConfirmer !== e.id) {
      setAConfirmer(e.id);
      return;
    }
    setAConfirmer(null);
    const headers = await getAuthHeaders();
    if (!headers) return;
    await fetch(`/api/fle/evaluations/${encodeURIComponent(e.id)}`, { method: 'DELETE', headers });
    charger();
  };

  const ouvrir = async (e: EvaluationFle) => {
    if (e.source.kind === 'lien') window.open(e.source.url, '_blank', 'noopener');
    else if (e.source.kind === 'activite') window.location.href = `/dashboard/travaux/${e.source.devoirId}`;
    else {
      // Le PDF se sert avec le jeton : on le lit en blob puis on l'ouvre
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/fle/evaluations/fichier/${encodeURIComponent(e.source.fichierId)}`, { headers });
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      window.open(url, '_blank', 'noopener');
    }
  };

  return (
    <section className={listeStyles.section}>
      <div className={styles.entete}>
        <h3 className={listeStyles.title}>
          Évaluations <span className={listeStyles.compteur}>{evaluations.length}</span>
        </h3>
        {!lectureSeule && (
          <button type="button" className={styles.ajouter} onClick={() => setPopup(true)}>
            + Ajouter une évaluation
          </button>
        )}
      </div>

      {isLoading ? (
        <p className={listeStyles.dim}>Chargement…</p>
      ) : evaluations.length === 0 ? (
        <p className={listeStyles.dim}>
          Aucune évaluation. Ajoute un lien, un PDF ou une activité existante : les élèves la
          retrouveront dans « Mes évaluations » de leur cours FLE.
        </p>
      ) : (
        evaluations.map((e) => (
          <div key={e.id} className={`${listeStyles.ligne} ${styles.ligne}`}>
            <span className={listeStyles.icone}>{ICONE_SOURCE[e.source.kind]}</span>
            <button type="button" className={styles.intituleBtn} onClick={() => ouvrir(e)}>
              <span className={listeStyles.intitule}>{e.titre}</span>
              <span className={styles.sous}>
                {e.source.kind === 'activite' ? `Activité : ${e.source.intitule}` : e.source.kind === 'pdf' ? e.source.nomFichier : e.source.url}
              </span>
            </button>
            <span className={`${styles.type} ${styles[`type_${e.type}`]}`}>{labelTypeEvaluation(e.type)}</span>
            {!lectureSeule &&
              (aConfirmer === e.id ? (
                <span className={styles.confirmer}>
                  <button type="button" className={styles.confirmerOui} onClick={() => retirer(e)}>
                    Retirer
                  </button>
                  <button type="button" className={styles.confirmerNon} onClick={() => setAConfirmer(null)}>
                    Annuler
                  </button>
                </span>
              ) : (
                <button type="button" className={styles.retirer} onClick={() => retirer(e)} title="Retirer de la classe">
                  🗑️
                </button>
              ))}
          </div>
        ))
      )}

      {popup && (
        <AjoutEvaluationModal
          classeId={classeId}
          onClose={() => setPopup(false)}
          onAjoutee={() => {
            setPopup(false);
            charger();
          }}
        />
      )}
    </section>
  );
}

// ── La popup d'ajout ──
function AjoutEvaluationModal({ classeId, onClose, onAjoutee }: { classeId: string; onClose: () => void; onAjoutee: () => void }) {
  const { getAuthHeaders } = useAuth();
  const [forme, setForme] = useState<Forme>('lien');
  const [titre, setTitre] = useState('');
  const [type, setType] = useState<TypeEvaluation>('regulative');
  const [url, setUrl] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [devoirs, setDevoirs] = useState<Devoir[] | null>(null);
  const [recherche, setRecherche] = useState('');
  const [devoirId, setDevoirId] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Mes activités, pour la forme « activité existante »
  useEffect(() => {
    if (forme !== 'activite' || devoirs !== null) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/devoirs', { headers });
        const json = await res.json();
        if (!annule) setDevoirs(json.success ? (json.data as Devoir[]).filter((d) => !d.archive && d.typeTravail !== 'sequence') : []);
      } catch {
        if (!annule) setDevoirs([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [forme, devoirs, getAuthHeaders]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enCours) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enCours, onClose]);

  const pret =
    titre.trim().length > 0 &&
    ((forme === 'lien' && /^https?:\/\//.test(url.trim())) || (forme === 'pdf' && !!fichier) || (forme === 'activite' && !!devoirId));

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!pret || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Connexion perdue.');
      const entetes: Record<string, string> = { ...headers };
      Object.keys(entetes).forEach((k) => {
        if (k.toLowerCase() === 'content-type') delete entetes[k];
      });
      const form = new FormData();
      form.set('classeId', classeId);
      form.set('titre', titre.trim());
      form.set('type', type);
      form.set('kind', forme);
      if (forme === 'lien') form.set('url', url.trim());
      if (forme === 'pdf' && fichier) form.set('fichier', fichier, fichier.name);
      if (forme === 'activite') form.set('devoirId', devoirId);
      const res = await fetch('/api/fle/evaluations', { method: 'POST', headers: entetes, body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Ajout impossible.');
      onAjoutee();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Ajout impossible.');
      setEnCours(false);
    }
  };

  const q = recherche.trim().toLowerCase();
  const candidats = (devoirs ?? []).filter((d) => !q || d.intitule.toLowerCase().includes(q));

  return (
    <div className={styles.overlay} onClick={() => !enCours && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Ajouter une évaluation" onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3 className={styles.modalTitre}>Ajouter une évaluation</h3>
          <button type="button" className={styles.fermer} onClick={onClose} disabled={enCours} aria-label="Fermer">
            ×
          </button>
        </div>
        <form className={styles.form} onSubmit={envoyer}>
          <div className={styles.formes} role="tablist">
            {(
              [
                ['lien', '🔗', 'Un lien'],
                ['pdf', '📄', 'Un PDF'],
                ['activite', '📝', 'Une activité'],
              ] as [Forme, string, string][]
            ).map(([f, picto, label]) => (
              <button key={f} type="button" role="tab" aria-selected={forme === f} className={`${styles.formeBtn} ${forme === f ? styles.formeActive : ''}`} onClick={() => setForme(f)}>
                <span aria-hidden="true">{picto}</span> {label}
              </button>
            ))}
          </div>

          {forme === 'lien' && (
            <label className={styles.champ}>
              <span className={styles.label}>Lien (Google Docs, Drive, page web)</span>
              <input type="url" className={styles.input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/…" autoFocus />
            </label>
          )}
          {forme === 'pdf' && (
            <label className={styles.champ}>
              <span className={styles.label}>PDF (700 Ko maximum — au-delà, passe par un lien)</span>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
            </label>
          )}
          {forme === 'activite' && (
            <div className={styles.champ}>
              <span className={styles.label}>Une activité de Mes Activités (la classe lui sera ajoutée)</span>
              <input type="search" className={styles.input} value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un intitulé…" />
              <div className={styles.liste}>
                {devoirs === null ? (
                  <p className={styles.dim}>Chargement…</p>
                ) : candidats.length === 0 ? (
                  <p className={styles.dim}>Aucune activité.</p>
                ) : (
                  candidats.slice(0, 40).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`${styles.choix} ${devoirId === d.id ? styles.choixActif : ''}`}
                      onClick={() => {
                        setDevoirId(d.id);
                        if (!titre.trim()) setTitre(d.intitule);
                      }}
                    >
                      <span>{d.intitule}</span>
                      <span className={styles.dim}>{d.atelier ? atelierLabel(d.atelier, true) : d.typeTravail}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <label className={styles.champ}>
            <span className={styles.label}>Titre</span>
            <input type="text" className={styles.input} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Diagnostic de rentrée — compréhension écrite" maxLength={120} />
          </label>

          <div className={styles.champ}>
            <span className={styles.label}>Type d’évaluation</span>
            <div className={styles.types}>
              {TYPES_EVALUATION.map((t) => (
                <label key={t.id} className={`${styles.typeChoix} ${type === t.id ? styles.typeChoixActif : ''}`} title={t.aide}>
                  <input type="radio" name="type-evaluation" checked={type === t.id} onChange={() => setType(t.id)} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {erreur && <p className={styles.erreur}>{erreur}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.btnSecondaire} onClick={onClose} disabled={enCours}>
              Annuler
            </button>
            <button type="submit" className={styles.btnPrimaire} disabled={!pret || enCours}>
              {enCours ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
