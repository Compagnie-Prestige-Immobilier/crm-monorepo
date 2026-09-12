'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Role } from '@/lib/types';

type Coque = 'chues' | 'grand-public';

interface Onglet {
  label: string;
  chemin: string;
  volet?: string;
  /** Sans rôle : ouvert à tous ceux qui voient le pilotage. */
  roles?: readonly Role[];
}

/** Le pilotage tient en un écran à onglets : chaque onglet garde sa route, les anciens liens vivent. */
const ONGLETS: Record<Coque, readonly Onglet[]> = {
  chues: [
    { label: 'Tableau de bord', chemin: 'statistiques' },
    { label: 'Activité', chemin: 'supervision' },
    { label: 'Présence', chemin: 'supervision', volet: 'comptes' },
    { label: 'Campagnes', chemin: 'campagnes' },
    // La vue bancaire est le tableau de bord de l'agent bancaire ; l'ADMIN la
    // lit ici plutôt que dans une entrée de barre de plus.
    { label: 'Banque', chemin: 'banque', roles: ['ADMIN'] },
    { label: 'Pôle déploiement', chemin: 'pole-deploiement', roles: ['ADMIN'] },
    { label: 'Pôle enrôlement', chemin: 'pole-enrolement', roles: ['ADMIN'] },
    { label: 'Pôle marketing', chemin: 'pole-marketing', roles: ['ADMIN'] },
  ],
  'grand-public': [
    { label: 'Tableau de bord', chemin: 'statistiques' },
    { label: 'Activité', chemin: 'supervision' },
    { label: 'Présence', chemin: 'supervision', volet: 'comptes' },
    { label: 'Campagnes', chemin: 'campagnes' },
    { label: 'Banque', chemin: 'banque', roles: ['ADMIN'] },
  ],
};

function hrefDe(coque: Coque, onglet: Onglet): string {
  const base = `/${coque}/${onglet.chemin}`;
  return onglet.volet === undefined ? base : `${base}?volet=${onglet.volet}`;
}

export function OngletsPilotage({ coque, role }: { coque: Coque; role: Role }) {
  const pathname = usePathname();
  const volet = useSearchParams().get('volet') ?? undefined;
  const onglets = ONGLETS[coque].filter(
    (onglet) => onglet.roles === undefined || onglet.roles.includes(role),
  );
  const actif =
    onglets.find((onglet) => pathname === `/${coque}/${onglet.chemin}` && onglet.volet === volet) ??
    onglets[0];

  return (
    <Tabs value={actif?.label}>
      <TabsList aria-label="Pilotage" className="max-w-full justify-start overflow-x-auto">
        {onglets.map((onglet) => (
          <TabsTrigger
            key={onglet.label}
            value={onglet.label}
            nativeButton={false}
            render={<Link href={hrefDe(coque, onglet)} />}
          >
            {onglet.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
