'use client';

import { InfoPopover } from '@/components/ui/info-popover';

/** Le « i » à côté d'un réglage : ce qu'il fait, en une phrase, au clic. */
export function InfoBulle({ sujet, texte }: { sujet: string; texte: string }) {
  return <InfoPopover label={sujet} description={texte} />;
}
