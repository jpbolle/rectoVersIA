'use client';

// Le DÉPÔT « GROUPE » côté élève (maquette v2, vue 2) : il liste ses
// partenaires (champ qui filtre les élèves de la classe, sans accent ni
// casse — règle du projet au-delà de cinq choix), chacun confirme de son
// côté, puis le professeur accepte ou refuse depuis la copie. Tant que le
// groupe n'est pas accepté, l'étape n'est pas faite.

import { useMemo, useState } from 'react';
import type { PortfolioEleve } from '@/hooks/usePortfolioEleve';
import { GROUPE_STATUT_LABELS } from '@/types/portfolio';
import styles from './Portfolio.module.css';

function plat(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface Props {
  eleve: PortfolioEleve;
  lectureSeule?: boolean;
}

export default function PortfolioDepotGroupe({ eleve, lectureSeule = false }: Props) {
  const { groupe, camarades, groupeErreur, groupeChargement, declarerGroupe, repondreGroupe } = eleve;
  const [choisis, setChoisis] = useState<string[]>([]);
  const [recherche, setRecherche] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const q = plat(recherche.trim());
  const candidats = useMemo(
    () => camarades.filter((c) => !choisis.includes(c.eleveId) && (!q || plat(c.nom).includes(q))).slice(0, 12),
    [camarades, choisis, q]
  );

  const envoyer = async (fn: () => Promise<boolean>) => {
    setEnvoi(true);
    try {
      await fn();
    } finally {
      setEnvoi(false);
    }
  };

  if (groupeChargement && !groupe && camarades.length === 0) {
    return <p className={styles.depotAide}>Chargement des élèves de ta classe…</p>;
  }

  const moi = groupe?.membres.find((m) => m.moi);
  const peutRecomposer = !lectureSeule && (!groupe || groupe.statut === 'refuse');

  return (
    <div className={styles.groupe}>
      {groupe && (
        <>
          <div className={styles.membres}>
            {groupe.membres.map((m) => (
              <div key={m.eleveId} className={styles.membre}>
                <span className={styles.membreAv} aria-hidden="true">
                  {m.nom
                    .split(/\s+/)
                    .map((p) => p[0] ?? '')
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <span className={styles.membreNom}>
                  {m.nom}
                  {m.moi && <small> (toi)</small>}
                  {m.createur && !m.moi && <small> · a déclaré le groupe</small>}
                </span>
                <span className={`${styles.membreSt} ${m.statut === 'confirme' ? styles.membreStOk : m.statut === 'decline' ? styles.membreStNon : ''}`}>
                  {m.statut === 'confirme' ? '✓ a confirmé' : m.statut === 'decline' ? 'a décliné' : 'en attente de sa confirmation'}
                </span>
              </div>
            ))}
          </div>

          <div className={`${styles.statut} ${groupe.statut === 'accepte' ? styles.statutOk : groupe.statut === 'refuse' ? styles.statutNon : styles.statutAtt}`}>
            {groupe.statut === 'accepte' && '✓ '}
            {groupe.statut === 'attente' && '⏳ '}
            {groupe.statut === 'refuse' && '✕ '}
            {GROUPE_STATUT_LABELS[groupe.statut]}
            {groupe.statut === 'refuse' && groupe.motif && <> — « {groupe.motif} »</>}
            {groupe.statut === 'attente' && ' — tant qu’il ne l’est pas, les étapes collectives restent personnelles.'}
          </div>

          {!lectureSeule && groupe.statut !== 'accepte' && moi && !moi.createur && moi.statut === 'attente' && (
            <div className={styles.groupeActions}>
              <button type="button" className={styles.btn} disabled={envoi} onClick={() => envoyer(() => repondreGroupe(groupe.id, 'confirmer'))}>
                Je confirme
              </button>
              <button type="button" className={styles.btnGhost} disabled={envoi} onClick={() => envoyer(() => repondreGroupe(groupe.id, 'decliner'))}>
                Je décline
              </button>
            </div>
          )}
          {!lectureSeule && groupe.statut === 'attente' && moi && (moi.createur || moi.statut !== 'attente') && (
            <div className={styles.groupeActions}>
              <button type="button" className={styles.btnGhost} disabled={envoi} onClick={() => envoyer(() => repondreGroupe(groupe.id, 'quitter'))}>
                {moi.createur ? 'Dissoudre et recomposer' : 'Quitter ce groupe'}
              </button>
            </div>
          )}
        </>
      )}

      {peutRecomposer && (
        <div className={styles.groupeForm}>
          {groupe?.statut === 'refuse' && <p className={styles.depotAide}>Recompose ton groupe puis déclare-le à nouveau.</p>}
          {choisis.length > 0 && (
            <div className={styles.chips}>
              {choisis.map((id) => {
                const c = camarades.find((x) => x.eleveId === id);
                return (
                  <span key={id} className={styles.chip}>
                    {c?.nom ?? id}
                    <button type="button" onClick={() => setChoisis((l) => l.filter((x) => x !== id))} aria-label={`Retirer ${c?.nom ?? ''}`}>
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <input
            className={styles.input}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={camarades.length ? 'Ajoute un élève de ta classe… (tape les premières lettres)' : 'Aucun camarade trouvé dans tes classes'}
            disabled={camarades.length === 0}
          />
          {candidats.length > 0 && (recherche.trim() || choisis.length === 0) && (
            <div className={styles.candidats}>
              {candidats.map((c) => (
                <button
                  key={c.eleveId}
                  type="button"
                  className={styles.candidat}
                  onClick={() => {
                    setChoisis((l) => [...l, c.eleveId]);
                    setRecherche('');
                  }}
                >
                  {c.nom}
                </button>
              ))}
            </div>
          )}
          <div className={styles.groupeActions}>
            <button
              type="button"
              className={styles.btn}
              disabled={envoi || choisis.length === 0}
              onClick={() =>
                envoyer(async () => {
                  const ok = await declarerGroupe(choisis);
                  if (ok) setChoisis([]);
                  return ok;
                })
              }
            >
              Déclarer mon groupe ({choisis.length + 1} élève{choisis.length + 1 > 1 ? 's' : ''})
            </button>
          </div>
        </div>
      )}
      {groupeErreur && <p className={styles.groupeErreur}>{groupeErreur}</p>}
    </div>
  );
}
