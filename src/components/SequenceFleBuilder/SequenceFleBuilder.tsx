'use client';

// Le constructeur d'une SÉQUENCE FLE — au verso « Ajouter des contenus »
// d'une activité de type « sequence » (création et popup ✏️).
//
// Une LIGNE DU TEMPS EN SERPENTIN (demandes JP, 2026-09-14) : les étapes sont
// des encadrés posés sur une ligne qui, arrivée au bord droit, tourne et
// revient vers la gauche — rangée après rangée. Une ÉTAPE est SOIT une
// THÉORIE (un point de théorie de Mes Ressources › Modules FLE), SOIT une ACTIVITÉ
// (une activité FLE, ou une activité classique de Mes Activités).
//
// Le « + » ne fait que PRENDRE DANS L'EXISTANT (décision JP, 2026-09-19 : « la
// popup n'a d'intérêt que lorsque les activités et points théoriques sont
// déjà existants »). Créer se fait dans Mes Ressources › Modules FLE, ouvert dans un
// NOUVEL ONGLET : la séquence reste ouverte, et la liste se recharge quand
// le prof revient sur cet onglet. Il y avait avant un chemin « créer ici »
// (éditeur de module et formulaire de création en popups empilées) : trop de
// popups, et l'activité créée y entrait sans titre.
//
// Chaque encadré porte le bouton « tous / n élèves » (différenciation, 2e
// étage). Le 1er étage — quels élèves de la classe accèdent à l'activité — se
// règle au recto avec `ElevesChoix` : le constructeur reçoit ces élèves.
//
// Le nombre d'encadrés par rangée se MESURE (largeur du conteneur), la
// rangée impaire s'affiche en `row-reverse`, et un trait vertical relie la
// fin d'une rangée au début de la suivante.

import { useCallback, useEffect, useState } from 'react';
import Serpentin from './Serpentin';
import { useAuth } from '@/hooks/useAuth';
import { useClasses } from '@/hooks/useClasses';
import { estClasseFle } from '@/types/classe';
import { useDidactiqueFle } from '@/hooks/useDidactiqueFle';
import { ATELIERS, atelierLabel } from '@/types/didactique';
import { estDevoirFle } from '@/types/devoir';
import type { Devoir } from '@/types/devoir';
import type { ModuleFle } from '@/types/module-fle';
import { iconeTypeModule } from '@/types/module-fle';
import { SEQUENCE_FLE_VIDE, generateEtapeId, iconeAtelier } from '@/types/sequence-fle';
import type { NatureEtape, SequenceFleContenu, SequenceFleEtape } from '@/types/sequence-fle';
import { ListeEleves } from '@/components/ElevesChoix/ElevesChoix';
import type { EleveAvecClasse } from '@/components/ElevesChoix/ElevesChoix';
import base from '@/components/ModuleFleEditor/ModuleFleEditor.module.css';
import styles from './SequenceFleBuilder.module.css';

interface Props {
  value: SequenceFleContenu | null;
  onChange: (contenu: SequenceFleContenu) => void;
  // Les élèves qui suivent la séquence (ceux des classes cochées, filtrés par
  // le choix du recto) — base des restrictions par étape
  elevesDeLaSequence: EleveAvecClasse[];
  plusieursClasses?: boolean;
  disabled?: boolean;
  // Clic sur le titre d'un encadré : ouvrir la ressource (point de théorie ou
  // activité) — l'atelier de Mes Ressources › Modules FLE › Séquences de cours
  onOuvrirEtape?: (etape: SequenceFleEtape) => void;
}

function iconeEtape(e: SequenceFleEtape): string {
  if (e.nature === 'theorie') return iconeTypeModule(e.type ?? '');
  return iconeAtelier(e.atelier);
}

export default function SequenceFleBuilder({
  value,
  onChange,
  elevesDeLaSequence,
  plusieursClasses = false,
  disabled = false,
  onOuvrirEtape,
}: Props) {
  const { getAuthHeaders } = useAuth();
  const { config } = useDidactiqueFle();
  // Les classes FLE du prof : c'est par elles qu'une activité ordinaire est FLE
  const { classes: mesClasses, classesPartagees } = useClasses();
  const contenu = value ?? SEQUENCE_FLE_VIDE;

  // Le « + » : où insérer, quelle nature
  const [insertion, setInsertion] = useState<number | null>(null);
  const [nature, setNature] = useState<NatureEtape | null>(null);

  // L'existant — rechargé à chaque choix de nature et au retour sur l'onglet
  // (le prof vient peut-être de créer ce qu'il cherche dans l'autre onglet)
  const [modules, setModules] = useState<ModuleFle[] | null>(null);
  const [devoirs, setDevoirs] = useState<Devoir[] | null>(null);
  const [recherche, setRecherche] = useState('');
  const [fraicheur, setFraicheur] = useState(0);

  // Étape dont on choisit les élèves ; null = popup fermée
  const [elevesDe, setElevesDe] = useState<string | null>(null);

  const poser = useCallback(
    (patch: Partial<SequenceFleContenu>) => onChange({ ...contenu, ...patch }),
    [contenu, onChange]
  );

  // Retour sur cet onglet, popup ouverte : on relit l'existant
  const popupOuverte = insertion !== null;
  useEffect(() => {
    if (!popupOuverte) return;
    const auRetour = () => setFraicheur((n) => n + 1);
    window.addEventListener('focus', auRetour);
    return () => window.removeEventListener('focus', auRetour);
  }, [popupOuverte]);

  useEffect(() => {
    if (nature !== 'theorie') return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/modules-fle', { headers });
        const json = await res.json();
        if (!annule) setModules(json.success ? (json.data as ModuleFle[]).filter((m) => !m.archive) : []);
      } catch {
        if (!annule) setModules([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [nature, fraicheur, getAuthHeaders]);

  useEffect(() => {
    if (nature !== 'activite') return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/devoirs', { headers });
        const json = await res.json();
        if (!annule) {
          setDevoirs(
            json.success
              ? (json.data as Devoir[]).filter((d) => !d.archive && d.typeTravail !== 'sequence')
              : []
          );
        }
      } catch {
        if (!annule) setDevoirs([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [nature, fraicheur, getAuthHeaders]);

  const ouvrirPlus = (index: number) => {
    setInsertion(index);
    setNature(null);
    setRecherche('');
  };

  const insererEtape = (etape: Omit<SequenceFleEtape, 'id' | 'eleves'>) => {
    if (insertion === null) return;
    const liste = [...contenu.etapes];
    liste.splice(insertion, 0, { ...etape, id: generateEtapeId(), eleves: null });
    poser({ etapes: liste });
    setInsertion(null);
  };

  const insererModule = (m: ModuleFle) =>
    insererEtape({ nature: 'theorie', moduleId: m.id, titre: m.titre, type: m.type });

  const insererDevoir = (d: Devoir) =>
    insererEtape({
      nature: 'activite',
      devoirId: d.id,
      titre: d.intitule,
      atelier: d.atelier,
      typeTravail: d.typeTravail,
    });

  const modifierEtape = (id: string, patch: Partial<SequenceFleEtape>) =>
    poser({ etapes: contenu.etapes.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const deplacer = (i: number, sens: -1 | 1) => {
    const j = i + sens;
    if (j < 0 || j >= contenu.etapes.length) return;
    const liste = [...contenu.etapes];
    [liste[i], liste[j]] = [liste[j], liste[i]];
    poser({ etapes: liste });
  };

  const retirer = (id: string) => poser({ etapes: contenu.etapes.filter((e) => e.id !== id) });

  const etapeEleves = elevesDe ? contenu.etapes.find((e) => e.id === elevesDe) : null;
  const q = recherche.trim().toLowerCase();
  const candidatsDevoirs = (devoirs ?? []).filter((d) => !q || d.intitule.toLowerCase().includes(q));
  const candidatsModules = (modules ?? []).filter((m) => !q || m.titre.toLowerCase().includes(q));
  // Deux groupes : les activités FLE (nées dans Ressources FLE, ou données à
  // une classe FLE — règle des deux espaces, plus de case à cocher depuis le
  // 2026-10-09) ; puis tout le reste
  const nomsClassesFle = new Set([...mesClasses, ...classesPartagees].filter((c) => estClasseFle(c)).map((c) => c.nom));
  const estPourFle = (d: Devoir) => estDevoirFle(d, nomsClassesFle);
  const activitesFle = candidatsDevoirs.filter(estPourFle);
  const activitesClassiques = candidatsDevoirs.filter((d) => !estPourFle(d));
  const lienCreer =
    nature === 'theorie' ? '/parcours-fle?section=theorie' : '/parcours-fle?section=activites';

  const rendreEtape = (e: SequenceFleEtape, i: number) => {
    const restreint = e.eleves !== null;
    return (
      <article
        key={e.id}
        className={`${styles.encadre} ${e.nature === 'theorie' ? styles.encadreTheorie : styles.encadreActivite} ${
          restreint ? styles.encadreRestreint : ''
        }`}
      >
        <span className={styles.numero}>{i + 1}</span>
        <span className={styles.nature}>{e.nature === 'theorie' ? 'Théorie' : 'Activité'}</span>
        <span className={styles.icone} aria-hidden="true">{iconeEtape(e)}</span>
        {onOuvrirEtape ? (
          <button
            type="button"
            className={`${styles.titre} ${styles.titreLien}`}
            title={e.nature === 'theorie' ? `Ouvrir « ${e.titre} »` : `Modifier « ${e.titre} »`}
            onClick={() => onOuvrirEtape(e)}
          >
            {e.titre || e.moduleId || e.devoirId}
          </button>
        ) : (
          <span className={styles.titre} title={e.titre}>{e.titre || e.moduleId || e.devoirId}</span>
        )}
        <span className={styles.meta}>
          {e.nature === 'theorie' ? (config.typesModule.find((t) => t.id === e.type)?.label ?? '') : atelierLabel(e.atelier ?? '', true) || e.typeTravail || 'activité'}
        </span>
        <button
          type="button"
          className={`${styles.restriction} ${restreint ? styles.restrictionActive : ''}`}
          onClick={() => setElevesDe(e.id)}
          disabled={disabled}
          title="Choisir qui fait cette étape"
        >
          {restreint ? `${e.eleves!.length} élève${e.eleves!.length > 1 ? 's' : ''}` : 'tous les élèves'}
        </button>
        {!disabled && (
          <span className={styles.actions}>
            <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0} title="Avancer dans le parcours">◀</button>
            <button type="button" onClick={() => deplacer(i, 1)} disabled={i === contenu.etapes.length - 1} title="Reculer dans le parcours">▶</button>
            <button type="button" onClick={() => retirer(e.id)} title="Retirer de la séquence">✕</button>
          </span>
        )}
      </article>
    );
  };

  return (
    <div className={styles.builder}>
      <div className={base.bloc}>
        <p className={base.blocTitre}>
          Le parcours, étape par étape
          <span>
            Le « + » ajoute une étape à cet endroit : un point de théorie ou une activité, pris
            dans Mes Ressources › Modules FLE. Chaque encadré peut être réservé à certains élèves.
          </span>
        </p>

        {/* ── La ligne du temps en serpentin (mécanisme partagé avec le portfolio) ── */}
        <Serpentin
          items={contenu.etapes}
          cle={(e) => e.id}
          rendreItem={rendreEtape}
          onPlus={disabled ? undefined : ouvrirPlus}
          aideDepart="Première étape : une théorie ou une activité."
        />
      </div>

      {/* ── Le « + » : la nature, puis l'existant ── */}
      {insertion !== null && (
        <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && setInsertion(null)}>
          <div className={base.popup}>
            <header className={base.popupEntete}>
              <h3>
                Ajouter une étape
                {contenu.etapes.length > 0 && (
                  <span className={styles.popupPosition}> — en position {insertion + 1}</span>
                )}
              </h3>
              <button type="button" className={base.popupFermer} onClick={() => setInsertion(null)}>
                ✕
              </button>
            </header>
            <div className={base.popupCorps}>
              {/* 1. La nature */}
              <div className={styles.natures}>
                <button
                  type="button"
                  className={`${styles.natureBtn} ${styles.natureTheorie} ${nature === 'theorie' ? styles.natureActive : ''}`}
                  onClick={() => {
                    setNature('theorie');
                    setRecherche('');
                  }}
                >
                  <span className={styles.natureIcone} aria-hidden="true">📖</span>
                  <span className={styles.natureTitre}>Un point de théorie</span>
                </button>
                <button
                  type="button"
                  className={`${styles.natureBtn} ${styles.natureActivite} ${nature === 'activite' ? styles.natureActive : ''}`}
                  onClick={() => {
                    setNature('activite');
                    setRecherche('');
                  }}
                >
                  <span className={styles.natureIcone} aria-hidden="true">🎯</span>
                  <span className={styles.natureTitre}>Une activité</span>
                </button>
              </div>

              {/* 2. L'existant — la popup s'allonge */}
              {nature && (
                <>
                  <input
                    type="search"
                    className={styles.recherche}
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder={nature === 'theorie' ? 'Rechercher un point de théorie…' : 'Rechercher une activité…'}
                    autoFocus
                  />
                  {nature === 'theorie' &&
                    (modules === null ? (
                      <p className={base.vide}>Chargement…</p>
                    ) : candidatsModules.length === 0 ? (
                      <p className={base.vide}>{q ? 'Aucun point de théorie ne correspond.' : 'Aucun point de théorie pour l’instant.'}</p>
                    ) : (
                      <div className={base.liste}>
                        {candidatsModules.map((m) => (
                          <button key={m.id} type="button" className={base.item} onClick={() => insererModule(m)}>
                            <span>{iconeTypeModule(m.type)}</span>
                            <span className={base.activiteNom}>{m.titre}</span>
                            <span className={base.itemClasses}>
                              {config.niveaux.find((n) => n.id === m.niveau)?.label ?? ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  {nature === 'activite' &&
                    (devoirs === null ? (
                      <p className={base.vide}>Chargement…</p>
                    ) : candidatsDevoirs.length === 0 ? (
                      <p className={base.vide}>{q ? 'Aucune activité ne correspond.' : 'Aucune activité pour l’instant.'}</p>
                    ) : (
                      <>
                        {[
                          { titreGroupe: 'Activités FLE', liste: activitesFle },
                          { titreGroupe: 'Mes Activités', liste: activitesClassiques },
                        ].map(
                          ({ titreGroupe, liste }) =>
                            liste.length > 0 && (
                              <div key={titreGroupe} className={styles.groupe}>
                                <p className={styles.groupeTitre}>{titreGroupe}</p>
                                <div className={base.liste}>
                                  {liste.map((d) => (
                                    <button key={d.id} type="button" className={base.item} onClick={() => insererDevoir(d)}>
                                      <span>{iconeAtelier(d.atelier)}</span>
                                      <span className={base.activiteNom}>{d.intitule}</span>
                                      <span className={base.itemClasses}>
                                        {atelierLabel(d.atelier ?? '', true) || d.typeTravail}
                                        {d.classes.length ? ` · ${d.classes.join(', ')}` : ''}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )
                        )}
                      </>
                    ))}
                  <a className={styles.lienCreer} href={lienCreer} target="_blank" rel="noopener">
                    ➕ {nature === 'theorie' ? 'Créer un point de théorie' : 'Créer une activité'} dans Mes Ressources › Modules FLE
                    <span aria-hidden="true"> ↗</span>
                  </a>
                </>
              )}
            </div>
            <footer className={base.popupPied}>
              <span className={base.popupNote}>
                {nature
                  ? 'Créé dans l’autre onglet ? Reviens ici : la liste se met à jour.'
                  : 'Choisis d’abord la nature de l’étape.'}
              </span>
              <button type="button" className={base.btnGhost} onClick={() => setInsertion(null)}>
                Fermer
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── Les élèves d'une étape ── */}
      {etapeEleves && (
        <div className={base.overlay} onClick={(e) => e.target === e.currentTarget && setElevesDe(null)}>
          <div className={base.popup}>
            <header className={base.popupEntete}>
              <h3>Qui fait « {etapeEleves.titre} » ?</h3>
              <button type="button" className={base.popupFermer} onClick={() => setElevesDe(null)}>
                ✕
              </button>
            </header>
            <div className={base.popupCorps}>
              <div className={styles.choixEleves}>
                <label className={`${styles.option} ${etapeEleves.eleves === null ? styles.optionActive : ''}`}>
                  <input type="radio" checked={etapeEleves.eleves === null} disabled={disabled} onChange={() => modifierEtape(etapeEleves.id, { eleves: null })} />
                  Tous les élèves de la séquence
                </label>
                <label className={`${styles.option} ${etapeEleves.eleves !== null ? styles.optionActive : ''}`}>
                  <input type="radio" checked={etapeEleves.eleves !== null} disabled={disabled} onChange={() => modifierEtape(etapeEleves.id, { eleves: etapeEleves.eleves ?? [] })} />
                  Certains élèves seulement
                </label>
              </div>
              {etapeEleves.eleves !== null &&
                (elevesDeLaSequence.length === 0 ? (
                  <p className={styles.vide}>Coche d’abord une classe au recto : ses élèves apparaîtront ici.</p>
                ) : (
                  <ListeEleves
                    eleves={elevesDeLaSequence}
                    coches={etapeEleves.eleves}
                    onBasculer={(id, coche) =>
                      modifierEtape(etapeEleves.id, {
                        eleves: coche ? [...etapeEleves.eleves!, id] : etapeEleves.eleves!.filter((e) => e !== id),
                      })
                    }
                    avecClasse={plusieursClasses}
                    disabled={disabled}
                  />
                ))}
            </div>
            <footer className={base.popupPied}>
              <span className={base.popupNote}>Seuls les élèves qui suivent la séquence sont proposés.</span>
              <button type="button" className={base.btnGhost} onClick={() => setElevesDe(null)}>
                Fermer
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

// Les ateliers ne servent ici qu'à l'icône et au libellé court ; on garde la
// liste sous la main pour les compléter le jour où un atelier s'ajoute.
void ATELIERS;
