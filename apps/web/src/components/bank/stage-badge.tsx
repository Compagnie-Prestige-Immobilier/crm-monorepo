import { Badge } from '@/components/ui/badge';
import { stageBadgeVariant, type BankCaseStage } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Pastille d'étape, teintée d'après la CONFIGURATION.
 *
 * `BankCaseStageDto.color` porte un rôle du design system (`info`, `warning`,
 * `success`…), jamais un hex : c'est écrit dans le contrat, et c'est ce qui
 * permet à une étape créée par un administrateur de rester lisible dans les
 * deux thèmes sans qu'on ait à mesurer un contraste à sa place. Une couleur
 * inconnue retombe sur la variante neutre plutôt que de casser la ligne.
 *
 * L'étape désactivée est marquée en toutes lettres : sans cela, un dossier
 * stationnant sur une étape retirée du flux paraîtrait normal, et personne ne
 * comprendrait pourquoi il n'avance plus.
 */
export function StageBadge({
  stage,
  className,
}: {
  stage: BankCaseStage;
  className?: string | undefined;
}) {
  return (
    <Badge variant={stageBadgeVariant(stage.color)} className={cn('max-w-full', className)}>
      <span className="truncate">{stage.label}</span>
      {!stage.isActive ? <span className="shrink-0 opacity-80"> (désactivée)</span> : null}
    </Badge>
  );
}
