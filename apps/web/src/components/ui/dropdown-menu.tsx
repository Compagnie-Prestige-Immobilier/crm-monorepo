'use client';

import { Menu as DropdownMenuPrimitive } from '@base-ui/react/menu';
import { CheckIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Base UI n'a pas de primitive « dropdown menu » : c'est `Menu`, dont
 * `Menu.Root` ne rend aucun élément. Les noms publics restent ceux de shadcn,
 * les écrans n'ont pas à connaître la primitive sous-jacente.
 */
const DropdownMenu = DropdownMenuPrimitive.Root;

type DropdownMenuTriggerProps = Omit<DropdownMenuPrimitive.Trigger.Props, 'className'> & {
  className?: string | undefined;
};

function DropdownMenuTrigger(props: DropdownMenuTriggerProps) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

type DropdownMenuGroupProps = Omit<DropdownMenuPrimitive.Group.Props, 'className'> & {
  className?: string | undefined;
};

function DropdownMenuGroup(props: DropdownMenuGroupProps) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

/**
 * Le placement vit sur le `Positioner`, la peau sur le `Popup`. Les quatre
 * props de placement sont déstructurées PUIS transmises explicitement : sinon
 * elles partiraient dans `...props` vers le `Popup`, qui ne positionne rien, et
 * le menu se collerait en haut à gauche sans qu'aucun type ne proteste.
 */
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
  // Base UI réserve 5 px au bord de la fenêtre, Radix n'en réservait aucun.
  // Un menu aligné à droite d'une action de ligne se décalait donc de 5 px
  // vers l'intérieur : on garde le comportement d'origine.
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
            // Mêmes images-clés que sous Radix (tw-animate-css), rebranchées sur
            // les attributs de présence de Base UI : la primitive garde le popup
            // monté jusqu'à la fin de l'animation de sortie.
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

/**
 * `onSelect` est INTERDIT ici, et le type le dit.
 *
 * Radix appelait l'action d'un item dans `onSelect`. Base UI l'appelle dans
 * `onClick` et n'expose aucun `onSelect`. Mais l'item rend un `<div>`, et
 * `onSelect` EST un événement DOM valide sur un `<div>` : passé par erreur, il
 * compile, se pose sur l'élément, et n'est jamais déclenché par un clic. Quinze
 * actions de menu — dont « Se déconnecter » et les deux exports Excel — sont
 * ainsi devenues muettes sans qu'aucun type ne bronche ; seuls les parcours
 * Playwright l'ont vu.
 *
 * Le `never` transforme la même erreur en échec de compilation.
 */
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
        // Le fond `secondary` seul ne fait que 1,16:1 contre `popover` : loin
        // des 3:1 exigés d'un indicateur de focus. Base UI ne déplace PAS le
        // focus DOM d'un item à l'autre — il marque `data-highlighted` — donc
        // l'anneau se raccroche à cet attribut et non à `:focus`.
        'data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-ring',
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

type DropdownMenuCheckboxItemProps = Omit<DropdownMenuPrimitive.CheckboxItem.Props, 'className'> &
  NoOnSelect & {
    className?: string | undefined;
  };

/**
 * `closeOnClick` REND la fermeture au clic.
 *
 * Base UI laisse le menu ouvert après avoir coché une case (`false` par
 * défaut) ; Radix le fermait. Le panel n'a aucun menu à cases multiples où
 * rester ouvert aurait du sens : garder le comportement d'origine évite qu'un
 * futur appelant hérite d'une nuance jamais décidée ici. Un menu qui doit
 * rester ouvert le demandera explicitement.
 */
function DropdownMenuCheckboxItem({
  className,
  children,
  closeOnClick = true,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      closeOnClick={closeOnClick}
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm py-2 pr-2 pl-8',
        'text-[0.875rem] outline-none',
        'data-highlighted:bg-secondary data-highlighted:text-secondary-foreground',
        'data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-ring',
        'data-disabled:pointer-events-none data-disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="size-4 text-primary" />
        </DropdownMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

type DropdownMenuLabelProps = Omit<DropdownMenuPrimitive.GroupLabel.Props, 'className'> & {
  className?: string | undefined;
  inset?: boolean | undefined;
};

/**
 * Le libellé porte SON PROPRE `Menu.Group`, et ce n'est pas une coquetterie.
 *
 * `DropdownMenu.Label` de Radix était un simple `<div>` : on le posait où l'on
 * voulait. `Menu.GroupLabel` de Base UI exige un `Menu.Group` au-dessus de lui
 * et lève sinon « MenuGroupContext is missing » — une erreur d'EXÉCUTION, pas
 * de compilation. Les trois menus qui posaient un libellé (les deux exports
 * Excel et le menu du compte) plantaient donc à l'ouverture, écran blanc et
 * overlay d'erreur Next : aucun type, aucun test unitaire ne l'a vu, seuls les
 * parcours Playwright.
 *
 * Envelopper ici plutôt qu'à l'appel garde le libellé posable n'importe où,
 * comme avant. `DropdownMenuGroup` reste exporté pour grouper libellé ET items
 * quand le regroupement doit être annoncé.
 */
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

const DropdownMenuSub = DropdownMenuPrimitive.SubmenuRoot;

type DropdownMenuSubTriggerProps = Omit<DropdownMenuPrimitive.SubmenuTrigger.Props, 'className'> &
  NoOnSelect & {
    className?: string | undefined;
  };

function DropdownMenuSubTrigger({ className, children, ...props }: DropdownMenuSubTriggerProps) {
  return (
    <DropdownMenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={cn(
        'flex cursor-default select-none items-center rounded-sm px-2 py-2 text-[0.875rem] outline-none',
        'data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-ring',
        'data-highlighted:bg-secondary data-popup-open:bg-secondary',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubmenuTrigger>
  );
}

/**
 * Le sous-menu compose le `Content` public : `alignOffset={-3}` et
 * `sideOffset={0}` alignent visuellement le panneau enfant sur son parent.
 */
function DropdownMenuSubContent({ className, ...props }: DropdownMenuContentProps) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      align="start"
      alignOffset={-3}
      side="right"
      sideOffset={0}
      className={cn('min-w-[8rem]', className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
