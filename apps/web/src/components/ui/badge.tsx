import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Chaque variante de statut associe une SURFACE claire à un TEXTE mesuré sur
 * cette surface (docs/design.md §2.4). En particulier `warning` utilise
 * `accent-text` (#856011), jamais l'or décoratif.
 */
const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden',
    'rounded-full border px-2.5 py-0.5 text-[0.75rem] font-[600] whitespace-nowrap',
    '[&>svg]:size-3 [&>svg]:pointer-events-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-foreground',
        success: 'border-transparent bg-success-surface text-success',
        warning: 'border-accent-border/30 bg-warning-surface text-warning',
        destructive: 'border-transparent bg-destructive-surface text-destructive',
        info: 'border-transparent bg-info-surface text-info',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean | undefined };

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
