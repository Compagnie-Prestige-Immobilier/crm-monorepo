import type { NamedCount } from '@/lib/types';

export const MAX_CHART_SERIES = 5;

export function groupTail(items: NamedCount[], limit = MAX_CHART_SERIES): NamedCount[] {
  if (items.length <= limit) return items;
  const head = items.slice(0, limit - 1);
  const rest = items.slice(limit - 1).reduce((sum, item) => sum + item.value, 0);
  return [...head, { id: '__autres__', label: 'Autres', value: rest }];
}
