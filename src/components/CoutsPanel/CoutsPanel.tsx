'use client';

// GESTION DES COÛTS IA (administration, plan 2026-10-15-gestion-couts-ia) :
// en tête, ce qui demande d'agir (coupures en cours, alertes non lues) ; puis
// la dépense du jour / 7 jours / mois, le rapprochement avec la console
// Anthropic, la dépense PAR ACTIVITÉ (dépliable : par élève), par fonction,
// par modèle, et les erreurs qui reviennent — « 232 × la même erreur » doit
// sauter aux yeux en une ligne.

import { Fragment, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { CompteCouts, CoutActivite, RapportCouts } from '@/types/couts-ia';
import styles from './CoutsPanel.module.css';

// Libellés des fonctions tracées (`suivreIa('…')` dans les routes)
const LIBELLES: Record<string, string> = {
  'vocabulaire.etude': 'Vocabulaire — étude',
  'vocabulaire.diagnostic': 'Vocabulaire — diagnostic',
  'vocabulaire.evaluation': 'Vocabulaire — évaluation',
  'vocabulaire.composition': 'Vocabulaire — notation de la composition',
  'vocabulaire.synonymes': 'Vocabulaire — synonymes et antonymes',
  'vocabulaire.defi-production': 'Vocabulaire — défi de production',
  'vocabulaire.suggestion': 'Vocabulaire — mots suggérés (prof)',
  'vocabulaire.enrichissement': 'Vocabulaire — fiches enrichies (prof)',
  'grille.evaluation': 'Évaluation IA par grille',
  'schema.comparaison': 'Schéma — comparaison au corrigé',
  'dictionnaire.proxemie': 'Dictionnaire — mots proches',
  'fle.traduction': 'FLE — traduction d’un mot',
  'fle.verifier-phrase': 'FLE — phrase avec le vocabulaire',
  'lecture-cours.transcription-pdf': 'Lecture de cours — transcription PDF',
  'lecture-cours.correction': 'Lecture de cours — correction de la réponse',
  'lecture-cours.avis-resume': 'Lecture de cours — avis sur le résumé',
  'navigkid.aide': 'NavigKid — aide à la recherche',
  'navigkid.questions': 'NavigKid — questions générées (prof)',
};

function libelle(fonction: string): string {
  if (LIBELLES[fonction]) return LIBELLES[fonction];
  if (fonction.startsWith('aide-ecriture.')) return `Aide à l’écriture — ${fonction.slice(14)}`;
  if (fonction.startsWith('lecture-cours.')) return `Lecture de cours — section ${fonction.slice(14)}`;
  return fonction;
}

function dollars(v: number): string {
  const decimales = v > 0 && v < 0.1 ? 4 : 2;
  return `${v.toLocaleString('fr-BE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} $`;
}

function taux(c: CompteCouts): number {
  return c.appels ? c.echecs / c.appels : 0;
}

function pourcent(v: number): string {
  return `${Math.round(v * 100)} %`;
}

function dateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function nomMois(mois: string): string {
  const [a, m] = mois.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' });
}

function decalerMois(mois: string, n: number): string {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Le taux d'échec : signalé par un libellé et une icône, pas par la couleur seule */
function Echecs({ c, seuil }: { c: CompteCouts; seuil: number }) {
  if (!c.echecs) return <span className={styles.muet}>0</span>;
  const t = taux(c);
  const alerte = c.appels >= 5 && t >= seuil;
  return (
    <span className={alerte ? styles.echecFort : undefined}>
      {alerte && <AlertTriangle size={13} aria-hidden />}
      {c.echecs} ({pourcent(t)})
    </span>
  );
}

function Tuile({ titre, c, seuil }: { titre: string; c: CompteCouts; seuil: number }) {
  return (
    <div className={styles.tuile}>
      <span className={styles.tuileTitre}>{titre}</span>
      <span className={styles.tuileValeur}>{dollars(c.cout)}</span>
      <span className={styles.tuileDetail}>
        {c.appels} appel{c.appels > 1 ? 's' : ''} · échecs <Echecs c={c} seuil={seuil} />
      </span>
      {c.coutEchecs > 0 && <span className={styles.tuileDetail}>dont {dollars(c.coutEchecs)} facturés pour rien</span>}
    </div>
  );
}

export default function CoutsPanel() {
  const { getAuthHeaders } = useAuth();
  const [mois, setMois] = useState<string | null>(null);
  const [rapport, setRapport] = useState<RapportCouts | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  const charger = useCallback(
    async (m: string | null) => {
      setChargement(true);
      setErreur(null);
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/admin/couts${m ? `?mois=${m}` : ''}`, { headers });
        const json = await res.json();
        if (json.success) setRapport(json.data as RapportCouts);
        else setErreur(json.message || 'Impossible de charger les coûts.');
      } catch {
        setErreur('Impossible de charger les coûts.');
      } finally {
        setChargement(false);
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    charger(mois);
  }, [charger, mois]);

  const agir = async (corps: Record<string, string>, cle: string) => {
    setAction(cle);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/admin/couts', { method: 'POST', headers, body: JSON.stringify(corps) });
      const json = await res.json();
      if (!json.success) setErreur(json.message || 'Action impossible.');
      await charger(mois);
    } catch {
      setErreur('Action impossible.');
    } finally {
      setAction(null);
    }
  };

  if (!rapport) {
    return (
      <div className={styles.panneau}>
        <p className={styles.vide}>{erreur ?? 'Calcul des coûts…'}</p>
      </div>
    );
  }

  const r = rapport;
  const seuil = r.seuils.tauxEchecAlerte;
  const alertesNonLues = r.alertes.filter((a) => !a.vue);
  const maxJour = Math.max(...r.parJour.map((j) => j.cout), 0.0001);
  const moisCourant = r.mois === r.aujourdhui.slice(0, 7);
  // Console et application comparées sur la MÊME période : à partir du jour
  // où le suivi a commencé, s'il tombe dans le mois affiché
  const debutSuivi = r.depuis ? new Date(r.depuis).toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' }) : null;
  const comparaison = r.console.parJour
    ? debutSuivi && debutSuivi.startsWith(r.mois)
      ? {
          libelle: `Depuis le début du suivi (${new Date(r.depuis!).toLocaleDateString('fr-BE')})`,
          console: r.console.parJour.filter((j) => j.jour >= debutSuivi).reduce((t, j) => t + j.cout, 0),
        }
      : debutSuivi && debutSuivi < r.mois
        ? { libelle: 'Sur le mois', console: r.console.total ?? 0 }
        : null
    : null;

  return (
    <div className={styles.panneau}>
      {/* ── Ce qui demande d'agir ── */}
      {r.suspensions.length > 0 && (
        <section className={`${styles.bandeau} ${styles.bandeauCoupure}`}>
          <h2>
            <AlertTriangle size={18} aria-hidden /> IA coupée pour {r.suspensions.length} activité
            {r.suspensions.length > 1 ? 's' : ''}
          </h2>
          {r.suspensions.map((s) => (
            <div key={s.devoirId} className={styles.bandeauLigne}>
              <div>
                <strong>{s.titre}</strong> — {s.raison} <span className={styles.muet}>({dateHeure(s.at)})</span>
                {s.rapport.length > 0 && (
                  <ul className={styles.rapport}>
                    {s.rapport.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                className={styles.boutonVert}
                disabled={action !== null}
                onClick={() => agir({ action: 'reactiver', devoirId: s.devoirId }, `reactiver-${s.devoirId}`)}
              >
                {action === `reactiver-${s.devoirId}` ? 'Réactivation…' : 'Réactiver l’IA'}
              </button>
            </div>
          ))}
        </section>
      )}

      {alertesNonLues.length > 0 && (
        <section className={styles.bandeau}>
          <div className={styles.bandeauTete}>
            <h2>
              <AlertTriangle size={18} aria-hidden /> {alertesNonLues.length} alerte{alertesNonLues.length > 1 ? 's' : ''}{' '}
              non lue{alertesNonLues.length > 1 ? 's' : ''}
            </h2>
            <button
              type="button"
              className={styles.boutonDiscret}
              disabled={action !== null}
              onClick={() => agir({ action: 'toutesVues' }, 'toutesVues')}
            >
              Tout marquer comme lu
            </button>
          </div>
          {alertesNonLues.map((a) => (
            <div key={a.id} className={styles.bandeauLigne}>
              <div>
                <span className={styles.muet}>{dateHeure(a.at)}</span> — {a.message}
                {a.titreActivite && <> Activité : <strong>{a.titreActivite}</strong>.</>}
                {a.rapport.length > 0 && (
                  <ul className={styles.rapport}>
                    {a.rapport.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                className={styles.boutonDiscret}
                disabled={action !== null}
                onClick={() => agir({ action: 'vue', id: a.id }, `vue-${a.id}`)}
              >
                Lu
              </button>
            </div>
          ))}
        </section>
      )}

      {/* ── Le mois ── */}
      <div className={styles.barreMois}>
        <button type="button" className={styles.boutonDiscret} onClick={() => setMois(decalerMois(r.mois, -1))}>
          ‹
        </button>
        <h2 className={styles.titreMois}>{nomMois(r.mois)}</h2>
        <button
          type="button"
          className={styles.boutonDiscret}
          disabled={moisCourant}
          onClick={() => setMois(decalerMois(r.mois, 1))}
        >
          ›
        </button>
        <button
          type="button"
          className={styles.boutonDiscret}
          onClick={() => charger(mois)}
          disabled={chargement}
          title="Recalculer"
        >
          <RefreshCw size={14} aria-hidden /> {chargement ? 'Calcul…' : 'Actualiser'}
        </button>
        {erreur && <span className={styles.erreur}>{erreur}</span>}
      </div>
      <p className={styles.intro}>
        {r.depuis
          ? `Chaque appel à Claude est compté depuis le ${new Date(r.depuis).toLocaleDateString('fr-BE')}. `
          : 'Aucun appel compté pour l’instant : le suivi commence au premier appel à Claude. '}
        Montants en dollars, calculés par l’application d’après les tarifs officiels. La transcription audio
        (Whisper) n’est pas comptée.
      </p>

      <div className={styles.tuiles}>
        {moisCourant && <Tuile titre="Aujourd’hui" c={r.totaux.jour} seuil={seuil} />}
        {moisCourant && <Tuile titre="7 derniers jours" c={r.totaux.septJours} seuil={seuil} />}
        <Tuile titre={moisCourant ? 'Ce mois-ci' : nomMois(r.mois)} c={r.totaux.mois} seuil={seuil} />
      </div>

      {/* ── Rapprochement avec la console Anthropic ── */}
      <section className={styles.carte}>
        <div className={styles.carteTete}>
          <h3>Console Anthropic</h3>
          <span>ce qui est réellement facturé</span>
        </div>
        <div className={styles.carteCorps}>
          {!r.console.configure ? (
            <p className={styles.texte}>
              Non relié : il faut une <strong>clé Admin</strong> de l’organisation Anthropic (variable{' '}
              <code>ANTHROPIC_ADMIN_KEY</code>). Sans elle, seuls les montants calculés par l’application
              s’affichent.
            </p>
          ) : r.console.erreur ? (
            <p className={styles.erreur}>Console injoignable : {r.console.erreur}</p>
          ) : (
            <>
              <p className={styles.texte}>
                Dépensé en {nomMois(r.mois)}, toute l’organisation : <strong>{dollars(r.console.total ?? 0)}</strong>
              </p>
              {comparaison && (
                <p className={styles.texte}>
                  {comparaison.libelle} : console <strong>{dollars(comparaison.console)}</strong> · application{' '}
                  <strong>{dollars(r.totaux.mois.cout)}</strong> · écart{' '}
                  <strong>{dollars(comparaison.console - r.totaux.mois.cout)}</strong>
                </p>
              )}
              <p className={styles.muet}>
                C’est ce qui a été <strong>dépensé</strong>, pas ce qu’il reste. La console couvre toute
                l’organisation (d’autres applications sur le même compte s’y ajoutent) et compte par jours
                entiers (UTC) : le jour où le suivi a commencé, elle compte aussi les appels d’avant. Un écart
                qui grandit, jour après jour, sans autre application = un appel qui échappe au suivi.
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── Par activité ── */}
      <section className={styles.carte}>
        <div className={styles.carteTete}>
          <h3>Par activité</h3>
          <span>clic sur une ligne : le détail par élève</span>
        </div>
        {r.parActivite.length === 0 ? (
          <p className={styles.vide}>Aucun appel ce mois-ci.</p>
        ) : (
          <div className={styles.defile}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Activité</th>
                  <th className={styles.nombre}>Coût</th>
                  <th className={styles.nombre}>Appels</th>
                  <th className={styles.nombre}>Échecs</th>
                  <th className={styles.nombre}>Élèves</th>
                  <th className={styles.nombre}>Par élève</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.parActivite.map((a) => (
                  <LigneActivite
                    key={a.devoirId ?? '__hors'}
                    a={a}
                    seuil={seuil}
                    ouverte={ouverte === (a.devoirId ?? '__hors')}
                    basculer={() => setOuverte((o) => (o === (a.devoirId ?? '__hors') ? null : a.devoirId ?? '__hors'))}
                    action={action}
                    agir={agir}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Erreurs fréquentes ── */}
      {r.erreurs.length > 0 && (
        <section className={styles.carte}>
          <div className={styles.carteTete}>
            <h3>Erreurs qui reviennent</h3>
            <span>regroupées par message (les nombres sont masqués)</span>
          </div>
          <ul className={styles.erreurs}>
            {r.erreurs.map((e) => (
              <li key={`${e.cle}|${e.fonction}`}>
                <strong>{e.nombre} ×</strong> <span title={e.exemple}>{e.cle}</span>
                <span className={styles.muet}>
                  {' '}
                  — {libelle(e.fonction)} · dernière le {dateHeure(e.dernier)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Par jour ── */}
      <section className={styles.carte}>
        <div className={styles.carteTete}>
          <h3>Par jour</h3>
        </div>
        {r.parJour.length === 0 ? (
          <p className={styles.vide}>Aucun appel ce mois-ci.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Jour</th>
                <th className={styles.colBarre}>Coût</th>
                <th className={styles.nombre}>Appels</th>
                <th className={styles.nombre}>Échecs</th>
              </tr>
            </thead>
            <tbody>
              {r.parJour.map((j) => (
                <tr key={j.jour}>
                  <td>{new Date(`${j.jour}T12:00:00`).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td className={styles.colBarre}>
                    <span className={styles.barreFond} title={dollars(j.cout)}>
                      <span className={styles.barre} style={{ width: `${Math.max(2, (j.cout / maxJour) * 100)}%` }} />
                    </span>
                    <span className={styles.barreValeur}>{dollars(j.cout)}</span>
                  </td>
                  <td className={styles.nombre}>{j.appels}</td>
                  <td className={styles.nombre}>
                    <Echecs c={j} seuil={seuil} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Par fonction et par modèle ── */}
      <div className={styles.deuxColonnes}>
        <section className={styles.carte}>
          <div className={styles.carteTete}>
            <h3>Par fonction</h3>
          </div>
          {r.parFonction.length === 0 && <p className={styles.vide}>Aucun appel ce mois-ci.</p>}
          <table className={styles.table}>
            <tbody>
              {r.parFonction.map((f) => (
                <tr key={f.fonction}>
                  <td>{libelle(f.fonction)}</td>
                  <td className={styles.nombre}>{dollars(f.cout)}</td>
                  <td className={styles.nombre}>{f.appels}</td>
                  <td className={styles.nombre}>
                    <Echecs c={f} seuil={seuil} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className={styles.carte}>
          <div className={styles.carteTete}>
            <h3>Par modèle</h3>
          </div>
          {r.parModele.length === 0 && <p className={styles.vide}>Aucun appel ce mois-ci.</p>}
          <table className={styles.table}>
            <tbody>
              {r.parModele.map((m) => (
                <tr key={m.modele}>
                  <td>{m.modele}</td>
                  <td className={styles.nombre}>{dollars(m.cout)}</td>
                  <td className={styles.nombre}>{m.appels}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <p className={styles.muet}>
        Seuils : alerte au-delà de {r.seuils.coutJour} $ par jour, de {r.seuils.coutActiviteJour} $ par activité et
        par jour, de {r.seuils.appelsEleveJour} appels par élève et par jour, et à {pourcent(r.seuils.tauxEchecAlerte)}{' '}
        d’échecs sur une heure (dès {r.seuils.appelsMinimum} appels) ; l’IA de l’activité est coupée à{' '}
        {pourcent(r.seuils.tauxEchecCoupure)}. Les traces de plus de 12 mois sont effacées.
      </p>
    </div>
  );
}

function LigneActivite({
  a,
  seuil,
  ouverte,
  basculer,
  action,
  agir,
}: {
  a: CoutActivite;
  seuil: number;
  ouverte: boolean;
  basculer: () => void;
  action: string | null;
  agir: (corps: Record<string, string>, cle: string) => void;
}) {
  return (
    <Fragment>
      <tr className={styles.ligneCliquable} onClick={basculer}>
        <td>
          <span className={styles.titreActivite}>
            {ouverte ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            {a.titre}
            {a.suspendue && <span className={styles.pastilleCoupee}>IA coupée</span>}
          </span>
          {(a.prof || a.classes) && (
            <span className={styles.sousTitre}>{[a.prof, a.classes].filter(Boolean).join(' · ')}</span>
          )}
        </td>
        <td className={styles.nombre}>{dollars(a.cout)}</td>
        <td className={styles.nombre}>{a.appels}</td>
        <td className={styles.nombre}>
          <Echecs c={a} seuil={seuil} />
        </td>
        <td className={styles.nombre}>{a.eleves || '—'}</td>
        <td className={styles.nombre}>{a.eleves ? dollars(a.coutParEleve) : '—'}</td>
        <td className={styles.nombre}>
          {a.devoirId && (
            <button
              type="button"
              className={a.suspendue ? styles.boutonVert : styles.boutonDiscret}
              disabled={action !== null}
              onClick={(e) => {
                e.stopPropagation();
                agir({ action: a.suspendue ? 'reactiver' : 'couper', devoirId: a.devoirId! }, `ligne-${a.devoirId}`);
              }}
            >
              {a.suspendue ? 'Réactiver' : 'Couper l’IA'}
            </button>
          )}
        </td>
      </tr>
      {ouverte && (
        <tr className={styles.detail}>
          <td colSpan={7}>
            <p className={styles.muet}>Fonctions : {a.fonctions.map(libelle).join(' · ')}</p>
            {a.detailEleves.length === 0 ? (
              <p className={styles.muet}>Aucun appel d’élève (prof seulement).</p>
            ) : (
              <table className={styles.table}>
                <tbody>
                  {a.detailEleves.map((e) => (
                    <tr key={e.uid}>
                      <td>{e.nom}</td>
                      <td className={styles.nombre}>{dollars(e.cout)}</td>
                      <td className={styles.nombre}>
                        {e.appels} appel{e.appels > 1 ? 's' : ''}
                      </td>
                      <td className={styles.nombre}>
                        <Echecs c={e} seuil={seuil} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
