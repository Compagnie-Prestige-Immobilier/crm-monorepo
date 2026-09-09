import { Select as SelectPrimitive } from '@base-ui/react/select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Sans la prop `items` sur le `Root`, `Select.Value` affiche la valeur brute et non le libelle. */
const Select = SelectPrimitive.Root;

type SelectValueProps = Omit<SelectPrimitive.Value.Props, 'className'> & {
  className?: string | undefined;
};

// `min-w-0` autant que `truncate` : sans lui un élément flex refuse de passer
// sous la largeur de son texte, et un libellé long débordait du champ.
function SelectValue({ className, ...props }: SelectValueProps) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn('block min-w-0 flex-1 truncate text-left', className)}
      {...props}
    />
  );
}

type SelectTriggerProps = Omit<SelectPrimitive.Trigger.Props, 'className'> & {
  className?: string | undefined;
  size?: 'sm' | 'default' | undefined;
};

function SelectTrigger({ className, size = 'default', children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input-border bg-input-background px-3 py-2',
        'text-[0.875rem] text-foreground whitespace-nowrap transition-colors',
        'data-[size=default]:h-11 data-[size=sm]:h-9',
        'data-placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon render={<ChevronDownIcon className="size-4 opacity-60" />} />
    </SelectPrimitive.Trigger>
  );
}

type SelectContentProps = Omit<SelectPrimitive.Popup.Props, 'className'> & {
  className?: string | undefined;
} & Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger' | 'collisionPadding'
  >;

function SelectContent({
  className,
  children,
  align = 'start',
  alignOffset,
  side,
  sideOffset = 4,
  alignItemWithTrigger = false,
  collisionPadding = 0,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        // Le `transform` que Base UI pose ici cree un contexte d'empilement: le
        // `z-50` du popup y reste enferme, et la liste se peint SOUS le calque
        // d'un dialogue. Sans cette ligne, tout `Select` dans un dialogue est
        // invisible. Meme geste que `popover.tsx`.
        className="isolate z-50"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        collisionPadding={collisionPadding}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'relative isolate z-50 max-h-(--available-height) min-w-[max(8rem,var(--anchor-width))]',
            'origin-(--transform-origin) overflow-y-auto overflow-x-hidden',
            'rounded-md border border-border bg-popover text-popover-foreground shadow-elev-lg',
            'duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
            'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-1">{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

type SelectItemProps = Omit<SelectPrimitive.Item.Props, 'className'> & {
  className?: string | undefined;
};

function SelectItem({ className, children, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-2 pr-8 pl-2',
        'text-[0.875rem] outline-none',
        'data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-ring',
        'data-highlighted:bg-secondary data-highlighted:text-secondary-foreground',
        'data-disabled:pointer-events-none data-disabled:text-muted-foreground',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="shrink-0 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={<span className="absolute right-2 flex size-3.5 items-center justify-center" />}
      >
        <CheckIcon className="size-4 text-primary" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

type SelectScrollUpButtonProps = Omit<SelectPrimitive.ScrollUpArrow.Props, 'className'> & {
  className?: string | undefined;
};

function SelectScrollUpButton({ className, ...props }: SelectScrollUpButtonProps) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        'top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1',
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

type SelectScrollDownButtonProps = Omit<SelectPrimitive.ScrollDownArrow.Props, 'className'> & {
  className?: string | undefined;
};

function SelectScrollDownButton({ className, ...props }: SelectScrollDownButtonProps) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        'bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1',
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
