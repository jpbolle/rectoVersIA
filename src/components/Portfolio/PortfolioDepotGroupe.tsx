'use client';

// Le DÉPÔT « GROUPE » côté élève (maquette v2, vue 2) : il liste ses
// partenaires (champ qui filtre les élèves de la classe, sans accent ni
// casse — règle du projet au-delà de cinq choix), chacun confirme de son
// côté, puis le professeur accepte ou refuse depuis la copie. Tant que le
// groupe n'est pas accepté, l'étape n'est pas faite.
// « Je travaille seul » (2026-10-11) : un groupe d'un seul élève, accepté ou
// refusé par le prof comme les autres (`groupeSolo`).
// Plus de bouton « Déclarer mon groupe » (JP, 2026-10-11 : « un surplus
// admin ») : chaque partenaire ajouté ou retiré met la déclaration à jour sur
// le champ ; c'est « Soumettre au professeur » qui fait l'acte.

import { useMemo, useState } from 'react';
import type { PortfolioEleve } from '@/hooks/usePortfolioEleve';
import { GROUPE_STATUT_LABELS, groupeSolo } from '@/types/portfolio';
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
  const [recherche, setRecherche] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const moi = groupe?.membres.find((m) => m.moi);
  const solo = !!groupe && groupeSolo(groupe);
  // Composable : pas encore de groupe, groupe refusé, ou groupe en attente que
  // J'AI déclaré (j'y ajoute, j'en retire des partenaires)
  const editable =
    !lectureSeule && (!groupe || groupe.statut === 'refuse' || (groupe.statut === 'attente' && !!moi?.createur));
  // Les partenaires de ma déclaration en cours (ceux qui ont décliné en sortent
  // au prochain changement)
  const partenaires = useMemo(
    () =>
      groupe && groupe.statut !== 'accepte' && moi?.createur
        ? groupe.membres.filter((m) => !m.moi && m.statut !== 'decline').map((m) => m.eleveId)
        : [],
    [groupe, moi]
  );
  const dejaMembres = useMemo(() => new Set(groupe?.membres.map((m) => m.eleveId) ?? []), [groupe]);

  const q = plat(recherche.trim());
  const candidats = useMemo(
    () => camarades.filter((c) => !dejaMembres.has(c.eleveId) && (!q || plat(c.nom).includes(q))).slice(0, 12),
    [camarades, dejaMembres, q]
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

  // Chaque changement est envoyé tout de suite : la déclaration remplace la précédente
  const ajouter = (eleveId: string) => {
    setRecherche('');
    envoyer(() => declarerGroupe([...partenaires, eleveId]));
  };
  const retirer = (eleveId: string) => {
    const reste = partenaires.filter((id) => id !== eleveId);
    envoyer(() => (reste.length > 0 || !groupe ? declarerGroupe(reste) : repondreGroupe(groupe.id, 'quitter')));
  };

  return (
    <div className={styles.groupe}>
      {groupe && (
        <>
          {solo ? (
            <p className={styles.depotAide}>🙋 Tu as choisi de travailler seul.</p>
          ) : (
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
                {editable && moi?.createur && !m.moi && (
                  <button
                    type="button"
                    className={styles.btnGhost}
                    disabled={envoi}
                    onClick={() => retirer(m.eleveId)}
                    aria-label={`Retirer ${m.nom} du groupe`}
                    title="Retirer du groupe"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          )}

          <div className={`${styles.statut} ${groupe.statut === 'accepte' ? styles.statutOk : groupe.statut === 'refuse' ? styles.statutNon : styles.statutAtt}`}>
            {groupe.statut === 'accepte' && '✓ '}
            {groupe.statut === 'attente' && '⏳ '}
            {groupe.statut === 'refuse' && '✕ '}
            {solo ? (groupe.statut === 'accepte' ? 'Travail seul accepté' : groupe.statut === 'refuse' ? 'Travail seul refusé' : 'En attente du professeur') : GROUPE_STATUT_LABELS[groupe.statut]}
            {groupe.statut === 'refuse' && groupe.motif && <> — « {groupe.motif} »</>}
            {groupe.statut === 'attente' && !solo && ' — tant qu’il ne l’est pas, les étapes collectives restent personnelles.'}
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
          {!lectureSeule && groupe.statut === 'attente' && moi && (solo || (!moi.createur && moi.statut !== 'attente')) && (
            <div className={styles.groupeActions}>
              <button type="button" className={styles.btnGhost} disabled={envoi} onClick={() => envoyer(() => repondreGroupe(groupe.id, 'quitter'))}>
                {solo ? 'Changer d’avis' : 'Quitter ce groupe'}
              </button>
            </div>
          )}
        </>
      )}

      {editable && (
        <div className={styles.groupeForm}>
          {groupe?.statut === 'refuse' && (
            <p className={styles.depotAide}>Recompose ton groupe : chaque changement est envoyé à ton professeur.</p>
          )}
          <input
            className={styles.input}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={camarades.length ? 'Ajoute un élève de ta classe… (tape les premières lettres)' : 'Aucun camarade trouvé dans tes classes'}
            disabled={camarades.length === 0 || envoi}
          />
          {candidats.length > 0 && (recherche.trim() || partenaires.length === 0) && (
            <div className={styles.candidats}>
              {candidats.map((c) => (
                <button key={c.eleveId} type="button" className={styles.candidat} disabled={envoi} onClick={() => ajouter(c.eleveId)}>
                  {c.nom}
                </button>
              ))}
            </div>
          )}
          {partenaires.length === 0 && !solo && (
            <div className={styles.groupeActions}>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={envoi}
                onClick={() => envoyer(() => declarerGroupe([], true))}
                title="Ton professeur accepte ou refuse, comme pour un groupe"
              >
                🙋 Je travaille seul
              </button>
            </div>
          )}
        </div>
      )}
      {groupeErreur && <p className={styles.groupeErreur}>{groupeErreur}</p>}
    </div>
  );
}
