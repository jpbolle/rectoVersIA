import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon: string;
  message: string;
}

export default function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.icon}>{icon}</div>
      <p className={styles.text}>{message}</p>
    </div>
  );
}
