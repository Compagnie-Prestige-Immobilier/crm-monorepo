import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { TableHead } from '@/components/ui/table';

export interface TriColonne<F extends string> {
  column: { id: F; label: ReactNode };
  sortBy: F | null;
  sortDir: 'asc' | 'desc';
  onToggle: (id: string) => void;
}

export function ariaSortDe<F extends string>(
  tri: TriColonne<F>,
): 'ascending' | 'descending' | 'none' {
  if (tri.sortBy !== tri.column.id) return 'none';
  return tri.sortDir === 'asc' ? 'ascending' : 'descending';
}

export function BoutonTri<F extends string>({ column, sortBy, sortDir, onToggle }: TriColonne<F>) {
  const active = sortBy === column.id;
  let icon = <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />;
  if (active && sortDir === 'asc') icon = <ArrowUpIcon className="size-3.5" aria-hidden="true" />;
  if (active && sortDir === 'desc')
    icon = <ArrowDownIcon className="size-3.5" aria-hidden="true" />;
  return (
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
  );
}

export function SortableTableHead<F extends string>({
  column,
  sortBy,
  sortDir,
  onToggle,
  className,
}: TriColonne<F> & { className?: string | undefined }) {
  return (
    <TableHead className={className} aria-sort={ariaSortDe({ column, sortBy, sortDir, onToggle })}>
      <BoutonTri column={column} sortBy={sortBy} sortDir={sortDir} onToggle={onToggle} />
    </TableHead>
  );
}
