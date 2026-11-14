import { ResourceType } from '../domain/index.ts';

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function formatDate(isoString: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getResourceTypeLabel(type: ResourceType): string {
  switch (type) {
    case ResourceType.BOOK:
      return 'Book';
    case ResourceType.JOURNAL:
      return 'Journal';
    case ResourceType.MAGAZINE:
      return 'Magazine';
    case ResourceType.DIGITAL:
      return 'Digital Resource';
    default:
      return type;
  }
}

export function getOverdueDays(
  dueDateIso: string | null,
  referenceDateIso?: string
): number {
  if (!dueDateIso) return 0;
  const due = new Date(dueDateIso).getTime();
  const ref = referenceDateIso ? new Date(referenceDateIso).getTime() : Date.now();
  const diff = ref - due;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
