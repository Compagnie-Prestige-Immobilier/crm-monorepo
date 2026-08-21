import { FlaskConicalIcon } from 'lucide-react';

export function DemoBanner() {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-accent-border/40 bg-accent-surface px-4 py-2 text-center text-[0.8125rem] text-warning"
    >
      <FlaskConicalIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="font-[600]">Espace démo</span>
      <span>Données fictives. Les e-mails et les exports intégraux sont désactivés.</span>
    </div>
  );
}
