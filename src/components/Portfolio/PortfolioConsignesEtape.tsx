'use client';

// L'onglet CONSIGNES d'un portfolio, colonne de droite (JP, 2026-10-11 : « la
// page doit s'ouvrir en activant l'onglet Consignes ; c'est dans celui-ci que
// tu dois glisser toujours les consignes particulières à la section ainsi que
// les objectifs »). Il suit l'étape ouverte à gauche :
//  - une étape : ses OBJECTIFS, puis sa CONSIGNE en liste de tâches que l'élève
//    coche (compteur « 2 / 5 ») ;
//  - l'introduction : la tâche finale et les consignes générales du portfolio
//    (ses objectifs et ses informations restent sur la page, à gauche).
// Le sommaire du portfolio a son propre onglet.
//
// ⚠ Rendu DANS `.content` de l'AssistancePanel, à `padding: 0` : il pose son
// propre retrait (classe `.sommaire`, gotcha du projet).

import type { PortfolioEleve } from '@/hooks/usePortfolioEleve';
import { decouperConsignes } from '@/lib/consignes-etapes';
import { cleTache } from '@/types/portfolio';
import styles from './Portfolio.module.css';

interface Props {
  eleve: PortfolioEleve;
  lectureSeule?: boolean;
}

export default function PortfolioConsignesEtape({ eleve, lectureSeule = false }: Props) {
  const { parcours, etape, contenu, cocherTache } = eleve;
  if (!parcours) return <p className={styles.sommaireVide}>Chargement…</p>;
  if (!etape) return <p className={styles.sommaireVide}>Aucune étape pour l’instant.</p>;

  // L'introduction : ce qui vaut pour tout le portfolio
  if (etape.introduction) {
    const generales = decouperConsignes(parcours.consignes);
    return (
      <div className={styles.sommaire}>
        {parcours.tacheFinale && (
          <div className={styles.sommaireTache}>
            <b>Tâche finale</b> — {parcours.tacheFinale}
          </div>
        )}
        {generales.length > 0 ? (
          <div className={styles.sommaireConsignes}>
            {generales.map((c) => (
              <p key={c.cle} className={c.genre === 'titre' ? styles.sommaireConsigneTitre : ''}>
                {c.texte}
              </p>
            ))}
          </div>
        ) : (
          !parcours.tacheFinale && <p className={styles.sommaireVide}>Lis l’introduction, puis passe à la première étape.</p>
        )}
      </div>
    );
  }

  const objectifs = etape.objectifs ?? [];
  const lignes = decouperConsignes(etape.consigne);
  const faites = new Set(contenu.taches ?? []);
  const nbTaches = lignes.filter((l) => l.genre === 'etape').length;
  const nbFaites = lignes.filter((l) => l.genre === 'etape' && faites.has(cleTache(etape.id, l.cle))).length;

  return (
    <div className={styles.sommaire}>
      <p className={styles.consignesEtapeTitre}>
        {etape.section ? <span>{etape.section}</span> : null}
        {etape.titre}
      </p>

      {objectifs.length > 0 && (
        <>
          <h4 className={styles.h4}>Objectifs</h4>
          <ul className={styles.objectifs}>
            {objectifs.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </>
      )}

      {lignes.length > 0 && (
        <>
          <h4 className={styles.h4}>
            Consigne
            {nbTaches > 0 && (
              <span className={`${styles.tachesCompteur} ${nbFaites === nbTaches ? styles.tachesCompteurOk : ''}`}>
                {nbFaites} / {nbTaches}
              </span>
            )}
          </h4>
          {/* Une ligne = une tâche à cocher ; une ligne finissant par « : » = un titre */}
          <ul className={`${styles.consigne} ${styles.taches}`}>
            {lignes.map((l, i) =>
              l.genre === 'titre' ? (
                <li key={`t${i}`} className={styles.tacheTitre}>{l.texte}</li>
              ) : (
                <li key={l.cle} className={faites.has(cleTache(etape.id, l.cle)) ? styles.tacheFaite : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={faites.has(cleTache(etape.id, l.cle))}
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

      {objectifs.length === 0 && lignes.length === 0 && (
        <p className={styles.sommaireVide}>Pas de consigne particulière pour cette étape.</p>
      )}
    </div>
  );
}
