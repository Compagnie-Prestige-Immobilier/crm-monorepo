'use client';

import { CommerciauxView } from '@/components/commerciaux/commerciaux-view';
import { RolesView } from '@/components/commerciaux/roles-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { peut, type SessionUser } from '@/lib/types';

/** L'onglet des rôles n'existe que pour qui peut les régler. */
export function UtilisateursEtRoles({ user }: { user: SessionUser }) {
  if (!peut(user, 'roles.administrer')) return <CommerciauxView currentUserId={user.id} />;

  return (
    <Tabs defaultValue="utilisateurs">
      <TabsList>
        <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
        <TabsTrigger value="roles">Rôles</TabsTrigger>
      </TabsList>
      <TabsContent value="utilisateurs">
        <CommerciauxView currentUserId={user.id} />
      </TabsContent>
      <TabsContent value="roles">
        <RolesView />
      </TabsContent>
    </Tabs>
  );
}
