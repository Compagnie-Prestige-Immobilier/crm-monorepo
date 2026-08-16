'use client';

import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';

import { cn } from '@/lib/utils';

/**
 * `decorative` n'existe plus : la primitive Base UI rend toujours un
 * `role="separator"` exposé aux lecteurs d'écran.
 */
type SeparatorProps = Omit<SeparatorPrimitive.Props, 'className'> & {
  className?: string | undefined;
};

function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
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
