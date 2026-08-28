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
  let icon = <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />;
  if (active && sortDir === 'asc') icon = <ArrowUpIcon className="size-3.5" aria-hidden="true" />;
  if (active && sortDir === 'desc')
    icon = <ArrowDownIcon className="size-3.5" aria-hidden="true" />;
  let ariaSort: 'ascending' | 'descending' | 'none' = 'none';
  if (active) ariaSort = sortDir === 'asc' ? 'ascending' : 'descending';
  return (
    <TableHead className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => {
          onToggle(column.id);
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-inherit hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {column.label}
        {icon}
      </button>
    </TableHead>
  );
}
