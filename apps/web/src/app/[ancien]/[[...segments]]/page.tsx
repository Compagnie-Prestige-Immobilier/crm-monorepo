import { notFound, redirect } from 'next/navigation';

import { movedTarget, type SearchParams } from '@/app/moved-routes';

/**
 * Toute adresse de premier niveau qui ne correspond à aucune route statique.
 * Next fait toujours gagner un segment statique sur ce segment dynamique :
 * `/chues/...`, `/admin/...` et `/espaces` ne passent jamais par ici.
 */
export default async function AncienneRoute({
  params,
  searchParams,
}: {
  params: Promise<{ ancien: string; segments?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const { ancien, segments = [] } = await params;
  const target = movedTarget(ancien, segments, await searchParams);

  if (target === null) notFound();

  redirect(target);
}
