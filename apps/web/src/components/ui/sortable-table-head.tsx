import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { TableHead } from '@/components/ui/table';

export function SortableTableHead<F extends string>({
  column,
  sortBy,
  sortDir,
  onToggle,
  className,
}: {
  column: { id: F; label: ReactNode };
  sortBy: F;
  sortDir: 'asc' | 'desc';
  onToggle: (id: string) => void;
  className?: string | undefined;
}) {
  const active = sortBy === column.id;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => {
          onToggle(column.id);
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-inherit hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {column.label}
        {active ? (
          sortDir === 'asc' ? (
            <ArrowUpIcon className="size-3.5" aria-hidden="true" />
          ) : (
            <ArrowDownIcon className="size-3.5" aria-hidden="true" />
          )
        ) : (
          <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        )}
      </button>
    </TableHead>
  );
}
