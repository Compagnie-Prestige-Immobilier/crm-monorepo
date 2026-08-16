'use client';

import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';

import { cn } from '@/lib/utils';

type SeparatorProps = Omit<SeparatorPrimitive.Props, 'className'> & {
  className?: string | undefined;
  decorative?: boolean | undefined;
};

/**
 * `decorative` n'est plus une prop de la primitive : Base UI expose TOUJOURS
 * un `role="separator"`. On la garde ici, avec la même valeur par défaut
 * qu'avant, et on la traduit en `role="none"`.
 *
 * Sans cela, chaque filet du panel deviendrait une annonce : un menu
 * déroulant de six entrées et deux traits se lit « séparateur » deux fois de
 * plus qu'avant, et un pied de carte annonce une frontière que rien ne
 * traverse. Un trait posé pour aérer une mise en page n'est pas une
 * information : c'est du décor, et WAI-ARIA a `role="none"` pour le dire.
 * Passer `decorative={false}` reste possible quand le trait sépare vraiment
 * deux groupes de sens.
 */
function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      {...(decorative ? { role: 'none' as const } : {})}
      className={cn(
        'shrink-0 bg-border',
        'data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full',
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
