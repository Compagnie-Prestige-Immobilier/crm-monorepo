import { cn } from '@/lib/utils';

/** Un tiret se lit comme une valeur. Le libellé dit LAQUELLE des absences c'est. */
export function Absent({
  children = 'Non renseigné',
  className,
}: {
  children?: string;
  className?: string | undefined;
}) {
  return <span className={cn('text-muted-foreground italic', className)}>{children}</span>;
}
