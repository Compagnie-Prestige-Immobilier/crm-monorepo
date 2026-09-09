import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';

function bornesDePage(
  total: number,
  page: number,
  pageSize: number,
): { premier: number; dernier: number } {
  return {
    premier: total === 0 ? 0 : (page - 1) * pageSize + 1,
    dernier: Math.min(page * pageSize, total),
  };
}

/**
 * L'intitulé est DONNÉ EN TEXTE (`sr-only`) : `aria-label` est interdit sur un
 * `<p>` (rôle `paragraph`, liste « name prohibited » d'ARIA 1.2), et là où un
 * lecteur d'écran l'honore, le nom REMPLACE le décompte annoncé.
 */
export function PiedDeListe({
  quoi,
  total,
  page,
  pageCount,
  pageSize,
  complement,
  actions,
  onPage,
}: {
  quoi: string;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  /** Ce que la sélection compte en plus, quand l'écran le dit. */
  complement?: string | null | undefined;
  actions?: ReactNode;
  onPage: (page: number) => void;
}) {
  const { premier, dernier } = bornesDePage(total, page, pageSize);
  const base =
    total === 0
      ? 'Aucun résultat'
      : `${formatNumber(premier)}–${formatNumber(dernier)} sur ${formatNumber(total)}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[0.8125rem] text-muted-foreground" role="status">
        <span className="sr-only">{quoi}&nbsp;: </span>
        {complement === null || complement === undefined || total === 0
          ? base
          : `${base}, ${complement}`}
      </p>

      <div className="flex items-center gap-3">
        {actions}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Page précédente"
            disabled={page <= 1}
            onClick={() => {
              onPage(page - 1);
            }}
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
            {page} / {Math.max(pageCount, 1)}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Page suivante"
            disabled={page >= pageCount}
            onClick={() => {
              onPage(page + 1);
            }}
          >
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SqueletteTableau({ lignes = 7 }: { lignes?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
      <div className="flex h-11 items-center gap-4 border-b border-border px-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="h-3 flex-1 animate-pulse rounded-sm bg-muted" />
        ))}
      </div>
      {Array.from({ length: lignes }, (_, index) => index).map((index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-3 py-4">
          {[0, 1, 2, 3, 4, 5].map((cellule) => (
            <div key={cellule} className="h-4 flex-1 animate-pulse rounded-sm bg-muted" />
          ))}
        </div>
      ))}
    </div>
  );
}
