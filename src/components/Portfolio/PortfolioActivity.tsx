'use client';

// La COLONNE 1 d'un portfolio côté élève : L'ÉTAPE OÙ IL EN ÉTAIT (décision JP,
// 2026-10-09 : « à gauche, affichage du portfolio là où l'apprenant l'avait
// laissé » ; la vue d'ensemble vit à droite, dans le sommaire). En-tête avec
// la section et le titre, puis échéance · statut IA · portée, objectifs,
// consigne, et ce qu'il y a à déposer :
//  - un RENVOI → une carte « Ouvrir l'activité » avec son état ;
//  - des DÉPÔTS texte → un champ qui grandit, l'exemple du prof en filigrane ;
//  - rien (SANS TRACE) → « Rien à déposer ici », et c'est l'élève qui coche.
// Une étape verrouillante non faite le dit en clair, avec ce qui manque.

import Link from 'next/link';
import AutoGrowTextarea from '@/components/AutoGrowTextarea';
import EmptyState from '@/components/EmptyState/EmptyState';
import PortfolioDepotGroupe from './PortfolioDepotGroupe';
import type { PortfolioEleve } from '@/hooks/usePortfolioEleve';
import { cequiManque, depotRempli, echeanceLisible, enRetard, faite, fermee, reponseDe } from '@/lib/portfolio-etat';
import { atelierLabel } from '@/types/didactique';
import { estEtapeSansTrace, PORTEE_LABELS, STATUT_IA_LABELS, type StatutIA } from '@/types/portfolio';
import { iconeAtelier } from '@/types/sequence-fle';
import styles from './Portfolio.module.css';

interface Props {
  eleve: PortfolioEleve;
  isPreviewMode?: boolean;
  lectureSeule?: boolean;
  // Le réglage IA de l'activité — le repli quand l'étape n'en fixe pas
  accesIA: boolean;
}

const ETAT_RENVOI: Record<string, { label: string; classe: string }> = {
  'a-faire': { label: 'à faire', classe: '' },
  'en-cours': { label: 'en cours', classe: 'etatEnCours' },
  fait: { label: 'remise', classe: 'etatFait' },
};

export default function PortfolioActivity({ eleve, isPreviewMode = false, lectureSeule = false, accesIA }: Props) {
  const { parcours, erreur, etapes, contenu, index, etape, allerA, deposer, cocher } = eleve;

  if (erreur) return <EmptyState icon="🗂️" message={erreur} />;
  if (!parcours) return <EmptyState icon="hourglass" message="En cours de chargement" />;
  if (!etape) return <EmptyState icon="🗂️" message="Ce portfolio n’a pas encore d’étape. Reviens bientôt !" />;

  const precedente = etapes[index - 1] ?? null;
  const suivante = etapes[index + 1] ?? null;
  const suivanteFermee = suivante ? fermee(etapes, index + 1, contenu) : false;
  const estFaite = faite(etape, contenu);
  const manque = cequiManque(etape, contenu);
  const retard = enRetard(etape, contenu);
  const ia: StatutIA = etape.ia ?? (accesIA ? 'libre' : 'aucune');
  const sansTrace = estEtapeSansTrace(etape);
  const renvoi = etape.nature === 'activite';
  const depots = etape.depots ?? [];
  const nbFaits = etapes.filter((e) => faite(e, contenu)).length;

  const navBouton = (cible: typeof precedente, sens: '←' | '→', ferme: boolean) =>
    cible ? (
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => allerA(cible.id)}
        disabled={ferme}
        title={ferme ? `Termine d’abord « ${etape.titre} »` : cible.titre}
      >
        {sens === '←' ? `← ${cible.titre}` : `${cible.titre} → ${ferme ? '🔒' : ''}`}
      </button>
    ) : (
      <span />
    );

  return (
    <div className={styles.eleveSection}>
      <div className={styles.eleveHead}>
        <div className={styles.eleveHeadTexte}>
          <span className={styles.eleveSect}>
            {etape.section ? `${etape.section} · ` : ''}étape {index + 1} sur {etapes.length}
          </span>
          <h2>{etape.titre}</h2>
        </div>
        <div className={styles.eleveNav}>
          {precedente && (
            <button type="button" className={styles.navBtnPetit} onClick={() => allerA(precedente.id)} title={precedente.titre}>
              ←
            </button>
          )}
          {suivante && (
            <button
              type="button"
              className={styles.navBtnPetit}
              onClick={() => allerA(suivante.id)}
              disabled={suivanteFermee}
              title={suivanteFermee ? `Termine d’abord « ${etape.titre} »` : suivante.titre}
            >
              {suivanteFermee ? '🔒' : '→'}
            </button>
          )}
        </div>
      </div>

      <div className={styles.eleveBody}>
        <div className={styles.meta}>
          {etape.echeance && (
            <span className={`${styles.tag} ${retard ? styles.tagRetard : styles.tagEcheance}`}>
              📅 Échéance · {echeanceLisible(etape.echeance, true)}
              {retard && ' — en retard'}
            </span>
          )}
          <span className={`${styles.tag} ${styles[`tagIa_${ia}`]}`} title={STATUT_IA_LABELS[ia].long}>
            🤖 {STATUT_IA_LABELS[ia].court} — {STATUT_IA_LABELS[ia].long}
          </span>
          <span className={`${styles.tag} ${etape.portee === 'collective' ? styles.tagCollectif : styles.tagPerso}`}>
            {etape.portee === 'collective' ? '👥' : '👤'} {PORTEE_LABELS[etape.portee ?? 'personnelle']}
          </span>
          {estFaite && <span className={`${styles.tag} ${styles.tagFait}`}>✓ Étape faite</span>}
        </div>

        {(etape.objectifs?.length ?? 0) > 0 && (
          <>
            <h4 className={styles.h4}>Objectifs</h4>
            <ul className={styles.objectifs}>
              {etape.objectifs!.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </>
        )}

        {etape.consigne?.trim() && (
          <>
            <h4 className={styles.h4}>Consigne</h4>
            <div className={styles.consigne}>{etape.consigne}</div>
          </>
        )}

        <h4 className={styles.h4}>{renvoi ? 'Où ça se passe' : sansTrace ? 'Rien à déposer ici' : 'À déposer'}</h4>

        {renvoi && (
          <div className={styles.renvoiCarte}>
            <span className={styles.renvoiPicto} aria-hidden="true">{iconeAtelier(etape.atelier)}</span>
            <div className={styles.renvoiTexte}>
              <b>{etape.titre}</b>
              <span>
                {atelierLabel(etape.atelier ?? '', true) || etape.typeTravail || 'Activité'} ·{' '}
                <span className={styles[ETAT_RENVOI[etape.etatRenvoi ?? 'a-faire'].classe] ?? ''}>
                  {ETAT_RENVOI[etape.etatRenvoi ?? 'a-faire'].label}
                </span>
                {' — '}l’étape se coche quand l’activité est remise.
              </span>
            </div>
            <Link
              href={isPreviewMode ? `/activites/${etape.devoirId}?preview=true` : `/activites/${etape.devoirId}`}
              className={styles.btn}
            >
              {etape.etatRenvoi === 'fait' ? 'Revoir l’activité' : 'Ouvrir l’activité'}
            </Link>
          </div>
        )}

        {!renvoi && sansTrace && (
          <div className={styles.sansTrace}>
            <span className={styles.sansTraceBig} aria-hidden="true">🎭</span>
            <p>Cette étape se vit en classe ou ailleurs : rien à écrire dans le portfolio.</p>
            <label className={styles.cocherMoi}>
              <input
                type="checkbox"
                checked={contenu.cochees.includes(etape.id)}
                onChange={(e) => cocher(etape.id, e.target.checked)}
                disabled={lectureSeule}
              />
              J’ai fait cette étape
            </label>
          </div>
        )}

        {!renvoi &&
          depots.map((d) => {
            const valeur = reponseDe(contenu, etape.id, d.id);
            const rempli = depotRempli(contenu, etape.id, d);
            return (
              <div key={d.id} className={styles.depotEleve}>
                <div className={styles.depotLib}>
                  {d.libelle}
                  {d.obligatoire !== false && <span className={styles.depotObl}>· obligatoire</span>}
                  <span className={`${styles.depotEtat} ${rempli ? styles.depotEtatOk : ''}`}>
                    {rempli ? (d.type === 'groupe' ? '✓ groupe accepté' : '✓ déposé') : d.type === 'groupe' && contenu.groupeStatut === 'attente' ? '⏳ en attente du professeur' : 'à faire'}
                  </span>
                </div>
                {d.consigne && <p className={styles.depotAide}>{d.consigne}</p>}
                {d.type === 'groupe' ? (
                  <PortfolioDepotGroupe eleve={eleve} lectureSeule={lectureSeule} />
                ) : (
                  <>
                    <AutoGrowTextarea
                      className={styles.champ}
                      value={valeur}
                      onChange={(e) => deposer(etape.id, d.id, e.target.value)}
                      placeholder={d.exemple || 'Écris ici…'}
                      minRows={3}
                      maxRows={18}
                      disabled={lectureSeule}
                    />
                    {d.exemple && !rempli && <div className={styles.sauve}>L’exemple s’efface quand tu écris</div>}
                  </>
                )}
              </div>
            );
          })}

        {etape.verrouille && !estFaite && suivante && (
          <div className={styles.verrouMsg}>
            <span className={styles.verrouBig} aria-hidden="true">🔒</span>
            <div>
              <b>« {suivante.titre} » s’ouvrira quand cette étape sera faite</b>
              {manque.length > 0 && <span>Il manque : {manque.join(', ')}.</span>}
            </div>
          </div>
        )}

        <div className={styles.bas}>
          {navBouton(precedente, '←', false)}
          <span className={styles.basMilieu}>
            {nbFaits} étape{nbFaits > 1 ? 's' : ''} faite{nbFaits > 1 ? 's' : ''} sur {etapes.length}
          </span>
          {navBouton(suivante, '→', suivanteFermee)}
        </div>
      </div>
    </div>
  );
}
