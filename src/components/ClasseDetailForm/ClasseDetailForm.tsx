'use client';

import { useEffect } from 'react';
import { useEleves } from '@/hooks/useClasses';
import type { Classe, Eleve } from '@/types/classe';
import styles from './ClasseDetailForm.module.css';

interface ClasseDetailFormProps {
  classe: Classe;
  isVisible: boolean;
  refreshKey?: number;
  onClose: () => void;
  onAddEleve: (classeId: string) => void;
  onEditEleve: (eleve: Eleve) => void;
  onDeleteEleve: (eleve: Eleve) => void;
}

export default function ClasseDetailForm({
  classe,
  isVisible,
  refreshKey,
  onClose,
  onAddEleve,
  onEditEleve,
  onDeleteEleve,
}: ClasseDetailFormProps) {
  const { eleves, isLoading, refetch } = useEleves(isVisible ? classe.id : undefined);

  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  return (
    <div className={`${styles.form} ${isVisible ? styles.formVisible : ''}`}>
      <div className={styles.formHeader}>
        <div className={styles.titleSection}>
          <h2 className={styles.formTitle}>{classe.nom}</h2>
          {classe.description && (
            <p className={styles.description}>{classe.description}</p>
          )}
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          title="Fermer"
        >
          &times;
        </button>
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statIcon}>👥</span>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{eleves.length}</span>
            <span className={styles.statLabel}>élève{eleves.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statIcon}>📅</span>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{classe.anneeScolaire}</span>
            <span className={styles.statLabel}>Année scolaire</span>
          </div>
        </div>
      </div>

      <div className={styles.elevesSection}>
        <div className={styles.elevesSectionHeader}>
          <h3 className={styles.sectionTitle}>Liste des élèves</h3>
          <button
            className={styles.addEleveBtn}
            onClick={() => onAddEleve(classe.id)}
          >
            + Ajouter un élève
          </button>
        </div>

        {isLoading ? (
          <div className={styles.loading}>Chargement des élèves...</div>
        ) : eleves.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyIcon}>👤</p>
            <p className={styles.emptyText}>Aucun élève dans cette classe</p>
            <button
              className={styles.emptyBtn}
              onClick={() => onAddEleve(classe.id)}
            >
              Ajouter le premier élève
            </button>
          </div>
        ) : (
          <div className={styles.elevesList}>
            {eleves.map((eleve) => (
              <div key={eleve.id} className={styles.eleveCard}>
                <div className={styles.eleveInfo}>
                  <span className={styles.eleveAvatar}>
                    {eleve.nom.charAt(0)}{eleve.prenom.charAt(0)}
                  </span>
                  <div className={styles.eleveDetails}>
                    <span className={styles.eleveName}>
                      {eleve.nom} {eleve.prenom}
                    </span>
                    <span className={styles.eleveEmail}>{eleve.email}</span>
                  </div>
                </div>
                <div className={styles.eleveActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onEditEleve(eleve)}
                    title="Modifier"
                  >
                    ✏️
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => onDeleteEleve(eleve)}
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
