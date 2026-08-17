'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

import { cn } from '@/lib/utils';

type TabsProps = Omit<TabsPrimitive.Root.Props, 'className'> & { className?: string | undefined };

function Tabs({ className, ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-4', className)}
      {...props}
    />
  );
}

type TabsListProps = Omit<TabsPrimitive.List.Props, 'className'> & {
  className?: string | undefined;
};

function TabsList({ className, activateOnFocus = true, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      activateOnFocus={activateOnFocus}
      className={cn(
        'inline-flex h-11 w-fit items-center justify-center rounded-md bg-secondary p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

type TabsTriggerProps = Omit<TabsPrimitive.Tab.Props, 'className'> & {
  className?: string | undefined;
};

function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-sm px-3',
        'text-[0.875rem] font-[600] whitespace-nowrap transition-colors',
        'data-active:bg-card data-active:text-foreground data-active:shadow-elev-xs',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'data-disabled:pointer-events-none data-disabled:opacity-40',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

type TabsContentProps = Omit<TabsPrimitive.Panel.Props, 'className'> & {
  className?: string | undefined;
};

function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        'flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
