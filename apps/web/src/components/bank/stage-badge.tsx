import { Badge } from '@/components/ui/badge';
import { stageBadgeVariant, type BankCaseStage } from '@/lib/types';
import { cn } from '@/lib/utils';

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
