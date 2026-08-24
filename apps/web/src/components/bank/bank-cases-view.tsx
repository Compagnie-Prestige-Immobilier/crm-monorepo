'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, FolderOpenIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { BankExportMenu } from '@/components/bank/bank-export-menu';
import { BankFiltersBar } from '@/components/bank/bank-filters-bar';
import { StageBadge } from '@/components/bank/stage-badge';
import { useBankFilters } from '@/components/bank/use-bank-filters';
import { EmptyState } from '@/components/empty-state';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BANK_PAGE_SIZE_OPTIONS, countActiveBankFilters } from '@/lib/bank-filters';
import { fetchBankCases } from '@/lib/data/bank-cases';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { formatXof } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import { BANK_CASE_SORT_FIELDS, type BankCase, type BankCaseSortField } from '@/lib/types';
import { cn } from '@/lib/utils';

const SORTABLE: readonly { id: BankCaseSortField; label: string }[] = [
  { id: 'reference', label: 'Référence' },
  { id: 'customerName', label: 'Client' },
  { id: 'amountXof', label: 'Montant' },
  { id: 'updatedAt', label: 'Dernière mise à jour' },
];

function isSortField(id: string): id is BankCaseSortField {
  return (BANK_CASE_SORT_FIELDS as readonly string[]).includes(id);
}

export function BankCasesView() {
  const { filters, setFilters } = useBankFilters();
  const router = useRouter();

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.bankCases(filters),
    queryFn: () => fetchBankCases(filters),
    placeholderData: (previous) => previous,
  });

  function toggleSort(columnId: string): void {
    if (!isSortField(columnId)) return;
    if (filters.sortBy === columnId) {
      setFilters({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      setFilters({ sortBy: columnId, sortDir: 'asc' });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Dossiers bancaires ouverts sur des clients dont la méthode d’enrôlement est obtenue.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <BankExportMenu filters={filters} />
          {/* Un LIEN habillé en bouton : la primitive `Button` de Base UI
              poserait `role="button"` sur le `<a>`. */}
          <Link href="/chues/dossiers/nouveau" className={buttonVariants()}>
            <PlusIcon aria-hidden="true" />
            Nouveau dossier
          </Link>
        </div>
      </div>

      <BankFiltersBar />

      {isPending ? (
        <BankCasesSkeleton />
      ) : isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="La liste des dossiers n’a pas pu être chargée."
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title={
            countActiveBankFilters(filters) === 0
              ? 'Aucun dossier bancaire'
              : 'Aucun dossier ne correspond à ces filtres'
          }
          description={
            countActiveBankFilters(filters) === 0
              ? 'Ouvrez un dossier depuis « Nouveau dossier ».'
              : 'Élargissez la période ou retirez un critère.'
          }
          action={
            countActiveBankFilters(filters) === 0 ? (
              <Link href="/chues/dossiers/nouveau" className={buttonVariants()}>
                <PlusIcon aria-hidden="true" />
                Nouveau dossier
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          {/* ─── Cartes : sous 1024 px ────────────────────────────────── */}
          <ul className={cn('flex flex-col gap-3 lg:hidden', isFetching && 'opacity-80')}>
            {data.items.map((bankCase) => (
              <li key={bankCase.id}>
                <BankCaseCard bankCase={bankCase} />
              </li>
            ))}
          </ul>

          {/* ─── Tableau : à partir de 1024 px ────────────────────────── */}
          <div
            className={cn(
              'hidden overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity lg:block',
              isFetching && 'opacity-80',
            )}
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {SORTABLE.slice(0, 2).map((column) => (
                    <SortableTableHead
                      key={column.id}
                      column={column}
                      sortBy={filters.sortBy}
                      sortDir={filters.sortDir}
                      onToggle={toggleSort}
                    />
                  ))}
                  <TableHead>Banque</TableHead>
                  <TableHead>Étape</TableHead>
                  <SortableTableHead
                    column={SORTABLE[2] ?? { id: 'amountXof', label: 'Montant' }}
                    sortBy={filters.sortBy}
                    sortDir={filters.sortDir}
                    onToggle={toggleSort}
                  />
                  <TableHead>Dernier intervenant</TableHead>
                  <SortableTableHead
                    column={SORTABLE[3] ?? { id: 'updatedAt', label: 'Mise à jour' }}
                    sortBy={filters.sortBy}
                    sortDir={filters.sortDir}
                    onToggle={toggleSort}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((bankCase) => (
                  <TableRow
                    key={bankCase.id}
                    className="cursor-pointer focus-within:bg-muted/60"
                    onClick={(event) => {
                      if (isTextSelected() || !isPlainAreaClick(event.target)) return;
                      router.push(`/chues/dossiers/${bankCase.id}`);
                    }}
                  >
                    <TableCell>
                      <Link
                        href={`/chues/dossiers/${bankCase.id}`}
                        className="rounded-sm font-[600] tabular-nums hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {bankCase.reference}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate">{bankCase.customerName}</p>
                        <p className="truncate text-[0.75rem] text-muted-foreground tabular-nums">
                          {formatPhone(bankCase.customerPhoneE164)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="truncate">{bankCase.processingBankName}</span>
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={bankCase.currentStage} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {/* « : » et non « 0 FCFA » : un dossier en instruction n'a
                          AUCUN montant, ce qui n'est pas la même information
                          qu'un montant nul (celui d'un rejet). */}
                      {formatXof(bankCase.amountXof)}
                    </TableCell>
                    <TableCell>
                      <span className="truncate">
                        {bankCase.updatedByName ?? bankCase.createdByName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <time
                        dateTime={bankCase.updatedAt}
                        className="whitespace-nowrap tabular-nums"
                      >
                        {formatDateTime(bankCase.updatedAt)}
                      </time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.8125rem] text-muted-foreground" role="status">
              <span className="sr-only">Dossiers affichés&nbsp;: </span>
              {data.total === 0
                ? 'Aucun résultat'
                : `${formatNumber((data.page - 1) * filters.pageSize + 1)}–${formatNumber(
                    Math.min(data.page * filters.pageSize, data.total),
                  )} sur ${formatNumber(data.total)}`}
            </p>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                <span className="hidden sm:inline">Lignes</span>
                <Select
                  value={String(filters.pageSize)}
                  onValueChange={(value) => {
                    if (value === null) return;
                    setFilters({ pageSize: Number(value), page: 1 });
                  }}
                >
                  <SelectTrigger size="sm" className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_PAGE_SIZE_OPTIONS.map((size) => (
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
                  disabled={data.page <= 1}
                  onClick={() => {
                    setFilters({ page: data.page - 1 });
                  }}
                >
                  <ChevronLeftIcon className="size-4" aria-hidden="true" />
                </Button>
                <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
                  {data.page} / {data.pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Page suivante"
                  disabled={data.page >= data.pageCount}
                  onClick={() => {
                    setFilters({ page: data.page + 1 });
                  }}
                >
                  <ChevronRightIcon className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function isPlainAreaClick(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest('a, button, input, select, textarea, [role="button"]') === null;
}

function isTextSelected(): boolean {
  return (window.getSelection()?.toString() ?? '') !== '';
}

function BankCaseCard({ bankCase }: { bankCase: BankCase }) {
  const router = useRouter();

  return (
    <Card
      className="animate-rise cursor-pointer transition-shadow hover:shadow-elev-hover focus-within:shadow-elev-hover focus-within:ring-2 focus-within:ring-ring"
      onClick={(event) => {
        if (isTextSelected() || !isPlainAreaClick(event.target)) return;
        router.push(`/chues/dossiers/${bankCase.id}`);
      }}
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
            <Link
              href={`/chues/dossiers/${bankCase.id}`}
              className="rounded-sm tabular-nums hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {bankCase.reference}
            </Link>
          </h3>
          <StageBadge stage={bankCase.currentStage} />
        </div>

        <div>
          <p className="truncate font-[600]">{bankCase.customerName}</p>
          <p className="truncate text-[0.8125rem] text-muted-foreground tabular-nums">
            {formatPhone(bankCase.customerPhoneE164)}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[0.8125rem]">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Banque</dt>
            <dd className="truncate font-[600]">{bankCase.processingBankName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Montant</dt>
            <dd className="truncate font-[600] tabular-nums">{formatXof(bankCase.amountXof)}</dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="text-muted-foreground">Dernière intervention</dt>
            <dd className="truncate">
              {bankCase.updatedByName ?? bankCase.createdByName},{' '}
              <time dateTime={bankCase.updatedAt} className="tabular-nums">
                {formatDateTime(bankCase.updatedAt)}
              </time>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function BankCasesSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => index).map((index) => (
        <Card key={index}>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-72" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
