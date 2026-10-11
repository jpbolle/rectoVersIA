'use client';

// LA COPIE D'UN PORTFOLIO, LUE PAR LE PROF — colonne de gauche de la page de
// correction. Les étapes bout à bout, section par section, chacune REPLIABLE
// sur son en-tête (numéro, titre, pastille d'état) ; à l'ouverture, toutes
// sont repliées sauf celle où l'élève en est (JP, 2026-10-11). Dépliée :
// les textes déposés en lecture, les renvois avec l'état de la copie de
// l'activité renvoyée, le retour du prof. En tête, le GROUPE déclaré par
// l'élève, à accepter ou refuser (avec motif).
//
// Le portfolio n'est pas noté ici (grille à l'étape 7 du chantier) : le prof
// lit, et commente dans le commentaire général.

import { useCallback, useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState/EmptyState';
import { cequiManque, echeanceLisible, enCours, enRetard, etatEtape, faite, fermee, indexDepart, lireContenuEleve, reponseDe, type ParcoursPortfolio } from '@/lib/portfolio-etat';
import { atelierLabel } from '@/types/didactique';
import type { Travail } from '@/types/travail';
import {
  APPRECIATIONS,
  clePartie,
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
  type TypeDepot,
} from '@/types/portfolio';
import PortfolioDepotLien from './PortfolioDepotLien';
import PortfolioRetourProf from './PortfolioRetourProf';
import PortfolioApercuActivite from './PortfolioApercuActivite';
import SmileyAppreciation from './SmileyAppreciation';
import { PortfolioSceneTexte } from './PortfolioDepotScene';
import PortfolioValeur from './PortfolioValeur';
import PortfolioDepotImage from './PortfolioDepotImage';
import PortfolioDepotTableau from './PortfolioDepotTableau';
import { iconeAtelier } from '@/types/sequence-fle';
import IaPicto from './IaPicto';
import styles from './Portfolio.module.css';

// La scène qu'un élève a choisie dans un dépôt « Scène d'une œuvre » de
// l'étape : le prof la retrouve pré-remplie dans « Extrait choisi » (2026-10-11)
function sceneChoisie(
  e: { id: string; depots?: { id: string; oeuvreId?: string; types?: TypeDepot[]; type?: TypeDepot }[] },
  contenu: { reponses: Record<string, string> }
): { oeuvreId: string; sectionId: string } | null {
  for (const d of e.depots ?? []) {
    if (!typesDuDepot(d).includes('scene') || !d.oeuvreId) continue;
    const sectionId = contenu.reponses[clePartie(e.id, d.id, 'scene')];
    if (sectionId) return { oeuvreId: d.oeuvreId, sectionId };
  }
  return null;
}

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
  // Les étapes dépliées — `null` : le réglage d'ouverture (l'étape de l'élève seule)
  const [ouvertes, setOuvertes] = useState<Set<string> | null>(null);
  // L'étape dont le prof corrige le DERNIER retour (erreur de clic)
  const [corrigerRetour, setCorrigerRetour] = useState<string | null>(null);
  // La copie de l'élève, relue au retour sur l'onglet : il dépose pendant que
  // le prof regarde (vu le 2026-10-11 : « Rien déposé » sur un dépôt fait)
  const [copie, setCopie] = useState(travail.content);
  useEffect(() => setCopie(travail.content), [travail.content]);
  // La CLOCHE d'une étape : le message en cours d'écriture (une étape à la fois)
  const [cloche, setCloche] = useState<{ etapeId: string; texte: string; envoi: boolean; retour: string | null } | null>(null);

  const charger = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const eleve = encodeURIComponent(travail.studentId);
      const [p, g, sv, t] = await Promise.all([
        fetch(`/api/devoirs/${devoirId}/parcours-portfolio?eleve=${eleve}`, { headers }).then((r) => r.json()),
        fetch(`/api/portfolio/groupe?devoirId=${encodeURIComponent(devoirId)}`, { headers }).then((r) => r.json()),
        fetch(`/api/portfolio/suivi?devoirId=${encodeURIComponent(devoirId)}&eleve=${eleve}`, { headers }).then((r) => r.json()),
        fetch(`/api/travaux/${encodeURIComponent(travail.id)}`, { headers }).then((r) => r.json()),
      ]);
      if (t.success && typeof t.data?.content === 'string') setCopie(t.data.content);
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
  }, [getAuthHeaders, devoirId, travail.studentId, travail.id]);

  useEffect(() => {
    void charger();
    const auRetour = () => void charger();
    window.addEventListener('focus', auRetour);
    return () => window.removeEventListener('focus', auRetour);
  }, [charger]);

  if (erreur) return <EmptyState icon="🗂️" message={erreur} />;
  if (!parcours) return <EmptyState icon="hourglass" message="En cours de chargement" />;

  // Le groupe de CET élève : celui où figure son uid (non refusé d'abord)
  const siens = groupes.filter((g) => g.membres.some((m) => m.uid === travail.studentId));
  const groupe = siens.find((g) => g.statut !== 'refuse') ?? siens[0] ?? null;
  const contenu = { ...lireContenuEleve(copie), groupeStatut: groupe?.statut ?? null, suivi };
  const etapes = parcours.etapes;
  const sections = sectionsDuPortfolio(etapes);
  const nbFaites = etapes.filter((e) => !e.introduction && faite(e, contenu)).length;
  // À l'ouverture : seule l'étape où l'élève en est est dépliée
  const etapeDeLEleve = etapes[indexDepart(etapes, contenu)]?.id ?? null;
  const deplies = ouvertes ?? new Set(etapeDeLEleve ? [etapeDeLEleve] : []);
  const ouvrirCloche = (id: string) => {
    if (!deplies.has(id)) setOuvertes(new Set([...deplies, id]));
    setCloche(cloche?.etapeId === id ? null : { etapeId: id, texte: '', envoi: false, retour: null });
  };
  const envoyerCloche = async () => {
    if (!cloche || !cloche.texte.trim()) return;
    setCloche({ ...cloche, envoi: true, retour: null });
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/portfolio/message', {
        method: 'POST',
        headers,
        body: JSON.stringify({ devoirId, eleve: travail.studentId, etapeId: cloche.etapeId, message: cloche.texte }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Envoi impossible');
      const n = json.data?.envoyes ?? 1;
      setCloche({ ...cloche, texte: '', envoi: false, retour: n > 1 ? `✓ Envoyé aux ${n} élèves du groupe` : '✓ Envoyé à l’élève' });
    } catch (err) {
      setCloche({ ...cloche, envoi: false, retour: err instanceof Error ? err.message : 'Envoi impossible' });
    }
  };
  const basculer = (id: string) => {
    const suite = new Set(deplies);
    if (suite.has(id)) suite.delete(id);
    else suite.add(id);
    setOuvertes(suite);
  };

  // Le GROUPE de l'élève — dans l'étape qui porte le dépôt « Groupe » (JP,
  // 2026-10-11 : plus en tête de la copie, hors de toute section)
  const blocGroupe = () => (
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
  );

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

      {sections.map((s, si) => (
        <section key={s.section || si} className={styles.lectureSection}>
          {s.section && <h3 className={styles.lectureH3}>{s.section}</h3>}
          {s.etapes.map(({ etape: e, index: i }) => {
            const estFaite = faite(e, contenu);
            const estFermee = fermee(etapes, i, contenu);
            const retard = enRetard(e, contenu);
            const sansTrace = estEtapeSansTrace(e);
            const renvoi = e.nature === 'activite';
            const ouverte = deplies.has(e.id);
            // Une étape soumise attend le prof : la pastille le dit, repliée ou non
            const etat = etapeASoumettre(e) ? etatEtape(e, contenu) : null;
            const aValider = etat === 'soumise' || etat === 'a-revoir';
            // La TRACE des retours (JP, 2026-10-11) : pour noter la progression et l'autonomie
            const historique = suivi?.historique[e.id] ?? [];
            const nbRefus = historique.filter((r) => r.decision === 'refuse').length;
            const blocHistorique = historique.length > 0 ? (
                  <div className={styles.lectureHistorique}>
                    <p className={styles.lectureHistoriqueTitre}>
                      Historique des retours{nbRefus > 0 ? ` — ${nbRefus} refus` : ''}
                    </p>
                    <ol>
                      {historique.map((r, k) => (
                        <li key={`${r.date}-${k}`} className={r.decision === 'refuse' ? styles.lectureHistoriqueRefus : styles.lectureHistoriqueValide}>
                          {/* Le POINT de la ligne du temps : le smiley de l'évaluation, dans
                              l'axe du liseré (JP, 2026-10-11) ; sans appréciation, une pastille */}
                          <span className={styles.lectureHistoriquePoint} aria-hidden={!r.appreciation}>
                            {r.appreciation ? (
                              <SmileyAppreciation appreciation={r.appreciation} taille={20} titre={APPRECIATIONS[r.appreciation].label} />
                            ) : (
                              <span className={styles.lectureHistoriquePastille} />
                            )}
                          </span>
                          <span className={styles.lectureHistoriqueTete}>
                            {r.decision === 'refuse' ? '✗ Refusée' : '✓ Validée'}
                            <small>{r.date ? new Date(r.date).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</small>
                            {/* Le dernier retour se corrige (erreur de clic) — il est remplacé, pas ajouté */}
                            {k === historique.length - 1 && corrigerRetour !== e.id && (
                              <button
                                type="button"
                                className={styles.crayonRetour}
                                onClick={() => setCorrigerRetour(e.id)}
                                title="Corriger ce retour"
                                aria-label="Corriger ce retour"
                              >
                                ✏️
                              </button>
                            )}
                          </span>
                          {r.commentaire && <span className={styles.lectureHistoriqueCommentaire}>« {r.commentaire} »</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
            ) : null;
            return (
              <article key={e.id} className={`${styles.lectureEtape} ${estFaite ? styles.lectureEtapeFaite : ''} ${ouverte ? '' : styles.lectureEtapeRepliee}`}>
                <div className={styles.lectureEtapeLigne}>
                <button
                  type="button"
                  className={styles.lectureEtapeTete}
                  onClick={() => basculer(e.id)}
                  aria-expanded={ouverte}
                >
                  <span className={styles.lectureNum}>{numeroEtape(etapes, i) ?? '◎'}</span>
                  <span className={styles.lectureTitre}>
                    {e.titre}
                    {e.id === etapeDeLEleve && <small className={styles.lectureIci}> · l’élève en est ici</small>}
                  </span>
                  {aValider && <span className={styles.lectureAValider}>● à valider</span>}
                  {nbRefus > 0 && (
                    <span className={styles.lectureRefus} title="Nombre de fois où l’étape a été renvoyée à l’élève">
                      ✗ {nbRefus} refus
                    </span>
                  )}
                  <span className={`${styles.lectureEtat} ${estFaite ? styles.lectureEtatOk : estFermee ? styles.lectureEtatFerme : enCours(e, contenu) ? styles.lectureEtatCours : ''}`}>
                    {estFaite ? '✓ faite' : estFermee ? '🔒 fermée' : enCours(e, contenu) ? 'en cours' : 'à faire'}
                  </span>
                  <span className={styles.lectureChevron} aria-hidden="true">{ouverte ? '▾' : '▸'}</span>
                </button>
                {/* La cloche : un message à l'élève — ou à son groupe — sur cette étape */}
                <button
                  type="button"
                  className={`${styles.lectureCloche} ${cloche?.etapeId === e.id ? styles.lectureClocheOn : ''}`}
                  onClick={() => ouvrirCloche(e.id)}
                  title={suiviGroupe ? 'Envoyer une notification au groupe' : 'Envoyer une notification à l’élève'}
                  aria-label={suiviGroupe ? 'Envoyer une notification au groupe' : 'Envoyer une notification à l’élève'}
                >
                  🔔
                </button>
                </div>
                {ouverte && (
                <>
                {cloche?.etapeId === e.id && (
                  <div className={styles.lectureClocheForm}>
                    <textarea
                      className={`${styles.input} ${styles.textarea}`}
                      value={cloche.texte}
                      onChange={(ev) => setCloche({ ...cloche, texte: ev.target.value, retour: null })}
                      placeholder={suiviGroupe ? 'Message au groupe, à propos de cette étape…' : 'Message à l’élève, à propos de cette étape…'}
                      rows={2}
                      maxLength={800}
                      autoFocus
                    />
                    <div className={styles.groupeActions}>
                      <button type="button" className={styles.btn} disabled={cloche.envoi || !cloche.texte.trim()} onClick={() => void envoyerCloche()}>
                        {cloche.envoi ? 'Envoi…' : suiviGroupe ? '🔔 Notifier le groupe' : '🔔 Notifier l’élève'}
                      </button>
                      <button type="button" className={styles.btnGhost} onClick={() => setCloche(null)}>
                        Fermer
                      </button>
                      {cloche.retour && <span className={styles.labNote}>{cloche.retour}</span>}
                    </div>
                  </div>
                )}
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
                    {e.activiteVide && ' ⚠ Aucun questionnaire attaché : l’étape compte comme faite pour l’élève.'}
                  </p>
                )}
                {/* La copie de l'activité se corrige sur SA page, avec tous ses outils
                    (annotations, grille, aide IA, triple bouton) — dans un nouvel
                    onglet, le portfolio reste ouvert à côté (JP, 2026-10-11) */}
                {renvoi && e.devoirId && e.etatRenvoi && e.etatRenvoi !== 'a-faire' && (() => {
                  const copieActivite = `TRV-${e.devoirId}-${travail.studentId}`;
                  // `retour` : la flèche de la page ramène à CETTE copie de portfolio
                  const lien = `/dashboard/travaux/${encodeURIComponent(e.devoirId)}/${encodeURIComponent(copieActivite)}?retour=${encodeURIComponent(`/dashboard/travaux/${devoirId}/${travail.id}`)}`;
                  return (
                    <>
                      {/* La miniature : l'élève a-t-il avancé ? (JP, 2026-10-11) */}
                      <PortfolioApercuActivite
                        travailId={copieActivite}
                        typeTravail={e.typeTravail}
                        href={lien}
                        getAuthHeaders={getAuthHeaders}
                        gauche={blocHistorique}
                      >
                        <div className={styles.lectureCorriger}>
                          <a className={styles.btn} href={lien} target="_blank" rel="noopener noreferrer">
                            {e.typeTravail === 'ecrire' || e.typeTravail === 'schematiser' ? '✏️ Corriger la copie' : '👁️ Voir la copie'} ↗
                          </a>
                        </div>
                      </PortfolioApercuActivite>
                    </>
                  );
                })()}
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
                          blocGroupe()
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
                                ) : t === 'scene' ? (
                                  <PortfolioSceneTexte devoirId={devoirId} etapeId={e.id} depotId={d.id} sectionId={valeur} nom="Scène choisie" />
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
                {/* Valider / refuser n'a de sens qu'une fois l'étape SOUMISE par l'élève
                    (ou déjà retournée) — JP, 2026-10-11 : « l'élève n'a encore rien
                    envoyé et pourtant je peux refuser ou accepter ». Avant : un
                    retour sans soumission valait soumission. */}
                {/* L'historique : dans la colonne de gauche de la miniature pour une
                    étape-activité (JP, 2026-10-11 : « beaucoup de blanc »), ici sinon */}
                {!(renvoi && e.devoirId && e.etatRenvoi && e.etatRenvoi !== 'a-faire') && blocHistorique}
                {/* Pas soumise : la ligne « Il manque : … » plus bas le dit déjà
                    (« remettre l'activité », « soumettre l'étape au professeur »…) */}
                {/* L'ENCADRÉ DE RETOUR (JP, 2026-10-11) : un encadré VIERGE à chaque
                    soumission de l'élève ; une fois enregistré, le retour devient une
                    trace figée de l'historique ci-dessus. « Corriger mon dernier
                    retour » le rouvre, pré-rempli, pour rattraper une erreur. */}
                {/* L'ENCADRÉ DE RETOUR, vierge, sous l'historique (JP, 2026-10-11) —
                    comme à la première évaluation. Pas sur une étape où l'élève n'a
                    encore rien fait. Sans soumission (travail fait, pas soumis :
                    l'élève a oublié), le retour vaut soumission. Le crayon de
                    l'historique remplace l'encadré vierge par le dernier retour,
                    pré-rempli. */}
                {/* Étape VALIDÉE : plus d'encadré (JP) — il revient si l'élève soumet à
                    nouveau ; le crayon reste pour corriger le dernier retour */}
                {etapeASoumettre(e) &&
                  etat &&
                  (corrigerRetour === e.id || (etat !== 'validee' && (aValider || etat === 'prete' || historique.length > 0))) && (
                  <PortfolioRetourProf
                    key={corrigerRetour === e.id ? 'corriger' : 'nouveau'}
                    devoirId={devoirId}
                    eleveUid={travail.studentId}
                    etape={e}
                    etat={etat}
                    suivi={suivi}
                    groupe={suiviGroupe}
                    getAuthHeaders={getAuthHeaders}
                    onSuivi={(sv) => {
                      setSuivi(sv);
                      setCorrigerRetour(null);
                    }}
                    sceneProposee={sceneChoisie(e, contenu)}
                    nouveau={corrigerRetour !== e.id}
                    sansSoumission={corrigerRetour !== e.id && !aValider}
                  />
                )}
                {corrigerRetour === e.id && (
                  <button type="button" className={styles.lienDiscret} onClick={() => setCorrigerRetour(null)}>
                    Annuler la correction
                  </button>
                )}
                {/* « Il manque » : seulement ce que l'ÉLÈVE doit encore faire. Pas
                    « reprendre l'étape selon le retour… » (l'historique le dit déjà,
                    JP : « cela m'égare ») ni « la validation du professeur » */}
                {!estFaite && !estFermee && etat !== 'a-reprendre' && !aValider && cequiManque(e, contenu).length > 0 && (
                  <p className={styles.lectureManque}>Il manque : {cequiManque(e, contenu).join(', ')}.</p>
                )}
                </>
                )}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
