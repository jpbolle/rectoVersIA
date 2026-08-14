'use client';

// Design & scénarisation didactique — onglet de Mes Ressources.
//
//   Parcours (une scénarisation par cours) > Chapitres > Modules > Activités
//
// Deux vues d'un même contenu :
//  - L'ANNÉE : vision spatiale. Par module (cartes dans les cinq périodes de
//    l'année, avec la capacité de chacune) ou par chapitre (une bande par
//    chapitre à travers l'année).
//  - ENCODAGE : un tableau par chapitre. Tout se modifie sur place — aucun
//    crayon, aucune fenêtre d'édition : on clique dans la cellule.
//
// L'enregistrement part 2,5 s après la dernière frappe (useScenarisations).

import { Fragment, useMemo, useState } from 'react';
import { useDidactique } from '@/hooks/useDidactique';
import { useScenarisations } from '@/hooks/useScenarisations';
import { habileteLabel } from '@/types/didactique';
import {
  PERIODES_ANNEE,
  capacitePeriode,
  formatDuree,
  nouveauChapitre,
  nouveauModule,
  nouvelleCertification,
  periodesChapitre,
  periodesPlanifiees,
  semainesDe,
} from '@/types/scenarisation';
import type {
  ChapitreDidactique,
  ModuleActivite,
  ModuleDidactique,
  PeriodeAnnee,
  Scenarisation,
} from '@/types/scenarisation';
import TagField from './TagField';
import ModuleActivitesModal from './ModuleActivitesModal';
import styles from './ScenarisationPanel.module.css';

// Couleurs de chapitre : la même teinte porte le chapitre dans les deux vues
const COULEURS = ['#2d6a5a', '#4a7ba6', '#a6674a', '#7c5fa6', '#b7950b', '#4a9a6a'];
const couleurChapitre = (i: number) => COULEURS[i % COULEURS.length];

type Vue = 'annee' | 'encodage';
type VueAnnee = 'module' | 'chapitre';

export default function ScenarisationPanel() {
  const { scenarisations, isLoading, isSaving, error, modifier, creer, supprimer, vider } =
    useScenarisations();
  const { config } = useDidactique();

  const [courantId, setCourantId] = useState<string | null>(null);
  const [vue, setVue] = useState<Vue>('encodage');
  const [vueAnnee, setVueAnnee] = useState<VueAnnee>('module');
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const [modulesDeplies, setModulesDeplies] = useState<Set<string>>(new Set());
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  // Module dont on ajoute une activité : { chapitreId, moduleId }
  const [cibleActivite, setCibleActivite] = useState<{ ch: string; mod: string } | null>(null);

  const scen = useMemo(
    () => scenarisations.find((s) => s.id === courantId) ?? scenarisations[0] ?? null,
    [scenarisations, courantId]
  );

  const uaaOptions = (config?.uaa ?? []).filter((u) => u.visible).map((u) => ({ id: u.id, label: u.label }));
  const methodeOptions = (config?.methodes ?? [])
    .filter((m) => m.visible)
    .map((m) => ({ id: m.id, label: m.label }));
  const habileteOptions = (config?.habiletes ?? [])
    .filter((h) => h.visible)
    .map((h) => ({ id: h.id, label: habileteLabel(h) }));

  // ─── Mutations ───

  const maj = (patch: Partial<Scenarisation>) => {
    if (scen) modifier({ ...scen, ...patch });
  };

  const majChapitre = (chId: string, patch: Partial<ChapitreDidactique>) => {
    if (!scen) return;
    maj({ chapitres: scen.chapitres.map((c) => (c.id === chId ? { ...c, ...patch } : c)) });
  };

  const majModule = (chId: string, modId: string, patch: Partial<ModuleDidactique>) => {
    if (!scen) return;
    maj({
      chapitres: scen.chapitres.map((c) =>
        c.id === chId
          ? { ...c, modules: c.modules.map((m) => (m.id === modId ? { ...m, ...patch } : m)) }
          : c
      ),
    });
  };

  const ajouterChapitre = () => {
    if (!scen) return;
    const ch = nouveauChapitre();
    maj({ chapitres: [...scen.chapitres, ch] });
    setOuverts((prev) => new Set(prev).add(ch.id));
  };

  const supprimerChapitre = (chId: string) => {
    if (!scen) return;
    if (!confirm('Supprimer ce chapitre et tous ses modules ? Les activités Recto-versIA sont conservées.')) return;
    maj({ chapitres: scen.chapitres.filter((c) => c.id !== chId) });
  };

  const ajouterModule = (chId: string) => {
    if (!scen) return;
    const ch = scen.chapitres.find((c) => c.id === chId);
    const derniere = ch?.modules[ch.modules.length - 1]?.periodeAnnee ?? 'sept-oct';
    const m = nouveauModule(derniere as PeriodeAnnee);
    majChapitre(chId, { modules: [...(ch?.modules ?? []), m] });
    setModulesDeplies((prev) => new Set(prev).add(m.id));
  };

  const supprimerModule = (chId: string, modId: string) => {
    if (!scen) return;
    const ch = scen.chapitres.find((c) => c.id === chId);
    majChapitre(chId, { modules: (ch?.modules ?? []).filter((m) => m.id !== modId) });
  };

  const dupliquerModule = (chId: string, modId: string) => {
    if (!scen) return;
    const ch = scen.chapitres.find((c) => c.id === chId);
    if (!ch) return;
    const i = ch.modules.findIndex((m) => m.id === modId);
    if (i === -1) return;
    const copie: ModuleDidactique = {
      ...JSON.parse(JSON.stringify(ch.modules[i])),
      id: `MOD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      titre: `${ch.modules[i].titre} (copie)`,
    };
    const modules = [...ch.modules];
    modules.splice(i + 1, 0, copie);
    majChapitre(chId, { modules });
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

  const totalPlanifie = PERIODES_ANNEE.reduce((s, p) => s + periodesPlanifiees(scen, p.id), 0);
  const totalCapacite = PERIODES_ANNEE.reduce((s, p) => s + capacitePeriode(scen, p.id), 0);

  return (
    <div className={styles.panel}>
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
          ＋ Nouvelle
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
          {isSaving ? 'Enregistrement…' : error ? <span className={styles.err}>{error}</span> : ''}
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

      {/* ── Bandeau du parcours ── */}
      <div className={styles.parcoursHead}>
        <input
          className={styles.phTitle}
          value={scen.nom}
          onChange={(e) => maj({ nom: e.target.value })}
          placeholder="Nom du cours"
        />
        <div className={styles.phRow}>
          <div className={styles.phObj}>
            <span className={styles.phLabel}>Objectif général du parcours</span>
            <textarea
              className={styles.inlineArea}
              value={scen.objectifGeneral}
              onChange={(e) => maj({ objectifGeneral: e.target.value })}
              placeholder="Ce que l’élève doit être capable de faire au terme du parcours…"
              rows={2}
            />
          </div>
          <div className={styles.phCert}>
            <span className={styles.phLabel}>Certification du parcours</span>
            {scen.certification ? (
              <div className={styles.certEdit}>
                <input
                  className={styles.inlineInput}
                  value={scen.certification.titre}
                  onChange={(e) =>
                    maj({ certification: { ...scen.certification!, titre: e.target.value } })
                  }
                />
                <div className={styles.certMeta}>
                  <select
                    className={styles.inlineSelect}
                    value={scen.certification.periodeAnnee ?? 'mai-juin'}
                    onChange={(e) =>
                      maj({
                        certification: {
                          ...scen.certification!,
                          periodeAnnee: e.target.value as PeriodeAnnee,
                        },
                      })
                    }
                  >
                    {PERIODES_ANNEE.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    className={styles.numInput}
                    value={scen.certification.periodes}
                    onChange={(e) =>
                      maj({
                        certification: {
                          ...scen.certification!,
                          periodes: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                  />
                  <span className={styles.dim}>pér.</span>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => maj({ certification: null })}
                  >
                    retirer
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => maj({ certification: nouvelleCertification() })}
              >
                ＋ prévoir une certification
              </button>
            )}
          </div>
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
                              className={styles.modCard}
                              style={{ borderLeftColor: couleurChapitre(ci) }}
                              onClick={() => {
                                setVue('encodage');
                                setOuverts((prev) => new Set(prev).add(ch.id));
                                setModulesDeplies((prev) => new Set(prev).add(m.id));
                              }}
                              title="Ouvrir dans l’encodage"
                            >
                              <div className={styles.modTitle}>{m.titre || 'Module sans titre'}</div>
                              <div className={styles.modMeta}>
                                <span className={styles.per}>{m.periodes} pér.</span>
                                {m.uaa.map((u) => (
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
                      {scen.chapitres
                        .filter((c) => c.certification?.periodeAnnee === p.id)
                        .map((c) => (
                          <div key={`cert-${c.id}`} className={styles.certCard}>
                            <div className={styles.modTitle}>⭐ {c.certification!.titre}</div>
                            <div className={styles.modMeta}>
                              <span>{c.certification!.periodes} pér.</span>
                              <span className={styles.dim}>{c.titre}</span>
                            </div>
                          </div>
                        ))}
                      {scen.certification?.periodeAnnee === p.id && (
                        <div className={styles.certCard}>
                          <div className={styles.modTitle}>⭐ {scen.certification.titre}</div>
                          <div className={styles.modMeta}>
                            <span>{scen.certification.periodes} pér.</span>
                            <span className={styles.dim}>parcours</span>
                          </div>
                        </div>
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

              {scen.chapitres.map((ch, ci) => (
                <div key={ch.id} className={styles.lane}>
                  <div className={styles.laneName} style={{ borderLeftColor: couleurChapitre(ci) }}>
                    <div className={styles.laneTitle}>{ch.titre || 'Chapitre sans titre'}</div>
                    {ch.objectifGeneral && <div className={styles.laneObj}>{ch.objectifGeneral}</div>}
                    <div className={styles.laneTotal}>
                      {periodesChapitre(ch)} périodes ·{' '}
                      {formatDuree(periodesChapitre(ch), scen.dureePeriodeMin)} · {ch.modules.length}{' '}
                      module{ch.modules.length > 1 ? 's' : ''}
                      {!ch.certification && ' · pas de certification'}
                    </div>
                  </div>
                  {PERIODES_ANNEE.map((p) => {
                    const mods = ch.modules.filter((m) => m.periodeAnnee === p.id);
                    const cert = ch.certification?.periodeAnnee === p.id ? ch.certification : null;
                    return (
                      <div key={p.id} className={styles.laneCell}>
                        {mods.map((m) => (
                          <div
                            key={m.id}
                            className={styles.blk}
                            style={{ background: couleurChapitre(ci) }}
                          >
                            {m.titre || 'Module'}
                            <span className={styles.blkPer}>{m.periodes} pér.</span>
                          </div>
                        ))}
                        {cert && (
                          <div className={`${styles.blk} ${styles.blkCert}`}>
                            ⭐ {cert.titre}
                            <span className={styles.blkPer}>{cert.periodes} pér.</span>
                          </div>
                        )}
                        {mods.length === 0 && !cert && <span className={styles.laneEmpty}>·</span>}
                      </div>
                    );
                  })}
                </div>
              ))}

              {scen.certification && (
                <div className={styles.lane}>
                  <div className={`${styles.laneName} ${styles.laneCertName}`}>
                    <div className={styles.laneTitle}>⭐ {scen.certification.titre}</div>
                    <div className={styles.laneObj}>Évalue l’objectif général du parcours.</div>
                    <div className={styles.laneTotal}>
                      {scen.certification.periodes} périodes ·{' '}
                      {formatDuree(scen.certification.periodes, scen.dureePeriodeMin)}
                    </div>
                  </div>
                  {PERIODES_ANNEE.map((p) => (
                    <div key={p.id} className={styles.laneCell}>
                      {scen.certification!.periodeAnnee === p.id ? (
                        <div className={`${styles.blk} ${styles.blkCert}`}>
                          {scen.certification!.titre}
                          <span className={styles.blkPer}>{scen.certification!.periodes} pér.</span>
                        </div>
                      ) : (
                        <span className={styles.laneEmpty}>·</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

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
                {scen.chapitres.filter((c) => c.certification).length + (scen.certification ? 1 : 0)}
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
              Aucun chapitre. Un chapitre regroupe des modules et vise un objectif général.
            </p>
          )}

          {scen.chapitres.map((ch, ci) => {
            const ouvert = ouverts.has(ch.id);
            return (
              <div key={ch.id} className={styles.chapter}>
                <div className={styles.chHead}>
                  <button
                    type="button"
                    className={styles.chChevron}
                    onClick={() => toggle(ouverts, ch.id, setOuverts)}
                  >
                    {ouvert ? '▾' : '▸'}
                  </button>
                  <span className={styles.chBadge} style={{ background: couleurChapitre(ci) }} />
                  <input
                    className={styles.chTitle}
                    value={ch.titre}
                    onChange={(e) => majChapitre(ch.id, { titre: e.target.value })}
                    placeholder="Titre du chapitre"
                  />
                  <input
                    className={styles.chObj}
                    value={ch.objectifGeneral}
                    onChange={(e) => majChapitre(ch.id, { objectifGeneral: e.target.value })}
                    placeholder="Objectif général du chapitre…"
                  />
                  <span className={styles.chMeta}>
                    <span className={styles.chip}>
                      {periodesChapitre(ch)} pér. · {formatDuree(periodesChapitre(ch), scen.dureePeriodeMin)}
                    </span>
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

                {ouvert && (
                  <div className={styles.chBody}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ width: '19%' }}>Module</th>
                          <th style={{ width: '10%' }}>Période de l’année</th>
                          <th style={{ width: '9%' }}>Périodes</th>
                          <th style={{ width: '15%' }}>Méthode</th>
                          <th style={{ width: '9%' }}>UAA</th>
                          <th style={{ width: '14%' }}>Habiletés</th>
                          <th style={{ width: '12%' }}>Outils</th>
                          <th style={{ width: '12%' }}>Activités</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ch.modules.map((m) => {
                          const deplie = modulesDeplies.has(m.id);
                          return (
                            <Fragment key={m.id}>
                              <tr className={styles.modRow}>
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
                                    <input
                                      className={`${styles.cellInput} ${styles.rowTitleInput}`}
                                      value={m.titre}
                                      onChange={(e) => majModule(ch.id, m.id, { titre: e.target.value })}
                                      placeholder="Titre du module"
                                    />
                                  </span>
                                </td>
                                <td>
                                  <select
                                    className={styles.inlineSelect}
                                    value={m.periodeAnnee}
                                    onChange={(e) =>
                                      majModule(ch.id, m.id, {
                                        periodeAnnee: e.target.value as PeriodeAnnee,
                                      })
                                    }
                                  >
                                    {PERIODES_ANNEE.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    className={`${styles.cellInput} ${styles.numInput}`}
                                    value={m.periodes}
                                    onChange={(e) =>
                                      majModule(ch.id, m.id, {
                                        periodes: Math.max(0, Number(e.target.value) || 0),
                                      })
                                    }
                                  />
                                  <span className={styles.duree}>
                                    {formatDuree(m.periodes, scen.dureePeriodeMin)}
                                  </span>
                                </td>
                                <td>
                                  <TagField
                                    value={m.methodes}
                                    options={methodeOptions}
                                    variant="methode"
                                    footer="Liste gérée dans Administration du site → Gestion didactique"
                                    onChange={(methodes) => majModule(ch.id, m.id, { methodes })}
                                  />
                                </td>
                                <td>
                                  <TagField
                                    value={m.uaa}
                                    options={uaaOptions}
                                    labelCourt={(id) => `UAA ${id}`}
                                    onChange={(uaa) => majModule(ch.id, m.id, { uaa })}
                                  />
                                </td>
                                <td>
                                  <TagField
                                    value={m.habiletes}
                                    options={habileteOptions}
                                    resume={(n) => `${n} habileté${n > 1 ? 's' : ''}`}
                                    onChange={(habiletes) => majModule(ch.id, m.id, { habiletes })}
                                  />
                                </td>
                                <td>
                                  <input
                                    className={styles.cellInput}
                                    value={m.outils}
                                    onChange={(e) => majModule(ch.id, m.id, { outils: e.target.value })}
                                    placeholder="Manuel, projecteur…"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className={styles.actCount}
                                    onClick={() => setCibleActivite({ ch: ch.id, mod: m.id })}
                                  >
                                    {m.activites.length === 0
                                      ? '＋ ajouter'
                                      : `${m.activites.length} activité${m.activites.length > 1 ? 's' : ''}`}
                                  </button>
                                </td>
                              </tr>

                              {deplie && (
                                <tr className={styles.detail}>
                                  <td colSpan={8}>
                                    <div className={styles.detailGrid}>
                                      {(
                                        [
                                          ['concepts', 'Concepts et connaissances'],
                                          ['habiletes', 'Habiletés'],
                                          ['savoirEtre', 'Savoir-être'],
                                        ] as const
                                      ).map(([cle, label]) => (
                                        <div key={cle}>
                                          <span className={styles.detailLabel}>{label}</span>
                                          <textarea
                                            className={styles.detailArea}
                                            value={m.objectifs[cle]}
                                            onChange={(e) =>
                                              majModule(ch.id, m.id, {
                                                objectifs: { ...m.objectifs, [cle]: e.target.value },
                                              })
                                            }
                                          />
                                        </div>
                                      ))}
                                    </div>

                                    <div className={styles.actList}>
                                      <span className={styles.detailLabel}>Activités du module</span>
                                      {m.activites.length === 0 && (
                                        <p className={styles.dim}>Aucune activité pour l’instant.</p>
                                      )}
                                      {m.activites.map((a) => (
                                        <div key={a.id} className={styles.act}>
                                          <span className={styles.actIcon}>{a.devoirId ? '🔗' : '🗣'}</span>
                                          <span className={styles.actName}>{a.titre}</span>
                                          {a.devoirId ? (
                                            <a
                                              className={styles.actLink}
                                              href={`/dashboard/travaux/${a.devoirId}`}
                                            >
                                              ouvrir dans Mes Activités
                                            </a>
                                          ) : (
                                            <span className={styles.dim}>hors application</span>
                                          )}
                                          <button
                                            type="button"
                                            className={styles.iconBtn}
                                            title="Retirer du module"
                                            onClick={() =>
                                              majModule(ch.id, m.id, {
                                                activites: m.activites.filter(
                                                  (x: ModuleActivite) => x.id !== a.id
                                                ),
                                              })
                                            }
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ))}
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
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}

                        {ch.certification && (
                          <tr className={styles.certRow}>
                            <td colSpan={5}>
                              <span className={styles.certTitle}>
                                ⭐
                                <input
                                  className={styles.cellInput}
                                  value={ch.certification.titre}
                                  onChange={(e) =>
                                    majChapitre(ch.id, {
                                      certification: { ...ch.certification!, titre: e.target.value },
                                    })
                                  }
                                />
                              </span>
                              <div className={styles.certMeta}>
                                Évalue l’objectif général du chapitre ·
                                <select
                                  className={styles.inlineSelect}
                                  value={ch.certification.periodeAnnee ?? 'mai-juin'}
                                  onChange={(e) =>
                                    majChapitre(ch.id, {
                                      certification: {
                                        ...ch.certification!,
                                        periodeAnnee: e.target.value as PeriodeAnnee,
                                      },
                                    })
                                  }
                                >
                                  {PERIODES_ANNEE.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className={styles.linkBtn}
                                  onClick={() => majChapitre(ch.id, { certification: null })}
                                >
                                  retirer
                                </button>
                              </div>
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                className={`${styles.cellInput} ${styles.numInput}`}
                                value={ch.certification.periodes}
                                onChange={(e) =>
                                  majChapitre(ch.id, {
                                    certification: {
                                      ...ch.certification!,
                                      periodes: Math.max(0, Number(e.target.value) || 0),
                                    },
                                  })
                                }
                              />
                            </td>
                            <td colSpan={2} className={styles.dim}>
                              {ch.certification.devoirId
                                ? '🔗 activité certificative liée'
                                : 'aucune activité liée'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    <div className={styles.chFoot}>
                      <button type="button" className={styles.btn} onClick={() => ajouterModule(ch.id)}>
                        ＋ Module
                      </button>
                      {!ch.certification && (
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() =>
                            majChapitre(ch.id, {
                              certification: {
                                ...nouvelleCertification(),
                                titre: `Certification — ${ch.titre || 'chapitre'}`,
                              },
                            })
                          }
                        >
                          ⭐ Prévoir une certification
                        </button>
                      )}
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

      {/* ── Popup : ajouter une activité au module ── */}
      {cibleActivite && moduleCible && (
        <ModuleActivitesModal
          module={moduleCible}
          onClose={() => setCibleActivite(null)}
          onAjouter={(activite) => {
            majModule(cibleActivite.ch, cibleActivite.mod, {
              activites: [...moduleCible.activites, activite],
            });
            setCibleActivite(null);
          }}
        />
      )}
    </div>
  );
}
