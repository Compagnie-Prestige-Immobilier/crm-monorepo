'use client';

import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const Sheet = SheetPrimitive.Root;

type SheetTriggerProps = Omit<SheetPrimitive.Trigger.Props, 'className'> & {
  className?: string | undefined;
};

function SheetTrigger(props: SheetTriggerProps) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

type SheetContentProps = Omit<SheetPrimitive.Popup.Props, 'className'> & {
  className?: string | undefined;
  side?: 'top' | 'right' | 'bottom' | 'left' | undefined;
  /** false : pas de voile ni de blocage de clics, pour un panneau non modal posé sur la page active. */
  voile?: boolean;
};

function SheetContent({
  className,
  children,
  side = 'right',
  voile = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      {voile ? (
        <SheetPrimitive.Backdrop
          data-slot="sheet-overlay"
          className={cn(
            'fixed inset-0 z-50 bg-scrim',
            'data-open:animate-in data-open:fade-in-0',
            'data-closed:animate-out data-closed:fade-out-0',
          )}
        />
      ) : null}
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          'fixed z-50 flex flex-col gap-0 bg-card shadow-elev-xl transition ease-in-out',
          'data-open:animate-in data-open:duration-300',
          'data-closed:animate-out data-closed:duration-200',
          side === 'right' &&
            'inset-y-0 right-0 h-full w-3/4 border-l border-border sm:max-w-sm data-closed:slide-out-to-right data-open:slide-in-from-right',
          side === 'left' &&
            'inset-y-0 left-0 h-full w-[17rem] border-r border-border data-closed:slide-out-to-left data-open:slide-in-from-left',
          side === 'top' &&
            'inset-x-0 top-0 h-auto border-b border-border data-closed:slide-out-to-top data-open:slide-in-from-top',
          side === 'bottom' &&
            'inset-x-0 bottom-0 h-auto border-t border-border data-closed:slide-out-to-bottom data-open:slide-in-from-bottom',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className={cn(
            'absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-md',
            'text-current opacity-70 transition-opacity hover:opacity-100',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
          )}
        >
          <XIcon className="size-4" />
          <span className="sr-only">Fermer</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="sheet-header" className={cn('flex flex-col gap-1 p-4', className)} {...props} />
  );
}

type SheetTitleProps = Omit<SheetPrimitive.Title.Props, 'className'> & {
  className?: string | undefined;
};

function SheetTitle({ className, ...props }: SheetTitleProps) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-display text-[1.0625rem] font-[700] tracking-[-0.02em]', className)}
      {...props}
    />
  );
}

type SheetDescriptionProps = Omit<SheetPrimitive.Description.Props, 'className'> & {
  className?: string | undefined;
};

function SheetDescription({ className, ...props }: SheetDescriptionProps) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-[0.8125rem] opacity-80', className)}
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };
