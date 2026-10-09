import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';

/**
 * Les fiches complétées dans le classeur après le lancement : le relevé suivant
 * les a ajoutées à la campagne de leur onglet, d'où un total qui grandit.
 */
export function BadgeRemontees({
  remontees,
  derniereRemontee,
}: {
  remontees: number;
  derniereRemontee: string;
}) {
  if (remontees === 0 || derniereRemontee === '') return null;
  return (
    <Badge
      variant="info"
      title="Lignes complétées dans le classeur après le lancement de la campagne"
    >
      +{remontees} remontée{remontees > 1 ? 's' : ''} le {formatDate(derniereRemontee)}
    </Badge>
  );
}
