'use client';

import { Select as SelectPrimitive } from '@base-ui/react/select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * `Select.Root` de Base UI ne rend aucun élément et ses props sont génériques
 * (`<Value, Multiple>`) : on ré-exporte la primitive plutôt que de l'envelopper,
 * sinon le type de `value` se réduirait à `unknown` chez tous les appelants.
 *
 * ATTENTION : contrairement à Radix, `Select.Value` n'affiche PAS le texte de
 * l'item choisi — il affiche la valeur brute. Le libellé se retrouve via la
 * prop `items` du `Root` (`{ value, label }[]` ou `Record<valeur, libellé>`).
 * Chaque écran la fournit ; sans elle, la gâchette montrerait le code interne.
 */
const Select = SelectPrimitive.Root;

type SelectGroupProps = Omit<SelectPrimitive.Group.Props, 'className'> & {
  className?: string | undefined;
};

function SelectGroup(props: SelectGroupProps) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

type SelectValueProps = Omit<SelectPrimitive.Value.Props, 'className'> & {
  className?: string | undefined;
};

function SelectValue(props: SelectValueProps) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
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
        'flex w-full items-center justify-between gap-2 rounded-md border border-input-border bg-input-background px-3 py-2',
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

/**
 * `position="popper" | "item-aligned"` de Radix devient un booléen porté par le
 * `Positioner`. Le panel restait en mode popper : `alignItemWithTrigger` vaut
 * donc `false` par défaut, sinon Base UI recentrerait la liste sur l'item
 * sélectionné, ce qui déplacerait tous les menus déjà réglés.
 */
type SelectContentProps = Omit<SelectPrimitive.Popup.Props, 'className'> & {
  className?: string | undefined;
} & Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
  >;

function SelectContent({
  className,
  children,
  align = 'start',
  alignOffset,
  side,
  sideOffset = 4,
  alignItemWithTrigger = false,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        alignItemWithTrigger={alignItemWithTrigger}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            // La liste ne descend jamais sous la largeur de la gâchette, et ne
            // se rétrécit pas non plus sous 8 rem quand celle-ci est étroite.
            'relative isolate z-50 max-h-(--available-height) min-w-[max(8rem,var(--anchor-width))]',
            'origin-(--transform-origin) overflow-y-auto overflow-x-hidden',
            'rounded-md border border-border bg-popover text-popover-foreground shadow-elev-lg',
            'transition-[opacity,transform] duration-150',
            'data-starting-style:opacity-0 data-starting-style:scale-95',
            'data-ending-style:opacity-0 data-ending-style:scale-95',
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

type SelectLabelProps = Omit<SelectPrimitive.GroupLabel.Props, 'className'> & {
  className?: string | undefined;
};

function SelectLabel({ className, ...props }: SelectLabelProps) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn('px-2 py-1.5 text-[0.75rem] font-[600] text-muted-foreground', className)}
      {...props}
    />
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
        // Base UI ne déplace PAS le focus DOM d'un item à l'autre : il marque
        // `data-highlighted`. L'anneau se raccroche donc à cet attribut.
        // Le seul fond `secondary` ne fait que 1,16:1 contre `popover` : très
        // en dessous des 3:1 exigés d'un indicateur de focus (WCAG 1.4.11).
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
        render={
          <span className="absolute right-2 flex size-3.5 items-center justify-center" />
        }
      >
        <CheckIcon className="size-4 text-primary" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

type SelectSeparatorProps = Omit<SelectPrimitive.Separator.Props, 'className'> & {
  className?: string | undefined;
};

function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
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

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
