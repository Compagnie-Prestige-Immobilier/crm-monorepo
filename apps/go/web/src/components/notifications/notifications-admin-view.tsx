import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { InboxView } from '@/components/notifications/inbox-view';
import { NotificationComposer } from '@/components/notifications/notification-composer';
import { NotificationHistory } from '@/components/notifications/notification-history';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function NotificationsAdminView({ onglet }: { onglet: 'reception' | 'envoi' }) {
  const [tab, setTab] = useState<'reception' | 'envoi'>(onglet);
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as 'reception' | 'envoi');
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="reception">Boîte de réception</TabsTrigger>
            <TabsTrigger value="envoi">Envois</TabsTrigger>
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
          <NotificationHistory />
        </TabsContent>
      </Tabs>

      <NotificationComposer open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
}
