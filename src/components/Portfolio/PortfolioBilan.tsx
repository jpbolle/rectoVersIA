'use client';

// LE BILAN D'UN PORTFOLIO, en tête de l'onglet Évaluation de la copie (prof —
// JP, 2026-10-11 : « le prof devra à un moment noter l'élève, sa progression
// et son autonomie »). Étapes faites, non faites, renvoyées (au moins un
// refus), le nombre total de refus, les retards ; puis les étapes renvoyées
// avec leur nombre de refus. Lu sur le parcours, le suivi (historique des
// retours) et le groupe — rien de stocké en plus.

import { useEffect, useState } from 'react';
import { enRetard, etatEtape, faite, lireContenuEleve, type ParcoursPortfolio } from '@/lib/portfolio-etat';
import { numeroEtape, type GroupeVue, type SuiviPortfolio } from '@/types/portfolio';
import type { Travail } from '@/types/travail';
import styles from './Portfolio.module.css';

interface Props {
  devoirId: string;
  travail: Travail;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
}

export default function PortfolioBilan({ devoirId, travail, getAuthHeaders }: Props) {
  const [donnees, setDonnees] = useState<{ parcours: ParcoursPortfolio; suivi: SuiviPortfolio | null; groupe: GroupeVue | null; content: string } | null>(null);

  useEffect(() => {
    let annule = false;
    const charger = async () => {
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
        if (annule || !p.success) return;
        const siens = ((g.success ? g.data?.groupes : []) as GroupeVue[]).filter((x) => x.membres.some((m) => m.uid === travail.studentId));
        setDonnees({
          parcours: p.data as ParcoursPortfolio,
          suivi: sv.success ? (sv.data.suivi as SuiviPortfolio) : null,
          groupe: siens.find((x) => x.statut !== 'refuse') ?? siens[0] ?? null,
          content: t.success && typeof t.data?.content === 'string' ? t.data.content : travail.content,
        });
      } catch {
        // Pas de bilan : l'onglet garde le reste
      }
    };
    void charger();
    // Relu au retour sur l'onglet, comme la copie
    const auRetour = () => void charger();
    window.addEventListener('focus', auRetour);
    return () => {
      annule = true;
      window.removeEventListener('focus', auRetour);
    };
  }, [devoirId, travail.id, travail.studentId, travail.content, getAuthHeaders]);

  if (!donnees) return null;
  const { parcours, suivi } = donnees;
  const contenu = { ...lireContenuEleve(donnees.content), groupeStatut: donnees.groupe?.statut ?? null, suivi };
  const etapes = parcours.etapes;
  const lignes = etapes
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !e.introduction)
    .map(({ e, i }) => {
      const historique = suivi?.historique[e.id] ?? [];
      return {
        e,
        numero: numeroEtape(etapes, i),
        faite: faite(e, contenu),
        refus: historique.filter((r) => r.decision === 'refuse').length,
        aReprendre: etatEtape(e, contenu) === 'a-reprendre',
        retard: enRetard(e, contenu),
      };
    });
  const total = lignes.length;
  const faites = lignes.filter((l) => l.faite).length;
  const renvoyees = lignes.filter((l) => l.refus > 0);
  const totalRefus = renvoyees.reduce((n, l) => n + l.refus, 0);
  const retards = lignes.filter((l) => l.retard).length;

  return (
    <div className={styles.bilan}>
      <p className={styles.bilanTitre}>Bilan du portfolio</p>
      <div className={styles.bilanTuiles}>
        <span className={styles.bilanTuile}>
          <b>
            {faites} / {total}
          </b>
          étapes faites
        </span>
        <span className={styles.bilanTuile}>
          <b>{total - faites}</b>
          non faites
        </span>
        <span className={`${styles.bilanTuile} ${renvoyees.length > 0 ? styles.bilanTuileRefus : ''}`}>
          <b>{renvoyees.length}</b>
          renvoyée{renvoyees.length > 1 ? 's' : ''}
        </span>
        <span className={`${styles.bilanTuile} ${totalRefus > 0 ? styles.bilanTuileRefus : ''}`}>
          <b>{totalRefus}</b>
          refus au total
        </span>
        <span className={`${styles.bilanTuile} ${retards > 0 ? styles.bilanTuileRefus : ''}`}>
          <b>{retards}</b>
          en retard
        </span>
      </div>
      {renvoyees.length > 0 && (
        <ul className={styles.bilanListe}>
          {renvoyees.map((l) => (
            <li key={l.e.id}>
              {l.numero ? `${l.numero}. ` : ''}
              {l.e.titre} — <b>{l.refus} refus</b>
              {l.aReprendre ? ' · à reprendre' : l.faite ? ' · validée depuis' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
