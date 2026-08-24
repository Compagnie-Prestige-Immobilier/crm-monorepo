'use client';

import type * as React from 'react';

import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex select-none items-center gap-2 text-[0.9375rem] font-[600] leading-none text-foreground',
        'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
