'use client';

// Design & scénarisation didactique — onglet de Mes Ressources.
//
//   Parcours (une scénarisation par cours) > Chapitres > Modules > Activités
//
// Où se saisit quoi (décision de JP, 2026-08-14) :
//  - le PARCOURS ne porte qu'un nom : un objectif général à ce niveau serait
//    trop général pour dire quelque chose, et la certification appartient aux
//    chapitres ;
//  - le CHAPITRE porte plusieurs objectifs généraux, affichés dans son bandeau ;
//  - ses lignes ont trois GENRES — module, certification, suggestion — qui se
//    comportent exactement pareil : une certification s'intercale donc entre
//    deux modules, et une suggestion note une idée pour l'année suivante ;
//  - le MODULE porte ses objectifs particuliers en trois registres, et n'est
//    plus qu'une SYNTHÈSE pour le reste : sa durée est la somme de ses
//    activités, ses méthodes/UAA/gestes leur réunion ;
//  - l'ACTIVITÉ porte la didactique fine : durée, méthode, UAA, gestes, outils.
//
// Deux vues d'un même contenu :
//  - L'ANNÉE : vision spatiale. Par module (cartes dans les cinq périodes de
//    l'année, avec la capacité de chacune) ou par chapitre (une bande par
//    chapitre à travers l'année).
//  - ENCODAGE : un tableau par chapitre. Tout se modifie sur place — aucun
//    crayon, aucune fenêtre d'édition : on clique dans la cellule.
//
// Enregistrement (useScenarisations) : immédiat pour tout ce qui n'est pas de
// la frappe (case cochée, menu, ajout, suppression), 1,2 s après la dernière
// touche sinon, et de toute façon dès qu'on quitte un champ (onBlur du panneau).

import { Fragment, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDidactique } from '@/hooks/useDidactique';
import { useScenarisations } from '@/hooks/useScenarisations';
import { TYPES_COGNITIFS, TYPES_SAVOIR_ETRE, gestesDeTypes } from '@/types/didactique';
import {
  GENRES,
  GENRES_AJOUTABLES,
  PERIODES_ANNEE,
  capacitePeriode,
  couleurDeChapitre,
  comptePourLAnnee,
  formatDuree,
  genreDe,
  moduleGestes,
  moduleMethodes,
  moduleOutils,
  modulePeriodes,
  moduleUaa,
  nouveauChapitre,
  nouveauModule,
  objectifsDe,
  periodesChapitre,
  periodesPlanifiees,
  semainesDe,
} from '@/types/scenarisation';
import type {
  ChapitreDidactique,
  GenreModule,
  ModuleActivite,
  ModuleDidactique,
  PeriodeAnnee,
  Scenarisation,
} from '@/types/scenarisation';
import TagField from './TagField';
import ListField from './ListField';
import AutoTextarea from './AutoTextarea';
import ModuleActivitesModal from './ModuleActivitesModal';
import ModuleFicheModal from './ModuleFicheModal';
import styles from './ScenarisationPanel.module.css';


type Vue = 'annee' | 'encodage';
type VueAnnee = 'module' | 'chapitre';

// Déplace un élément d'un cran dans un tableau — sert au réordonnancement des
// chapitres et des modules (l'ordre d'encodage EST l'ordre du cours)
function deplacer<T>(liste: T[], i: number, sens: -1 | 1): T[] {
  const j = i + sens;
  if (j < 0 || j >= liste.length) return liste;
  const copie = [...liste];
  [copie[i], copie[j]] = [copie[j], copie[i]];
  return copie;
}

export default function ScenarisationPanel() {
  const { scenarisations, isLoading, isSaving, dirty, error, modifier, creer, supprimer, vider } =
    useScenarisations();
  const { config } = useDidactique();

  const [courantId, setCourantId] = useState<string | null>(null);
  const [vue, setVue] = useState<Vue>('encodage');
  const [vueAnnee, setVueAnnee] = useState<VueAnnee>('module');
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  // Chapitres dont le tiroir à suggestions est ouvert
  const [suggOuvertes, setSuggOuvertes] = useState<Set<string>>(new Set());
  const [modulesDeplies, setModulesDeplies] = useState<Set<string>>(new Set());
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  // Module dont on ajoute une activité : { chapitreId, moduleId }
  // Fiche descriptive ouverte — { chapitre, module }
  const [fiche, setFiche] = useState<{ ch: string; mod: string } | null>(null);
  const [cibleActivite, setCibleActivite] = useState<{ ch: string; mod: string } | null>(null);

  const scen = useMemo(
    () => scenarisations.find((s) => s.id === courantId) ?? scenarisations[0] ?? null,
    [scenarisations, courantId]
  );

  const uaaOptions = (config?.uaa ?? []).filter((u) => u.visible).map((u) => ({ id: u.id, label: u.label }));
  const methodeOptions = (config?.methodes ?? [])
    .filter((m) => m.visible)
    .map((m) => ({ id: m.id, label: m.label }));
  // La scénarisation coche des GESTES, pas des habiletés : un geste englobe des
  // habiletés, et c'est au geste qu'on planifie un cours (cf. init.md).
  const gestesCognitifs = useMemo(() => gestesDeTypes(config, TYPES_COGNITIFS), [config]);
  const gestesSavoirEtre = useMemo(() => gestesDeTypes(config, TYPES_SAVOIR_ETRE), [config]);
  // Ce que propose la colonne Gestes d'une activité : toutes les familles,
  // groupées — on voit d'abord « Gestes de lecture », « Gestes d'écriture »…
  // et on déplie celle qu'on veut.
  const tousLesGestes = useMemo(
    () => [...gestesCognitifs, ...gestesSavoirEtre],
    [gestesCognitifs, gestesSavoirEtre]
  );

  const ADMIN_NOTE = 'Liste gérée dans Administration du site → Gestion didactique';

  // ─── Mutations ───

  // `immediat` : tout ce qui n'est pas de la frappe au clavier (case cochée,
  // menu déroulant, ajout, suppression) part sans attendre le délai.
  const maj = (patch: Partial<Scenarisation>, immediat = false) => {
    if (scen) modifier({ ...scen, ...patch }, immediat);
  };

  const majChapitres = (chapitres: ChapitreDidactique[], immediat = false) =>
    maj({ chapitres }, immediat);

  const majChapitre = (chId: string, patch: Partial<ChapitreDidactique>, immediat = false) => {
    if (!scen) return;
    majChapitres(
      scen.chapitres.map((c) => (c.id === chId ? { ...c, ...patch } : c)),
      immediat
    );
  };

  const majModule = (
    chId: string,
    modId: string,
    patch: Partial<ModuleDidactique>,
    immediat = false
  ) => {
    if (!scen) return;
    majChapitre(
      chId,
      {
        modules:
          scen.chapitres
            .find((c) => c.id === chId)
            ?.modules.map((m) => (m.id === modId ? { ...m, ...patch } : m)) ?? [],
      },
      immediat
    );
  };

  const majActivite = (
    chId: string,
    modId: string,
    actId: string,
    patch: Partial<ModuleActivite>,
    immediat = false
  ) => {
    if (!scen) return;
    const mod = scen.chapitres.find((c) => c.id === chId)?.modules.find((m) => m.id === modId);
    if (!mod) return;
    majModule(
      chId,
      modId,
      { activites: mod.activites.map((a) => (a.id === actId ? { ...a, ...patch } : a)) },
      immediat
    );
  };

  const ajouterChapitre = () => {
    if (!scen) return;
    // Le rang décide de la couleur INITIALE ; elle est ensuite figée sur le
    // chapitre et ne bouge plus quand on le déplace.
    const ch = nouveauChapitre(scen.chapitres.length);
    majChapitres([...scen.chapitres, ch], true);
    setOuverts((prev) => new Set(prev).add(ch.id));
  };

  const supprimerChapitre = (chId: string) => {
    if (!scen) return;
    if (!confirm('Supprimer ce chapitre et tous ses modules ? Les activités Recto-versIA sont conservées.')) return;
    majChapitres(scen.chapitres.filter((c) => c.id !== chId), true);
  };

  const deplacerChapitre = (i: number, sens: -1 | 1) => {
    if (!scen) return;
    majChapitres(deplacer(scen.chapitres, i, sens), true);
  };

  const deplacerModule = (chId: string, i: number, sens: -1 | 1) => {
    if (!scen) return;
    const ch = scen.chapitres.find((c) => c.id === chId);
    if (!ch) return;
    majChapitre(chId, { modules: deplacer(ch.modules, i, sens) }, true);
  };

  const ajouterModule = (chId: string, genre: GenreModule = 'module') => {
    if (!scen) return;
    const ch = scen.chapitres.find((c) => c.id === chId);
    const derniere = ch?.modules[ch.modules.length - 1]?.periodeAnnee ?? 'sept-oct';
    const m = nouveauModule(derniere as PeriodeAnnee, genre);
    majChapitre(chId, { modules: [...(ch?.modules ?? []), m] }, true);
    setModulesDeplies((prev) => new Set(prev).add(m.id));
  };

  const supprimerModule = (chId: string, modId: string) => {
    // Un module emporte ses activités : la confirmation n'est pas du confort.
    // (La suppression de chapitre en demandait une, pas celle-ci — incohérence
    // relevée à l'audit du 2026-08-15.)
    const mod = scen.chapitres.find((c) => c.id === chId)?.modules.find((m) => m.id === modId);
    const nb = mod?.activites.length ?? 0;
    const ok = window.confirm(
      `Supprimer « ${mod?.titre?.trim() || 'ce module'} » ?` +
        (nb > 0 ? `\n\nSes ${nb} activité${nb > 1 ? 's' : ''} seront supprimées avec lui.` : '')
    );
    if (!ok) return;
    if (!scen) return;
    const ch = scen.chapitres.find((c) => c.id === chId);
    majChapitre(chId, { modules: (ch?.modules ?? []).filter((m) => m.id !== modId) }, true);
  };

  const dupliquerModule = (chId: string, modId: string) => {
    if (!scen) return;
    const ch = scen.chapitres.find((c) => c.id === chId);
    if (!ch) return;
    const i = ch.modules.findIndex((m) => m.id === modId);
    if (i === -1) return;
    const suffixe = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const source: ModuleDidactique = JSON.parse(JSON.stringify(ch.modules[i]));
    const copie: ModuleDidactique = {
      ...source,
      id: `MOD-${suffixe()}`,
      titre: `${ch.modules[i].titre} (copie)`,
      // Les activités dupliquées reçoivent leur propre identifiant
      activites: source.activites.map((a) => ({ ...a, id: `ACT-${suffixe()}` })),
    };
    const modules = [...ch.modules];
    modules.splice(i + 1, 0, copie);
    majChapitre(chId, { modules }, true);
  };

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  // ─── États d'attente ───

  if (isLoading) {
    return <p className={styles.info}>Chargement des scénarisations…</p>;
  }

  if (!scen) {
    return (
      <div className={styles.empty}>
        <h3 className={styles.emptyTitle}>Aucune scénarisation</h3>
        <p className={styles.emptyText}>
          Une scénarisation décrit un cours : ses chapitres, ses modules, leurs objectifs et le
          temps qu’ils prennent. Les activités Recto-versIA viennent s’y accrocher.
        </p>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={async () => {
            const nom = prompt('Nom du cours (ex. « Français — 4e générale ») :');
            if (nom?.trim()) {
              const nouvelle = await creer(nom.trim());
              if (nouvelle) setCourantId(nouvelle.id);
            }
          }}
        >
          ＋ Créer une scénarisation
        </button>
      </div>
    );
  }

  const moduleCible = cibleActivite
    ? scen.chapitres.find((c) => c.id === cibleActivite.ch)?.modules.find((m) => m.id === cibleActivite.mod)
    : null;

  const moduleFiche = fiche
    ? scen.chapitres.find((c) => c.id === fiche.ch)?.modules.find((m) => m.id === fiche.mod)
    : null;

  const totalPlanifie = PERIODES_ANNEE.reduce((s, p) => s + periodesPlanifiees(scen, p.id), 0);
  const totalCapacite = PERIODES_ANNEE.reduce((s, p) => s + capacitePeriode(scen, p.id), 0);

  // Résumé en lecture seule d'une liste de valeurs (colonnes du module)
  const resume = (valeurs: string[], libelle: (v: string) => string, vide = '—') => {
    if (!valeurs.length) return <span className={styles.roVide}>{vide}</span>;
    return (
      <span className={styles.roTags}>
        {valeurs.map((v) => (
          <span key={v} className={styles.roTag} title={libelle(v)}>
            {libelle(v)}
          </span>
        ))}
      </span>
    );
  };

  const labelDe = (options: { id: string; label: string }[], id: string) =>
    options.find((o) => o.id === id)?.label ?? id;

  // Les gestes d'un module viennent de ses activités ; on les range dans le
  // registre auquel ils appartiennent (cognitif ou savoir-être), d'après la
  // famille déclarée dans /admin. Un geste coché à la main autrefois, sur le
  // module lui-même, reste compté — rien de ce qui a été saisi ne se perd.
  const gestesDuModule = (m: ModuleDidactique, registre: 'cognitifs' | 'savoirEtre'): string[] => {
    const reference = registre === 'cognitifs' ? gestesCognitifs : gestesSavoirEtre;
    const connus = new Set(reference.map((g) => g.id));
    const manuels =
      registre === 'cognitifs'
        ? (m.objectifs.gestesCognitifs ?? [])
        : (m.objectifs.gestesSavoirEtre ?? []);
    const out: string[] = [];
    [...moduleGestes(m).filter((g) => connus.has(g)), ...manuels].forEach((g) => {
      if (!out.includes(g)) out.push(g);
    });
    return out;
  };

  return (
    /* onBlur : quitter un champ enregistre — on ne compte pas sur le seul délai */
    <div className={styles.panel} onBlur={() => vider()}>
      {/* ── Barre : choix du cours, réglages, bascule de vue ── */}
      <div className={styles.scenBar}>
        <select
          className={styles.scenSelect}
          value={scen.id}
          onChange={(e) => {
            vider();
            setCourantId(e.target.value);
          }}
        >
          {scenarisations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={styles.btn}
          onClick={async () => {
            const nom = prompt('Nom du cours :');
            if (nom?.trim()) {
              const nouvelle = await creer(nom.trim());
              if (nouvelle) setCourantId(nouvelle.id);
            }
          }}
        >
          ＋ Nouvelle scénarisation
        </button>

        <button
          type="button"
          className={styles.btn}
          onClick={() => setReglagesOuverts((v) => !v)}
          title="Durée d’une période, heures par semaine"
        >
          ⚙ {scen.heuresParSemaine} h/semaine · période = {formatDuree(1, scen.dureePeriodeMin)}
        </button>

        <span className={styles.saveState}>
          {error ? (
            <span className={styles.err}>⚠ {error}</span>
          ) : isSaving ? (
            'Enregistrement…'
          ) : dirty ? (
            <span className={styles.pending}>● Modifications en attente</span>
          ) : (
            <span className={styles.saved}>✓ Enregistré</span>
          )}
        </span>

        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.vBtn} ${vue === 'annee' ? styles.vBtnOn : ''}`}
            onClick={() => setVue('annee')}
          >
            🗓 L’année
          </button>
          <button
            type="button"
            className={`${styles.vBtn} ${vue === 'encodage' ? styles.vBtnOn : ''}`}
            onClick={() => setVue('encodage')}
          >
            ✎ Encodage
          </button>
        </div>
      </div>

      {reglagesOuverts && (
        <div className={styles.reglages}>
          <label className={styles.reglage}>
            Durée d’une période
            <input
              type="number"
              min={15}
              step={5}
              value={scen.dureePeriodeMin}
              onChange={(e) => maj({ dureePeriodeMin: Math.max(15, Number(e.target.value) || 90) })}
            />
            minutes
          </label>
          <label className={styles.reglage}>
            Heures de cours par semaine
            <input
              type="number"
              min={0}
              step={0.5}
              value={scen.heuresParSemaine}
              onChange={(e) => maj({ heuresParSemaine: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => {
              if (confirm(`Supprimer la scénarisation « ${scen.nom} » ? Les activités sont conservées.`)) {
                supprimer(scen.id);
                setCourantId(null);
              }
            }}
          >
            Supprimer cette scénarisation
          </button>
        </div>
      )}

      {/* ── Bandeau du parcours : le nom, rien d'autre ── */}
      <div className={styles.parcoursHead}>
        <AutoTextarea
          className={styles.phTitle}
          value={scen.nom}
          onChange={(nom) => maj({ nom })}
          placeholder="Nom du cours"
        />
        <span className={styles.phHint}>
          {scen.chapitres.length} chapitre{scen.chapitres.length > 1 ? 's' : ''} ·{' '}
          {totalPlanifie} période{totalPlanifie > 1 ? 's' : ''} planifiée
          {totalPlanifie > 1 ? 's' : ''} sur {totalCapacite}
        </span>

        {/* La charge de l'année, DANS LES DEUX VUES. Les jauges n'existaient
            que dans la vue « année », c'est-à-dire là où l'on ne saisit rien :
            le prof devait changer de vue, lire, mémoriser, revenir. C'est aussi
            la seule chose de l'écran qui bouge quand on encode. */}
        <div className={styles.capaBar}>
          {PERIODES_ANNEE.map((p) => {
            const plan = periodesPlanifiees(scen, p.id);
            const capa = capacitePeriode(scen, p.id);
            const pct = capa > 0 ? Math.min(100, Math.round((plan / capa) * 100)) : 0;
            const etat = capa > 0 && plan > capa ? 'over' : capa > 0 && plan / capa > 0.85 ? 'warn' : '';
            return (
              <div
                key={p.id}
                className={styles.capaCell}
                title={`${p.label} — ${plan} période${plan > 1 ? 's' : ''} planifiée${plan > 1 ? 's' : ''} sur ${capa}`}
              >
                <span className={styles.capaLabel}>{p.label}</span>
                <span className={styles.capaTrack}>
                  <span
                    className={`${styles.capaFill} ${etat ? styles[`capa_${etat}`] : ''}`}
                    style={{ transform: `scaleX(${pct / 100})` }}
                  />
                </span>
                <span className={`${styles.capaNum} ${etat ? styles[`capaNum_${etat}`] : ''}`}>
                  {plan}/{capa}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════ VUE ANNÉE ══════════ */}
      {vue === 'annee' && (
        <>
          <div className={styles.subToggle}>
            <button
              type="button"
              className={`${styles.sBtn} ${vueAnnee === 'module' ? styles.sBtnOn : ''}`}
              onClick={() => setVueAnnee('module')}
            >
              Par module
            </button>
            <button
              type="button"
              className={`${styles.sBtn} ${vueAnnee === 'chapitre' ? styles.sBtnOn : ''}`}
              onClick={() => setVueAnnee('chapitre')}
            >
              Par chapitre
            </button>
          </div>

          {vueAnnee === 'module' ? (
            <div className={styles.year}>
              {PERIODES_ANNEE.map((p) => {
                const capa = capacitePeriode(scen, p.id);
                const plan = periodesPlanifiees(scen, p.id);
                const pct = capa > 0 ? Math.min(100, Math.round((plan / capa) * 100)) : 0;
                const reste = capa - plan;
                return (
                  <div key={p.id} className={styles.col}>
                    <div className={styles.colHead}>
                      <div className={styles.colName}>{p.label}</div>
                      <div className={styles.colCapa}>
                        <input
                          type="number"
                          min={0}
                          value={semainesDe(scen, p.id)}
                          onChange={(e) =>
                            maj({
                              semaines: {
                                ...scen.semaines,
                                [p.id]: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                          title="Nombre de semaines de cours dans cette période"
                        />{' '}
                        sem. · <strong>{capa} pér.</strong>
                      </div>
                      <div className={styles.colTotal}>
                        {plan} <span className={styles.of}>/ {capa}</span>
                      </div>
                      <div className={styles.gauge}>
                        <div
                          className={`${styles.gaugeFill} ${
                            reste < 0 ? styles.over : pct > 85 ? styles.warn : ''
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className={`${styles.reste} ${reste < 0 ? styles.errText : ''}`}>
                        {reste >= 0
                          ? `${reste} période${reste > 1 ? 's' : ''} libre${reste > 1 ? 's' : ''}`
                          : `${-reste} de trop`}
                      </div>
                    </div>

                    <div className={styles.colBody}>
                      {scen.chapitres.map((ch, ci) =>
                        ch.modules
                          .filter((m) => m.periodeAnnee === p.id)
                          .map((m) => (
                            <div
                              key={m.id}
                              className={`${styles.modCard} ${
                                genreDe(m) === 'certification'
                                  ? styles.certCard
                                  : genreDe(m) === 'suggestion'
                                    ? styles.suggCard
                                    : ''
                              }`}
                              style={{ '--ch-color': couleurDeChapitre(ch, ci) } as CSSProperties}
                              onClick={() => {
                                setVue('encodage');
                                setOuverts((prev) => new Set(prev).add(ch.id));
                                setModulesDeplies((prev) => new Set(prev).add(m.id));
                              }}
                              title="Ouvrir dans l’encodage"
                            >
                              <div className={styles.modTitle}>
                                {GENRES[genreDe(m)].icone} {m.titre || 'Module sans titre'}
                              </div>
                              <div className={styles.modMeta}>
                                <span className={styles.per}>
                                  {modulePeriodes(m)} pér.
                                  {!comptePourLAnnee(m) && ' (hors calcul)'}
                                </span>
                                {moduleUaa(m).map((u) => (
                                  <span key={u} className={styles.tagMini}>
                                    UAA {u}
                                  </span>
                                ))}
                              </div>
                              {m.activites.length > 0 && (
                                <div className={styles.modMeta}>
                                  <span className={styles.rvTag}>
                                    {m.activites.filter((a) => a.devoirId).length} 🔗 ·{' '}
                                    {m.activites.length} activité{m.activites.length > 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.lanes}>
              <div className={styles.laneHead}>
                <div>Chapitre</div>
                {PERIODES_ANNEE.map((p) => (
                  <div key={p.id}>
                    {p.label}
                    <span className={styles.capa}>{capacitePeriode(scen, p.id)} pér. dispo.</span>
                  </div>
                ))}
              </div>

              {scen.chapitres.map((ch, ci) => {
                const certifs = ch.modules.filter((m) => genreDe(m) === 'certification');
                return (
                  <div key={ch.id} className={styles.lane}>
                    <div
                      className={styles.laneName}
                      style={{ '--ch-color': couleurDeChapitre(ch, ci) } as CSSProperties}
                    >
                      <div className={styles.laneTitle}>{ch.titre || 'Chapitre sans titre'}</div>
                      {objectifsDe(ch).map((o, i) => (
                        <div key={i} className={styles.laneObj}>
                          {o}
                        </div>
                      ))}
                      <div className={styles.laneTotal}>
                        {periodesChapitre(ch)} périodes ·{' '}
                        {formatDuree(periodesChapitre(ch), scen.dureePeriodeMin)} · {ch.modules.length}{' '}
                        module{ch.modules.length > 1 ? 's' : ''}
                        {certifs.length === 0 && ' · pas de certification'}
                      </div>
                    </div>
                    {PERIODES_ANNEE.map((p) => {
                      const mods = ch.modules.filter((m) => m.periodeAnnee === p.id);
                      return (
                        <div key={p.id} className={styles.laneCell}>
                          {mods.map((m) => {
                            const g = genreDe(m);
                            return (
                              <div
                                key={m.id}
                                className={`${styles.blk} ${
                                  g === 'certification'
                                    ? styles.blkCert
                                    : g === 'suggestion'
                                      ? styles.blkSugg
                                      : ''
                                }`}
                                style={g === 'module' ? { background: couleurDeChapitre(ch, ci) } : undefined}
                              >
                                {GENRES[g].icone} {m.titre || GENRES[g].label}
                                <span className={styles.blkPer}>{modulePeriodes(m)} pér.</span>
                              </div>
                            );
                          })}
                          {mods.length === 0 && <span className={styles.laneEmpty}>·</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <div className={`${styles.lane} ${styles.laneTotalRow}`}>
                <div className={styles.laneName} style={{ borderLeftColor: 'var(--c-border)' }}>
                  <div className={styles.laneTitle}>Total planifié</div>
                  <div className={styles.laneObj}>
                    Reste libre sur l’année : {Math.max(0, totalCapacite - totalPlanifie)} périodes
                  </div>
                </div>
                {PERIODES_ANNEE.map((p) => (
                  <div key={p.id} className={`${styles.laneCell} ${styles.laneCellTotal}`}>
                    <b>
                      {periodesPlanifiees(scen, p.id)} / {capacitePeriode(scen, p.id)}
                    </b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.yearFoot}>
            <div className={styles.kpi}>
              <span className={styles.kpiVal}>
                {totalPlanifie} <span className={styles.of}>/ {totalCapacite}</span>
              </span>
              <span className={styles.kpiLbl}>
                périodes planifiées · {formatDuree(totalPlanifie, scen.dureePeriodeMin)} sur{' '}
                {formatDuree(totalCapacite, scen.dureePeriodeMin)}
              </span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiVal}>{scen.chapitres.length}</span>
              <span className={styles.kpiLbl}>
                chapitres · {scen.chapitres.reduce((s, c) => s + c.modules.length, 0)} modules
              </span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiVal}>
                {scen.chapitres.reduce(
                  (s, c) => s + c.modules.reduce((n, m) => n + m.activites.filter((a) => a.devoirId).length, 0),
                  0
                )}
              </span>
              <span className={styles.kpiLbl}>activités Recto-versIA reliées</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiVal}>
                {scen.chapitres.reduce(
                  (s, c) => s + c.modules.filter((m) => genreDe(m) === 'certification').length,
                  0
                )}
              </span>
              <span className={styles.kpiLbl}>certifications prévues</span>
            </div>
          </div>
        </>
      )}

      {/* ══════════ VUE ENCODAGE ══════════ */}
      {vue === 'encodage' && (
        <>
          {scen.chapitres.length === 0 && (
            <p className={styles.info}>
              Aucun chapitre. Un chapitre regroupe des modules et vise un ou plusieurs objectifs
              généraux.
            </p>
          )}

          {scen.chapitres.map((ch, ci) => {
            const ouvert = ouverts.has(ch.id);
            return (
              <div
                key={ch.id}
                className={styles.chapter}
                style={{ '--ch-color': couleurDeChapitre(ch, ci) } as CSSProperties}
              >
                <div className={styles.chHead}>
                  <button
                    type="button"
                    className={styles.chChevron}
                    onClick={() => toggle(ouverts, ch.id, setOuverts)}
                  >
                    {ouvert ? '▾' : '▸'}
                  </button>
                  {/* Titre ET objectifs généraux dans le bandeau : ils se
                      lisent chapitre fermé, sans avoir à déplier */}
                  <div className={styles.chHeadMain}>
                    <AutoTextarea
                      className={styles.chTitle}
                      value={ch.titre}
                      onChange={(titre) => majChapitre(ch.id, { titre })}
                      placeholder="Titre du chapitre"
                    />
                    <ListField
                      values={objectifsDe(ch)}
                      placeholder="Objectif général du chapitre…"
                      ajouterLabel="＋ objectif"
                      onChange={(objectifsGeneraux) => majChapitre(ch.id, { objectifsGeneraux })}
                      onStructuralChange={(objectifsGeneraux) =>
                        majChapitre(ch.id, { objectifsGeneraux }, true)
                      }
                    />
                  </div>
                  <span className={styles.chMeta}>
                    <span className={styles.chip}>
                      {periodesChapitre(ch)} pér. · {formatDuree(periodesChapitre(ch), scen.dureePeriodeMin)}
                    </span>
                    {/* Les suggestions ne sont ni des modules ni des
                        certifications : elles ne durent pas et ne se placent
                        pas dans l'année. Elles vivent donc ici, repliées
                        derrière une ampoule qui annonce leur nombre. */}
                    <button
                      type="button"
                      className={`${styles.suggBtn} ${
                        (ch.suggestions ?? []).length > 0 ? styles.suggBtnOn : ''
                      }`}
                      onClick={() => toggle(suggOuvertes, ch.id, setSuggOuvertes)}
                      title={
                        (ch.suggestions ?? []).length > 0
                          ? `${(ch.suggestions ?? []).length} idée${(ch.suggestions ?? []).length > 1 ? 's' : ''} pour l’an prochain`
                          : 'Noter une idée pour l’an prochain'
                      }
                    >
                      💡
                      {(ch.suggestions ?? []).length > 0 && (
                        <span className={styles.suggCompte}>{(ch.suggestions ?? []).length}</span>
                      )}
                    </button>
                    {/* Interchanger les chapitres : l'ordre d'encodage est celui du cours */}
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Monter ce chapitre"
                      disabled={ci === 0}
                      onClick={() => deplacerChapitre(ci, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Descendre ce chapitre"
                      disabled={ci === scen.chapitres.length - 1}
                      onClick={() => deplacerChapitre(ci, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Supprimer ce chapitre"
                      onClick={() => supprimerChapitre(ch.id)}
                    >
                      🗑
                    </button>
                  </span>
                </div>

                {suggOuvertes.has(ch.id) && (
                  <div className={styles.suggPanel}>
                    <span className={styles.suggTitre}>
                      💡 Idées pour l’an prochain
                      <span className={styles.auto}>
                        ne comptent ni dans les périodes ni dans l’année
                      </span>
                    </span>
                    <ListField
                      values={ch.suggestions ?? []}
                      placeholder="Ex. : reprendre ce chapitre après les vacances, tester le débat filmé…"
                      ajouterLabel="＋ idée"
                      onChange={(suggestions) => majChapitre(ch.id, { suggestions })}
                      onStructuralChange={(suggestions) =>
                        majChapitre(ch.id, { suggestions }, true)
                      }
                    />
                  </div>
                )}

                {ouvert && (
                  <div className={styles.chBody}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          {/* Le module replié dit l'ESSENTIEL : ce qu'il vise,
                              combien il dure, combien il contient. Méthodes et
                              gestes ont rejoint la fiche descriptive — ils se
                              déduisent des activités et alourdissaient la ligne. */}
                          <th style={{ width: '38%' }}>Module</th>
                          <th style={{ width: '14%' }}>Période de l’année</th>
                          <th style={{ width: '12%' }}>Périodes</th>
                          <th style={{ width: '18%' }}>UAA</th>
                          <th style={{ width: '18%' }}>Activités</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ch.modules.map((m, mi) => {
                          const deplie = modulesDeplies.has(m.id);
                          const nbAct = m.activites.length;
                          const genre = genreDe(m);
                          const infos = GENRES[genre];
                          return (
                            <Fragment key={m.id}>
                              <tr
                                className={`${styles.modRow} ${
                                  genre === 'certification'
                                    ? styles.certRow
                                    : genre === 'suggestion'
                                      ? styles.suggRow
                                      : ''
                                }`}
                              >
                                <td>
                                  <span className={styles.rowTitle}>
                                    <button
                                      type="button"
                                      className={styles.rowChevron}
                                      onClick={() => toggle(modulesDeplies, m.id, setModulesDeplies)}
                                      title="Objectifs et activités"
                                    >
                                      {deplie ? '▾' : '▸'}
                                    </button>
                                    {infos.icone && (
                                      <span className={styles.genreIcone} title={infos.label}>
                                        {infos.icone}
                                      </span>
                                    )}
                                    <AutoTextarea
                                      className={`${styles.cellInput} ${styles.rowTitleInput}`}
                                      value={m.titre}
                                      onChange={(titre) => majModule(ch.id, m.id, { titre })}
                                      placeholder={`Titre ${
                                        genre === 'module' ? 'du module' : 'de la ' + infos.label.toLowerCase()
                                      }`}
                                    />
                                    <span className={styles.rowMove}>
                                      <button
                                        type="button"
                                        className={styles.iconBtn}
                                        title="Monter ce module"
                                        disabled={mi === 0}
                                        onClick={() => deplacerModule(ch.id, mi, -1)}
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.iconBtn}
                                        title="Descendre ce module"
                                        disabled={mi === ch.modules.length - 1}
                                        onClick={() => deplacerModule(ch.id, mi, 1)}
                                      >
                                        ↓
                                      </button>
                                    </span>
                                  </span>
                                </td>
                                <td>
                                  <select
                                    className={styles.inlineSelect}
                                    value={m.periodeAnnee}
                                    onChange={(e) =>
                                      majModule(
                                        ch.id,
                                        m.id,
                                        { periodeAnnee: e.target.value as PeriodeAnnee },
                                        true
                                      )
                                    }
                                  >
                                    {/* Chaque option dit la charge de sa période :
                                        c'est le contrôle le plus lourd de
                                        conséquences de l'écran, il ne peut pas
                                        rester muet sur ce qu'il déclenche. */}
                                    {PERIODES_ANNEE.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.label} · {periodesPlanifiees(scen, p.id)}/
                                        {capacitePeriode(scen, p.id)}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                {/* Les quatre colonnes qui suivent RÉSUMENT les activités :
                                    la saisie se fait dans la fiche de chaque activité */}
                                <td className={styles.roCell}>
                                  <span className={styles.roPer}>{modulePeriodes(m)}</span>
                                  <span className={styles.duree}>
                                    {comptePourLAnnee(m)
                                      ? formatDuree(modulePeriodes(m), scen.dureePeriodeMin)
                                      : 'hors calcul'}
                                  </span>
                                </td>
                                <td className={styles.roCell}>
                                  {resume(moduleUaa(m), (v) => `UAA ${v}`)}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className={styles.actCount}
                                    onClick={() => {
                                      setModulesDeplies((prev) => new Set(prev).add(m.id));
                                      setCibleActivite({ ch: ch.id, mod: m.id });
                                    }}
                                  >
                                    {nbAct === 0
                                      ? '＋ ajouter'
                                      : `${nbAct} activité${nbAct > 1 ? 's' : ''}`}
                                  </button>
                                </td>
                              </tr>

                              {deplie && (
                                <tr className={styles.detail}>
                                  <td colSpan={5}>
                                    <div className={styles.detailBox}>
                                      {/* Concepts, méthodes et gestes ont
                                          rejoint la FICHE DESCRIPTIVE (bouton
                                          ci-dessous) : ils décrivent le module,
                                          ils ne s'y saisissent pas. Ce menu
                                          déroulant reste celui des ACTIVITÉS,
                                          là où la didactique se pose vraiment. */}

                                      {/* ── Les activités : c'est ici que se saisit la didactique ── */}
                                      <div className={styles.actList}>
                                        <span className={styles.detailLabel}>
                                          Activités du module — méthode, UAA, gestes et durée se
                                          précisent ici
                                        </span>

                                        {nbAct === 0 && (
                                          <p className={styles.dim}>
                                            Aucune activité pour l’instant. Les périodes du module
                                            sont la somme de celles de ses activités.
                                          </p>
                                        )}

                                        {nbAct > 0 && (
                                          <div className={styles.actScroll}>
                                          <table className={styles.actTable}>
                                            <thead>
                                              <tr>
                                                <th style={{ width: '18%' }}>Activité</th>
                                                <th style={{ width: '6%' }}>Périodes</th>
                                                <th style={{ width: '11%' }}>Méthode</th>
                                                <th style={{ width: '6%' }}>UAA</th>
                                                <th style={{ width: '14%' }}>Gestes</th>
                                                <th style={{ width: '15%' }}>Concepts</th>
                                                <th style={{ width: '10%' }}>Outils</th>
                                                <th style={{ width: '15%' }}>Critique</th>
                                                <th style={{ width: '5%' }} />
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {m.activites.map((a) => (
                                                <tr key={a.id}>
                                                  <td>
                                                    <span className={styles.actCellTitle}>
                                                      <span className={styles.actIcon}>
                                                        {a.devoirId ? '🔗' : '🗣'}
                                                      </span>
                                                      <AutoTextarea
                                                        className={styles.cellInput}
                                                        value={a.titre}
                                                        placeholder="Intitulé de l’activité"
                                                        onChange={(titre) =>
                                                          majActivite(ch.id, m.id, a.id, { titre })
                                                        }
                                                      />
                                                    </span>
                                                    {a.devoirId ? (
                                                      <a
                                                        className={styles.actLink}
                                                        href={`/dashboard/travaux/${a.devoirId}`}
                                                      >
                                                        ouvrir dans Mes Activités
                                                      </a>
                                                    ) : (
                                                      <span className={styles.dim}>
                                                        hors application
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td>
                                                    <input
                                                      type="number"
                                                      min={0}
                                                      step={0.5}
                                                      className={`${styles.cellInput} ${styles.numInput}`}
                                                      value={a.periodes}
                                                      onChange={(e) =>
                                                        majActivite(ch.id, m.id, a.id, {
                                                          periodes: Math.max(
                                                            0,
                                                            Number(e.target.value) || 0
                                                          ),
                                                        })
                                                      }
                                                    />
                                                  </td>
                                                  <td>
                                                    <TagField
                                                      value={a.methodes ?? []}
                                                      options={methodeOptions}
                                                      variant="methode"
                                                      footer={ADMIN_NOTE}
                                                      onChange={(methodes) =>
                                                        majActivite(
                                                          ch.id,
                                                          m.id,
                                                          a.id,
                                                          { methodes },
                                                          true
                                                        )
                                                      }
                                                    />
                                                  </td>
                                                  <td>
                                                    <TagField
                                                      value={a.uaa ?? []}
                                                      options={uaaOptions}
                                                      labelCourt={(id) => `UAA ${id}`}
                                                      onChange={(uaa) =>
                                                        majActivite(ch.id, m.id, a.id, { uaa }, true)
                                                      }
                                                    />
                                                  </td>
                                                  <td>
                                                    <TagField
                                                      value={a.gestes ?? []}
                                                      options={tousLesGestes}
                                                      resume={(n) => `${n} gestes`}
                                                      footer={ADMIN_NOTE}
                                                      placeholder="choisir…"
                                                      onChange={(gestes) =>
                                                        majActivite(
                                                          ch.id,
                                                          m.id,
                                                          a.id,
                                                          { gestes },
                                                          true
                                                        )
                                                      }
                                                    />
                                                  </td>
                                                  <td>
                                                    {/* Concepts propres à CETTE
                                                        activité — le module a
                                                        les siens, dans sa fiche */}
                                                    <AutoTextarea
                                                      className={styles.cellInput}
                                                      value={a.concepts ?? ''}
                                                      placeholder="Ce que l’élève doit savoir…"
                                                      onChange={(concepts) =>
                                                        majActivite(ch.id, m.id, a.id, { concepts })
                                                      }
                                                    />
                                                  </td>
                                                  <td>
                                                    <AutoTextarea
                                                      className={styles.cellInput}
                                                      value={a.outils ?? ''}
                                                      placeholder="Manuel, projecteur…"
                                                      onChange={(outils) =>
                                                        majActivite(ch.id, m.id, a.id, { outils })
                                                      }
                                                    />
                                                  </td>
                                                  <td>
                                                    {/* L'avis du prof sur
                                                        l'activité : la mémoire
                                                        de l'année pour préparer
                                                        la suivante */}
                                                    <AutoTextarea
                                                      className={`${styles.cellInput} ${styles.critiqueInput}`}
                                                      value={a.critique ?? ''}
                                                      placeholder="Ce qui a marché, ce qui serait à revoir…"
                                                      onChange={(critique) =>
                                                        majActivite(ch.id, m.id, a.id, { critique })
                                                      }
                                                    />
                                                  </td>
                                                  <td>
                                                    <button
                                                      type="button"
                                                      className={styles.iconBtn}
                                                      title="Retirer du module"
                                                      onClick={() =>
                                                        majModule(
                                                          ch.id,
                                                          m.id,
                                                          {
                                                            activites: m.activites.filter(
                                                              (x: ModuleActivite) => x.id !== a.id
                                                            ),
                                                          },
                                                          true
                                                        )
                                                      }
                                                    >
                                                      ✕
                                                    </button>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                          </div>
                                        )}

                                        <div className={styles.actBtns}>
                                          <button
                                            type="button"
                                            className={`${styles.btn} ${styles.btnAccent}`}
                                            onClick={() => setCibleActivite({ ch: ch.id, mod: m.id })}
                                          >
                                            ➕ Activité
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.btn}
                                            onClick={() => setFiche({ ch: ch.id, mod: m.id })}
                                          >
                                            📋 Fiche du module
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.btn}
                                            onClick={() => dupliquerModule(ch.id, m.id)}
                                          >
                                            ⧉ Dupliquer le module
                                          </button>
                                          <button
                                            type="button"
                                            className={`${styles.btn} ${styles.btnDanger}`}
                                            onClick={() => supprimerModule(ch.id, m.id)}
                                          >
                                            🗑 Supprimer le module
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}

                      </tbody>
                    </table>

                    {/* Trois genres, trois boutons : ce qu'on ajoute prend
                        place en fin de chapitre et se déplace ensuite là où on
                        veut, entre deux modules s'il le faut. */}
                    <div className={styles.chFoot}>
                      {GENRES_AJOUTABLES.map((g) => (
                        <button
                          key={g}
                          type="button"
                          className={`${styles.btn} ${g === 'suggestion' ? styles.btnSugg : ''}`}
                          title={
                            g === 'suggestion'
                              ? 'Une idée pour l’année prochaine — ne compte pas dans les périodes'
                              : undefined
                          }
                          onClick={() => ajouterModule(ch.id, g)}
                        >
                          {GENRES[g].ajouter}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={ajouterChapitre}>
            ＋ Chapitre
          </button>
        </>
      )}

      {/* ── Popup : fiche descriptive du module ── */}
      {fiche && moduleFiche && (
        <ModuleFicheModal
          module={moduleFiche}
          genreLabel={GENRES[genreDe(moduleFiche)].label}
          genreIcone={GENRES[genreDe(moduleFiche)].icone}
          periodes={modulePeriodes(moduleFiche)}
          dureeLabel={
            comptePourLAnnee(moduleFiche)
              ? formatDuree(modulePeriodes(moduleFiche), scen.dureePeriodeMin)
              : 'hors calcul de l’année'
          }
          methodes={moduleMethodes(moduleFiche).map((v) => labelDe(methodeOptions, v))}
          uaa={moduleUaa(moduleFiche).map((v) => `UAA ${v}`)}
          gestesCognitifs={gestesDuModule(moduleFiche, 'cognitifs')}
          gestesSavoirEtre={gestesDuModule(moduleFiche, 'savoirEtre')}
          labelMethode={(id) => labelDe(methodeOptions, id)}
          onConceptsChange={(concepts) =>
            majModule(fiche.ch, fiche.mod, {
              objectifs: { ...moduleFiche.objectifs, concepts },
            })
          }
          onClose={() => setFiche(null)}
        />
      )}

      {/* ── Popup : ajouter une activité au module ── */}
      {cibleActivite && moduleCible && (
        <ModuleActivitesModal
          module={moduleCible}
          onClose={() => setCibleActivite(null)}
          onAjouter={(activite) => {
            majModule(
              cibleActivite.ch,
              cibleActivite.mod,
              { activites: [...moduleCible.activites, activite] },
              true
            );
            setCibleActivite(null);
          }}
        />
      )}
    </div>
  );
}
