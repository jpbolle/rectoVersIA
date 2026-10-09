'use client';

// LA COPIE D'UN PORTFOLIO, LUE PAR LE PROF — colonne de gauche de la page de
// correction. Toutes les étapes dépliées, section par section, avec l'état
// de chacune (faite / en cours / à faire / fermée), les textes déposés en
// lecture, les renvois avec l'état de la copie de l'activité renvoyée. En
// tête, le GROUPE déclaré par l'élève, à accepter ou refuser (avec motif).
//
// Le portfolio n'est pas noté ici (grille à l'étape 7 du chantier) : le prof
// lit, et commente dans le commentaire général.

import { useCallback, useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState/EmptyState';
import { cequiManque, echeanceLisible, enCours, enRetard, faite, fermee, lireContenuEleve, reponseDe, type ParcoursPortfolio } from '@/lib/portfolio-etat';
import { atelierLabel } from '@/types/didactique';
import type { Travail } from '@/types/travail';
import { aUnDepotGroupe, estEtapeSansTrace, GROUPE_STATUT_LABELS, sectionsDuPortfolio, STATUT_IA_LABELS, type GroupeVue } from '@/types/portfolio';
import { iconeAtelier } from '@/types/sequence-fle';
import styles from './Portfolio.module.css';

interface Props {
  devoirId: string;
  travail: Travail;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
}

export default function PortfolioLecture({ devoirId, travail, getAuthHeaders }: Props) {
  const [parcours, setParcours] = useState<ParcoursPortfolio | null>(null);
  const [groupes, setGroupes] = useState<GroupeVue[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [refusEnCours, setRefusEnCours] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const [p, g] = await Promise.all([
        fetch(`/api/devoirs/${devoirId}/parcours-portfolio?eleve=${encodeURIComponent(travail.studentId)}`, { headers }).then((r) => r.json()),
        fetch(`/api/portfolio/groupe?devoirId=${encodeURIComponent(devoirId)}`, { headers }).then((r) => r.json()),
      ]);
      if (p.success) setParcours(p.data as ParcoursPortfolio);
      else setErreur(p.message || 'Portfolio introuvable');
      if (g.success) setGroupes((g.data?.groupes as GroupeVue[]) ?? []);
    } catch {
      setErreur('Portfolio introuvable');
    }
  }, [getAuthHeaders, devoirId, travail.studentId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (erreur) return <EmptyState icon="🗂️" message={erreur} />;
  if (!parcours) return <EmptyState icon="hourglass" message="En cours de chargement" />;

  // Le groupe de CET élève : celui où figure son uid (non refusé d'abord)
  const siens = groupes.filter((g) => g.membres.some((m) => m.uid === travail.studentId));
  const groupe = siens.find((g) => g.statut !== 'refuse') ?? siens[0] ?? null;
  const contenu = { ...lireContenuEleve(travail.content), groupeStatut: groupe?.statut ?? null };
  const etapes = parcours.etapes;
  const sections = sectionsDuPortfolio(etapes);
  const nbFaites = etapes.filter((e) => faite(e, contenu)).length;

  const decider = async (action: 'accepter' | 'refuser' | 'annuler') => {
    if (!groupe) return;
    setEnvoi(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/portfolio/groupe', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ groupeId: groupe.id, action, motif: action === 'refuser' ? motif : undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Action impossible');
      setRefusEnCours(false);
      setMotif('');
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className={styles.lecture}>
      <div className={styles.lectureCompteur}>
        {nbFaites} étape{nbFaites > 1 ? 's' : ''} faite{nbFaites > 1 ? 's' : ''} sur {etapes.length}
        {parcours.tacheFinale && <span> · Tâche finale : {parcours.tacheFinale}</span>}
      </div>

      {aUnDepotGroupe(etapes) && (
        <div className={styles.lectureGroupe}>
          <h3 className={styles.lectureH3}>👥 Groupe de l’élève</h3>
          {!groupe ? (
            <p className={styles.depotAide}>Aucun groupe déclaré pour l’instant.</p>
          ) : (
            <>
              <div className={styles.membres}>
                {groupe.membres.map((m) => (
                  <div key={m.eleveId} className={styles.membre}>
                    <span className={styles.membreNom}>
                      {m.nom}
                      {m.createur && <small> · a déclaré le groupe</small>}
                    </span>
                    <span className={`${styles.membreSt} ${m.statut === 'confirme' ? styles.membreStOk : m.statut === 'decline' ? styles.membreStNon : ''}`}>
                      {m.statut === 'confirme' ? '✓ confirmé' : m.statut === 'decline' ? 'a décliné' : 'en attente'}
                    </span>
                  </div>
                ))}
              </div>
              <div className={`${styles.statut} ${groupe.statut === 'accepte' ? styles.statutOk : groupe.statut === 'refuse' ? styles.statutNon : styles.statutAtt}`}>
                {GROUPE_STATUT_LABELS[groupe.statut]}
                {groupe.statut === 'refuse' && groupe.motif && <> — « {groupe.motif} »</>}
              </div>
              <div className={styles.groupeActions}>
                {groupe.statut !== 'accepte' && (
                  <button type="button" className={styles.btn} disabled={envoi} onClick={() => decider('accepter')}>
                    Accepter le groupe
                  </button>
                )}
                {groupe.statut === 'attente' && !refusEnCours && (
                  <button type="button" className={styles.btnGhost} disabled={envoi} onClick={() => setRefusEnCours(true)}>
                    Refuser…
                  </button>
                )}
                {groupe.statut === 'accepte' && (
                  <button type="button" className={styles.btnGhost} disabled={envoi} onClick={() => decider('annuler')}>
                    Remettre en attente
                  </button>
                )}
              </div>
              {refusEnCours && (
                <div className={styles.groupeForm}>
                  <input
                    className={styles.input}
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder="Motif du refus, lu par l’élève (facultatif)"
                    autoFocus
                  />
                  <div className={styles.groupeActions}>
                    <button type="button" className={styles.btnNon} disabled={envoi} onClick={() => decider('refuser')}>
                      Refuser le groupe
                    </button>
                    <button type="button" className={styles.btnGhost} onClick={() => setRefusEnCours(false)}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {sections.map((s, si) => (
        <section key={s.section || si} className={styles.lectureSection}>
          {s.section && <h3 className={styles.lectureH3}>{s.section}</h3>}
          {s.etapes.map(({ etape: e, index: i }) => {
            const estFaite = faite(e, contenu);
            const estFermee = fermee(etapes, i, contenu);
            const retard = enRetard(e, contenu);
            const sansTrace = estEtapeSansTrace(e);
            const renvoi = e.nature === 'activite';
            return (
              <article key={e.id} className={`${styles.lectureEtape} ${estFaite ? styles.lectureEtapeFaite : ''}`}>
                <header className={styles.lectureEtapeTete}>
                  <span className={styles.lectureNum}>{i + 1}</span>
                  <span className={styles.lectureTitre}>{e.titre}</span>
                  <span className={`${styles.lectureEtat} ${estFaite ? styles.lectureEtatOk : estFermee ? styles.lectureEtatFerme : enCours(e, contenu) ? styles.lectureEtatCours : ''}`}>
                    {estFaite ? '✓ faite' : estFermee ? '🔒 fermée' : enCours(e, contenu) ? 'en cours' : 'à faire'}
                  </span>
                </header>
                <div className={styles.badges} style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
                  {e.echeance && <span className={`${styles.badge} ${retard ? styles.badgeRetard : ''}`}>📅 {echeanceLisible(e.echeance)}{retard && ' · en retard'}</span>}
                  {e.ia && <span className={styles.badge}>{STATUT_IA_LABELS[e.ia].picto} {STATUT_IA_LABELS[e.ia].court}</span>}
                  {e.portee === 'collective' && <span className={`${styles.badge} ${styles.badgeCollectif}`}>👥 collective</span>}
                  {e.verrouille && <span className={`${styles.badge} ${styles.badgeVerrou}`}>🔒 verrouille la suivante</span>}
                </div>
                {renvoi && (
                  <p className={styles.lectureRenvoi}>
                    <span aria-hidden="true">{iconeAtelier(e.atelier)}</span> Activité « {e.titre} » ({atelierLabel(e.atelier ?? '', true) || e.typeTravail}) —{' '}
                    {e.etatRenvoi === 'fait' ? 'remise' : e.etatRenvoi === 'en-cours' ? 'en cours' : 'pas commencée'}.
                  </p>
                )}
                {sansTrace && <p className={styles.lectureRenvoi}>Étape sans trace — {contenu.cochees.includes(e.id) ? 'cochée par l’élève' : 'pas encore cochée'}.</p>}
                {!renvoi &&
                  (e.depots ?? []).map((d) => {
                    const texte = reponseDe(contenu, e.id, d.id);
                    return (
                      <div key={d.id} className={styles.lectureDepot}>
                        <div className={styles.lectureDepotLib}>
                          {d.libelle}
                          {d.obligatoire !== false && <span className={styles.depotObl}>· obligatoire</span>}
                        </div>
                        {d.type === 'groupe' ? (
                          <p className={styles.depotAide}>Dépôt « groupe » — voir le bloc en tête.</p>
                        ) : texte.trim() ? (
                          <div className={styles.lectureTexte}>{texte}</div>
                        ) : (
                          <p className={styles.lectureVide}>Rien déposé.</p>
                        )}
                      </div>
                    );
                  })}
                {!estFaite && !estFermee && cequiManque(e, contenu).length > 0 && (
                  <p className={styles.lectureManque}>Il manque : {cequiManque(e, contenu).join(', ')}.</p>
                )}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
