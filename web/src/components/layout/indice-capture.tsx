'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Crop } from 'react-image-crop';

export const captureDisponible = (): boolean =>
  typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia !== undefined;

export const RACCOURCI_ECRAN = 'Ctrl+K';
export const RACCOURCI_ZONE = 'Ctrl+E';

// L'élément que le survol a surligné pendant que le panneau était ouvert : le point de départ de la zone.
export function zoneSurlignee(): Crop | undefined {
  const element = document.querySelector('.cpi-survol-signale');
  if (element === null) return undefined;
  const marge = 8;
  const rect = element.getBoundingClientRect();
  const x = Math.max(0, rect.left - marge);
  const y = Math.max(0, rect.top - marge);
  const largeur = Math.min(window.innerWidth, rect.right + marge) - x;
  const hauteur = Math.min(window.innerHeight, rect.bottom + marge) - y;
  if (largeur <= 0 || hauteur <= 0) return undefined;
  return {
    unit: '%',
    x: (x / window.innerWidth) * 100,
    y: (y / window.innerHeight) * 100,
    width: (largeur / window.innerWidth) * 100,
    height: (hauteur / window.innerHeight) * 100,
  };
}

export function Touche({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[0.75rem] text-secondary-foreground">
      {children}
    </kbd>
  );
}

// Au milieu de la page, hors du panneau : la souris reste sur l'élément à montrer, le clavier fait le reste.
// Dans le body : la barre du haut floute son fond, ce qui en fait le repère d'un `fixed` et le rognerait.
export function IndiceCapture({
  ouvert,
  envoye,
  masque,
}: {
  ouvert: boolean;
  envoye: boolean;
  masque: boolean;
}) {
  if (!ouvert || envoye || masque || !captureDisponible()) return null;
  return createPortal(
    <p
      aria-hidden="true"
      className="pointer-events-none fixed bottom-8 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border border-border bg-card/75 px-4 py-2.5 text-[0.8125rem] shadow-elev-lg backdrop-blur-sm sm:left-[calc((100%-28rem)/2)]"
    >
      Survolez ce qui pose problème, puis <Touche>{RACCOURCI_ZONE}</Touche> pour capturer cette zone
      <span className="text-muted-foreground">
        ou <Touche>{RACCOURCI_ECRAN}</Touche> pour tout l'écran
      </span>
    </p>,
    document.body,
  );
}
