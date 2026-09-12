'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber } from '@/lib/format';

export function Pagination({
  libelle,
  page,
  pageCount,
  pageSize,
  total,
  pageSizeOptions,
  onChange,
}: {
  libelle: string;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  pageSizeOptions: readonly number[];
  onChange: (patch: { page: number; pageSize?: number }) => void;
}) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[0.8125rem] text-muted-foreground" role="status">
        <span className="sr-only">{libelle}&nbsp;: </span>
        {total === 0
          ? 'Aucun résultat'
          : `${formatNumber(first)}–${formatNumber(last)} sur ${formatNumber(total)}`}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <span className="hidden sm:inline">Lignes</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              if (value === null) return;
              onChange({ pageSize: Number(value), page: 1 });
            }}
          >
            <SelectTrigger size="sm" className="w-20" aria-label="Lignes par page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Page précédente"
            disabled={page <= 1}
            onClick={() => {
              onChange({ page: page - 1 });
            }}
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Page suivante"
            disabled={page >= pageCount}
            onClick={() => {
              onChange({ page: page + 1 });
            }}
          >
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
