'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  LoaderIcon,
  UploadIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useFileDownload } from '@/components/exports/download-button';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { useLive } from '@/components/live/use-live';
import { QueryErrorInline, QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { RechercheTableau, useTriLocal } from '@/components/ui/tri-local';
import {
  applyVisitesImportJob,
  buildVisitesExportUrl,
  createVisitesImportJob,
  fetchVisitesImportJob,
  fetchVisitesImportRevue,
  setVisitesImportSelection,
  visitesExportFileName,
  VISITES_IMPORT_MAX_BYTES,
  type VisitesExportFilters,
  type VisitesImportChange,
  type VisitesImportJob,
} from '@/lib/data/visites-import';
import {
  fetchVisiteReferentiels,
  VISITE_COLONNES,
  type VisiteReferentiels,
} from '@/lib/data/visites';
import { formatDateTime, formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { FilterOption } from '@/lib/types';
import { cn } from '@/lib/utils';

const ACCEPTED = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const EMPTY_FILTERS: VisitesExportFilters = {
  from: null,
  to: null,
  entrepriseId: null,
  directionId: null,
  destinataireId: null,
  objetId: null,
  search: '',
};

function isRunning(job: VisitesImportJob | undefined): boolean {
  return job?.status === 'queued' || job?.status === 'running';
}

function options(items: { id: string; label: string }[] | undefined): FilterOption[] {
  return (items ?? []).map((item) => ({ value: item.id, label: item.label }));
}

function optionsReferentiel<K extends keyof VisiteReferentiels>(
  data: VisiteReferentiels | undefined,
  key: K,
): FilterOption[] {
  return options(data?.[key]);
}

/** Créations et corrections seules composent la revue : les lignes inchangées n'y figurent pas. */
function totalDiffs(job: VisitesImportJob): number {
  return job.createdRows + job.updatedRows;
}

function pluriel(n: number): string {
  return n > 1 ? 's' : '';
}

function classeurIdentique(job: VisitesImportJob, diffs: number): boolean {
  return job.status === 'succeeded' && job.mode === 'DRY_RUN' && diffs === 0;
}

function aDesErreurs(
  job: VisitesImportJob,
): job is VisitesImportJob & { report: NonNullable<VisitesImportJob['report']> } {
  return job.report !== null && job.report.errors.length > 0;
}

interface Rapport {
  id: string | undefined;
  pret: boolean;
  created: number;
  updated: number;
}

function rapportDe(job: VisitesImportJob | undefined): Rapport {
  return {
    id: job?.id,
    pret: job?.status === 'succeeded' && job.mode === 'DRY_RUN',
    created: job?.createdRows ?? 0,
    updated: job?.updatedRows ?? 0,
  };
}

/** La péremption du rapport se relit à chaque appel : elle tombe sans geste. */
function peutAppliquer(
  job: VisitesImportJob | undefined,
  selection: { created: number; updated: number },
): boolean {
  if (job === undefined || job.status !== 'succeeded' || job.mode !== 'DRY_RUN') return false;
  if (new Date(job.expiresAt).getTime() <= Date.now()) return false;
  return selection.created + selection.updated > 0;
}

function diffsDe(job: VisitesImportJob | undefined): number {
  return job === undefined ? 0 : totalDiffs(job);
}

function estEnRevue(
  job: VisitesImportJob | undefined,
  rapportPret: boolean,
  diffs: number,
): boolean {
  return job !== undefined && rapportPret && diffs > 0;
}

function ErreurJobInline({
  jobQuery,
  job,
}: {
  jobQuery: { isError: boolean; error: unknown; refetch: () => unknown };
  job: VisitesImportJob | undefined;
}) {
  if (!jobQuery.isError || job !== undefined) return null;
  return (
    <QueryErrorInline
      error={jobQuery.error}
      onRetry={() => {
        void jobQuery.refetch();
      }}
      fallback="Ce travail d’import n’a pas pu être relu."
    />
  );
}

function AnalysePanelSiPresent({
  job,
  onReset,
}: {
  job: VisitesImportJob | undefined;
  onReset: () => void;
}) {
  if (job === undefined) return null;
  return <AnalysePanel job={job} onReset={onReset} />;
}

export function RegistreImportView() {
  const queryClient = useQueryClient();
  const live = useLive({ topic: 'imports' });
  const template = useFileDownload();
  const inputId = useId();
  const duId = useId();
  const auId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<VisitesExportFilters>(EMPTY_FILTERS);
  const [dragging, setDragging] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [selection, setSelection] = useState({ created: 0, updated: 0 });

  const referentiels = useQuery({
    queryKey: queryKeys.visiteReferentielsRoot,
    queryFn: () => fetchVisiteReferentiels(),
    staleTime: 5 * 60_000,
  });

  const jobIdKey = jobId ?? '';

  const jobQuery = useQuery({
    queryKey: queryKeys.visitesImport(jobIdKey),
    queryFn: () => fetchVisitesImportJob(jobIdKey),
    enabled: jobId !== null,
    refetchInterval: (query) => (isRunning(query.state.data) ? live.refetchInterval(query) : false),
  });

  const job = jobQuery.data;
  const diffs = diffsDe(job);
  const {
    id: rapportId,
    pret: rapportPret,
    created: rapportCreated,
    updated: rapportUpdated,
  } = rapportDe(job);
  const enReview = estEnRevue(job, rapportPret, diffs);

  // La sélection démarre calée sur le rapport : le serveur pré-coche tout à la détection.
  useEffect(() => {
    if (rapportId === undefined || !rapportPret) return;
    // oxlint-disable-next-line react/set-state-in-effect -- sélection calée sur le rapport serveur
    setSelection({ created: rapportCreated, updated: rapportUpdated });
  }, [rapportId, rapportPret, rapportCreated, rapportUpdated]);

  const revueQuery = useQuery({
    queryKey: queryKeys.visitesImportRevue(jobIdKey, page),
    queryFn: () => fetchVisitesImportRevue(jobIdKey, page),
    enabled: jobId !== null && enReview,
    placeholderData: keepPreviousData,
  });

  const invalidatedFor = useRef<string | null>(null);
  useEffect(() => {
    if (job === undefined || job.status !== 'succeeded' || job.mode !== 'APPLY') return;
    if (invalidatedFor.current === job.id) return;
    invalidatedFor.current = job.id;
    void queryClient.invalidateQueries({ queryKey: ['visites'] });
  }, [job, queryClient]);

  const deposit = useMutation({
    mutationFn: (file: File) => createVisitesImportJob(file),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKeys.visitesImport(created.id), created);
      setJobId(created.id);
      setPage(1);
    },
    onError: (error) => {
      toastApiError(error, 'Le classeur n’a pas pu être déposé.');
    },
  });

  const toggle = useMutation({
    mutationFn: (input: { change: VisitesImportChange; selected: boolean }) =>
      setVisitesImportSelection(jobId ?? '', [input.change.id], input.selected),
    onMutate: (input) => {
      queryClient.setQueryData(
        queryKeys.visitesImportRevue(jobId ?? '', page),
        (current: Awaited<ReturnType<typeof fetchVisitesImportRevue>> | undefined) => {
          if (current === undefined) return current;
          return {
            ...current,
            items: current.items.map((item) =>
              item.id === input.change.id ? { ...item, selected: input.selected } : item,
            ),
          };
        },
      );
      const delta = input.selected ? 1 : -1;
      setSelection((prev) =>
        input.change.kind === 'CREATE'
          ? { ...prev, created: prev.created + delta }
          : { ...prev, updated: prev.updated + delta },
      );
    },
    onError: (error, input) => {
      queryClient.setQueryData(
        queryKeys.visitesImportRevue(jobId ?? '', page),
        (current: Awaited<ReturnType<typeof fetchVisitesImportRevue>> | undefined) => {
          if (current === undefined) return current;
          return {
            ...current,
            items: current.items.map((item) =>
              item.id === input.change.id ? { ...item, selected: !input.selected } : item,
            ),
          };
        },
      );
      const delta = input.selected ? -1 : 1;
      setSelection((prev) =>
        input.change.kind === 'CREATE'
          ? { ...prev, created: prev.created + delta }
          : { ...prev, updated: prev.updated + delta },
      );
      toastApiError(error, 'La sélection n’a pas pu être enregistrée.');
    },
  });

  const selectAll = useMutation({
    mutationFn: async (selected: boolean) => {
      if (job === undefined || diffs === 0) return;
      // Une seule page couvrant tout : `SetVisiteImportChangeSelectionDto` exige des identifiants
      // explicites, il n'existe pas de raccourci « tout » côté serveur.
      const all = await fetchVisitesImportRevue(job.id, 1, undefined, diffs);
      await setVisitesImportSelection(
        job.id,
        all.items.map((item) => item.id),
        selected,
      );
    },
    onSuccess: (_data, selected) => {
      if (job === undefined) return;
      setSelection(
        selected
          ? { created: job.createdRows, updated: job.updatedRows }
          : { created: 0, updated: 0 },
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.visitesImportRevue(job.id, page) });
    },
    onError: (error) => {
      toastApiError(error, 'La sélection n’a pas pu être enregistrée.');
    },
  });

  const apply = useMutation({
    mutationFn: (id: string) => applyVisitesImportJob(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.visitesImport(updated.id), updated);
      setConfirming(false);
      toast.success('Application lancée. L’écran suit son avancement.');
    },
    onError: (error) => {
      setConfirming(false);
      toastApiError(error, 'L’import n’a pas pu être appliqué.');
    },
  });

  function accept(candidate: File | null): void {
    if (candidate === null) return;
    if (candidate.size > VISITES_IMPORT_MAX_BYTES) {
      toast.error('Fichier trop volumineux : 25 Mo au maximum.');
      return;
    }
    deposit.mutate(candidate);
  }

  const canApply = peutAppliquer(job, selection);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-[1.0625rem]">1. Exporter le registre</CardTitle>
          <CardDescription>
            Travaillez dans le classeur téléchargé, puis redéposez-le : le serveur détecte les
            différences ligne par ligne avant d’écrire quoi que ce soit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DatePicker
              id={duId}
              label="Du"
              value={filters.from}
              max={filters.to}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, from: value }));
              }}
            />
            <DatePicker
              id={auId}
              label="Au"
              value={filters.to}
              min={filters.from}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, to: value }));
              }}
            />
            <SearchField
              value={filters.search}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, search: value }));
              }}
              placeholder="Nom ou n° de registre…"
            />
            <FilterCombobox
              label={VISITE_COLONNES.entreprise}
              placeholder="Toutes"
              options={optionsReferentiel(referentiels.data, 'entreprises')}
              value={filters.entrepriseId}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, entrepriseId: value }));
              }}
            />
            <FilterCombobox
              label={VISITE_COLONNES.direction}
              placeholder="Toutes"
              options={optionsReferentiel(referentiels.data, 'directions')}
              value={filters.directionId}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, directionId: value }));
              }}
            />
            <FilterCombobox
              label={VISITE_COLONNES.destinataire}
              placeholder="Tous"
              options={optionsReferentiel(referentiels.data, 'destinataires')}
              value={filters.destinataireId}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, destinataireId: value }));
              }}
            />
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              disabled={template.pending}
              onClick={() => {
                void template.download({
                  url: buildVisitesExportUrl(filters),
                  fileName: visitesExportFileName(),
                  failureMessage: 'Le registre n’a pas pu être exporté.',
                });
              }}
            >
              {template.pending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <DownloadIcon aria-hidden="true" />
              )}
              Exporter le registre filtré
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[1.0625rem]">2. Déposer le classeur corrigé</CardTitle>
          <CardDescription>
            Le fichier est d’abord simulé. Rien n’est écrit tant que vous n’avez pas revu et
            confirmé l’application.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Zone de dépôt doublée d'un champ de fichier réel : le glisser-déposer
              n'est pas atteignable au clavier. */}
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- input de fichier associé */}
          <label
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => {
              setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              accept(event.dataTransfer.files.item(0));
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center',
              'transition-colors duration-(--dur-1) ease-(--ease-out-cpi)',
              'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
              dragging ? 'border-primary bg-secondary' : 'border-border hover:bg-secondary/50',
            )}
          >
            <UploadIcon className="size-7 text-muted-foreground" aria-hidden="true" />
            <span className="text-[0.9375rem] font-[600]">
              Glissez le classeur ici, ou choisissez un fichier
            </span>
            <span className="text-[0.8125rem] text-muted-foreground">
              Format .xlsx, 25 Mo au maximum.
            </span>
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              disabled={deposit.isPending}
              onChange={(event) => {
                accept(event.target.files?.item(0) ?? null);
                // Vidé pour que redéposer le même fichier corrigé émette bien un
                // nouvel évènement `change`.
                event.target.value = '';
              }}
            />
          </label>

          {deposit.isPending ? (
            <p role="status" className="flex items-center gap-2 text-[0.875rem]">
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              Envoi du classeur…
            </p>
          ) : null}
        </CardContent>
      </Card>

      <ErreurJobInline jobQuery={jobQuery} job={job} />

      <AnalysePanelSiPresent
        job={job}
        onReset={() => {
          setJobId(null);
          setPage(1);
          inputRef.current?.focus();
        }}
      />

      <RevuePanelSiActif
        enReview={enReview}
        job={job}
        onPageChange={setPage}
        revueQuery={revueQuery}
        selection={selection}
        onToggle={(change, selected) => {
          toggle.mutate({ change, selected });
        }}
        onSelectAll={(selected) => {
          selectAll.mutate(selected);
        }}
        selectAllPending={selectAll.isPending}
        canApply={canApply}
        onApply={() => {
          setConfirming(true);
        }}
      />

      <ApplyDialog
        job={confirming && job !== undefined ? job : null}
        selection={selection}
        pending={apply.isPending}
        onOpenChange={(open) => {
          if (!open && apply.isPending) return;
          setConfirming(open);
        }}
        onConfirm={() => {
          if (job !== undefined) apply.mutate(job.id);
        }}
      />
    </div>
  );
}

function EtatAnalyse({ job, running }: { job: VisitesImportJob; running: boolean }) {
  if (running) {
    return (
      <>
        <LoaderIcon className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        Lecture du fichier…
      </>
    );
  }

  if (job.status === 'failed') {
    return (
      <>
        <AlertTriangleIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        {job.failureMsg ?? 'Le travail a échoué.'}
      </>
    );
  }

  if (job.status === 'expired') {
    return (
      <>
        <AlertTriangleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        Échéance passée : redéposez le fichier pour recommencer.
      </>
    );
  }

  return (
    <>
      <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden="true" />
      Analyse terminée
      {job.finishedAt === null ? '' : `, le ${formatDateTime(job.finishedAt)}`}.
    </>
  );
}

function AnalysePanel({ job, onReset }: { job: VisitesImportJob; onReset: () => void }) {
  const running = isRunning(job);
  const applied = job.status === 'succeeded' && job.mode === 'APPLY';
  const diffs = totalDiffs(job);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-[1.0625rem]">
          <FileSpreadsheetIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-all">{job.fileName}</span>
          {job.mode === 'DRY_RUN' ? <Badge variant="outline">Simulation</Badge> : null}
        </CardTitle>
        <CardDescription>3. Analyse · déposé le {formatDateTime(job.createdAt)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p role="status" className="flex items-center gap-2 text-[0.9375rem] tabular-nums">
          <EtatAnalyse job={job} running={running} />
        </p>

        {running ? null : (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="À créer" value={job.createdRows} color="text-success" />
            <Figure label="À corriger" value={job.updatedRows} color="text-success" />
            <Figure label="Inchangées" value={job.skippedRows} color="text-muted-foreground" />
            <Figure label="Refusées" value={job.errorRows} color="text-destructive" />
          </dl>
        )}

        {classeurIdentique(job, diffs) ? (
          <p role="status" className="text-[0.875rem] text-muted-foreground">
            Votre classeur est identique au registre. Rien à appliquer.
          </p>
        ) : null}

        {applied ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-md border border-border bg-secondary p-4"
          >
            <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0 text-[0.875rem]">
              <p className="font-[600]">
                {formatNumber(job.createdRows)} visite{pluriel(job.createdRows)} créée
                {pluriel(job.createdRows)}, {formatNumber(job.updatedRows)} corrigée
                {pluriel(job.updatedRows)}.
              </p>
            </div>
          </div>
        ) : null}

        {aDesErreurs(job) ? <RapportErreurs report={job.report} /> : null}

        {running ? null : (
          <div>
            <Button type="button" variant="ghost" onClick={onReset}>
              Déposer un autre fichier
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ErreurImportVisites = NonNullable<VisitesImportJob['report']>['errors'][number];

const COLONNES_ERREURS_VISITES = {
  ligne: (erreur: ErreurImportVisites) => erreur.rowNumber,
  colonne: (erreur: ErreurImportVisites) => erreur.column,
  motif: (erreur: ErreurImportVisites) => erreur.message,
};

const ENTETES_ERREURS_VISITES = [
  { id: 'ligne', label: 'Ligne', className: 'w-24' },
  { id: 'colonne', label: 'Colonne', className: 'w-56' },
  { id: 'motif', label: 'Motif' },
] as const;

function RapportErreurs({ report }: { report: NonNullable<VisitesImportJob['report']> }) {
  const pluriel = report.errorRows > 1 ? 's' : '';
  const tri = useTriLocal(report.errors, COLONNES_ERREURS_VISITES);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-[0.9375rem] font-[600]">
        <AlertTriangleIcon className="size-4 text-destructive" aria-hidden="true" />
        Lignes refusées
      </h3>
      <p className="text-[0.8125rem] text-muted-foreground">
        {formatNumber(report.errorRows)} ligne{pluriel} refusée{pluriel}
        {report.truncated
          ? `, ${formatNumber(report.maxReportedErrors)} premières affichées.`
          : '.'}{' '}
        Le numéro est celui de la ligne dans le classeur, en-tête compris.
      </p>
      <RechercheTableau
        recherche={tri.recherche}
        setRecherche={tri.setRecherche}
        total={tri.total}
        affichees={tri.lignes.length}
      />
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {ENTETES_ERREURS_VISITES.map((colonne) => (
                <SortableTableHead
                  key={colonne.id}
                  column={colonne}
                  className={'className' in colonne ? colonne.className : undefined}
                  sortBy={tri.sortBy}
                  sortDir={tri.sortDir}
                  onToggle={tri.toggle}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.errors.length > 0 && tri.lignes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Aucune ligne refusée ne correspond à la recherche.
                </TableCell>
              </TableRow>
            ) : null}
            {tri.lignes.map((error, index) => (
              <TableRow key={`${String(error.rowNumber)}-${error.code}-${String(index)}`}>
                <TableCell className="tabular-nums">{error.rowNumber}</TableCell>
                <TableCell className="text-muted-foreground">{error.column ?? '–'}</TableCell>
                <TableCell>{error.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Figure({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <dt className="text-[0.75rem] font-[600] text-muted-foreground">{label}</dt>
      <dd className={cn('text-[1.5rem] font-[700] tabular-nums', color)}>{formatNumber(value)}</dd>
    </div>
  );
}

function RevuePanel({
  job,
  onPageChange,
  revueQuery,
  selection,
  onToggle,
  onSelectAll,
  selectAllPending,
  canApply,
  onApply,
}: {
  job: VisitesImportJob;
  onPageChange: (page: number) => void;
  revueQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof fetchVisitesImportRevue>>>>;
  selection: { created: number; updated: number };
  onToggle: (change: VisitesImportChange, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  selectAllPending: boolean;
  canApply: boolean;
  onApply: () => void;
}) {
  const data = revueQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[1.0625rem]">4. Revue</CardTitle>
        <CardDescription>
          {formatNumber(totalDiffs(job))} différence{totalDiffs(job) > 1 ? 's' : ''} ·{' '}
          {formatNumber(job.updatedRows)} correction{job.updatedRows > 1 ? 's' : ''} ·{' '}
          {formatNumber(job.createdRows)} création{job.createdRows > 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-0">
        <div className="flex flex-wrap items-center gap-2 px-5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectAllPending}
            onClick={() => {
              onSelectAll(true);
            }}
          >
            Tout cocher
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectAllPending}
            onClick={() => {
              onSelectAll(false);
            }}
          >
            Tout décocher
          </Button>
        </div>

        {(() => {
          if (revueQuery.isError)
            return (
              <div className="px-5">
                <QueryErrorState
                  error={revueQuery.error}
                  onRetry={() => {
                    void revueQuery.refetch();
                  }}
                  fallback="La revue n’a pas pu être chargée."
                  className="items-center gap-3 border-destructive/30 px-6 py-12 text-center"
                />
              </div>
            );
          return (() => {
            if (data === undefined)
              return (
                <div className="flex flex-col gap-2 px-5">
                  {[0, 1, 2].map((row) => (
                    <Skeleton key={row} className="h-16 w-full" />
                  ))}
                </div>
              );
            return (
              <>
                <ul className="flex flex-col divide-y divide-border">
                  {data.items.map((change) => (
                    <ChangeRow
                      key={change.id}
                      change={change}
                      onToggle={(selected) => {
                        onToggle(change, selected);
                      }}
                    />
                  ))}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
                  <p className="text-[0.8125rem] text-muted-foreground" role="status">
                    {formatNumber(data.total)} différence{data.total > 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Page précédente"
                      disabled={data.page <= 1}
                      onClick={() => {
                        onPageChange(data.page - 1);
                      }}
                    >
                      <ChevronLeftIcon className="size-4" aria-hidden="true" />
                    </Button>
                    <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
                      {data.page} / {Math.max(1, data.pageCount)}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Page suivante"
                      disabled={data.page >= data.pageCount}
                      onClick={() => {
                        onPageChange(data.page + 1);
                      }}
                    >
                      <ChevronRightIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </>
            );
          })();
        })()}

        <div className="border-t border-border px-5 py-4">
          <Button type="button" disabled={!canApply} onClick={onApply}>
            {applyLabel(selection)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RevuePanelSiActif({
  enReview,
  job,
  ...reste
}: {
  enReview: boolean;
  job: VisitesImportJob | undefined;
} & Omit<Parameters<typeof RevuePanel>[0], 'job'>) {
  if (!enReview || job === undefined) return null;
  return <RevuePanel job={job} {...reste} />;
}

function applyLabel(selection: { created: number; updated: number }): string {
  if (selection.created === 0 && selection.updated === 0) return 'Rien à appliquer';
  const parts: string[] = [];
  if (selection.updated > 0) {
    parts.push(`${formatNumber(selection.updated)} correction${selection.updated > 1 ? 's' : ''}`);
  }
  if (selection.created > 0) {
    parts.push(`${formatNumber(selection.created)} création${selection.created > 1 ? 's' : ''}`);
  }
  return `Appliquer ${parts.join(' et ')}`;
}

function ChangeRow({
  change,
  onToggle,
}: {
  change: VisitesImportChange;
  onToggle: (selected: boolean) => void;
}) {
  const checkboxId = useId();

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <input
        id={checkboxId}
        type="checkbox"
        className="mt-1 size-4"
        checked={change.selected}
        onChange={(event) => {
          onToggle(event.target.checked);
        }}
      />
      <label htmlFor={checkboxId} className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
          <span className="font-[600]">{change.label}</span>
          <Badge variant={change.kind === 'CREATE' ? 'success' : 'info'}>
            {change.kind === 'CREATE' ? 'Création' : 'Correction'}
          </Badge>
          {change.kind === 'CREATE' ? (
            <span className="text-[0.8125rem] text-muted-foreground">ligne {change.rowNumber}</span>
          ) : null}
        </span>
        {change.kind === 'UPDATE'
          ? change.fields.map((field) => (
              <span key={field.field} className="text-[0.8125rem] text-muted-foreground">
                {field.label} : « {field.before} » → « {field.after} »
              </span>
            ))
          : null}
      </label>
    </li>
  );
}

function ResumeSelection({ selection }: { selection: { created: number; updated: number } }) {
  const pluralCreees = selection.created > 1 ? 's' : '';

  return (
    <>
      {selection.created > 0 ? (
        <>
          <span className="font-display text-[1.5rem] font-[800] tabular-nums">
            {formatNumber(selection.created)}
          </span>{' '}
          visite{pluralCreees} créée{pluralCreees}
          {selection.updated > 0 ? ' et ' : ''}
        </>
      ) : null}
      {selection.updated > 0 ? (
        <>
          <span className="font-display text-[1.5rem] font-[800] tabular-nums">
            {formatNumber(selection.updated)}
          </span>{' '}
          corrigée{selection.updated > 1 ? 's' : ''}
        </>
      ) : null}
    </>
  );
}

function ApplyDialog({
  job,
  selection,
  pending,
  onOpenChange,
  onConfirm,
}: {
  job: VisitesImportJob | null;
  selection: { created: number; updated: number };
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={job !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {job === null ? null : (
          <>
            <DialogHeader>
              <DialogTitle>{applyLabel(selection)} ?</DialogTitle>
              <DialogDescription>
                Cette action écrit les visites cochées en base et ne s’annule pas.
              </DialogDescription>
            </DialogHeader>

            <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem]">
              <ResumeSelection selection={selection} /> à partir de « {job.fileName} ».
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Annuler
              </Button>
              <Button type="button" disabled={pending} onClick={onConfirm}>
                {pending ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                {applyLabel(selection)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
