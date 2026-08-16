'use client';

import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Base UI n'expose aucune primitive `Label` : un `<label>` natif suffit, la
 * liaison au contrôle passe par `htmlFor` (ou par `Field.Label` dans un
 * formulaire Base UI, que ce panel n'utilise pas).
 */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex select-none items-center gap-2 text-[0.8125rem] font-[600] leading-none text-foreground',
        'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
