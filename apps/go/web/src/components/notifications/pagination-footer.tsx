import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';

export function PaginationFooter({
  page,
  pageCount,
  total,
  label,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  label: (count: number) => string;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[0.8125rem] text-muted-foreground" role="status">
        {label(total)}
      </p>
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
          {page} / {Math.max(1, pageCount)}
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
  );
}

export function formatCountLabel(total: number, word: string): string {
  return `${formatNumber(total)} ${word}${total > 1 ? 's' : ''}`;
}
