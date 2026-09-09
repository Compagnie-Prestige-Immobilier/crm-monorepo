import { Link, useLocation } from '@tanstack/react-router';
import { ChartNoAxesCombinedIcon, ListChecksIcon, ListIcon, UploadIcon } from 'lucide-react';

import { ACCUEIL_ADMINISTRATION } from '@/lib/roles';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const ONGLETS = [
  { to: '/accueil', label: 'Liste', icon: ListIcon, roles: null },
  {
    to: '/accueil/tableau-de-bord',
    label: 'Tableau de bord',
    icon: ChartNoAxesCombinedIcon,
    roles: null,
  },
  // Tenir les quatre listes qui alimentent la saisie n'est pas saisir avec elles.
  { to: '/accueil/listes', label: 'Listes', icon: ListChecksIcon, roles: ACCUEIL_ADMINISTRATION },
  { to: '/accueil/import', label: 'Import', icon: UploadIcon, roles: ACCUEIL_ADMINISTRATION },
] as const;

export function OngletsVisites({ role }: { role: Role }) {
  const pathname = useLocation({ select: (etat) => etat.pathname });

  return (
    <nav aria-label="Registre des visites" className="print:hidden">
      <ul className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-secondary p-1">
        {ONGLETS.filter((onglet) => onglet.roles === null || onglet.roles.includes(role)).map(
          (onglet) => {
            const actif = pathname === onglet.to;
            const Icone = onglet.icon;

            return (
              <li key={onglet.to}>
                <Link
                  to={onglet.to}
                  aria-current={actif ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-[0.875rem] font-[600]',
                    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    actif
                      ? 'bg-card text-foreground shadow-elev-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icone className="size-4" aria-hidden="true" />
                  {onglet.label}
                </Link>
              </li>
            );
          },
        )}
      </ul>
    </nav>
  );
}
