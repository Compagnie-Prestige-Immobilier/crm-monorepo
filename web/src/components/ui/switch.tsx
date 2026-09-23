import { Switch as SwitchPrimitive } from '@base-ui/react/switch';

import { cn } from '@/lib/utils';

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent',
        'transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'data-[checked]:bg-primary data-[unchecked]:bg-input',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow-xs',
          'transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'data-[checked]:translate-x-4 data-[unchecked]:translate-x-0.5',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
