import { ChevronDownIcon, ChevronUpIcon, LockIcon, PencilIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { EtapeBadge } from '@/components/banque/pieces';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EtapeBanque } from '@/lib/data/bank-cases';

function motifDeVerrou(etape: EtapeBanque): string | null {
  if (etape.isSystem) return 'Étape système : sa désactivation casserait le flux.';
  if (etape.isInitial) return 'Étape initiale : tout nouveau dossier y entre.';
  return null;
}

export function ActionsEtape({
  etape,
  monter,
  descendre,
  occupe,
  onDeplacer,
  onRenommer,
  onBasculer,
}: {
  etape: EtapeBanque;
  monter: boolean;
  descendre: boolean;
  occupe: boolean;
  onDeplacer: (sens: -1 | 1) => void;
  onRenommer: () => void;
  onBasculer: () => void;
}) {
  const verrou = motifDeVerrou(etape);

  return (
    <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Monter « ${etape.label} »`}
        disabled={!monter || occupe}
        onClick={() => {
          onDeplacer(-1);
        }}
      >
        <ChevronUpIcon className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Descendre « ${etape.label} »`}
        disabled={!descendre || occupe}
        onClick={() => {
          onDeplacer(1);
        }}
      >
        <ChevronDownIcon className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Renommer « ${etape.label} »`}
        onClick={onRenommer}
      >
        <PencilIcon className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant={etape.isActive ? 'ghost' : 'secondary'}
        size="sm"
        disabled={verrou !== null || occupe}
        onClick={onBasculer}
      >
        {etape.isActive ? 'Désactiver' : 'Réactiver'}
      </Button>
      {verrou === null ? null : (
        <span className="basis-full text-[0.75rem] leading-tight text-muted-foreground sm:basis-auto sm:max-w-56">
          {verrou}
        </span>
      )}
    </div>
  );
}

/**
 * `basis-full` sur la colonne du libellé : en `flex-1` seul, elle ne déclenchait
 * pas le retour à la ligne et passait sous le groupe d'actions en petite largeur.
 */
export function LigneEtape({
  etape,
  rang,
  children,
}: {
  etape: EtapeBanque;
  rang: number;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="flex min-w-0 basis-full items-center gap-3 lg:basis-auto lg:flex-1">
        <span className="w-6 shrink-0 text-[0.8125rem] text-muted-foreground">{rang}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <EtapeBadge etape={etape} />
            {etape.isInitial ? <Badge variant="outline">Étape initiale</Badge> : null}
            {etape.isSystem ? (
              <Badge variant="secondary" className="gap-1">
                <LockIcon aria-hidden="true" />
                Système
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[0.75rem] text-muted-foreground">Code {etape.code}</p>
        </div>
      </div>
      {children}
    </li>
  );
}
