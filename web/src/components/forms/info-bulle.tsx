'use client';

import { InfoIcon } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Le « i » à côté d'un réglage : ce qu'il fait, en une phrase, au clic. */
export function InfoBulle({ sujet, texte }: { sujet: string; texte: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Aide : ${sujet}`}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <InfoIcon className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 px-3 py-2 text-[0.8125rem] leading-snug">
        {texte}
      </PopoverContent>
    </Popover>
  );
}
