'use client';

// Le TABLEAU D'ÉVOLUTION d'un portfolio (phase 4 du plan 2026-10-10) : une
// ligne par élève (les membres d'un groupe côte à côte), une colonne par
// étape. Le POINT ambre ● = soumise, à valider : c'est là que le prof clique
// (il arrive dans la copie). Au bout de la ligne, les gestes du suivi de
// lecture : ❤️ féliciter, 💔 relancer (bleu-gris, pour ne pas le confondre
// avec le cœur — JP, 2026-10-10), 💬 écrire — par la cloche de l'élève.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/AuthContext';
import type { CaseProgression, LigneProgression } from '@/app/api/portfolio/progression/route';
import base from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
import styles from './Portfolio.module.css';

interface EtapeColonne {
  id: string;
  titre: string;
  section: string;
  sansTrace: boolean;
  bloquante: boolean;
  echeance: string | null;
}

interface Props {
  devoirId: string;
  titreActivite?: string;
  sessionId?: string | null;
}

const CASES: Record<CaseProgression, { icone: string; label: string; classe: string }> = {
  'a-faire': { icone: '·', label: 'à faire', classe: 'caseVide' },
  'en-cours': { icone: '✎', label: 'en cours', classe: 'caseCours' },
  prete: { icone: '◔', label: 'prête, pas encore soumise', classe: 'caseCours' },
  soumise: { icone: '●', label: 'soumise — à valider', classe: 'caseAValider' },
  'a-revoir': { icone: '●', label: 'resoumise — à revoir', classe: 'caseAValider' },
  validee: { icone: '✓', label: 'validée', classe: 'caseValidee' },
  'a-reprendre': { icone: '✗', label: 'refusée — à reprendre', classe: 'caseRefusee' },
  cochee: { icone: '☑', label: 'cochée (sans trace)', classe: 'caseValidee' },
  'non-cochee': { icone: '·', label: 'pas cochée (sans trace)', classe: 'caseVide' },
};

type Geste = 'felicitation' | 'rappel' | 'message';
const GESTES: Record<Geste, { icone: string; titre: string; defaut: string; ton: 'felicitation' | 'rappel' | null }> = {
  felicitation: {
    icone: '❤️',
    titre: 'Féliciter — son portfolio avance bien',
    defaut: 'Bravo, ton portfolio avance bien. Continue comme ça !',
    ton: 'felicitation',
  },
  rappel: {
    icone: '💔',
    titre: 'Relancer — son portfolio a pris du retard',
    defaut: 'Ton portfolio a pris du retard. Prends un moment cette semaine pour avancer.',
    ton: 'rappel',
  },
  message: { icone: '💬', titre: 'Écrire un message personnalisé', defaut: '', ton: null },
};

export default function PortfolioProgression({ devoirId, titreActivite, sessionId }: Props) {
  const { getAuthHeaders } = useAuthContext();
  const router = useRouter();
  const [etapes, setEtapes] = useState<EtapeColonne[]>([]);
  const [lignes, setLignes] = useState<LigneProgression[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<{ ligne: LigneProgression; geste: Geste; texte: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const q = new URLSearchParams({ devoirId });
      if (sessionId) q.set('sessionId', sessionId);
      const json = await (await fetch(`/api/portfolio/progression?${q}`, { headers })).json();
      if (!json.success) throw new Error(json.message || 'Suivi indisponible');
      setEtapes(json.data.etapes as EtapeColonne[]);
      setLignes(json.data.lignes as LigneProgression[]);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Suivi indisponible');
    }
  }, [getAuthHeaders, devoirId, sessionId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const envoyer = async () => {
    if (!envoi || !envoi.texte.trim()) return;
    setEnCours(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/annonces', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: envoi.texte.trim(),
          cible: 'eleve',
          destinataireUid: envoi.ligne.studentId,
          ton: GESTES[envoi.geste].ton,
          lien: `/activites/${devoirId}`,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Envoi impossible');
      setMessage(`Message envoyé à ${envoi.ligne.studentName}.`);
      setEnvoi(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setEnCours(false);
    }
  };

  if (erreur) return <p className={styles.lectureVide}>{erreur}</p>;
  if (!lignes) return <p className={styles.lectureVide}>Chargement du suivi…</p>;
  if (lignes.length === 0) return <p className={styles.lectureVide}>Aucun élève n’a encore ouvert ce portfolio.</p>;

  const aValider = lignes.reduce(
    (n, l) => n + Object.values(l.cases).filter((c) => c === 'soumise' || c === 'a-revoir').length,
    0
  );

  return (
    <div className={styles.progression}>
      <div className={styles.progressionTete}>
        <span className={aValider > 0 ? styles.progressionAValider : styles.labNote}>
          {aValider > 0 ? `● ${aValider} étape${aValider > 1 ? 's' : ''} à valider` : 'Rien à valider pour l’instant'}
        </span>
        {message && (
          <span className={styles.labNote} onClick={() => setMessage(null)}>
            {message}
          </span>
        )}
      </div>

      <div className={styles.progressionDefile}>
        <table className={styles.progressionTable}>
          <thead>
            <tr>
              <th className={styles.progressionNom}>Élève</th>
              {etapes.map((e, i) => (
                <th key={e.id} title={`${e.section ? `${e.section} — ` : ''}${e.titre}${e.bloquante ? ' (la suite attend votre validation)' : ''}`}>
                  {i + 1}
                  {e.bloquante && <small>🔒</small>}
                </th>
              ))}
              <th>Faites</th>
              <th aria-label="Gestes" />
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, li) => {
              const nouveauGroupe = l.groupe && (li === 0 || lignes[li - 1].groupe !== l.groupe);
              return (
                <tr key={l.travailId} className={nouveauGroupe ? styles.progressionDebutGroupe : ''}>
                  <td className={styles.progressionNom}>
                    {l.groupe && <span className={styles.progressionGroupe} title="Membre d’un groupe">👥</span>}
                    {l.studentName}
                  </td>
                  {etapes.map((e) => {
                    const c = CASES[l.cases[e.id] ?? 'a-faire'];
                    const retard = l.retards.includes(e.id);
                    // Étape-activité : la case ouvre la copie de l'activité elle-même
                    const copie = l.copies?.[e.id];
                    return (
                      <td key={e.id}>
                        <button
                          type="button"
                          className={`${styles.progressionCase} ${styles[c.classe] ?? ''} ${retard ? styles.caseRetard : ''}`}
                          title={`${e.titre} — ${c.label}${retard ? ' · en retard' : ''}${copie ? ' · ouvrir sa copie de l’activité' : ''}`}
                          onClick={() =>
                            router.push(
                              copie
                                ? `/dashboard/travaux/${copie.devoirId}/${copie.travailId}`
                                : `/dashboard/travaux/${devoirId}/${l.travailId}`
                            )
                          }
                        >
                          {c.icone}
                        </button>
                      </td>
                    );
                  })}
                  <td className={styles.progressionFaites}>
                    {l.faites}/{etapes.length}
                  </td>
                  <td>
                    <span className={styles.progressionGestes}>
                      {(Object.keys(GESTES) as Geste[]).map((g) => (
                        <button
                          key={g}
                          type="button"
                          className={styles.progressionGeste}
                          title={GESTES[g].titre}
                          aria-label={GESTES[g].titre}
                          onClick={() => setEnvoi({ ligne: l, geste: g, texte: GESTES[g].defaut })}
                        >
                          <span className={g === 'rappel' ? styles.iconeRappel : undefined}>{GESTES[g].icone}</span>
                        </button>
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.sommaireLegende}>
        <span>● à valider</span>
        <span>✓ validée</span>
        <span>✗ à reprendre</span>
        <span>✎ en cours</span>
        <span>◔ prête, pas soumise</span>
        <span className={styles.caseRetardLegende}>en retard</span>
      </div>

      {envoi && (
        <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && setEnvoi(null)}>
          <div className={base.popup}>
            <header className={base.popupEntete}>
              <h3>
                <span className={envoi.geste === 'rappel' ? styles.iconeRappel : undefined}>{GESTES[envoi.geste].icone}</span> À{' '}
                {envoi.ligne.studentName}
              </h3>
              <button type="button" className={base.popupFermer} onClick={() => setEnvoi(null)} aria-label="Fermer">
                ✕
              </button>
            </header>
            <div className={base.popupCorps}>
              <p className={styles.labNote}>
                {titreActivite ? `« ${titreActivite} » — ` : ''}le message arrive dans la cloche de l’élève.
              </p>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={envoi.texte}
                onChange={(e) => setEnvoi({ ...envoi, texte: e.target.value })}
                rows={4}
                autoFocus
                placeholder="Ton message…"
              />
            </div>
            <footer className={base.popupPied}>
              <button type="button" className={base.btnGhost} onClick={() => setEnvoi(null)}>
                Annuler
              </button>
              <button type="button" className={base.btnPrimary} onClick={() => void envoyer()} disabled={enCours || !envoi.texte.trim()}>
                {enCours ? 'Envoi…' : 'Envoyer'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
