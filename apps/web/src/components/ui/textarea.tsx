import type * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-[5.5rem] w-full rounded-md border border-input-border bg-input-background px-3 py-2',
        'text-[0.9375rem] text-foreground transition-colors duration-150 field-sizing-content',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'aria-invalid:border-destructive aria-invalid:outline-destructive',
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
