'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * `Dialog.Root` de Base UI ne rend aucun élément : il n'accepte donc ni
 * `className` ni `data-slot`. Ses props sont génériques (`<Payload>`), ce qui
 * casse le motif `ComponentProps` habituel : on ré-exporte la primitive telle
 * quelle plutôt que de l'envelopper.
 */
const Dialog = DialogPrimitive.Root;

type DialogTriggerProps = Omit<DialogPrimitive.Trigger.Props, 'className'> & {
  className?: string | undefined;
};

function DialogTrigger(props: DialogTriggerProps) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal {...props} />;
}

type DialogCloseProps = Omit<DialogPrimitive.Close.Props, 'className'> & {
  className?: string | undefined;
};

function DialogClose(props: DialogCloseProps) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

type DialogOverlayProps = Omit<DialogPrimitive.Backdrop.Props, 'className'> & {
  className?: string | undefined;
};

/**
 * `Overlay` de Radix s'appelle `Backdrop` chez Base UI. Le fondu ne passe plus
 * par des keyframes `animate-in` / `animate-out` mais par une transition entre
 * les styles d'entrée (`data-starting-style`) et de sortie
 * (`data-ending-style`).
 */
function DialogOverlay({ className, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-scrim backdrop-blur-[2px]',
        'transition-opacity duration-200',
        'data-starting-style:opacity-0 data-ending-style:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

type DialogContentProps = Omit<DialogPrimitive.Popup.Props, 'className'> & {
  className?: string | undefined;
  showCloseButton?: boolean | undefined;
};

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
          'gap-4 rounded-lg border border-border bg-card p-6 shadow-elev-xl sm:max-w-lg',
          'transition-[opacity,transform] duration-200',
          'data-starting-style:opacity-0 data-starting-style:scale-95',
          'data-ending-style:opacity-0 data-ending-style:scale-95',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              'absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-md',
              'text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Fermer</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5 text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

type DialogTitleProps = Omit<DialogPrimitive.Title.Props, 'className'> & {
  className?: string | undefined;
};

function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('font-display text-[1.25rem] font-[700] tracking-[-0.02em]', className)}
      {...props}
    />
  );
}

type DialogDescriptionProps = Omit<DialogPrimitive.Description.Props, 'className'> & {
  className?: string | undefined;
};

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-[0.875rem] text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
