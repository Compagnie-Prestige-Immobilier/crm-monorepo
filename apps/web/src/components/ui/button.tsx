import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Bouton CPI.
 *
 * La hauteur par défaut est 44 px (`h-11`), pas 36 : docs/design.md §6 fixe la
 * cible tactile minimale à 44 px et le panel est aussi consulté sur tablette.
 *
 * La variante `accent` pose du texte SOMBRE sur l'or (`accent-foreground`,
 * 6,95:1). Il n'existe volontairement aucune variante « texte or sur fond
 * clair » : `#C8921A` plafonne à 2,77:1 et échoue AA (design.md §2.3).
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'font-[600] transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
    'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    /**
     * Désactivé : on CHANGE de peau, on ne baisse pas l'opacité.
     *
     * `disabled:opacity-40` mesurait 1,53:1 en clair et 3,39:1 en sombre sur
     * « Ouvrir le dossier » : le bouton devenait un fantôme illisible. WCAG
     * exempte les commandes inactives, ce qui rend l'échec invisible en audit
     * automatique — mais un utilisateur qui ne peut plus lire le libellé ne
     * sait plus ce que le bouton refuse de faire.
     *
     * Le signal « désactivé » passe donc par la PERTE de couleur, d'ombre et
     * de survol, pas par l'effacement : 6,18:1 en clair, 7,85:1 en sombre.
     */
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
      size: {
        default: 'h-11 px-4 text-[0.9375rem]',
        // 36 px de haut, mais la zone tactile est portée à 44 px par le
        // pseudo-élément ci-dessous — même raison que `icon-sm`.
        sm: 'relative h-9 rounded-sm px-3 text-[0.8125rem] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[""]',
        lg: 'h-12 rounded-md px-6 text-[1rem]',
        icon: 'size-11 rounded-md',
        // Le design system impose 44 px de cible tactile (§6), mais une action
        // de ligne à 44 px visuels alourdit un tableau dense.
        //
        // On garde donc 36 px À L'ŒIL et on étend la ZONE TACTILE à 44 px avec
        // un pseudo-élément centré. C'est la règle qui compte : elle porte sur
        // ce que le doigt peut atteindre, pas sur ce que l'œil voit. Grossir le
        // bouton aurait respecté la lettre en abîmant la densité.
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

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean | undefined;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
