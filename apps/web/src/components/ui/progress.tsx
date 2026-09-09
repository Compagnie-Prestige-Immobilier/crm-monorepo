'use client';

import { Progress as ProgressPrimitive } from '@base-ui/react/progress';

import { cn } from '@/lib/utils';

type ProgressProps = Omit<ProgressPrimitive.Root.Props, 'className'> & {
  className?: string | undefined;
};

function Progress({ className, ...props }: ProgressProps) {
  return (
    <ProgressPrimitive.Root data-slot="progress" className={cn('w-full', className)} {...props}>
      <ProgressPrimitive.Track className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <ProgressPrimitive.Indicator className="block h-full rounded-full bg-primary transition-[width] duration-200 ease-out" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
