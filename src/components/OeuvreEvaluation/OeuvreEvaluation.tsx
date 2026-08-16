'use client';

// Onglet « Évaluation » d'une lecture d'œuvre, côté élève.
//
// AUCUNE NOTE, et c'est le sujet même de l'écran : cet atelier est formatif.
// On y montre trois choses, dans cet ordre — ce qu'il a fait, ce qu'il a lu,
// et comment il s'en tire. Le « degré de réussite » n'est pas un score à
// encoder : c'est un retour, dit comme tel à l'écran.
//
// Il se recharge à chaque ouverture de l'onglet : l'élève vient d'y répondre,
// il veut voir le compteur bouger.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import EmptyState from '@/components/EmptyState/EmptyState';
import styles from './OeuvreEvaluation.module.css';

interface BilanFormulaire {
  sectionId: string;
  titre: string;
  groupe?: string;
  justes: number;
  total: number;
  ouvertes: number;
  termine: boolean;
}

interface Bilan {
  formulairesFaits: number;
  formulairesTotal: number;
  minimum: number;
  extraitsLus: number;
  extraitsTotal: number;
  jours: number;
  formulaires: BilanFormulaire[];
  moyenne: number | null;
}

interface Props {
  devoirId: string;
  /** Change à chaque vérification terminée : force le rechargement */
  version?: number;
}

function couleur(pct: number): string {
  return pct < 40 ? 'var(--c-danger)' : pct < 65 ? 'var(--c-accent)' : 'var(--c-success)';
}

export default function OeuvreEvaluation({ devoirId, version = 0 }: Props) {
  const { getAuthHeaders } = useAuth();
  const headersRef = useRef(getAuthHeaders);
  headersRef.current = getAuthHeaders;

  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const h = await headersRef.current();
        const res = await fetch(`/api/oeuvres/bilan?devoirId=${devoirId}`, {
          headers: h || undefined,
        });
        const json = await res.json();
        if (annule) return;
        if (!json.success) throw new Error(json.message || 'Bilan indisponible');
        setBilan(json.data);
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [devoirId, version]);

  if (chargement) return <EmptyState icon="hourglass" message="Chargement de ton bilan" />;
  if (erreur) return <EmptyState icon="⚠️" message={erreur} />;
  if (!bilan) return null;

  // Le dénominateur des formulaires : ce que le prof demande s'il l'a fixé,
  // sinon tout ce qui existe.
  const objectif = bilan.minimum || bilan.formulairesTotal;
  const pctFormulaires = objectif
    ? Math.min(100, Math.round((bilan.formulairesFaits / objectif) * 100))
    : 0;
  const pctExtraits = bilan.extraitsTotal
    ? Math.round((bilan.extraitsLus / bilan.extraitsTotal) * 100)
    : 0;

  return (
    <div className={styles.bilan}>
      <p className={styles.avertissement}>
        Rien n’est noté ici. Ces chiffres sont pour <strong>toi</strong> : ils disent où tu en es
        dans ta lecture, pas ce que tu vaux.
      </p>

      {/* ── Trois compteurs ── */}
      <div className={styles.compteurs}>
        <div className={styles.compteur}>
          <span className={styles.chiffre}>
            {bilan.formulairesFaits}
            <span className={styles.chiffreSur}>/{objectif}</span>
          </span>
          <span className={styles.label}>
            Vérifications complétées
            {bilan.minimum > 0 && <span className={styles.sous}>demandées par ton professeur</span>}
          </span>
          <div className={styles.barre}>
            <i style={{ width: `${pctFormulaires}%`, background: 'var(--c-primary)' }} />
          </div>
        </div>

        <div className={styles.compteur}>
          <span className={styles.chiffre}>
            {bilan.extraitsLus}
            <span className={styles.chiffreSur}>/{bilan.extraitsTotal}</span>
          </span>
          <span className={styles.label}>
            Extraits ouverts
            <span className={styles.sous}>
              {bilan.jours > 0
                ? `sur ${bilan.jours} jour${bilan.jours > 1 ? 's' : ''} de lecture`
                : 'aucune séance encore'}
            </span>
          </span>
          <div className={styles.barre}>
            <i style={{ width: `${pctExtraits}%`, background: 'var(--c-accent)' }} />
          </div>
        </div>

        <div className={styles.compteur}>
          <span
            className={styles.chiffre}
            style={bilan.moyenne !== null ? { color: couleur(bilan.moyenne) } : undefined}
          >
            {bilan.moyenne !== null ? `${bilan.moyenne}%` : '—'}
          </span>
          <span className={styles.label}>
            Réussite moyenne
            <span className={styles.sous}>sur tes questions à choix</span>
          </span>
          {bilan.moyenne !== null && (
            <div className={styles.barre}>
              <i style={{ width: `${bilan.moyenne}%`, background: couleur(bilan.moyenne) }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Le détail, formulaire par formulaire ── */}
      {bilan.formulaires.length === 0 ? (
        <EmptyState
          icon="📖"
          message="Tu n’as pas encore fait de vérification. Ouvre une scène et réponds à ses questions : c’est ce qui compte dans ton total."
        />
      ) : (
        <section className={styles.detail}>
          <h4 className={styles.detailTitre}>
            Vérification par vérification
            <span className={styles.detailAide}>dans l’ordre du livre</span>
          </h4>

          <div className={styles.liste}>
            {bilan.formulaires.map((f) => {
              const pct = f.total ? Math.round((f.justes / f.total) * 100) : null;
              return (
                <div key={f.sectionId} className={styles.ligne}>
                  <div className={styles.ligneTexte}>
                    <span className={styles.ligneTitre}>{f.titre}</span>
                    <span className={styles.ligneSous}>
                      {f.groupe ? `${f.groupe} · ` : ''}
                      {f.termine ? 'complétée' : 'commencée'}
                      {f.ouvertes > 0 &&
                        ` · ${f.ouvertes} réponse${f.ouvertes > 1 ? 's' : ''} écrite${f.ouvertes > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {pct === null ? (
                    // Une vérification sans QCM ne se mesure pas : le dire vaut
                    // mieux qu'afficher un 0 % qui n'a aucun sens.
                    <span className={styles.sansMesure}>pas de question à choix</span>
                  ) : (
                    <>
                      <div className={styles.ligneBarre}>
                        <i style={{ width: `${pct}%`, background: couleur(pct) }} />
                      </div>
                      <span className={styles.lignePct} style={{ color: couleur(pct) }}>
                        {pct}%
                        <span className={styles.ligneFraction}>
                          {f.justes}/{f.total}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
