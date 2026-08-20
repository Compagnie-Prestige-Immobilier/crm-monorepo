import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { Card } from '@/components/ui/card';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Projet Grand Public' };

export default async function GrandPublicPage() {
  const guard = await guardRoles(['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le projet Grand Public" />;
  }

  return (
    <Card className="animate-rise mx-auto max-w-2xl gap-4 px-6 py-10">
      <h2 className="font-display text-h2 font-[700] tracking-[-0.02em]">
        Le projet Grand Public n’est pas encore ouvert
      </h2>
      <p className="text-body text-muted-foreground">
        Son modèle de données est en cours de pose. Aucun prospect, aucune campagne et aucun écran
        n’existent pour l’instant.
      </p>
      <p className="text-body text-muted-foreground">
        Il ne partagera rien avec le projet CHUES : la vente est la même, l’acquisition et le
        programme d’appels ne le sont pas.
      </p>
    </Card>
  );
}
