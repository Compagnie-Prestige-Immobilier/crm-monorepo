'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Coque = 'chues' | 'grand-public';

interface Onglet {
  label: string;
  chemin: string;
  volet?: string;
}

/** Le pilotage tient en un écran à onglets : chaque onglet garde sa route, les anciens liens vivent. */
const ONGLETS: Record<Coque, readonly Onglet[]> = {
  chues: [
    { label: 'Tableau de bord', chemin: 'statistiques' },
    { label: 'Activité', chemin: 'supervision' },
    { label: 'Présence', chemin: 'supervision', volet: 'comptes' },
    { label: 'Campagnes', chemin: 'campagnes' },
  ],
  'grand-public': [
    { label: 'Tableau de bord', chemin: 'statistiques' },
    { label: 'Activité', chemin: 'supervision' },
    { label: 'Campagnes', chemin: 'campagnes' },
  ],
};

function hrefDe(coque: Coque, onglet: Onglet): string {
  const base = `/${coque}/${onglet.chemin}`;
  return onglet.volet === undefined ? base : `${base}?volet=${onglet.volet}`;
}

export function OngletsPilotage({ coque }: { coque: Coque }) {
  const pathname = usePathname();
  const volet = useSearchParams().get('volet') ?? undefined;
  const onglets = ONGLETS[coque];
  const actif =
    onglets.find((onglet) => pathname === `/${coque}/${onglet.chemin}` && onglet.volet === volet) ??
    onglets[0];

  return (
    <Tabs value={actif?.label}>
      <TabsList aria-label="Pilotage" className="max-w-full overflow-x-auto">
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
