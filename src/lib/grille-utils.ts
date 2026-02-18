export function generateGrilleId(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `GRL-${year}${month}${day}-${random}`;
}

export function generateCriterionId(): string {
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `crit-${random}`;
}
