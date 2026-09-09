import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'font-[600] transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
    'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:border-transparent disabled:bg-muted',
    'disabled:text-muted-foreground disabled:shadow-none',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-elev-xs hover:bg-primary-hover',
        destructive:
          'bg-destructive text-destructive-foreground shadow-elev-xs hover:brightness-110',
        outline:
          'border border-border bg-card text-foreground shadow-elev-xs hover:bg-secondary hover:text-secondary-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
        accent: 'bg-accent text-accent-foreground shadow-elev-xs hover:brightness-95',
        ghost: 'text-foreground hover:bg-secondary hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      // 44 px de cible tactile (docs/design.md §6). `sm` et `icon-sm` gardent 36 px a l'oeil
      // dans un tableau dense et etendent la zone tactile a 44 px via `before:`.
      size: {
        default: 'h-11 px-4 text-[0.9375rem]',
        sm: 'relative h-9 rounded-sm px-3 text-[0.8125rem] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[""]',
        lg: 'h-12 rounded-md px-6 text-[1rem]',
        icon: 'size-11 rounded-md',
        'icon-sm':
          'relative size-9 rounded-sm before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
