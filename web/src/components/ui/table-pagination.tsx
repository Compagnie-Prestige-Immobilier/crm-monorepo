'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS } from '@/lib/filters';

/** Toute liste locale reçoit une borne explicite : jamais de rendu sans plafond. */
export function usePaginationLocale<T>(lignes: readonly T[], pageSizeInitial = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(pageSizeInitial);

  const pageCount = Math.max(1, Math.ceil(lignes.length / pageSize));
  const pageActuelle = Math.min(page, pageCount);

  const page_lignes = useMemo(
    () => lignes.slice((pageActuelle - 1) * pageSize, pageActuelle * pageSize),
    [lignes, pageActuelle, pageSize],
  );

  return {
    pageLignes: page_lignes,
    page: pageActuelle,
    pageCount,
    pageSize,
    setPage,
    setPageSize: (taille: number) => {
      setPageSizeState(taille);
      setPage(1);
    },
  };
}

export function TablePaginationLocale({
  page,
  pageCount,
  pageSize,
  setPage,
  setPageSize,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}) {
  if (pageCount <= 1 && pageSize >= PAGE_SIZE_OPTIONS[0]) return null;

  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3">
      <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <span className="hidden sm:inline">Lignes</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            if (value === null) return;
            setPageSize(Number(value));
          }}
        >
          <SelectTrigger size="sm" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
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
            setPage(page - 1);
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
            setPage(page + 1);
          }}
        >
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
