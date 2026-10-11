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
import { cequiManque, echeanceLisible, enCours, enRetard, etatEtape, faite, fermee, lireContenuEleve, reponseDe, type ParcoursPortfolio } from '@/lib/portfolio-etat';
import { atelierLabel } from '@/types/didactique';
import type { Travail } from '@/types/travail';
import {
  aUnDepotGroupe,
  estEtapeSansTrace,
  GROUPE_STATUT_LABELS,
  groupeSolo,
  nombreEtapes,
  numeroEtape,
  sectionsDuPortfolio,
  STATUT_IA_LABELS,
  TYPE_DEPOT_LABELS,
  typesDuDepot,
  etapeASoumettre,
  valeursAffichees,
  type GroupeVue,
  type SuiviPortfolio,
} from '@/types/portfolio';
import PortfolioDepotLien from './PortfolioDepotLien';
import PortfolioRetourProf from './PortfolioRetourProf';
import PortfolioValeur from './PortfolioValeur';
import PortfolioDepotImage from './PortfolioDepotImage';
import PortfolioDepotTableau from './PortfolioDepotTableau';
import { iconeAtelier } from '@/types/sequence-fle';
import IaPicto from './IaPicto';
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
  // Le suivi (soumissions, retours, valeurs) du groupe de cet élève
  const [suivi, setSuivi] = useState<SuiviPortfolio | null>(null);
  const [suiviGroupe, setSuiviGroupe] = useState(false);

  const charger = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const eleve = encodeURIComponent(travail.studentId);
      const [p, g, sv] = await Promise.all([
        fetch(`/api/devoirs/${devoirId}/parcours-portfolio?eleve=${eleve}`, { headers }).then((r) => r.json()),
        fetch(`/api/portfolio/groupe?devoirId=${encodeURIComponent(devoirId)}`, { headers }).then((r) => r.json()),
        fetch(`/api/portfolio/suivi?devoirId=${encodeURIComponent(devoirId)}&eleve=${eleve}`, { headers }).then((r) => r.json()),
      ]);
      if (sv.success) {
        setSuivi(sv.data.suivi as SuiviPortfolio);
        setSuiviGroupe(sv.data.groupe === true);
      }
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
  const contenu = { ...lireContenuEleve(travail.content), groupeStatut: groupe?.statut ?? null, suivi };
  const etapes = parcours.etapes;
  const sections = sectionsDuPortfolio(etapes);
  const nbFaites = etapes.filter((e) => !e.introduction && faite(e, contenu)).length;

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
        {nbFaites} étape{nbFaites > 1 ? 's' : ''} faite{nbFaites > 1 ? 's' : ''} sur {nombreEtapes(etapes)}
        {parcours.tacheFinale && <span> · Tâche finale : {parcours.tacheFinale}</span>}
      </div>

      {aUnDepotGroupe(etapes) && (
        <div className={styles.lectureGroupe}>
          <h3 className={styles.lectureH3}>{groupe && groupeSolo(groupe) ? '🙋 L’élève travaille seul' : '👥 Groupe de l’élève'}</h3>
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
                    {groupeSolo(groupe) ? 'Accepter le travail seul' : 'Accepter le groupe'}
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
                      {groupeSolo(groupe) ? 'Refuser le travail seul' : 'Refuser le groupe'}
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
                  <span className={styles.lectureNum}>{numeroEtape(etapes, i) ?? '◎'}</span>
                  <span className={styles.lectureTitre}>{e.titre}</span>
                  <span className={`${styles.lectureEtat} ${estFaite ? styles.lectureEtatOk : estFermee ? styles.lectureEtatFerme : enCours(e, contenu) ? styles.lectureEtatCours : ''}`}>
                    {estFaite ? '✓ faite' : estFermee ? '🔒 fermée' : enCours(e, contenu) ? 'en cours' : 'à faire'}
                  </span>
                </header>
                <div className={styles.badges} style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
                  {e.echeance && <span className={`${styles.badge} ${retard ? styles.badgeRetard : ''}`}>📅 {echeanceLisible(e.echeance)}{retard && ' · en retard'}</span>}
                  {e.ia && <span className={styles.badge}><IaPicto statut={e.ia} className={styles.iaPicto} /> {STATUT_IA_LABELS[e.ia].court}</span>}
                  {e.portee === 'collective' && <span className={`${styles.badge} ${styles.badgeCollectif}`}>👥 collective</span>}
                  {e.verrouille && <span className={`${styles.badge} ${styles.badgeVerrou}`}>🔒 verrouille la suivante</span>}
                  {e.validation?.bloquante && <span className={`${styles.badge} ${styles.badgeVerrou}`}>✓🔒 la suite attend votre validation</span>}
                </div>
                {valeursAffichees(etapes, e, suivi).map((v) => (
                  <PortfolioValeur key={v.valeurId} valeur={v} devoirId={devoirId} eleveUid={travail.studentId} />
                ))}
                {renvoi && (
                  <p className={styles.lectureRenvoi}>
                    <span aria-hidden="true">{iconeAtelier(e.atelier)}</span> Activité « {e.titre} » ({atelierLabel(e.atelier ?? '', true) || e.typeTravail}) —{' '}
                    {e.etatRenvoi === 'fait' ? 'remise' : e.etatRenvoi === 'en-cours' ? 'en cours' : 'pas commencée'}.
                  </p>
                )}
                {sansTrace && !e.introduction && <p className={styles.lectureRenvoi}>Étape sans trace — {contenu.cochees.includes(e.id) ? 'cochée par l’élève' : 'pas encore cochée'}.</p>}
                {e.introduction && <p className={styles.lectureRenvoi}>Introduction — {contenu.cochees.includes(e.id) ? 'ouverte par l’élève' : 'pas encore ouverte'}.</p>}
                {!renvoi &&
                  (e.depots ?? []).map((d) => {
                    const types = typesDuDepot(d);
                    const remplies = types.filter((t) => reponseDe(contenu, e.id, d.id, t).trim());
                    return (
                      <div key={d.id} className={styles.lectureDepot}>
                        <div className={styles.lectureDepotLib}>
                          {d.libelle}
                          {d.obligatoire !== false && <span className={styles.depotObl}>· obligatoire</span>}
                        </div>
                        {types.includes('groupe') ? (
                          <p className={styles.depotAide}>Dépôt « groupe » — voir le bloc en tête.</p>
                        ) : remplies.length === 0 ? (
                          <p className={styles.lectureVide}>Rien déposé.</p>
                        ) : (
                          types.map((t) => {
                            const valeur = reponseDe(contenu, e.id, d.id, t);
                            return (
                              <div key={t}>
                                {types.length > 1 && <span className={styles.partieLib}>{TYPE_DEPOT_LABELS[t]}</span>}
                                {!valeur.trim() ? (
                                  <p className={styles.lectureVide}>Rien déposé.</p>
                                ) : t === 'lien' ? (
                                  <PortfolioDepotLien valeur={valeur} lectureSeule />
                                ) : t === 'image' ? (
                                  <PortfolioDepotImage valeur={valeur} lectureSeule />
                                ) : t === 'tableau' ? (
                                  <PortfolioDepotTableau
                                    valeur={valeur}
                                    colonnes={d.colonnes?.length ? d.colonnes : ['Réponse']}
                                    lectureSeule
                                  />
                                ) : (
                                  <div className={styles.lectureTexte}>{valeur}</div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                {etapeASoumettre(e) && (
                  <PortfolioRetourProf
                    devoirId={devoirId}
                    eleveUid={travail.studentId}
                    etape={e}
                    etat={etatEtape(e, contenu)}
                    suivi={suivi}
                    groupe={suiviGroupe}
                    getAuthHeaders={getAuthHeaders}
                    onSuivi={setSuivi}
                  />
                )}
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
