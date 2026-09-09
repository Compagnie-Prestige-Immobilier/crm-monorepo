import { createFileRoute } from '@tanstack/react-router';

import { ChangePasswordCard } from '@/components/compte/change-password-card';

/** Ouvert à tout compte connecté : chacun change son mot de passe. */
export const Route = createFileRoute('/_panneau/compte')({
  component: () => (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h2 font-[800] tracking-[-0.02em]">Mon compte</h1>
      <ChangePasswordCard />
    </div>
  ),
});
