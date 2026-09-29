'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { peut, type Permission, type SessionUser } from '@/lib/types';

/** Le pilotage tient en un écran à onglets : chaque onglet garde sa route, les anciens liens vivent. */
const ONGLETS: readonly { label: string; href: string; acces: Permission }[] = [
  { label: 'Tableau de bord', href: '/grand-public/statistiques', acces: 'analytics.superviser' },
  { label: 'Campagnes', href: '/grand-public/campagnes', acces: 'campagnes.superviser' },
  { label: 'Banque', href: '/grand-public/banque', acces: 'banque.dossiers' },
];

export function OngletsPilotage({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const onglets = ONGLETS.filter((onglet) => peut(user, onglet.acces));
  const actif = onglets.find((onglet) => pathname === onglet.href) ?? onglets[0];

  return (
    <Tabs value={actif?.label}>
      <TabsList aria-label="Pilotage" className="max-w-full overflow-x-auto">
        {onglets.map((onglet) => (
          <TabsTrigger
            key={onglet.label}
            value={onglet.label}
            nativeButton={false}
            render={<Link href={onglet.href} />}
          >
            {onglet.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
