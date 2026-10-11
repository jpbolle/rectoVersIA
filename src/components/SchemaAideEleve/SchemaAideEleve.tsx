'use client';

// Onglet « AIDE IA » de l'élève dans un atelier de conceptualisation (étape 5
// du plan 2026-10-11) : si le prof a ouvert l'aide IA, l'élève compare UNE
// fois son schéma au corrigé. Il voit ce qu'il a trouvé (ses mots) et, pour le
// reste, seulement des NOMBRES — « une aide, pas une réponse » (JP). Le
// serveur ne lui envoie rien d'autre.

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { estArbre, type VueEleveComparaison } from '@/lib/schema-comparaison';
import styles from './SchemaAideEleve.module.css';

interface Props {
  travailId: string | null;
  /** L'activité a un corrigé : sans lui, rien à comparer */
  corrigePrevu: boolean;
  /** Le schéma a au moins une boîte */
  schemaNonVide: boolean;
}

export default function SchemaAideEleve({ travailId, corrigePrevu, schemaNonVide }: Props) {
  const { getAuthHeaders } = useAuth();
  const [vue, setVue] = useState<VueEleveComparaison | null | undefined>(undefined);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!travailId) {
      setVue(null);
      return;
    }
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/ai/schema-comparaison?travailId=${encodeURIComponent(travailId)}`, { headers });
        const json = await res.json();
        if (!annule) setVue(json.success ? (json.data as VueEleveComparaison | null) : null);
      } catch {
        if (!annule) setVue(null);
      }
    })();
    return () => {
      annule = true;
    };
  }, [travailId, getAuthHeaders]);

  const comparer = async () => {
    if (!travailId) return;
    if (!window.confirm('Tu ne peux utiliser cette aide qu’UNE seule fois. Ton schéma est-il assez avancé ?')) return;
    setEnCours(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Session expirée');
      const res = await fetch('/api/ai/schema-comparaison', { method: 'POST', headers, body: JSON.stringify({ travailId }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Comparaison impossible');
      setVue(json.data as VueEleveComparaison);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Comparaison impossible');
    } finally {
      setEnCours(false);
    }
  };

  if (vue === undefined) return <p className={`${styles.panneau} ${styles.note}`}>Chargement…</p>;

  if (!vue) {
    return (
      <div className={styles.panneau}>
        <p>
          L’IA compare ton schéma au corrigé de ton professeur. Elle te dit ce que tu as déjà trouvé, et <strong>combien</strong> d’idées
          ou de liens il te reste à chercher — pas lesquels.
        </p>
        {!corrigePrevu ? (
          <p className={styles.note}>Ton professeur n’a pas encore préparé de corrigé pour cette activité.</p>
        ) : (
          <>
            <p className={styles.attention}>⚠️ Une seule utilisation : fais-le quand ton schéma est bien avancé.</p>
            <button type="button" className={styles.btn} onClick={() => void comparer()} disabled={enCours || !schemaNonVide}>
              <span className={styles.robot} aria-hidden="true">🤖</span>
              {enCours ? 'Comparaison en cours…' : 'Comparer mon schéma au corrigé'}
            </button>
            {!schemaNonVide && <p className={styles.note}>Commence par construire ton schéma.</p>}
          </>
        )}
        {erreur && <p className={styles.erreur}>{erreur}</p>}
      </div>
    );
  }

  const arbre = estArbre(vue.type);
  const motLiens = arbre ? 'rattachement' : vue.type === 'timeline' ? 'place' : 'lien';
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const aRevoir: string[] = [];
  if (vue.nombres.conceptsAbsents) aRevoir.push(`${pluriel(vue.nombres.conceptsAbsents, arbre ? 'idée' : 'concept')} à trouver`);
  if (vue.nombres.conceptsEnTrop) aRevoir.push(`${pluriel(vue.nombres.conceptsEnTrop, arbre ? 'idée' : 'concept')} qui n’${vue.nombres.conceptsEnTrop > 1 ? 'ont' : 'a'} pas sa place`);
  if (vue.nombres.liensFaux) aRevoir.push(`${pluriel(vue.nombres.liensFaux, motLiens)} à revoir`);
  if (vue.nombres.liensAbsents) aRevoir.push(`${pluriel(vue.nombres.liensAbsents, motLiens)} à ajouter`);

  return (
    <div className={styles.panneau}>
      <div className={styles.tableau}>
        <div className={`${styles.colonne} ${styles.colBon}`}>
          <h4 className={styles.titreBon}>✔ Ce que tu as trouvé</h4>
          {vue.trouves.concepts.length === 0 && vue.trouves.liens.length === 0 ? (
            <p className={styles.note}>Rien pour l’instant.</p>
          ) : (
            <>
              {vue.trouves.concepts.length > 0 && (
                <>
                  <p className={styles.sousTitre}>
                    {arbre ? 'Idées' : 'Concepts'} ({vue.trouves.concepts.length} / {vue.totalConceptsCorrige})
                  </p>
                  <ul className={styles.liste}>
                    {vue.trouves.concepts.map((c, i) => (
                      <li key={`c${i}`}>{c}</li>
                    ))}
                  </ul>
                </>
              )}
              {vue.trouves.liens.length > 0 && (
                <>
                  <p className={styles.sousTitre}>
                    {arbre ? 'Rattachements' : vue.type === 'timeline' ? 'Bien placés' : 'Liens'} ({vue.trouves.liens.length} / {vue.totalLiensCorrige})
                  </p>
                  <ul className={styles.liste}>
                    {vue.trouves.liens.map((c, i) => (
                      <li key={`l${i}`}>{c}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
        <div className={`${styles.colonne} ${styles.colMauvais}`}>
          <h4 className={styles.titreMauvais}>✘ Ce qu’il te reste à faire</h4>
          {aRevoir.length === 0 ? (
            <p className={styles.note}>Rien : ton schéma correspond au corrigé. Bravo !</p>
          ) : (
            <ul className={styles.liste}>
              {aRevoir.map((t) => (
                <li key={t} className={styles.nombre}>
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className={styles.note}>
        Comparaison faite le {new Date(vue.demandeLe).toLocaleDateString('fr-BE')} — sur ton schéma de ce moment-là. L’IA peut se tromper :
        c’est ton professeur qui corrige.
      </p>
    </div>
  );
}
