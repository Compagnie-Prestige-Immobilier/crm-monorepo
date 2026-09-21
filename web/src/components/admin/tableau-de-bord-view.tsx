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
  { id: 'teleconseil', label: 'Activité téléconseil', icon: PhoneCallIcon },
  { id: 'enrolement', label: 'Enrôlement', icon: PlugZapIcon },
  { id: 'deploiement', label: 'Pôle déploiement', icon: UsersRoundIcon },
  { id: 'marketing', label: 'Pôle marketing', icon: ActivityIcon },
] as const;

type VoletId = (typeof VOLETS)[number]['id'];

// Le volet par défaut n'écrit rien dans l'URL : les filtres de l'écran de
// supervision la réécrivent sans `volet`, et renverraient ailleurs.
const VOLET_PAR_DEFAUT: VoletId = 'teleconseil';

export function AdminTableauDeBordView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const voletActif: VoletId = useMemo(() => {
    const volet = searchParams.get('volet');
    return VOLETS.find((v) => v.id === volet)?.id ?? VOLET_PAR_DEFAUT;
  }, [searchParams]);

  const changerVolet = (suivant: string) => {
    const params = new URLSearchParams();
    if (suivant !== VOLET_PAR_DEFAUT) {
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
          Le tableau de bord de supervision, puis l’enrôlement des plateformes, la qualité de la
          base et le marketing.
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
          <ChiffresView ecran="chues" />
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
