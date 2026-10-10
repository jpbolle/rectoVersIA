'use client';

// L'ENCADRÉ DE VALIDATION d'une étape, dans la copie d'un élève (côté prof —
// plan 2026-10-10, option A) : ✓ Valider / ✗ Refuser, une appréciation à
// trois niveaux (😀 😐 🙁), un commentaire, et les VALEURS que l'étape
// attribue au groupe — pour une œuvre, un menu « l'œuvre ou une de ses scènes »
// (le texte n'est pas affiché ici) ; pour un lien, une vidéo, une page
// intégrée, l'adresse. Pour un groupe, le retour vaut pour tous ses membres.

import { useEffect, useState } from 'react';
import { ETAT_ETAPE_LABELS, type EtatEtape } from '@/lib/portfolio-etat';
import type { Oeuvre } from '@/types/oeuvre';
import {
  APPRECIATIONS,
  GENRE_VALEUR_LABELS,
  type Appreciation,
  type PortfolioEtape,
  type SuiviPortfolio,
  type ValeurAttribuee,
} from '@/types/portfolio';
import styles from './Portfolio.module.css';

interface Props {
  devoirId: string;
  eleveUid: string;
  etape: PortfolioEtape;
  etat: EtatEtape;
  suivi: SuiviPortfolio | null;
  groupe: boolean;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
  onSuivi: (suivi: SuiviPortfolio) => void;
}

// La bibliothèque, chargée une fois par page (toutes les étapes la partagent)
let bibliotheque: Promise<Oeuvre[]> | null = null;
function chargerBibliotheque(getAuthHeaders: Props['getAuthHeaders']): Promise<Oeuvre[]> {
  if (!bibliotheque) {
    bibliotheque = (async () => {
      const headers = await getAuthHeaders();
      if (!headers) return [];
      const json = await (await fetch('/api/oeuvres', { headers })).json();
      if (!json.success) return [];
      const toutes = [...(json.data ?? []), ...(json.partagees ?? []), ...(json.shared ?? []), ...(json.otherProfs ?? [])] as Oeuvre[];
      const vues = new Set<string>();
      return toutes.filter((o) => !o.archive && !vues.has(o.id) && vues.add(o.id));
    })().catch(() => {
      bibliotheque = null;
      return [];
    });
  }
  return bibliotheque;
}

function scenesDe(o: Oeuvre | undefined): { id: string; titre: string }[] {
  if (!o) return [];
  return o.chapitres.flatMap((c) => c.sections.map((s) => ({ id: s.id, titre: [c.titre, s.groupe, s.titre].filter(Boolean).join(' — ') })));
}

export default function PortfolioRetourProf({ devoirId, eleveUid, etape, etat, suivi, groupe, getAuthHeaders, onSuivi }: Props) {
  const retour = suivi?.retours[etape.id] ?? null;
  const declarees = etape.validation?.attribue ?? [];
  const [decision, setDecision] = useState<'valide' | 'refuse' | null>(retour?.decision ?? null);
  const [appreciation, setAppreciation] = useState<Appreciation | null>(retour?.appreciation ?? null);
  const [commentaire, setCommentaire] = useState(retour?.commentaire ?? '');
  const [valeurs, setValeurs] = useState<Record<string, ValeurAttribuee | null>>(() =>
    Object.fromEntries(declarees.map((v) => [v.id, suivi?.valeurs[v.id] ?? null]))
  );
  const [oeuvres, setOeuvres] = useState<Oeuvre[] | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Le suivi rechargé (autre étape enregistrée…) : on resynchronise
  useEffect(() => {
    const r = suivi?.retours[etape.id];
    setDecision(r?.decision ?? null);
    setAppreciation(r?.appreciation ?? null);
    setCommentaire(r?.commentaire ?? '');
    setValeurs(Object.fromEntries((etape.validation?.attribue ?? []).map((v) => [v.id, suivi?.valeurs[v.id] ?? null])));
  }, [suivi, etape.id, etape.validation]);

  const aOeuvre = declarees.some((v) => v.genre === 'oeuvre');
  useEffect(() => {
    if (aOeuvre) void chargerBibliotheque(getAuthHeaders).then(setOeuvres);
  }, [aOeuvre, getAuthHeaders]);

  const enregistrer = async () => {
    if (!decision) {
      setMessage('Choisis d’abord : valider ou refuser.');
      return;
    }
    setEnvoi(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/portfolio/suivi', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ devoirId, eleve: eleveUid, etapeId: etape.id, decision, appreciation, commentaire, valeurs }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Enregistrement impossible');
      onSuivi(json.data as SuiviPortfolio);
      setMessage(groupe ? 'Retour enregistré pour tout le groupe — les élèves sont prévenus.' : 'Retour enregistré — l’élève est prévenu.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setEnvoi(false);
    }
  };

  const poserValeur = (id: string, v: ValeurAttribuee | null) => setValeurs((x) => ({ ...x, [id]: v }));

  return (
    <div className={styles.retourEdition}>
      <div className={styles.retourEditionTete}>
        <span className={styles.retourEditionEtat}>
          {etat === 'soumise' || etat === 'a-revoir' ? '● ' : ''}
          {ETAT_ETAPE_LABELS[etat]}
        </span>
        {groupe && <span className={styles.labNote}>Ce retour vaut pour tout le groupe.</span>}
      </div>

      <div className={styles.retourActions}>
        <button
          type="button"
          className={`${styles.retourBtn} ${decision === 'valide' ? styles.retourBtnValide : ''}`}
          onClick={() => setDecision('valide')}
          aria-pressed={decision === 'valide'}
        >
          ✓ Valider
        </button>
        <button
          type="button"
          className={`${styles.retourBtn} ${decision === 'refuse' ? styles.retourBtnRefuse : ''}`}
          onClick={() => setDecision('refuse')}
          aria-pressed={decision === 'refuse'}
        >
          ✗ Refuser
        </button>
        <span className={styles.retourSmileys} role="group" aria-label="Appréciation">
          {(Object.keys(APPRECIATIONS) as Appreciation[]).map((a) => (
            <button
              key={a}
              type="button"
              className={`${styles.retourSmiley} ${appreciation === a ? styles.retourSmileyOn : ''}`}
              onClick={() => setAppreciation(appreciation === a ? null : a)}
              title={APPRECIATIONS[a].label}
              aria-pressed={appreciation === a}
            >
              {APPRECIATIONS[a].emoji}
            </button>
          ))}
        </span>
      </div>

      <textarea
        className={`${styles.input} ${styles.textarea}`}
        value={commentaire}
        onChange={(e) => setCommentaire(e.target.value)}
        placeholder="Commentaire pour l’élève (facultatif)"
        rows={2}
      />

      {declarees.map((d) => {
        const v = valeurs[d.id];
        const oeuvre = oeuvres?.find((o) => o.id === v?.oeuvreId);
        return (
          <div key={d.id} className={styles.retourValeur}>
            <span className={styles.retourValeurNom}>
              {d.nom} <small>({GENRE_VALEUR_LABELS[d.genre].toLowerCase()})</small>
            </span>
            {d.genre === 'oeuvre' ? (
              <>
                <select
                  value={v?.oeuvreId ?? ''}
                  onChange={(e) => {
                    const o = oeuvres?.find((x) => x.id === e.target.value);
                    poserValeur(d.id, o ? { genre: 'oeuvre', oeuvreId: o.id, sectionId: null, titre: o.titre } : null);
                  }}
                  aria-label={`${d.nom} : l’œuvre`}
                >
                  <option value="">{oeuvres === null ? 'Chargement…' : '— Choisir une œuvre —'}</option>
                  {(oeuvres ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.titre}
                    </option>
                  ))}
                </select>
                {v?.oeuvreId && (
                  <select
                    value={v.sectionId ?? ''}
                    onChange={(e) => {
                      const scene = scenesDe(oeuvre).find((s) => s.id === e.target.value);
                      poserValeur(d.id, {
                        ...v,
                        sectionId: scene?.id ?? null,
                        titre: scene ? `${oeuvre?.titre ?? ''} — ${scene.titre}` : oeuvre?.titre ?? v.titre,
                      });
                    }}
                    aria-label={`${d.nom} : l’extrait`}
                  >
                    <option value="">L’œuvre entière</option>
                    {scenesDe(oeuvre).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.titre}
                      </option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <input
                className={styles.input}
                value={v?.url ?? ''}
                onChange={(e) => poserValeur(d.id, e.target.value.trim() ? { genre: d.genre, url: e.target.value } : null)}
                placeholder={d.genre === 'video' ? 'Lien YouTube ou Google Drive' : d.genre === 'integration' ? 'Adresse Genially, LearningApps…' : 'https://…'}
                aria-label={`${d.nom} : l’adresse`}
              />
            )}
          </div>
        );
      })}

      <div className={styles.retourPied}>
        {message && <span className={styles.labNote}>{message}</span>}
        <button type="button" className={styles.soumettreBtn} onClick={() => void enregistrer()} disabled={envoi}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le retour'}
        </button>
      </div>
    </div>
  );
}
