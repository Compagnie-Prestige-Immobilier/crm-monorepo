import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';

/**
 * État vide. Il dit ce que l'écran contiendra et ce qui manque pour l'obtenir -
 * un cadre vide sans texte laisse croire à une panne.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode | undefined;
}) {
  return (
    <Card className="animate-rise items-center gap-3 border-dashed px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary"
      >
        <Icon className="size-6" />
      </span>
      <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{title}</h2>
      <p className="max-w-md text-[0.9375rem] text-muted-foreground">{description}</p>
      {action}
    </Card>
  );
}
