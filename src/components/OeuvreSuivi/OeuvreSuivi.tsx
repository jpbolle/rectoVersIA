'use client';

// Suivi de lecture d'une œuvre — ce que le prof voit à la place des trois
// colonnes de correction.
//
// POURQUOI PAS LES TROIS COLONNES : dans cet atelier, rien ne se remet et rien
// ne se corrige. « Non ouvert / à corriger / corrigé » n'y décrit aucune
// réalité. La seule question du prof est : QUI LIT, où en est-il, et qu'a-t-il
// compris. D'où un tableau — une ligne par élève, lisible d'un coup d'œil.
//
// POURQUOI PAS DE CLIC VERS LA COPIE : il n'y a pas de copie. Ouvrir l'écran
// en deux colonnes montrerait une « production du travail » vide. Le clic ouvre
// donc la FICHE de l'élève (la même que dans Mes Classes), et les trois actions
// (❤️ 💔 💬) restent sur la ligne — c'est de là qu'on parle à un élève, pas
// d'un écran de correction.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import EmptyState from '@/components/EmptyState/EmptyState';
import EleveProfilModal from '@/components/EleveProfilModal/EleveProfilModal';
import type { EtatLecture } from '@/types/oeuvre';
import styles from './OeuvreSuivi.module.css';

interface SuiviEleve {
  travailId: string;
  studentId: string;
  eleveId: string | null;
  studentName: string;
  faites: number;
  vues: number;
  jours: number;
  dernierJour: string | null;
  etat: EtatLecture;
  attendu: number;
  retard: number;
  qcmJustes: number;
  qcmRepondus: number;
  ouvertesRepondues: number;
  commentairesLus: number;
}

interface SuiviQuestion {
  sectionId: string;
  sectionTitre: string;
  enonce: string;
  repondus: number;
  justes: number;
}

interface SuiviData {
  eleves: SuiviEleve[];
  questionsDifficiles: SuiviQuestion[];
  minimum: number;
  echeance: string;
  totalSections: number;
  totalVerifications: number;
}

// Les quatre états de lecture, avec leur couleur. « Sans échéance » n'est pas
// un problème : c'est une activité sans rythme imposé, on n'affiche qu'un
// compteur.
const ETATS: Record<EtatLecture, { label: string; classe: string }> = {
  termine: { label: 'Objectif atteint', classe: 'etatTermine' },
  dansLesTemps: { label: 'Dans les temps', classe: 'etatOk' },
  enRetard: { label: 'En retard', classe: 'etatRetard' },
  pasEntamee: { label: 'Pas entamée', classe: 'etatRien' },
  sansEcheance: { label: 'Sans échéance', classe: 'etatNeutre' },
};

// Les trois gestes du prof. Le message est PRÉ-RÉDIGÉ pour les deux premiers :
// un encouragement qu'il faut écrire est un encouragement qu'on n'envoie pas.
type Geste = 'felicitation' | 'rappel' | 'message';

const GESTES: Record<Geste, { icone: string; titre: string; defaut: string; ton: 'felicitation' | 'rappel' | null }> = {
  felicitation: {
    icone: '❤️',
    titre: 'Féliciter — tu as vu qu’il avance bien',
    defaut: 'Bravo, ta lecture avance bien. Continue comme ça !',
    ton: 'felicitation',
  },
  rappel: {
    icone: '💔',
    titre: 'Rappeler — il n’a rien fait',
    defaut: 'Ta lecture n’avance pas. Prends un moment cette semaine pour t’y remettre.',
    ton: 'rappel',
  },
  message: {
    icone: '💬',
    titre: 'Écrire un message personnalisé',
    defaut: '',
    ton: null,
  },
};

interface Props {
  devoirId: string;
  /** Intitulé de l’activité, rappelé dans la popup de message */
  titreActivite?: string;
}

export default function OeuvreSuivi({ devoirId, titreActivite }: Props) {
  const { getAuthHeaders } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;

  const [data, setData] = useState<SuiviData | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<{ eleve: SuiviEleve; geste: Geste; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  // Fiche élève en popup — la MÊME que celle de Mes Classes. Pas l'écran de
  // correction en deux colonnes : il n'y a ici aucune copie à annoter.
  const [fiche, setFiche] = useState<SuiviEleve | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const headers = await headersRef.current();
        const res = await fetch(`/api/oeuvres/suivi?devoirId=${devoirId}`, {
          headers: headers || undefined,
        });
        const json = await res.json();
        if (annule) return;
        if (!json.success) throw new Error(json.message || 'Suivi indisponible');
        setData(json.data);
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [devoirId]);

  const envoyer = useCallback(async () => {
    if (!envoi || !envoi.texte.trim()) return;
    setOccupe(true);
    try {
      const h = await headersRef.current();
      const res = await fetch('/api/annonces', {
        method: 'POST',
        headers: { ...(h || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: envoi.texte.trim(),
          cible: 'eleve',
          destinataireUid: envoi.eleve.studentId,
          ton: GESTES[envoi.geste].ton,
          // Le message mène là où il porte : l'activité elle-même.
          lien: `/activites/${devoirId}`,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Envoi impossible');
      setMessage(`Message envoyé à ${envoi.eleve.studentName}.`);
      setEnvoi(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setOccupe(false);
    }
  }, [envoi, devoirId]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);

  // Chiffres de classe — trois nombres, pas un tableau de bord. Ce sont ceux
  // que le prof cherche : combien n'ont pas commencé, combien décrochent.
  const bilan = useMemo(() => {
    if (!data) return null;
    const e = data.eleves;
    return {
      total: e.length,
      pasEntamee: e.filter((x) => x.etat === 'pasEntamee' || (x.faites === 0 && x.vues === 0)).length,
      enRetard: e.filter((x) => x.etat === 'enRetard').length,
      termine: e.filter((x) => x.etat === 'termine').length,
      moyenneFaites: e.length
        ? Math.round((e.reduce((s, x) => s + x.faites, 0) / e.length) * 10) / 10
        : 0,
    };
  }, [data]);

  if (chargement) return <EmptyState icon="hourglass" message="Chargement du suivi de lecture" />;
  if (erreur) return <EmptyState icon="⚠️" message={erreur} />;
  if (!data || data.eleves.length === 0) {
    return (
      <EmptyState
        icon="📖"
        message="Aucun élève dans les classes de cette activité."
      />
    );
  }

  const denominateur = data.minimum || data.totalVerifications;
  // Un élève au moins est allé lire un commentaire du prof : c'est ce qui
  // décide d'afficher la colonne. Ailleurs, elle ne montrerait que des zéros.
  const aDesCommentaires = data.eleves.some((e) => e.commentairesLus > 0);

  return (
    <div className={styles.suivi}>
      {message && (
        <div className={styles.flash} role="status" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}

      {/* ── Bilan de classe ── */}
      {bilan && (
        <div className={styles.bilan}>
          <div className={styles.bilanCarte}>
            <span className={styles.bilanChiffre}>{bilan.total}</span>
            <span className={styles.bilanLabel}>Lecteurs</span>
          </div>
          <div className={styles.bilanCarte}>
            <span className={`${styles.bilanChiffre} ${bilan.pasEntamee > 0 ? styles.rouge : ''}`}>
              {bilan.pasEntamee}
            </span>
            <span className={styles.bilanLabel}>N’ont pas commencé</span>
          </div>
          <div className={styles.bilanCarte}>
            <span className={`${styles.bilanChiffre} ${bilan.enRetard > 0 ? styles.ambre : ''}`}>
              {bilan.enRetard}
            </span>
            <span className={styles.bilanLabel}>En retard</span>
          </div>
          <div className={styles.bilanCarte}>
            <span className={`${styles.bilanChiffre} ${styles.vert}`}>{bilan.termine}</span>
            <span className={styles.bilanLabel}>Objectif atteint</span>
          </div>
          <div className={styles.bilanCarte}>
            <span className={styles.bilanChiffre}>{bilan.moyenneFaites}</span>
            <span className={styles.bilanLabel}>
              Vérifications en moyenne
              <span className={styles.bilanSous}>
                sur {denominateur || '—'}
                {data.minimum > 0 ? ' demandées' : ' possibles'}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ── Tableau de progression ── */}
      {/* Un élève au moins a ouvert un commentaire : c'est ce qui décide
          d'afficher la colonne — le suivi ne connaît pas les commentaires de
          l'œuvre, seulement ce que les élèves en ont lu. */}
      <div className={styles.tableauCadre}>
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Élève</th>
              <th className={styles.colProgression}>
                Progression
                {data.minimum > 0 && (
                  <span className={styles.thSous}>{data.minimum} vérifications demandées</span>
                )}
              </th>
              <th>État</th>
              <th className={styles.colNombre}>
                Lu
                <span className={styles.thSous}>scènes ouvertes</span>
              </th>
              <th className={styles.colNombre}>
                Régularité
                <span className={styles.thSous}>jours de lecture</span>
              </th>
              <th className={styles.colNombre}>
                QCM
                <span className={styles.thSous}>justes / répondus</span>
              </th>
              {/* La colonne n'apparaît QUE si des commentaires existent :
                  ailleurs, ce serait une colonne de zéros. */}
              {aDesCommentaires && (
                <th className={styles.colNombre}>
                  Commentaires
                  <span className={styles.thSous}>ouverts par l’élève</span>
                </th>
              )}
              <th className={styles.colActions}>Un mot</th>
            </tr>
          </thead>
          <tbody>
            {data.eleves.map((e) => {
              const pct = denominateur ? Math.min(100, Math.round((e.faites / denominateur) * 100)) : 0;
              const etat = ETATS[e.etat];
              const reussite = e.qcmRepondus
                ? Math.round((e.qcmJustes / e.qcmRepondus) * 100)
                : null;

              return (
                <tr key={e.travailId}>
                  <td>
                    <button
                      type="button"
                      className={styles.nom}
                      // Pas l'écran de correction : il n'y a rien à corriger.
                      // La fiche, elle, dit ce que cet élève lit et comprend.
                      onClick={() => e.eleveId && setFiche(e)}
                      disabled={!e.eleveId}
                      title={
                        e.eleveId
                          ? 'Ouvrir la fiche de l’élève'
                          : 'Cet élève ne s’est encore jamais connecté'
                      }
                    >
                      {e.studentName}
                    </button>
                  </td>

                  <td>
                    <div className={styles.progression}>
                      <div className={styles.barre}>
                        <i
                          className={pct >= 100 ? styles.barreFinie : undefined}
                          style={{ width: `${pct}%` }}
                        />
                        {/* Le repère de l'attendu : là où il devrait en être
                            aujourd'hui, et non à l'échéance. */}
                        {data.minimum > 0 && e.attendu > 0 && e.attendu < denominateur && (
                          <span
                            className={styles.repere}
                            style={{ left: `${Math.round((e.attendu / denominateur) * 100)}%` }}
                            title={`Attendu aujourd’hui : ${e.attendu}`}
                          />
                        )}
                      </div>
                      <span className={styles.chiffres}>
                        {e.faites}
                        {denominateur ? ` / ${denominateur}` : ''}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span className={`${styles.etat} ${styles[etat.classe]}`}>{etat.label}</span>
                    {e.retard > 0 && <span className={styles.retard}>−{e.retard}</span>}
                  </td>

                  <td className={styles.colNombre}>
                    {e.vues > 0 ? e.vues : <span className={styles.rien}>—</span>}
                  </td>

                  <td className={styles.colNombre}>
                    {e.jours > 0 ? (
                      <>
                        {e.jours} j
                        {e.dernierJour && (
                          <span className={styles.sousCellule}>
                            dernier&nbsp;: {formatJour(e.dernierJour)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={styles.rien}>jamais ouverte</span>
                    )}
                  </td>

                  <td className={styles.colNombre}>
                    {reussite === null ? (
                      <span className={styles.rien}>—</span>
                    ) : (
                      <>
                        <span className={reussite >= 60 ? styles.vert : styles.ambre}>
                          {reussite}%
                        </span>
                        <span className={styles.sousCellule}>
                          {e.qcmJustes}/{e.qcmRepondus}
                        </span>
                      </>
                    )}
                  </td>

                  {aDesCommentaires && (
                    <td className={styles.colNombre}>
                      {e.commentairesLus > 0 ? (
                        e.commentairesLus
                      ) : (
                        <span className={styles.rien}>—</span>
                      )}
                    </td>
                  )}

                  <td className={styles.colActions}>
                    <div className={styles.actions}>
                      {(Object.keys(GESTES) as Geste[]).map((g) => (
                        <button
                          key={g}
                          type="button"
                          className={styles.actionBtn}
                          title={GESTES[g].titre}
                          aria-label={GESTES[g].titre}
                          onClick={() =>
                            setEnvoi({ eleve: e, geste: g, texte: GESTES[g].defaut })
                          }
                        >
                          {GESTES[g].icone}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Ce que la classe a raté ── */}
      {data.questionsDifficiles.length > 0 && (
        <section className={styles.difficiles}>
          <h3 className={styles.difficilesTitre}>
            Les questions qui résistent
            <span className={styles.difficilesAide}>
              QCM des vérifications, à partir de 3 réponses
            </span>
          </h3>
          <div className={styles.difficilesListe}>
            {data.questionsDifficiles.map((q) => {
              const pct = Math.round((q.justes / q.repondus) * 100);
              return (
                <div key={`${q.sectionId}-${q.enonce}`} className={styles.difficileLigne}>
                  <div className={styles.difficileTexte}>
                    <span className={styles.difficileEnonce}>{q.enonce}</span>
                    <span className={styles.difficileSection}>{q.sectionTitre}</span>
                  </div>
                  <div className={styles.difficileBarre}>
                    <i
                      style={{
                        width: `${pct}%`,
                        background:
                          pct < 40 ? 'var(--c-danger)' : pct < 65 ? 'var(--c-accent)' : 'var(--c-success)',
                      }}
                    />
                  </div>
                  <span className={styles.difficilePct}>
                    {pct}%
                    <span className={styles.sousCellule}>
                      {q.justes}/{q.repondus}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {fiche?.eleveId && (
        <EleveProfilModal
          eleveId={fiche.eleveId}
          eleveName={fiche.studentName}
          onClose={() => setFiche(null)}
        />
      )}

      {/* ── Popup d'envoi ── */}
      {envoi && (
        <div
          className={styles.overlay}
          onClick={(e) => e.target === e.currentTarget && setEnvoi(null)}
        >
          <div className={styles.popup} role="dialog" aria-modal="true">
            <header className={styles.popupEntete}>
              <div>
                <h3>
                  {GESTES[envoi.geste].icone} À {envoi.eleve.studentName}
                </h3>
                <p className={styles.popupSous}>
                  {titreActivite ? `${titreActivite} · ` : ''}
                  {envoi.eleve.faites} vérification{envoi.eleve.faites > 1 ? 's' : ''}
                  {denominateur ? ` sur ${denominateur}` : ''}
                </p>
              </div>
              <button
                type="button"
                className={styles.popupFermer}
                onClick={() => setEnvoi(null)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </header>

            <div className={styles.popupCorps}>
              <label className={styles.champ}>
                Message
                <textarea
                  rows={4}
                  value={envoi.texte}
                  autoFocus
                  maxLength={500}
                  placeholder="Ce que tu veux lui dire…"
                  onChange={(ev) => setEnvoi({ ...envoi, texte: ev.target.value })}
                />
              </label>
              <p className={styles.popupNote}>
                Il le verra dans sa cloche pendant 14 jours, et le message le mènera à
                l’activité.
              </p>
            </div>

            <footer className={styles.popupPied}>
              <button type="button" className={styles.btnGhost} onClick={() => setEnvoi(null)}>
                Annuler
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={envoyer}
                disabled={occupe || !envoi.texte.trim()}
              >
                {occupe ? 'Envoi…' : 'Envoyer'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

// « 2026-08-16 » → « 16/08 » : dans un tableau, l'année est du bruit.
function formatJour(iso: string): string {
  const [, mois, jour] = iso.split('-');
  return mois && jour ? `${jour}/${mois}` : iso;
}
