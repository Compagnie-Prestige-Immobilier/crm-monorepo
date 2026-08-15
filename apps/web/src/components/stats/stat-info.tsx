'use client';

import { InfoIcon } from 'lucide-react';
import { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { explain, type StatKey } from '@/lib/stat-explanations';

/**
 * La bulle « i » d'une statistique.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Elle s'ouvre au SURVOL et au CLIC. Les deux, et pas l'un ou l'autre.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Au survol seul, l'information est inatteignable au tactile et au clavier :
 * sur une tablette, la bulle n'existe tout simplement pas. Au clic seul, il
 * faut deviner qu'il y a quelque chose à cliquer, puis refermer chaque bulle
 * après lecture : sur une page qui en compte quinze, personne ne le fait.
 *
 * La combinaison demande une seule précaution, et c'est tout l'objet du code
 * ci-dessous : une bulle ouverte au CLIC ne doit pas se refermer quand la
 * souris s'éloigne. Sans `pinned`, l'utilisateur qui clique pour figer la bulle
 * la voit disparaître dès qu'il bouge d'un pixel : le comportement est vécu
 * comme un défaut, et il l'est.
 *
 * Le focus clavier ouvre également : `Tab` jusqu'à l'icône suffit, sans avoir à
 * valider.
 */
export function StatInfo({ stat, label }: { stat: StatKey; label: string }) {
  const [hovered, setHovered] = useState(false);
  /** Ouverte par un clic ou par `Entrée` : elle reste jusqu'à fermeture. */
  const [pinned, setPinned] = useState(false);

  return (
    <Popover open={pinned || hovered} onOpenChange={setPinned}>
      <PopoverTrigger
        // `type="button"` : sans lui, l'icône placée dans un formulaire de
        // filtres en déclencherait la soumission.
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
        // Le contenu ne prend pas le focus à l'ouverture : au survol, voler le
        // focus déplacerait le curseur du clavier à chaque passage de souris.
        onOpenAutoFocus={(event) => {
          if (!pinned) event.preventDefault();
        }}
      >
        {explain(stat)}
      </PopoverContent>
    </Popover>
  );
}
