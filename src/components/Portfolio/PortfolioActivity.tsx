'use client';

// La COLONNE 1 d'un portfolio côté élève : L'ÉTAPE OÙ IL EN ÉTAIT (décision JP,
// 2026-10-09 : « à gauche, affichage du portfolio là où l'apprenant l'avait
// laissé » ; la vue d'ensemble vit à droite, dans le sommaire). En-tête avec
// la section et le titre, puis échéance · statut IA · portée, objectifs,
// consigne, et ce qu'il y a à déposer :
//  - un RENVOI → une carte « Ouvrir l'activité » avec son état ;
//  - des DÉPÔTS → un bloc par dépôt, une zone par type coché par le prof
//    (texte : champ qui grandit, l'exemple en filigrane ; lien : adresse + lecteur ;
//    image : choisie, compressée, route protégée ; tableau : lignes ajoutées) ;
//  - rien (SANS TRACE) → « Rien à déposer ici », et c'est l'élève qui coche.
// Une étape verrouillante non faite le dit en clair, avec ce qui manque.

import Link from 'next/link';
import AutoGrowTextarea from '@/components/AutoGrowTextarea';
import EmptyState from '@/components/EmptyState/EmptyState';
import PortfolioDepotGroupe from './PortfolioDepotGroupe';
import PortfolioDepotLien from './PortfolioDepotLien';
import PortfolioDepotImage from './PortfolioDepotImage';
import PortfolioDepotTableau from './PortfolioDepotTableau';
import type { PortfolioEleve } from '@/hooks/usePortfolioEleve';
import {
  cequiManque,
  depotRempli,
  echeanceLisible,
  enRetard,
  ETAT_ETAPE_LABELS,
  etatEtape,
  faite,
  fermee,
  reponseDe,
  verrouilleLaSuite,
} from '@/lib/portfolio-etat';
import PortfolioValeur from './PortfolioValeur';
import { atelierLabel } from '@/types/didactique';
import { decouperConsignes } from '@/lib/consignes-etapes';
import {
  APPRECIATIONS,
  cleTache,
  estEtapeSansTrace,
  etapeASoumettre,
  valeursAffichees,
  PORTEE_LABELS,
  STATUT_IA_LABELS,
  TYPE_DEPOT_LABELS,
  typesDuDepot,
  type StatutIA,
} from '@/types/portfolio';
import { iconeAtelier } from '@/types/sequence-fle';
import IaPicto from './IaPicto';
import styles from './Portfolio.module.css';

interface Props {
  eleve: PortfolioEleve;
  isPreviewMode?: boolean;
  lectureSeule?: boolean;
  // Le réglage IA de l'activité — le repli quand l'étape n'en fixe pas
  accesIA: boolean;
  // La copie de l'élève (dépôt d'image : la route vérifie qu'elle est la sienne)
  travailId?: string;
}

const ETAT_RENVOI: Record<string, { label: string; classe: string }> = {
  'a-faire': { label: 'à faire', classe: '' },
  'en-cours': { label: 'en cours', classe: 'etatEnCours' },
  fait: { label: 'remise', classe: 'etatFait' },
};

export default function PortfolioActivity({ eleve, isPreviewMode = false, lectureSeule = false, accesIA, travailId }: Props) {
  const { parcours, erreur, etapes, contenu, index, etape, allerA, deposer, cocher, cocherTache, soumettre, soumission } = eleve;

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
  // La consigne de l'étape, lue comme une liste de tâches (clé = texte de la ligne)
  const lignesConsigne = decouperConsignes(etape.consigne);
  const tachesFaites = new Set(contenu.taches ?? []);
  const nbTaches = lignesConsigne.filter((l) => l.genre === 'etape').length;
  const nbTachesFaites = lignesConsigne.filter((l) => l.genre === 'etape' && tachesFaites.has(cleTache(etape.id, l.cle))).length;
  // Soumission au prof et retour (plan 2026-10-10)
  const aSoumettre = etapeASoumettre(etape);
  const etat = aSoumettre ? etatEtape(etape, contenu) : null;
  const retour = contenu.suivi?.retours[etape.id] ?? null;
  const soumise = contenu.suivi?.soumissions[etape.id] ?? null;
  const enSoumission = soumission?.etapeId === etape.id && !soumission.erreur;
  const erreurSoumission = soumission?.etapeId === etape.id ? soumission.erreur : null;
  const valeursTravail = valeursAffichees(etapes, etape, contenu.suivi, 'travail');

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
            <IaPicto statut={ia} className={styles.iaTagImage} />
            {STATUT_IA_LABELS[ia].court} — {STATUT_IA_LABELS[ia].long}
          </span>
          <span className={`${styles.tag} ${etape.portee === 'collective' ? styles.tagCollectif : styles.tagPerso}`}>
            {etape.portee === 'collective' ? '👥' : '👤'} {PORTEE_LABELS[etape.portee ?? 'personnelle']}
          </span>
          {estFaite && <span className={`${styles.tag} ${styles.tagFait}`}>✓ Étape faite</span>}
          {etat && !estFaite && etat !== 'a-faire' && (
            <span className={`${styles.tag} ${etat === 'a-reprendre' ? styles.tagRetard : styles.tagEcheance}`}>
              {ETAT_ETAPE_LABELS[etat]}
            </span>
          )}
        </div>

        {/* Le retour du professeur : encadré ambre, en tête de l'étape */}
        {retour && (
          <div className={`${styles.retourProf} ${retour.decision === 'refuse' ? styles.retourRefuse : ''}`}>
            <div className={styles.retourTete}>
              <span className={styles.retourDecision}>
                {retour.decision === 'valide' ? '✓ Validé par ton professeur' : '✗ À reprendre'}
              </span>
              {retour.appreciation && (
                <span className={styles.retourAppreciation} title={APPRECIATIONS[retour.appreciation].label}>
                  {APPRECIATIONS[retour.appreciation].emoji}
                </span>
              )}
              <span className={styles.retourDate}>{echeanceLisible(retour.date.slice(0, 10), true)}</span>
            </div>
            {retour.commentaire && <p className={styles.retourCommentaire}>💬 {retour.commentaire}</p>}
            {etat === 'a-revoir' && <p className={styles.retourNote}>Tu as soumis à nouveau : ton professeur va revoir l’étape.</p>}
          </div>
        )}

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

        {lignesConsigne.length > 0 && (
          <>
            <h4 className={styles.h4}>
              Consigne
              {nbTaches > 0 && (
                <span className={`${styles.tachesCompteur} ${nbTachesFaites === nbTaches ? styles.tachesCompteurOk : ''}`}>
                  {nbTachesFaites} / {nbTaches}
                </span>
              )}
            </h4>
            {/* Une ligne = une tâche à cocher ; une ligne finissant par « : » = un titre */}
            <ul className={`${styles.consigne} ${styles.taches}`}>
              {lignesConsigne.map((l, i) =>
                l.genre === 'titre' ? (
                  <li key={`t${i}`} className={styles.tacheTitre}>{l.texte}</li>
                ) : (
                  <li key={l.cle} className={tachesFaites.has(cleTache(etape.id, l.cle)) ? styles.tacheFaite : ''}>
                    <label>
                      <input
                        type="checkbox"
                        checked={tachesFaites.has(cleTache(etape.id, l.cle))}
                        onChange={() => cocherTache(cleTache(etape.id, l.cle))}
                        disabled={lectureSeule}
                      />
                      <span>{l.texte}</span>
                    </label>
                  </li>
                )
              )}
            </ul>
          </>
        )}

        {valeursTravail.length > 0 && (
          <>
            <h4 className={styles.h4}>Pour ton groupe</h4>
            {valeursTravail.map((v) => (
              <PortfolioValeur key={v.valeurId} valeur={v} devoirId={parcours.devoirId} />
            ))}
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
                {' — '}remets l’activité, puis soumets l’étape à ton professeur.
              </span>
            </div>
            <Link
              // Le portfolio et l'étape voyagent avec le lien : l'activité y
              // retrouve les valeurs attribuées au groupe (« Le sketch »)
              href={
                isPreviewMode
                  ? `/activites/${etape.devoirId}?preview=true`
                  : `/activites/${etape.devoirId}?portfolio=${encodeURIComponent(parcours.devoirId)}&etape=${encodeURIComponent(etape.id)}`
              }
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
            const types = typesDuDepot(d);
            const groupe = types.includes('groupe');
            const rempli = depotRempli(contenu, etape.id, d);
            // Plusieurs parties : chacune porte un petit intitulé (« Texte », « Lien »)
            const intitule = (t: (typeof types)[number]) =>
              types.length > 1 ? <span className={styles.partieLib}>{TYPE_DEPOT_LABELS[t]}</span> : null;
            return (
              <div key={d.id} className={styles.depotEleve}>
                <div className={styles.depotLib}>
                  {d.libelle}
                  {d.obligatoire !== false && <span className={styles.depotObl}>· obligatoire</span>}
                  <span className={`${styles.depotEtat} ${rempli ? styles.depotEtatOk : ''}`}>
                    {rempli ? (groupe ? '✓ groupe accepté' : '✓ déposé') : groupe && contenu.groupeStatut === 'attente' ? '⏳ en attente du professeur' : 'à faire'}
                  </span>
                </div>
                {d.consigne && <p className={styles.depotAide}>{d.consigne}</p>}
                {groupe ? (
                  <PortfolioDepotGroupe eleve={eleve} lectureSeule={lectureSeule} />
                ) : (
                  types.map((t) => {
                    const valeur = reponseDe(contenu, etape.id, d.id, t);
                    if (t === 'texte') {
                      return (
                        <div key={t}>
                          {intitule(t)}
                          <AutoGrowTextarea
                            className={styles.champ}
                            value={valeur}
                            onChange={(e) => deposer(etape.id, d.id, e.target.value)}
                            placeholder={d.exemple || 'Écris ici…'}
                            minRows={3}
                            maxRows={18}
                            disabled={lectureSeule}
                          />
                          {d.exemple && !valeur.trim() && <div className={styles.sauve}>L’exemple s’efface quand tu écris</div>}
                        </div>
                      );
                    }
                    if (t === 'lien') {
                      return (
                        <div key={t}>
                          {intitule(t)}
                          <PortfolioDepotLien
                            valeur={valeur}
                            onChange={(v) => deposer(etape.id, d.id, v, 'lien')}
                            lectureSeule={lectureSeule}
                          />
                        </div>
                      );
                    }
                    if (t === 'image') {
                      return (
                        <div key={t}>
                          {intitule(t)}
                          <PortfolioDepotImage
                            valeur={valeur}
                            lectureSeule={lectureSeule || !travailId}
                            travailId={travailId}
                            etapeId={etape.id}
                            depotId={d.id}
                            onChange={(id) => deposer(etape.id, d.id, id, 'image')}
                          />
                        </div>
                      );
                    }
                    if (t === 'tableau') {
                      return (
                        <div key={t}>
                          {intitule(t)}
                          <PortfolioDepotTableau
                            valeur={valeur}
                            colonnes={d.colonnes?.length ? d.colonnes : ['Réponse']}
                            onChange={(v) => deposer(etape.id, d.id, v, 'tableau')}
                            lectureSeule={lectureSeule}
                          />
                        </div>
                      );
                    }
                    return null;
                  })
                )}
              </div>
            );
          })}

        {/* Soumettre au professeur — la ligne d'action à deux traits du projet */}
        {aSoumettre && etat && !isPreviewMode && (
          <div className={styles.soumettreBarre}>
            <span className={styles.soumettreTrait} aria-hidden="true" />
            <div className={styles.soumettreCentre}>
              {etat === 'validee' ? (
                <span className={styles.soumettreEtat}>✓ Étape validée par ton professeur</span>
              ) : etat === 'soumise' || etat === 'a-revoir' ? (
                <span className={styles.soumettreEtat}>
                  ✓ Soumise le {echeanceLisible(soumise?.date.slice(0, 10), true)} — en attente de ton professeur
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.soumettreBtn}
                  onClick={() => void soumettre(etape.id)}
                  disabled={lectureSeule || enSoumission || (etat !== 'prete' && etat !== 'a-reprendre')}
                  title={etat === 'prete' || etat === 'a-reprendre' ? undefined : `Il manque : ${manque.join(', ')}`}
                >
                  {enSoumission ? 'Envoi…' : etat === 'a-reprendre' ? 'Soumettre à nouveau au professeur' : 'Soumettre au professeur'}
                </button>
              )}
              {etat !== 'prete' && etat !== 'a-reprendre' && etat !== 'validee' && etat !== 'soumise' && etat !== 'a-revoir' && manque.length > 0 && (
                <span className={styles.soumettreAide}>Avant de soumettre : {manque.join(', ')}.</span>
              )}
              {erreurSoumission && <span className={styles.lienErreur}>{erreurSoumission}</span>}
            </div>
            <span className={styles.soumettreTrait} aria-hidden="true" />
          </div>
        )}

        {verrouilleLaSuite(etape) && !estFaite && suivante && (
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
