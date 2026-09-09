import { Link, useLocation } from '@tanstack/react-router';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { lien } from '@/lib/nav';
import type { Projet, Role } from '@/lib/types';

interface Onglet {
  label: string;
  chemin: string;
  volet?: string;
  /** Sans rôle : ouvert à tous ceux qui voient le pilotage. */
  roles?: readonly Role[];
}

/** Le pilotage tient en un écran à onglets ; chaque onglet garde sa route. */
const ONGLETS: Record<Projet, readonly Onglet[]> = {
  chues: [
    { label: 'Tableau de bord', chemin: 'statistiques' },
    { label: 'Activité', chemin: 'supervision' },
    { label: 'Présence', chemin: 'supervision', volet: 'comptes' },
    { label: 'Campagnes', chemin: 'campagnes' },
    // La vue bancaire est le tableau de bord de l'agent bancaire ; l'ADMIN la
    // lit ici plutôt que dans une entrée de barre de plus.
    { label: 'Banque', chemin: 'banque', roles: ['ADMIN'] },
  ],
  'grand-public': [
    { label: 'Tableau de bord', chemin: 'statistiques' },
    { label: 'Activité', chemin: 'supervision' },
    { label: 'Campagnes', chemin: 'campagnes' },
    { label: 'Banque', chemin: 'banque', roles: ['ADMIN'] },
  ],
};

export function OngletsPilotage({ projet, role }: { projet: Projet; role: Role }) {
  const { pathname, search } = useLocation();
  const volet = 'volet' in search ? String(search.volet) : undefined;
  const onglets = ONGLETS[projet].filter(
    (onglet) => onglet.roles === undefined || onglet.roles.includes(role),
  );
  const actif =
    onglets.find(
      (onglet) => pathname === `/${projet}/${onglet.chemin}` && onglet.volet === volet,
    ) ?? onglets[0];

  return (
    <Tabs value={actif?.label}>
      <TabsList aria-label="Pilotage" className="max-w-full overflow-x-auto">
        {onglets.map((onglet) => (
          <TabsTrigger
            key={onglet.label}
            value={onglet.label}
            nativeButton={false}
            render={
              <Link
                {...lien(
                  onglet.volet === undefined
                    ? `/${projet}/${onglet.chemin}`
                    : `/${projet}/${onglet.chemin}?volet=${onglet.volet}`,
                )}
              />
            }
          >
            {onglet.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
