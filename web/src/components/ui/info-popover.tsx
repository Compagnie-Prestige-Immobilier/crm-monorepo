'use client';

import { InfoIcon } from 'lucide-react';
import { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function InfoPopover({ label, description }: { label: string; description: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label={`À propos de ${label}`}
        aria-expanded={open}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors duration-(--dur-1) ease-(--ease-out-cpi) hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <InfoIcon className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-80 p-3">
        <div className="flex flex-col gap-1">
          <p className="text-[0.8125rem] font-[700] text-foreground">{label}</p>
          <p className="whitespace-pre-line text-[0.8125rem] leading-[1.55] text-muted-foreground">
            {description}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
