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
// L'INTRODUCTION (2026-10-11) : la première page — couverture ronde, objectifs,
// informations générales en simple liste (rien à cocher, rien à déposer) ;
// l'ouvrir suffit à la marquer faite (`usePortfolioEleve`).
//
// Refonte du 2026-10-11 (retours de JP) :
//  - les objectifs et la consigne d'une ÉTAPE vivent dans l'onglet Consignes
//    de la colonne de droite (`PortfolioConsignesEtape`), plus ici ;
//  - les ÉTIQUETTES en haut à droite, sur leur propre bande (rien ne passe à
//    côté) : l'image IA du prof ENTIÈRE (elle porte le message), ~2 cm de haut,
//    l'échéance et la portée empilées à sa gauche ;
//  - si l'étape a des RESSOURCES : une ligne « Consulter les ressources »
//    (trait — bouton — trait) avant les encadrés, qui ouvre l'onglet Ressources ;
//  - « À déposer » devient « Encadrés à compléter » (un dépôt = un encadré) ;
//  - UNE SEULE ligne d'action, motif de l'atelier de vocabulaire : trait —
//    [reculer] [gestes : soumettre, « j'ai fait cette étape »] [avancer] —
//    trait ; tous les boutons DANS le trait, au centre (JP, 2026-10-11).

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
  nombreEtapes,
  numeroEtape,
  styleCouverture,
  urlCouverture,
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
import { ressourcesPresentes } from '@/lib/ressources-presentes';
import styles from './Portfolio.module.css';

interface Props {
  eleve: PortfolioEleve;
  isPreviewMode?: boolean;
  lectureSeule?: boolean;
  // Le réglage IA de l'activité — le repli quand l'étape n'en fixe pas
  accesIA: boolean;
  // La copie de l'élève (dépôt d'image : la route vérifie qu'elle est la sienne)
  travailId?: string;
  // « Consulter les ressources » : ouvre l'onglet Ressources de la colonne de droite
  onOuvrirRessources?: () => void;
  // Le portfolio a des ressources (pour tout le portfolio) : l'introduction
  // propose « Consulter les ressources » dans sa ligne finale
  ressourcesPortfolio?: boolean;
}

const ETAT_RENVOI: Record<string, { label: string; classe: string }> = {
  'a-faire': { label: 'à faire', classe: '' },
  'en-cours': { label: 'en cours', classe: 'etatEnCours' },
  fait: { label: 'remise', classe: 'etatFait' },
};

export default function PortfolioActivity({
  eleve,
  isPreviewMode = false,
  lectureSeule = false,
  accesIA,
  travailId,
  onOuvrirRessources,
  ressourcesPortfolio = false,
}: Props) {
  const { parcours, erreur, etapes, contenu, index, etape, allerA, deposer, cocher, soumettre, soumission } = eleve;

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
  const intro = etape.introduction === true;
  const sansTrace = estEtapeSansTrace(etape) && !intro;
  const couverture = urlCouverture(etape.couverture);
  const numero = numeroEtape(etapes, index);
  const renvoi = etape.nature === 'activite';
  const depots = etape.depots ?? [];
  const nbEtapes = nombreEtapes(etapes);
  // La consigne : sur la page pour l'INTRODUCTION seulement (informations générales)
  const lignesConsigne = decouperConsignes(etape.consigne);
  // Soumission au prof et retour (plan 2026-10-10)
  const aSoumettre = etapeASoumettre(etape);
  const etat = aSoumettre ? etatEtape(etape, contenu) : null;
  const retour = contenu.suivi?.retours[etape.id] ?? null;
  const soumise = contenu.suivi?.soumissions[etape.id] ?? null;
  const enSoumission = soumission?.etapeId === etape.id && !soumission.erreur;
  const erreurSoumission = soumission?.etapeId === etape.id ? soumission.erreur : null;
  const valeursTravail = valeursAffichees(etapes, etape, contenu.suivi, 'travail');

  // Les boutons de la ligne d'action
  const boutonPrecedent = precedente ? (
    <button type="button" className={`${styles.actionBtn} ${styles.actionBtnNav}`} onClick={() => allerA(precedente.id)} title={precedente.titre}>
      ← {precedente.titre}
    </button>
  ) : null;
  const boutonSuivant = suivante ? (
    <button
      type="button"
      className={`${styles.actionBtn} ${styles.actionBtnNav}`}
      onClick={() => allerA(suivante.id)}
      disabled={suivanteFermee}
      title={suivanteFermee ? `Termine d’abord « ${etape.titre} »` : suivante.titre}
    >
      {suivante.titre} {suivanteFermee ? '🔒' : '→'}
    </button>
  ) : null;
  // Au centre : soumettre au professeur (étape à dépôts ou à activité), ou
  // « J'ai fait cette étape » (étape sans trace)
  const centre: React.ReactNode[] = [];
  if (aSoumettre && etat && !isPreviewMode) {
    if (etat === 'validee') centre.push(<span key="e" className={styles.soumettreEtat}>✓ Étape validée par ton professeur</span>);
    else if (etat === 'soumise' || etat === 'a-revoir')
      centre.push(
        <span key="e" className={styles.soumettreEtat}>
          ✓ Soumise le {echeanceLisible(soumise?.date.slice(0, 10), true)} — en attente de ton professeur
        </span>
      );
    else
      centre.push(
        <button
          key="b"
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
          onClick={() => void soumettre(etape.id)}
          disabled={lectureSeule || enSoumission || (etat !== 'prete' && etat !== 'a-reprendre')}
          title={etat === 'prete' || etat === 'a-reprendre' ? undefined : `Il manque : ${manque.join(', ')}`}
        >
          {enSoumission ? 'Envoi…' : etat === 'a-reprendre' ? 'Soumettre à nouveau au professeur' : 'Soumettre au professeur'}
        </button>
      );
  }
  // L'INTRODUCTION : « Consulter les ressources » dans la ligne finale, à côté
  // du bouton de la première étape (JP, 2026-10-11)
  if (intro && onOuvrirRessources && (ressourcesPortfolio || ressourcesPresentes(etape.ressources))) {
    centre.push(
      <button key="r" type="button" className={`${styles.actionBtn} ${styles.actionBtnAmbre}`} onClick={onOuvrirRessources}>
        Consulter les ressources
      </button>
    );
  }
  if (!renvoi && sansTrace) {
    const coche = contenu.cochees.includes(etape.id);
    centre.push(
      <button
        key="c"
        type="button"
        className={`${styles.actionBtn} ${coche ? styles.actionBtnFait : styles.actionBtnPrimary}`}
        onClick={() => cocher(etape.id, !coche)}
        disabled={lectureSeule}
        aria-pressed={coche}
      >
        {coche ? '✓ Étape faite' : 'J’ai fait cette étape'}
      </button>
    );
  }
  const aideSoumission =
    aSoumettre && etat && !isPreviewMode && etat !== 'prete' && etat !== 'a-reprendre' && etat !== 'validee' && etat !== 'soumise' && etat !== 'a-revoir' && manque.length > 0
      ? `Avant de soumettre : ${manque.join(', ')}.`
      : null;

  return (
    <div className={styles.eleveSection}>
      <div className={styles.eleveHead}>
        <div className={styles.eleveHeadTexte}>
          <span className={styles.eleveSect}>
            {intro
              ? parcours.intitule
              : `${etape.section ? `${etape.section} · ` : ''}étape ${numero} sur ${nbEtapes}`}
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
        {intro && (
          <div className={styles.eleveCouverture}>
            {couverture ? (
              <span className={styles.eleveCouvertureCadre}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={couverture} alt="" style={styleCouverture(etape.couvertureCadrage)} />
              </span>
            ) : (
              <span>{parcours.intitule}</span>
            )}
          </div>
        )}
        {/* Les ÉTIQUETTES, coin supérieur droit : échéance et portée empilées,
            l'image IA choisie par le prof sur leur hauteur, à droite */}
        {!intro && (
          <div className={styles.etiquettes}>
            <div className={styles.etiquettesPile}>
              {etape.echeance && (
                <span className={`${styles.tag} ${retard ? styles.tagRetard : styles.tagEcheance}`}>
                  📅 {echeanceLisible(etape.echeance, true)}
                  {retard && ' — en retard'}
                </span>
              )}
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
            {/* Au survol : la précision du prof (« Aide de l'IA » : comment s'en servir), sinon l'intitulé */}
            <span
              className={styles.etiquetteIa}
              title={
                ia === 'partielle' && etape.iaPrecision?.trim()
                  ? `${STATUT_IA_LABELS[ia].court} — ${etape.iaPrecision.trim()}`
                  : `${STATUT_IA_LABELS[ia].court} — ${STATUT_IA_LABELS[ia].long}`
              }
            >
              <IaPicto statut={ia} alt={STATUT_IA_LABELS[ia].court} carte />
            </span>
          </div>
        )}

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

        {/* Une ÉTAPE : objectifs et consigne dans l'onglet Consignes, à droite.
            L'INTRODUCTION les garde sur sa page. */}
        {intro && (etape.objectifs?.length ?? 0) > 0 && (
          <>
            <h4 className={styles.h4}>Objectifs</h4>
            <ul className={styles.objectifs}>
              {etape.objectifs!.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </>
        )}

        {/* L'introduction : des informations à lire, pas une liste de tâches */}
        {intro && lignesConsigne.length > 0 && (
          <>
            <h4 className={styles.h4}>Informations générales</h4>
            <ul className={styles.infosIntro}>
              {lignesConsigne.map((l, i) => (
                <li key={`${l.cle}-${i}`} className={l.genre === 'titre' ? styles.infosIntroTitre : ''}>
                  {l.texte}
                </li>
              ))}
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

        {/* Les ressources de l'étape : une ligne d'action avant les encadrés */}
        {!intro && ressourcesPresentes(etape.ressources) && onOuvrirRessources && (
          <div className={styles.ligneAction}>
            <span className={styles.ligneActionTrait} />
            <div className={styles.ligneActionCentre}>
              <button type="button" className={`${styles.actionBtn} ${styles.actionBtnAmbre}`} onClick={onOuvrirRessources}>
                Consulter les ressources
              </button>
            </div>
            <span className={styles.ligneActionTrait} />
          </div>
        )}

        {!intro && (
          <h4 className={styles.h4}>
            {renvoi ? 'Où ça se passe' : sansTrace ? 'Rien à compléter ici' : depots.length > 1 ? 'Encadrés à compléter' : 'Encadré à compléter'}
          </h4>
        )}

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
            <p>Cette étape se vit en classe ou ailleurs : rien à écrire dans le portfolio. Quand c’est fait, dis-le avec le bouton en bas.</p>
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
                    {rempli
                      ? groupe
                        ? contenu.groupeStatut === 'accepte'
                          ? '✓ groupe accepté'
                          : '✓ déclaré — le professeur l’accepte avec l’étape'
                        : '✓ déposé'
                      : 'à faire'}
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

        {verrouilleLaSuite(etape) && !estFaite && suivante && (
          <div className={styles.verrouMsg}>
            <span className={styles.verrouBig} aria-hidden="true">🔒</span>
            <div>
              <b>« {suivante.titre} » s’ouvrira quand cette étape sera faite</b>
              {manque.length > 0 && <span>Il manque : {manque.join(', ')}.</span>}
            </div>
          </div>
        )}

        {/* LA LIGNE D'ACTION (motif du vocabulaire) : trait | reculer · gestes · avancer | trait */}
        <div className={styles.ligneAction}>
          <span className={styles.ligneActionTrait} />
          <div className={styles.ligneActionCentre}>
            {boutonPrecedent}
            {centre}
            {boutonSuivant}
          </div>
          <span className={styles.ligneActionTrait} />
        </div>
        {(aideSoumission || erreurSoumission) && (
          <p className={styles.ligneActionAide}>
            {aideSoumission}
            {erreurSoumission && <span className={styles.lienErreur}> {erreurSoumission}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
