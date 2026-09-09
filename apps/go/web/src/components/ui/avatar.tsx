import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';

import { cn } from '@/lib/utils';

type AvatarProps = Omit<AvatarPrimitive.Root.Props, 'className'> & {
  className?: string | undefined;
};

function Avatar({ className, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  );
}

type AvatarFallbackProps = Omit<AvatarPrimitive.Fallback.Props, 'className'> & {
  className?: string | undefined;
};

function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-secondary',
        'text-[0.75rem] font-[600] text-secondary-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback };
