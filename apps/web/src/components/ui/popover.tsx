'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const PopoverAnchorContext = createContext<{
  anchor: Element | null;
  setAnchor: (element: Element | null) => void;
} | null>(null);

function Popover({ children, ...props }: PopoverPrimitive.Root.Props) {
  const [anchor, setAnchor] = useState<Element | null>(null);
  return (
    <PopoverAnchorContext.Provider value={{ anchor, setAnchor }}>
      <PopoverPrimitive.Root {...props}>{children as ReactNode}</PopoverPrimitive.Root>
    </PopoverAnchorContext.Provider>
  );
}

function PopoverAnchor({ children, ...props }: React.ComponentProps<'span'>) {
  const context = useContext(PopoverAnchorContext);
  return (
    <span
      data-slot="popover-anchor"
      style={{ display: 'contents' }}
      ref={(element) => {
        context?.setAnchor(element);
      }}
      {...props}
    >
      {children}
    </span>
  );
}

type PopoverTriggerProps = Omit<PopoverPrimitive.Trigger.Props, 'className'> & {
  className?: string | undefined;
};

function PopoverTrigger(props: PopoverTriggerProps) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

type PopoverContentProps = Omit<PopoverPrimitive.Popup.Props, 'className'> & {
  className?: string | undefined;
} & Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'collisionPadding'
  >;

function PopoverContent({
  className,
  align = 'start',
  alignOffset,
  side,
  sideOffset = 4,
  collisionPadding = 8,
  ...props
}: PopoverContentProps) {
  const anchor = useContext(PopoverAnchorContext)?.anchor ?? undefined;
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        className="isolate z-50"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        anchor={anchor}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            // Sans `--available-height`, un popover ouvert en bas d'écran
            // dépassait la fenêtre : sa fin était hors d'atteinte, et rien ne
            // défilait puisque rien ne débordait d'un conteneur.
            'z-50 flex max-h-(--available-height) w-72 flex-col overflow-y-auto',
            'origin-(--transform-origin) rounded-md',
            'border border-border bg-popover p-1 text-popover-foreground shadow-elev-lg',
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
            'duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
            'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
