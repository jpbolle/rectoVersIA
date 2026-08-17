'use client';

// Bloc « Certifications » du détail d'une classe.
//
// Les certifications ne sont pas déclarées ici : elles vivent dans la
// scénarisation du cours (Mes Ressources → Design & scénarisation). Ce bloc
// n'est qu'une PORTE D'ENTRÉE vers la saisie des notes, là où le prof pense à
// ses élèves plutôt qu'à son année.
//
// Une classe ne voit que les certifications des parcours qui la désignent
// (`scenarisation.classes`) — sans quoi le bloc reste vide, et le dit.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import CertificationNotesModal from '@/components/CertificationNotesModal/CertificationNotesModal';
import { ceintureParId } from '@/types/ceintures';
import { periodeLabel } from '@/types/scenarisation';
import type { CertificationDeClasse } from '@/types/certification';
import styles from './ClasseCertifications.module.css';

export default function ClasseCertifications({ classeId }: { classeId: string }) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [certifs, setCertifs] = useState<CertificationDeClasse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ouverte, setOuverte] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(
        `/api/certifications/classe?classeId=${encodeURIComponent(classeId)}`,
        { headers }
      );
      const json = await res.json();
      if (json.success) setCertifs(json.data);
    } catch (err) {
      console.error('Erreur chargement certifications de la classe:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAuthHeaders, classeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  if (isLoading) {
    return (
      <section className={styles.section}>
        <h3 className={styles.title}>Certifications</h3>
        <p className={styles.dim}>Chargement…</p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>Certifications</h3>

      {certifs.length === 0 ? (
        <p className={styles.dim}>
          Aucune certification ne vise cette classe. Elles se déclarent dans{' '}
          <a href="/grilles" className={styles.link}>
            Mes Ressources → Design &amp; scénarisation
          </a>{' '}
          — pensez à désigner les classes qui suivent le cours.
        </p>
      ) : (
        <div className={styles.list}>
          {certifs.map((c) => {
            const ceinture = ceintureParId(c.ceinture);
            const complet = c.eleves > 0 && c.notees >= c.eleves;
            return (
              <button
                key={c.moduleId}
                type="button"
                className={styles.card}
                onClick={() => setOuverte(c.moduleId)}
              >
                <span className={styles.cardTop}>
                  <span className={styles.cardTitle}>⭐ {c.titre || 'Certification sans titre'}</span>
                  {ceinture && (
                    <span className={styles.belt}>
                      <span
                        className={styles.beltDot}
                        style={{
                          background: ceinture.couleur,
                          borderColor: ceinture.contour ?? ceinture.couleur,
                        }}
                      />
                      {ceinture.label.toLowerCase()}
                    </span>
                  )}
                </span>
                <span className={styles.cardMeta}>
                  {c.uaa.length > 0 ? c.uaa.map((u) => `UAA ${u}`).join(' · ') : 'aucune UAA'} ·{' '}
                  {c.ponderation} % · {periodeLabel(c.periodeAnnee)} · {c.scenarisationNom}
                </span>
                <span className={`${styles.progress} ${complet ? styles.progressDone : ''}`}>
                  {complet ? '✓ ' : ''}
                  {c.notees}/{c.eleves} élève{c.eleves > 1 ? 's' : ''} noté
                  {c.notees > 1 ? 's' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {ouverte && (
        <CertificationNotesModal
          moduleId={ouverte}
          classeId={classeId}
          onClose={() => setOuverte(null)}
          onEnregistre={charger}
        />
      )}
    </section>
  );
}
