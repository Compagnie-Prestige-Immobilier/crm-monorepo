import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ImportsView } from '@/components/imports/imports-view';
import { PermissionDenied } from '@/components/permission-denied';
import { UPLOADABLE_IMPORT_KINDS } from '@/lib/data/imports';
import { readEnum, type RawSearchParams } from '@/lib/search-params';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Importer un fichier Excel' };

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les imports de masse" />;
  }

  // `?kind=` présélectionne le classeur : les autres coques mènent ici pour
  // leur propre entité.
  const kind = readEnum(await searchParams, 'kind', UPLOADABLE_IMPORT_KINDS);

  return <ImportsView initialKind={kind ?? 'PROSPECTS'} />;
}
