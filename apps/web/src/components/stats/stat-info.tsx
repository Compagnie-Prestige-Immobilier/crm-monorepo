'use client';

import { InfoIcon } from 'lucide-react';
import { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { explain, type StatKey } from '@/lib/stat-explanations';

export function StatInfo({ stat, label }: { stat: StatKey; label: string }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  return (
    <Popover open={pinned || hovered} onOpenChange={setPinned}>
      <PopoverTrigger
        type="button"
        aria-label={`À propos de ${label}`}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-1) ease-(--ease-out-cpi) hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onMouseEnter={() => {
          setHovered(true);
        }}
        onMouseLeave={() => {
          setHovered(false);
        }}
        onFocus={() => {
          setHovered(true);
        }}
        onBlur={() => {
          setHovered(false);
        }}
      >
        <InfoIcon className="size-4" aria-hidden="true" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 p-3 text-[0.8125rem] leading-[1.55]"
        initialFocus={pinned}
      >
        {explain(stat)}
      </PopoverContent>
    </Popover>
  );
}
