import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { GabaritsView } from '@/components/notifications/gabarits';
import { InboxView } from '@/components/notifications/inbox-view';
import { NotificationComposer } from '@/components/notifications/notification-composer';
import { NotificationHistory } from '@/components/notifications/notification-history';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OngletNotifications } from '@/lib/data/notifications';
import type { RechercheNotifications } from '@/routes/_panneau/admin/notifications';

export function NotificationsAdminView({
  recherche,
  onRecherche,
}: {
  recherche: RechercheNotifications;
  onRecherche: (suivante: RechercheNotifications) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const onglet = recherche.onglet ?? 'envoi';

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={onglet}
        onValueChange={(value) => {
          onRecherche(value === 'envoi' ? {} : { onglet: value as OngletNotifications });
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="reception">Boîte de réception</TabsTrigger>
            <TabsTrigger value="envoi">Envois</TabsTrigger>
            <TabsTrigger value="gabarits">Gabarits</TabsTrigger>
          </TabsList>
          <Button
            type="button"
            onClick={() => {
              setComposerOpen(true);
            }}
          >
            <PlusIcon aria-hidden="true" />
            Nouvelle notification
          </Button>
        </div>

        <TabsContent value="reception" className="mt-4">
          <InboxView />
        </TabsContent>

        <TabsContent value="envoi" className="mt-4">
          <NotificationHistory
            page={recherche.page ?? 1}
            status={recherche.statut ?? null}
            category={recherche.categorie ?? null}
            onFiltres={(filtres) => {
              onRecherche({
                ...(filtres.status === null ? {} : { statut: filtres.status }),
                ...(filtres.category === null ? {} : { categorie: filtres.category }),
                ...(filtres.page > 1 ? { page: filtres.page } : {}),
              });
            }}
          />
        </TabsContent>

        <TabsContent value="gabarits" className="mt-4">
          <GabaritsView />
        </TabsContent>
      </Tabs>

      <NotificationComposer open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
}
