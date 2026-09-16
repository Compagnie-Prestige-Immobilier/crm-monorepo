'use client';

import { HistoryIcon } from 'lucide-react';
import { useState } from 'react';

import { HistoireDeLaFiche } from '@/components/prospects/histoire-fiche';
import type { ProspectRow, Role } from '@/lib/types';

/**
 * La même histoire de fiche que sur le détail, repliée : le téléconseiller
 * enchaîne ses appels, elle ne charge rien tant qu'il ne l'ouvre pas.
 */
export function HistoriqueFiche({ prospect, role }: { prospect: ProspectRow; role: Role }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <details
      onToggle={(event) => {
        setOuvert(event.currentTarget.open);
      }}
    >
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-[0.9375rem] font-[600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <HistoryIcon className="size-4 shrink-0" aria-hidden="true" />
        Historique de la fiche
      </summary>
      <div className="pt-3">
        {ouvert ? <HistoireDeLaFiche prospect={prospect} role={role} /> : null}
      </div>
    </details>
  );
}
