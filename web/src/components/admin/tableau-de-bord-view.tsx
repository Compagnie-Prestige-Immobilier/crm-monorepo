'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ActivityIcon, PhoneCallIcon, PlugZapIcon, UsersRoundIcon } from 'lucide-react';

import { ChiffresView } from '@/components/chiffres/vue';
import { SyntheseEnrolement } from '@/components/enrolement/synthese-enrolement';
import { PoleDeploiementView } from '@/components/pilotage/pole-deploiement-view';
import { PoleMarketingView } from '@/components/pilotage/pole-marketing-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const VOLETS = [
  { id: 'enrolement', label: 'Enrôlement & CCP', icon: PlugZapIcon },
  { id: 'teleconseil', label: 'Activité téléconseil', icon: PhoneCallIcon },
  { id: 'deploiement', label: 'Pôle déploiement', icon: UsersRoundIcon },
  { id: 'marketing', label: 'Pôle marketing', icon: ActivityIcon },
] as const;

type VoletId = (typeof VOLETS)[number]['id'];

export function AdminTableauDeBordView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const voletActif: VoletId = useMemo(() => {
    const volet = searchParams.get('volet');
    if (volet === 'deploiement' || volet === 'marketing' || volet === 'teleconseil') return volet;
    return 'enrolement';
  }, [searchParams]);

  const changerVolet = (suivant: string) => {
    const params = new URLSearchParams();
    if (suivant !== 'enrolement') {
      params.set('volet', suivant);
    }
    const requete = params.toString();
    router.replace(requete === '' ? pathname : `${pathname}?${requete}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Tableau de bord admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d’ensemble globale : enrôlement des plateformes, activité CCP et téléconseil, qualité
          de la base et marketing.
        </p>
      </div>

      <Tabs value={voletActif} onValueChange={changerVolet}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {VOLETS.map((v) => {
            const Icone = v.icon;
            return (
              <TabsTrigger key={v.id} value={v.id} className="gap-2">
                <Icone className="size-4" />
                <span>{v.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="enrolement" className="pt-4">
          <SyntheseEnrolement />
        </TabsContent>

        <TabsContent value="teleconseil" className="pt-4">
          <ChiffresView ecran="chues" role="ADMIN" />
        </TabsContent>

        <TabsContent value="deploiement" className="pt-4">
          <PoleDeploiementView />
        </TabsContent>

        <TabsContent value="marketing" className="pt-4">
          <PoleMarketingView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
