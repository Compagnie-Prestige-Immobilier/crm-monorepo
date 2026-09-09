import type { UseQueryResult } from '@tanstack/react-query';
import { CheckIcon, UserPlusIcon, UserRoundIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ProspectBanque } from '@/lib/data/bank-cases';
import { formatPhone } from '@/lib/format';

export function ResultatsProspects({
  etat,
  onChoisir,
  onDemander,
}: {
  etat: UseQueryResult<ProspectBanque[]>;
  onChoisir: (prospect: ProspectBanque) => void;
  onDemander: () => void;
}) {
  if (etat.isPending) {
    return (
      <div className="flex flex-col gap-2 p-3" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (etat.isError) {
    return (
      <p className="p-4 text-[0.875rem] text-destructive">La recherche a échoué. Réessayez.</p>
    );
  }

  if (etat.data.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-[0.875rem]">
          <span className="font-[600]">Aucun client ne correspond.</span>
          <span className="mt-1 block text-muted-foreground">
            Si le client existe mais n’est pas encore en base, demandez sa création au siège. Elle
            vous reviendra approuvée, prête à recevoir ce dossier.
          </span>
        </p>
        <Button type="button" variant="outline" onClick={onDemander}>
          <UserPlusIcon aria-hidden="true" />
          Demander la création du client
        </Button>
      </div>
    );
  }

  return (
    <ul className="max-h-72 overflow-y-auto p-1 scrollbar-thin">
      {etat.data.map((prospect) => (
        <li key={prospect.id}>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            onClick={() => {
              onChoisir(prospect);
            }}
          >
            <UserRoundIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-[600]">{prospect.fullName}</span>
              <span className="block truncate text-[0.75rem] text-muted-foreground">
                {formatPhone(prospect.phoneE164)} · {prospect.banqueName}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ClientChoisi({
  prospect,
  onChanger,
}: {
  prospect: ProspectBanque;
  onChanger: () => void;
}) {
  return (
    <Card className="animate-rise border-primary/30">
      <CardContent className="flex items-start gap-3">
        <CheckIcon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-[600]">{prospect.fullName}</p>
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            {formatPhone(prospect.phoneE164)}
          </p>
          <p className="mt-1 text-[0.75rem] text-muted-foreground">
            Nom et téléphone sont copiés sur le dossier.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onChanger}>
          <XIcon aria-hidden="true" />
          Changer
        </Button>
      </CardContent>
    </Card>
  );
}
