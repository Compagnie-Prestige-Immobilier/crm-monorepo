import { Slider as SliderPrimitive } from '@base-ui/react/slider';

import { cn } from '@/lib/utils';

function Slider({ className, ...props }: SliderPrimitive.Root.Props<number>) {
  return (
    <SliderPrimitive.Root className={cn('w-full touch-none select-none', className)} {...props}>
      <SliderPrimitive.Control className="flex h-6 w-full items-center">
        <SliderPrimitive.Track className="h-1.5 w-full rounded-full bg-muted">
          <SliderPrimitive.Indicator className="rounded-full bg-primary" />
          <SliderPrimitive.Thumb className="size-5 rounded-full border-2 border-primary bg-background shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[disabled]:opacity-50" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
