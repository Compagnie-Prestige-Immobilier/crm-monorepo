import { Badge } from '@/components/ui/badge';
import type { Projet } from '@/lib/types';

export function ProjetBadge({ projet }: { projet: Projet }) {
  return (
    <Badge
      variant="outline"
      className={
        projet === 'GRAND_PUBLIC'
          ? 'whitespace-nowrap border-red-200 bg-red-50 text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/40'
          : 'whitespace-nowrap border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/40'
      }
    >
      Projet : {projet === 'GRAND_PUBLIC' ? 'Grand Public' : 'CHUES'}
    </Badge>
  );
}
