'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';

import { cn } from '@/lib/utils';

/**
 * `Popover.Root` de Base UI ne rend aucun élément et ses props sont génériques
 * (`<Payload>`) : on ré-exporte la primitive au lieu de l'envelopper.
 */
const Popover = PopoverPrimitive.Root;

type PopoverTriggerProps = Omit<PopoverPrimitive.Trigger.Props, 'className'> & {
  className?: string | undefined;
};

function PopoverTrigger(props: PopoverTriggerProps) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/**
 * Base UI sépare le placement (`Positioner`) de la boîte stylée (`Popup`).
 * Les quatre props de placement DOIVENT être déstructurées ici puis passées au
 * `Positioner` : laissées dans `...props`, elles atterriraient sur le `Popup`,
 * qui ne positionne rien, et le popover se collerait en haut à gauche sans
 * qu'aucun type ne proteste.
 */
type PopoverContentProps = Omit<PopoverPrimitive.Popup.Props, 'className'> & {
  className?: string | undefined;
} & Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>;

function PopoverContent({
  className,
  align = 'start',
  alignOffset,
  side,
  sideOffset = 4,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        className="isolate z-50"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'z-50 w-72 origin-(--transform-origin) rounded-md',
            'border border-border bg-popover p-1 text-popover-foreground shadow-elev-lg',
            // Le conteneur reçoit le focus à l'ouverture : sans anneau de
            // remplacement, l'utilisateur au clavier ne voit pas où il a atterri.
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
            'transition-[opacity,transform] duration-150',
            'data-starting-style:opacity-0 data-starting-style:scale-95',
            'data-ending-style:opacity-0 data-ending-style:scale-95',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
