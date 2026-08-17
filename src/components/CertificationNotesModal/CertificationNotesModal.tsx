'use client';

// Saisie des notes d'une certification, élève par élève.
//
// Une seule popup, DEUX portes d'entrée :
//  - la ligne ⭐ Certification de la scénarisation (toutes les classes du parcours) ;
//  - le bloc « Certifications » du détail d'une classe (`classeId` la restreint).
//
// Quand la certification est rattachée à une activité Recto-versIA, la note de
// la correction est PROPOSÉE en gris ; ce que le prof tape prime toujours sur
// elle. Une case laissée vide reprend donc la note de l'activité.
//
// L'enregistrement est EXPLICITE (bouton) : une grille de notes n'est pas un
// champ qu'on modifie en passant, et la fermeture prévient si rien n'est parti.

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { CEINTURES_ATTRIBUABLES, SEUIL_CERTIFICATION, ceintureParId } from '@/types/ceintures';
import type { CertificationNotesPayload, LigneNoteCertification } from '@/types/certification';
import styles from './CertificationNotesModal.module.css';

interface Props {
  moduleId: string;
  // Restreint la saisie à une classe — utilisé depuis Mes Classes
  classeId?: string | null;
  onClose: () => void;
  // Prévient le parent qu'au moins une note a bougé (rafraîchir un compteur)
  onEnregistre?: () => void;
}

export default function CertificationNotesModal({
  moduleId,
  classeId,
  onClose,
  onEnregistre,
}: Props) {
  const { getAuthHeaders } = useAuth();
  const [payload, setPayload] = useState<CertificationNotesPayload | null>(null);
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  // Certification non cotée : une case cochée par élève, rien de plus
  const [faits, setFaits] = useState<Record<string, boolean>>({});
  const [date, setDate] = useState('');
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modifie, setModifie] = useState(false);

  const fermer = useCallback(() => {
    if (modifie && !window.confirm('Des notes ne sont pas enregistrées. Fermer quand même ?')) {
      return;
    }
    onClose();
  }, [modifie, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fermer]);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const url = `/api/certifications/notes?moduleId=${encodeURIComponent(moduleId)}${
          classeId ? `&classeId=${encodeURIComponent(classeId)}` : ''
        }`;
        const res = await fetch(url, { headers });
        const json = await res.json();
        if (annule) return;
        if (!json.success) {
          setErreur(json.message || 'Certification introuvable');
          return;
        }
        const data = json.data as CertificationNotesPayload;
        setPayload(data);
        setDate(data.date || new Date().toISOString().slice(0, 10));
        // Le champ est PRÉREMPLI avec la note de l'activité rattachée quand
        // rien n'a été saisi : sans cela, la note resterait une suggestion
        // jamais enregistrée — et n'atteindrait donc jamais le profil de
        // l'élève, qui ne lit que les notes écrites en base.
        const init: Record<string, string> = {};
        const initFaits: Record<string, boolean> = {};
        data.lignes.forEach((l) => {
          const valeur = l.percent ?? l.percentAuto;
          init[l.eleveId] = valeur === null ? '' : String(valeur);
          initFaits[l.eleveId] = l.fait;
        });
        setSaisies(init);
        setFaits(initFaits);
      } catch (err) {
        console.error('Erreur chargement notes de certification:', err);
        if (!annule) setErreur('Erreur de chargement');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [moduleId, classeId, getAuthHeaders]);

  const cotee = (payload?.cotation ?? 'note') === 'note';

  // La note retenue pour l'affichage : ce qui est tapé, sinon celle de l'activité
  const retenue = (ligne: LigneNoteCertification): number | null => {
    const brut = saisies[ligne.eleveId];
    if (brut !== undefined && brut !== '') {
      const n = Number(brut);
      return Number.isFinite(n) ? n : null;
    }
    return ligne.percentAuto;
  };

  // La ceinture est-elle acquise ? Notée : 60 %. Non cotée : l'épreuve est faite.
  const gagnee = (ligne: LigneNoteCertification): boolean =>
    cotee ? (retenue(ligne) ?? -1) >= SEUIL_CERTIFICATION : faits[ligne.eleveId] === true;

  const enregistrer = async () => {
    if (!payload) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/certifications/notes', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          moduleId,
          date,
          notes: payload.lignes.map((l) => ({
            eleveId: l.eleveId,
            percent: saisies[l.eleveId] === '' ? null : Number(saisies[l.eleveId]),
            fait: faits[l.eleveId] === true,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setErreur(json.message || 'Enregistrement refusé');
        return;
      }
      setModifie(false);
      onEnregistre?.();
      onClose();
    } catch (err) {
      console.error('Erreur enregistrement notes de certification:', err);
      setErreur('Erreur réseau');
    } finally {
      setEnvoi(false);
    }
  };

  const ceinture = ceintureParId(payload?.ceinture);
  const obtenues = payload ? payload.lignes.filter(gagnee).length : 0;
  const notees = payload
    ? payload.lignes.filter((l) => (cotee ? retenue(l) !== null : faits[l.eleveId] === true)).length
    : 0;
  // Une seule classe à l'écran ? la colonne devient du bruit
  const plusieursClasses = payload
    ? new Set(payload.lignes.map((l) => l.classeNom)).size > 1
    : false;

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.head}>
          <div>
            <h3 className={styles.title}>
              ⭐ {payload?.titre || 'Certification'}
            </h3>
            <div className={styles.sub}>
              {payload && (
                <>
                  {payload.uaa.length > 0
                    ? payload.uaa.map((u) => `UAA ${u}`).join(' · ')
                    : 'aucune UAA déclarée'}
                  {' · '}
                  {ceinture ? (
                    <span className={styles.beltInline}>
                      <span
                        className={styles.beltDot}
                        style={{
                          background: ceinture.couleur,
                          borderColor: ceinture.contour || ceinture.couleur,
                        }}
                      />
                      ceinture {ceinture.label.toLowerCase()}
                    </span>
                  ) : (
                    'aucune ceinture déclarée'
                  )}
                  {' · '}
                  {cotee
                    ? `${payload.ponderation} % du total de l’UAA`
                    : 'non cotée — la ceinture s’obtient au seul fait d’avoir été faite'}
                </>
              )}
            </div>
          </div>
          <button type="button" className={styles.close} onClick={fermer} title="Fermer">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {chargement && <p className={styles.info}>Chargement…</p>}
          {!chargement && erreur && <p className={styles.error}>{erreur}</p>}

          {!chargement && payload && payload.lignes.length === 0 && (
            <p className={styles.info}>
              Aucun élève concerné. Vérifiez que le parcours désigne bien ses classes
              (bandeau « Classes » en tête de la scénarisation).
            </p>
          )}

          {!chargement && payload && payload.lignes.length > 0 && (
            <>
              <div className={styles.toolbar}>
                <label className={styles.dateField}>
                  Date de l’épreuve
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setModifie(true);
                    }}
                  />
                </label>
                {payload.devoirId && cotee && (
                  <span className={styles.autoHint}>
                    Notes reprises de l’activité rattachée — modifiables, et enregistrées
                    seulement quand vous validez.
                  </span>
                )}
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    {plusieursClasses && <th className={styles.thClasse}>Classe</th>}
                    <th>Élève</th>
                    <th className={styles.thNote}>{cotee ? 'Résultat (%)' : 'Fait'}</th>
                    <th className={styles.thBelt}>Ceinture</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.lignes.map((l) => {
                    const note = retenue(l);
                    const obtenue = gagnee(l);
                    const vide = cotee ? note === null : faits[l.eleveId] !== true;
                    return (
                      <tr key={l.eleveId}>
                        {plusieursClasses && <td className={styles.tdClasse}>{l.classeNom}</td>}
                        <td className={styles.tdNom}>
                          {l.nom} {l.prenom}
                        </td>
                        <td className={styles.tdNote}>
                          {cotee ? (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className={styles.noteInput}
                              value={saisies[l.eleveId] ?? ''}
                              placeholder={l.percentAuto !== null ? String(l.percentAuto) : '—'}
                              onChange={(e) => {
                                setSaisies((prev) => ({ ...prev, [l.eleveId]: e.target.value }));
                                setModifie(true);
                              }}
                            />
                          ) : (
                            /* Non cotée : il n'y a rien à noter, seulement à
                               constater. Une case, pas un champ. */
                            <input
                              type="checkbox"
                              className={styles.faitBox}
                              checked={faits[l.eleveId] === true}
                              aria-label={`Épreuve faite par ${l.nom} ${l.prenom}`}
                              onChange={(e) => {
                                setFaits((prev) => ({ ...prev, [l.eleveId]: e.target.checked }));
                                setModifie(true);
                              }}
                            />
                          )}
                        </td>
                        <td className={styles.tdBelt}>
                          {obtenue && ceinture ? (
                            <span className={styles.beltWon}>
                              <img src={ceinture.image} alt="" className={styles.beltImg} />
                              {ceinture.label.toLowerCase()}
                            </span>
                          ) : vide ? (
                            <span className={styles.beltNone}>—</span>
                          ) : (
                            <span className={styles.beltMissed}>
                              &lt; {SEUIL_CERTIFICATION} %
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className={styles.foot}>
          <span className={styles.tally}>
            {notees}/{payload?.lignes.length ?? 0}{' '}
            {cotee ? `noté${notees > 1 ? 's' : ''}` : `fait${notees > 1 ? 's' : ''}`} ·{' '}
            <strong>{obtenues}</strong> ceinture{obtenues > 1 ? 's' : ''} obtenue
            {obtenues > 1 ? 's' : ''}
          </span>
          <button type="button" className={styles.btnGhost} onClick={fermer}>
            Annuler
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={enregistrer}
            disabled={envoi || chargement || !payload?.lignes.length}
          >
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Le menu de choix d'une ceinture — partagé par la scénarisation. Il vit ici
// pour que la liste des ceintures n'ait qu'un seul rendu dans l'application.
export function CeinturePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title="Ceinture accordée si le résultat atteint 60 %"
    >
      <option value="">— ceinture —</option>
      {/* La blanche est absente : elle est acquise dès l'entrée dans le
          parcours, aucune certification ne l'accorde. */}
      {CEINTURES_ATTRIBUABLES.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
