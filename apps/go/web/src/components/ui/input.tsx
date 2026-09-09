import type * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-md border border-input-border bg-input-background px-3 py-2',
        'text-[0.9375rem] text-foreground transition-colors duration-150',
        'placeholder:text-muted-foreground',
        'file:inline-flex file:border-0 file:bg-transparent file:text-[0.8125rem] file:font-[600]',
        'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'aria-invalid:border-destructive aria-invalid:outline-destructive',
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
