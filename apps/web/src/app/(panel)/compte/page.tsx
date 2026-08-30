import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ChangePasswordCard } from '@/components/compte/change-password-card';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Mon compte' };

export default async function ComptePage() {
  const session = await getSession();
  if (session === null) redirect('/connexion');

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <ChangePasswordCard />
    </div>
  );
}
