import { ChevronDownIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PastilleFiltre<K extends string> {
  key: K;
  champ: string;
  valeur: string;
}

export function AdvancedPanel<K extends string>({
  pastilles,
  onRetirer,
  onToutRetirer,
  actions,
  children,
}: {
  pastilles: readonly PastilleFiltre<K>[];
  onRetirer: (key: K) => void;
  onToutRetirer: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const panneauId = useId();
  const compte = pastilles.length;
  const [ouvert, setOuvert] = useState(compte > 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-expanded={ouvert}
          aria-controls={panneauId}
          onClick={() => {
            setOuvert((courant) => !courant);
          }}
        >
          <SlidersHorizontalIcon aria-hidden="true" />
          Filtres avancés
          {/* Le compte porte sur les critères REPLIÉS : les seuls qu'on ne voit pas. */}
          {compte > 0 ? (
            <Badge variant="default" className="ml-1 tabular-nums">
              {compte}
              <span className="sr-only">
                {' '}
                critère{compte > 1 ? 's' : ''} replié{compte > 1 ? 's' : ''}
              </span>
            </Badge>
          ) : null}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn('transition-transform', ouvert && 'rotate-180')}
          />
        </Button>

        {actions}
      </div>

      {/* Panneau fermé seulement : ouvert, chaque champ porte déjà sa valeur. */}
      {ouvert || compte === 0 ? null : (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-[0.75rem] text-muted-foreground">Filtres avancés actifs</span>
          {pastilles.map((pastille) => (
            <button
              key={pastille.key}
              type="button"
              aria-label={`Retirer le filtre ${pastille.champ} : ${pastille.valeur}`}
              onClick={() => {
                onRetirer(pastille.key);
              }}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary py-1 pr-1.5 pl-2.5 text-[0.75rem] text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="truncate">
                <span className="text-muted-foreground">{pastille.champ} : </span>
                <span className="font-[600]">{pastille.valeur}</span>
              </span>
              <XIcon className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={onToutRetirer}>
            Tout retirer
          </Button>
        </div>
      )}

      <div id={panneauId} hidden={!ouvert}>
        {ouvert ? children : null}
      </div>
    </>
  );
}
