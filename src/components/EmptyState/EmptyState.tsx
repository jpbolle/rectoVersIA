import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon: string;
  message: string;
}

// icon accepte un emoji, ou la valeur spéciale "hourglass" qui affiche un
// spinner animé (état de chargement).
export default function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      {icon === 'hourglass' ? (
        <div className={styles.spinner} aria-label="Chargement en cours" />
      ) : (
        <div className={styles.icon}>{icon}</div>
      )}
      <p className={styles.text}>{message}</p>
    </div>
  );
}
