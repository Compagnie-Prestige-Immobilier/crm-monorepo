import { useCanGoBack, useRouter } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Ramène à la liste d'où vient la fiche, onglet et filtres compris ; `href` ne
 * sert qu'à une fiche ouverte directement. `buttonVariants` et non `Button`:
 * `nativeButton={false}` poserait `role="button"` sur le `<a>`.
 */
export function DetailBackLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  const peutRevenir = useCanGoBack();
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: 'ghost' }), 'w-fit -ml-2')}
      onClick={(event) => {
        if (!peutRevenir) return;
        event.preventDefault();
        router.history.back();
      }}
    >
      <ArrowLeftIcon aria-hidden="true" />
      {peutRevenir ? 'Retour' : children}
    </Link>
  );
}
