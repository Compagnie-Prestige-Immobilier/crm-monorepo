import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';

/**
 * Les fiches complétées dans le classeur après le lancement : le relevé suivant
 * les a ajoutées à la campagne de leur onglet, d'où un total qui grandit. Tant
 * qu'il en reste à appeler, la campagne passe en tête de la liste.
 */
export function BadgeRemontees({
  remontees,
  remonteesATraiter,
  derniereRemontee,
}: {
  remontees: number;
  remonteesATraiter: number;
  derniereRemontee: string;
}) {
  if (remontees === 0 || derniereRemontee === '') return null;
  if (remonteesATraiter > 0) {
    return (
      <Badge
        variant="warning"
        title={`Remontées le ${formatDate(derniereRemontee)}, la campagne reste en tête tant qu’elles ne sont pas appelées`}
      >
        {remonteesATraiter} remontée{remonteesATraiter > 1 ? 's' : ''} à appeler
      </Badge>
    );
  }
  return (
    <Badge
      variant="info"
      title="Lignes complétées dans le classeur après le lancement de la campagne"
    >
      +{remontees} remontée{remontees > 1 ? 's' : ''} le {formatDate(derniereRemontee)}
    </Badge>
  );
}
