'use client';

import { Menu as DropdownMenuPrimitive } from '@base-ui/react/menu';

import { cn } from '@/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;

type DropdownMenuTriggerProps = Omit<DropdownMenuPrimitive.Trigger.Props, 'className'> & {
  className?: string | undefined;
};

function DropdownMenuTrigger(props: DropdownMenuTriggerProps) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

type DropdownMenuContentProps = Omit<DropdownMenuPrimitive.Popup.Props, 'className'> & {
  className?: string | undefined;
} & Pick<
    DropdownMenuPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'collisionPadding'
  >;

function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = 'end',
  alignOffset,
  side,
  collisionPadding = 0,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        side={side}
        collisionPadding={collisionPadding}
      >
        <DropdownMenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'z-50 min-w-[10rem] origin-(--transform-origin) outline-none',
            'overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-elev-lg',
            'duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
            'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        />
      </DropdownMenuPrimitive.Positioner>
    </DropdownMenuPrimitive.Portal>
  );
}

// L'action d'un item passe par `onClick`. Base UI n'expose pas `onSelect`, mais l'item rend un
// `<div>` sur lequel `onSelect` est un evenement DOM valide: il compilerait sans jamais tirer.
type NoOnSelect = { onSelect?: never };

type DropdownMenuItemProps = Omit<DropdownMenuPrimitive.Item.Props, 'className'> &
  NoOnSelect & {
    className?: string | undefined;
    inset?: boolean | undefined;
    variant?: 'default' | 'destructive' | undefined;
  };

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-2',
        'text-[0.875rem] outline-none transition-colors',
        // Base UI ne deplace pas le focus DOM d'un item a l'autre: l'anneau (3:1, WCAG 1.4.11)
        // se raccroche a `data-highlighted` et non a `:focus`.
        'data-highlighted:outline-solid data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-ring',
        'data-highlighted:bg-secondary data-highlighted:text-secondary-foreground',
        'data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive-surface',
        'data-[inset]:pl-8 data-disabled:pointer-events-none data-disabled:opacity-40',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

type DropdownMenuLabelProps = Omit<DropdownMenuPrimitive.GroupLabel.Props, 'className'> & {
  className?: string | undefined;
  inset?: boolean | undefined;
};

function DropdownMenuLabel({ className, inset, ...props }: DropdownMenuLabelProps) {
  return (
    <DropdownMenuPrimitive.Group>
      <DropdownMenuPrimitive.GroupLabel
        data-slot="dropdown-menu-label"
        data-inset={inset}
        className={cn('px-2 py-1.5 text-[0.75rem] font-[600] text-muted-foreground', className)}
        {...props}
      />
    </DropdownMenuPrimitive.Group>
  );
}

type DropdownMenuSeparatorProps = Omit<DropdownMenuPrimitive.Separator.Props, 'className'> & {
  className?: string | undefined;
};

function DropdownMenuSeparator({ className, ...props }: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
