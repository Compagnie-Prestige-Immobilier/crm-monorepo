import {
  ArrowLeftRightIcon,
  CombineIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Prospect } from '@/lib/data/prospects';

export interface ActionsProspect {
  onModifier: (prospect: Prospect) => void;
  onFusionner: (prospect: Prospect) => void;
  onReaffecter: (prospect: Prospect) => void;
  onSupprimer: (prospect: Prospect) => void;
}

export function MenuActions({
  prospect,
  peutAdministrer,
  actions,
}: {
  prospect: Prospect;
  peutAdministrer: boolean;
  actions: ActionsProspect;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions pour ${prospect.prenom} ${prospect.nom}`}
          />
        }
      >
        <MoreHorizontalIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => {
            actions.onModifier(prospect);
          }}
        >
          <PencilIcon aria-hidden="true" />
          Modifier
        </DropdownMenuItem>
        {peutAdministrer ? (
          <>
            <DropdownMenuItem
              onClick={() => {
                actions.onReaffecter(prospect);
              }}
            >
              <ArrowLeftRightIcon aria-hidden="true" />
              Réaffecter
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                actions.onFusionner(prospect);
              }}
            >
              <CombineIcon aria-hidden="true" />
              Fusionner un doublon…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                actions.onSupprimer(prospect);
              }}
            >
              <Trash2Icon aria-hidden="true" />
              Supprimer
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
