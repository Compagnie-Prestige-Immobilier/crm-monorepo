'use client';

import { RenderError, type RouteError } from '@/components/render-error';

/**
 * Posée SOUS `layout.tsx` : la barre latérale, la barre supérieure et la
 * palette de coque survivent à l'erreur, seul le contenu est remplacé.
 */
export default function PanelError({ error, reset }: { error: RouteError; reset: () => void }) {
  return <RenderError error={error} reset={reset} retour="/espaces" />;
}
