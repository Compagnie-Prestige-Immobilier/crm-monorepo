'use client';

import { RenderError, type RouteError } from '@/components/render-error';

/** Tout ce qui n'est pas dans le panel : connexion, hub, adresses déplacées. */
export default function RootError({ error, reset }: { error: RouteError; reset: () => void }) {
  return (
    <main id="contenu-principal" className="grid min-h-dvh place-items-center p-6">
      <RenderError error={error} reset={reset} retour="/espaces" />
    </main>
  );
}
