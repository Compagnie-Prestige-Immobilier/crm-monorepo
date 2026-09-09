import { DownloadIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { PILOTAGE } from '@/lib/roles';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Le serveur pose `Content-Disposition` : une ancre suffit, et le navigateur
 * garde sa barre de téléchargement, sa reprise et son ouverture directe.
 */
export function LienTelechargement({
  href,
  label,
  variant = 'outline',
  size = 'default',
  iconSeule = false,
  desactive = false,
  children,
}: {
  href: string;
  /** Ce que dit le lecteur d'écran quand seule l'icône est visible. */
  label: string;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'icon-sm';
  iconSeule?: boolean;
  desactive?: boolean;
  children?: ReactNode;
}) {
  if (desactive) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className={cn(buttonVariants({ variant, size }), 'pointer-events-none opacity-50')}
      >
        <DownloadIcon aria-hidden="true" className="size-4" />
        {iconSeule ? null : children}
      </span>
    );
  }

  return (
    <a href={href} download aria-label={label} className={buttonVariants({ variant, size })}>
      <DownloadIcon aria-hidden="true" className="size-4" />
      {iconSeule ? null : children}
    </a>
  );
}

/** Le classeur de toute la base, réservé au pilotage comme la route qui le sert. */
export function BoutonExportGlobal({ role }: { role: Role }) {
  if (!PILOTAGE.includes(role)) return null;

  return (
    <a
      href="/api/v1/export/global.xlsx"
      download
      className={buttonVariants({ variant: 'outline' })}
      title="Export Excel global"
    >
      <DownloadIcon aria-hidden="true" className="size-4" />
      <span className="sr-only lg:not-sr-only">Export Excel global</span>
    </a>
  );
}
