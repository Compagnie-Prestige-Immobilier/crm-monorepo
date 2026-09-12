'use client';

import { useQuery } from '@tanstack/react-query';
import { FolderOpenIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { BankExportMenu } from '@/components/bank/bank-export-menu';
import { BankFiltersBar } from '@/components/bank/bank-filters-bar';
import { StageBadge } from '@/components/bank/stage-badge';
import { useBankFilters } from '@/components/bank/use-bank-filters';
import { EmptyState } from '@/components/empty-state';
import { LienTelephone } from '@/components/lien-telephone';
import { Pagination } from '@/components/pagination';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { BANK_PAGE_SIZE_OPTIONS, bankBasePath, countActiveBankFilters } from '@/lib/bank-filters';
import { fetchBankCases } from '@/lib/data/bank-cases';
import { formatDateTime } from '@/lib/format';
import { formatXof } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import {
  BANK_CASE_SORT_FIELDS,
  type BankCase,
  type BankCaseSortField,
  type Projet,
} from '@/lib/types';
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

export function BankCasesView({ projet }: { projet: Projet }) {
  const { filters, setFilters, resetFilters } = useBankFilters(projet);
  const router = useRouter();
  const base = bankBasePath(projet);

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
          Dossiers bancaires ouverts depuis les dossiers validés sur la plateforme.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <BankExportMenu filters={filters} />
          {/* Un LIEN habillé en bouton : la primitive `Button` de Base UI
              poserait `role="button"` sur le `<a>`. */}
          <Link href={`${base}/dossiers/nouveau`} className={buttonVariants()}>
            <PlusIcon aria-hidden="true" />À ouvrir (plateforme)
          </Link>
        </div>
      </div>

      <BankFiltersBar />

      {(() => {
        if (isPending) return <BankCasesSkeleton />;
        return (() => {
          if (isError)
            return (
              <QueryErrorState
                error={error}
                onRetry={() => {
                  void refetch();
                }}
                fallback="La liste des dossiers n’a pas pu être chargée."
              />
            );
          return (() => {
            if (data.items.length === 0)
              return (
                <EmptyState
                  icon={FolderOpenIcon}
                  title={
                    countActiveBankFilters(filters) === 0
                      ? 'Aucun dossier bancaire'
                      : 'Aucun dossier ne correspond à ces filtres'
                  }
                  description={
                    countActiveBankFilters(filters) === 0
                      ? 'Ouvrez un dossier depuis « À ouvrir (plateforme) ».'
                      : 'Élargissez la période ou retirez un critère.'
                  }
                  action={
                    countActiveBankFilters(filters) === 0 ? (
                      <Link href={`${base}/dossiers/nouveau`} className={buttonVariants()}>
                        <PlusIcon aria-hidden="true" />À ouvrir (plateforme)
                      </Link>
                    ) : (
                      <Button variant="outline" onClick={resetFilters}>
                        <RotateCcwIcon aria-hidden="true" />
                        Effacer les filtres
                      </Button>
                    )
                  }
                />
              );
            return (
              <>
                {/* ─── Cartes : sous 1024 px ────────────────────────────────── */}
                <ul className={cn('flex flex-col gap-3 lg:hidden', isFetching && 'opacity-80')}>
                  {data.items.map((bankCase) => (
                    <li key={bankCase.id}>
                      <BankCaseCard bankCase={bankCase} base={base} />
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
                            router.push(`${base}/dossiers/${bankCase.id}`);
                          }}
                        >
                          <TableCell>
                            <Link
                              href={`${base}/dossiers/${bankCase.id}`}
                              className="rounded-sm font-[600] tabular-nums hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              {bankCase.reference}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate">{bankCase.customerName}</p>
                              <p className="truncate text-[0.75rem] text-muted-foreground tabular-nums">
                                <LienTelephone phoneE164={bankCase.customerPhoneE164} />
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

                <Pagination
                  libelle="Dossiers affichés"
                  page={data.page}
                  pageCount={data.pageCount}
                  pageSize={filters.pageSize}
                  total={data.total}
                  pageSizeOptions={BANK_PAGE_SIZE_OPTIONS}
                  onChange={setFilters}
                />
              </>
            );
          })();
        })();
      })()}
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

function BankCaseCard({ bankCase, base }: { bankCase: BankCase; base: string }) {
  const router = useRouter();

  return (
    <Card
      className="animate-rise cursor-pointer transition-shadow hover:shadow-elev-hover focus-within:shadow-elev-hover focus-within:ring-2 focus-within:ring-ring"
      onClick={(event) => {
        if (isTextSelected() || !isPlainAreaClick(event.target)) return;
        router.push(`${base}/dossiers/${bankCase.id}`);
      }}
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
            <Link
              href={`${base}/dossiers/${bankCase.id}`}
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
            <LienTelephone phoneE164={bankCase.customerPhoneE164} />
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
