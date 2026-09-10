import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** `buttonVariants` et non `Button`: `nativeButton={false}` poserait `role="button"` sur le `<a>`. */
export function DetailBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: 'ghost' }), 'w-fit -ml-2')}>
      <ArrowLeftIcon aria-hidden="true" />
      {children}
    </Link>
  );
}
