'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Base UI n'a pas de part `Anchor` : c'est le `Positioner` qui reçoit une prop
 * `anchor`. Ce contexte rétablit l'API de Radix — poser `<PopoverAnchor>`
 * quelque part dans l'arbre suffit, `PopoverContent` s'y accroche tout seul —
 * sans obliger chaque écran à porter une ref jusqu'au contenu.
 *
 * Sans ancre déclarée, la valeur reste `null` et le `Positioner` retombe sur
 * son ancre par défaut, la gâchette. C'est exactement ce que faisait Radix.
 */
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

/**
 * Ancre le popover sur un élément AUTRE que la gâchette. Rend un `<span>`
 * transparent à la mise en page (`contents`), comme le faisait le `Slot` de
 * Radix quand on ne lui passait pas `asChild`.
 */
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

/**
 * Base UI sépare le placement (`Positioner`) de la boîte stylée (`Popup`).
 * Les props de placement DOIVENT être déstructurées ici puis passées au
 * `Positioner` : laissées dans `...props`, elles atterriraient sur le `Popup`,
 * qui ne positionne rien, et le popover se collerait en haut à gauche sans
 * qu'aucun type ne proteste.
 */
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
  // Base UI réserve 5 px au bord de la fenêtre, Radix n'en réservait aucun.
  collisionPadding = 0,
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
            'z-50 w-72 origin-(--transform-origin) rounded-md',
            'border border-border bg-popover p-1 text-popover-foreground shadow-elev-lg',
            // Le conteneur reçoit le focus à l'ouverture : sans anneau de
            // remplacement, l'utilisateur au clavier ne voit pas où il a atterri.
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
            // Mêmes images-clés que sous Radix (tw-animate-css), rebranchées sur
            // les attributs de présence de Base UI : la primitive garde le popup
            // monté jusqu'à la fin de l'animation de sortie.
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
