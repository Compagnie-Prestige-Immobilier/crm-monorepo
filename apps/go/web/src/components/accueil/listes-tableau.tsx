import { InboxIcon, PencilIcon, PowerIcon, PowerOffIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { libelle, type ReferentielItem } from '@/lib/data/referentiels';
import { cn } from '@/lib/utils';

export function ListeVide({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center shadow-elev-sm">
      <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-[600]">{message}</p>
    </div>
  );
}

function LigneListe({
  entree,
  basculePending,
  onModifier,
  onBasculer,
}: {
  entree: ReferentielItem;
  basculePending: boolean;
  onModifier: () => void;
  onBasculer: () => void;
}) {
  const retiree = entree.isActive === false;
  const nom = libelle(entree);

  return (
    <TableRow className={retiree ? 'bg-muted/50' : undefined}>
      <TableCell className={cn('font-[600]', retiree && 'text-muted-foreground')}>{nom}</TableCell>
      <TableCell className="text-muted-foreground">{entree.code}</TableCell>
      <TableCell>
        <Badge variant={retiree ? 'outline' : 'success'}>{retiree ? 'Retirée' : 'Proposée'}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Modifier ${nom}`}
            onClick={onModifier}
          >
            <PencilIcon className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={basculePending}
            aria-label={retiree ? `Proposer de nouveau ${nom}` : `Retirer ${nom} de la saisie`}
            onClick={onBasculer}
          >
            {retiree ? (
              <PowerIcon className="size-4" aria-hidden="true" />
            ) : (
              <PowerOffIcon className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ListesTableau({
  entrees,
  basculePending,
  onModifier,
  onBasculer,
}: {
  entrees: readonly ReferentielItem[];
  basculePending: boolean;
  onModifier: (entree: ReferentielItem) => void;
  onBasculer: (entree: ReferentielItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Libellé</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>État</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entrees.map((entree) => (
            <LigneListe
              key={entree.id}
              entree={entree}
              basculePending={basculePending}
              onModifier={() => {
                onModifier(entree);
              }}
              onBasculer={() => {
                onBasculer(entree);
              }}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
