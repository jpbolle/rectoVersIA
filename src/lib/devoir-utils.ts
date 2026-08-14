export function generateDevoirId(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DEV-${year}${month}${day}-${random}`;
}

export function formatDateRemise(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(dateString: string): string {
  // La date de remise est facultative
  if (!dateString) return 'date non fixée';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'date non fixée';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}
