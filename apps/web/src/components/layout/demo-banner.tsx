import Link from 'next/link';
import { FlaskConicalIcon } from 'lucide-react';

import { formatDate } from '@/lib/format';
import type { Role } from '@/lib/types';

export function DemoBanner({ seededAt, role }: { seededAt: string | null; role: Role }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-accent-border/40 bg-accent-surface px-4 py-2 text-center text-[0.8125rem] text-warning"
    >
      <FlaskConicalIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="font-[600]">Mode démonstration actif : écritures suspendues.</span>
      <span>
        Données fictives
        {seededAt !== null ? `, jeu créé le ${formatDate(seededAt)}` : ''}. Ne pas exporter comme
        chiffres réels. La synchronisation mobile reste acceptée.
      </span>
      {role === 'ADMIN' ? (
        <Link
          href="/admin/parametres"
          className="rounded-sm font-[600] underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Gérer
        </Link>
      ) : null}
    </div>
  );
}
