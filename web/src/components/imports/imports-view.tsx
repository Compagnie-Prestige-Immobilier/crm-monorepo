'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  HistoryIcon,
  LoaderIcon,
  UploadIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { useFileDownload } from '@/components/exports/download-button';
import { csvRows, downloadCsv } from '@/lib/csv';
import { useLive } from '@/components/live/use-live';
import { QueryErrorInline } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RattraperFeuilles } from '@/components/imports/rattraper-feuilles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  applyImportJob,
  createImportJob,
  fetchImportJob,
  fetchImportJobs,
  IMPORT_KIND_LABELS,
  IMPORT_MAX_ROWS,
  IMPORT_TEMPLATES,
  UPLOADABLE_IMPORT_KINDS,
  type ImportJob,
  type ImportJobReport,
  type ImportKind,
  type UploadableImportKind,
} from '@/lib/data/imports';
import { formatDateTime, formatNumber } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

/** Aligné sur `IMPORTS_MAX_BYTES` de l'API : refuser ici évite un 413. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const ACCEPTED = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** `items` est obligatoire sur le Select Base UI, sinon la gâchette montre la valeur brute. */
const KIND_OPTIONS: readonly { value: UploadableImportKind; label: string }[] =
  UPLOADABLE_IMPORT_KINDS.map((value) => ({ value, label: IMPORT_KIND_LABELS[value] }));

const IMPORT_HINTS: Readonly<Record<ImportKind, string>> = {
  PROSPECTS_GRAND_PUBLIC:
    'Classeur des leads marketing (SharePoint, adhésions en ligne, pub Meta/TikTok). Lit tous les onglets (Feuille 1, etc.), adapte les colonnes (Nom complet, Email, Provenance, Téléphone) et route automatiquement chaque prospect vers CHUES ou Grand Public.',
  PROSPECTS:
    'Fiches prospects terrain rattachées aux représentants. Lit tous les onglets du fichier et croise banques, syndicats et représentants.',
  REPRESENTANTS:
    'Département et IEF se choisissent dans les listes déroulantes du modèle, tirées des référentiels du jour.',
  VISITES: 'Seuls les onglets « BDD VISITES » sont lus, avec l’en-tête en ligne 3.',
  // Jamais choisi ici : le dépôt du registre part de l'écran d'accueil, pas de cette liste.
  VISITES_REGISTRE: 'Aller-retour du registre des visites, déposé depuis l’écran d’accueil.',
};

/** « Grand Public » ne prend pas la marque du pluriel : elle ne peut pas être ajoutée au vol. */
const IMPORT_NOUNS: Readonly<
  Record<ImportKind, { readonly un: string; readonly plusieurs: string }>
> = {
  PROSPECTS: { un: 'prospect', plusieurs: 'prospects' },
  PROSPECTS_GRAND_PUBLIC: {
    un: 'prospect Grand Public',
    plusieurs: 'prospects Grand Public',
  },
  REPRESENTANTS: { un: 'représentant', plusieurs: 'représentants' },
  VISITES: { un: 'visite', plusieurs: 'visites' },
  VISITES_REGISTRE: { un: 'visite', plusieurs: 'visites' },
};

/** Seul l'aller-retour du registre des visites réécrit des lignes : ailleurs `updatedRows` reste à 0. */
const totalWriteRows = (job: ImportJob): number => job.createdRows + job.updatedRows;

const FEMININE_KINDS: readonly ImportKind[] = ['VISITES', 'VISITES_REGISTRE'];

const nounFor = (job: ImportJob): string =>
  totalWriteRows(job) > 1 ? IMPORT_NOUNS[job.kind].plusieurs : IMPORT_NOUNS[job.kind].un;

const createdPast = (job: ImportJob): string =>
  `créé${FEMININE_KINDS.includes(job.kind) ? 'e' : ''}${totalWriteRows(job) > 1 ? 's' : ''}`;

function isRunning(job: ImportJob | undefined): boolean {
  return job?.status === 'queued' || job?.status === 'running';
}

function statusLabel(job: ImportJob): string {
  if (job.status === 'queued') return 'En file d’attente';
  if (job.status === 'running') {
    return job.mode === 'APPLY' ? 'Application en cours' : 'Simulation en cours';
  }
  if (job.status === 'succeeded') {
    return job.mode === 'APPLY' ? 'Appliqué' : 'Simulation terminée';
  }
  if (job.status === 'failed') return 'Échec';
  return 'Échu';
}

/** `expired` prend la teinte neutre : le classeur a passé son échéance, rien n'a échoué. */
function statusTone(job: ImportJob): 'default' | 'secondary' | 'success' | 'destructive' {
  if (job.status === 'succeeded') return 'success';
  if (job.status === 'failed') return 'destructive';
  if (job.status === 'expired') return 'secondary';
  return 'default';
}

/*
 * L'avancement se lit en lignes. `totalRows` est nul tant que le serveur n'a pas lu
 * l'en-tête, et peut le rester : `<dimension>` est facultatif dans le format xlsx. Un
 * pourcentage calculé dessus afficherait 0 % sur un import sain, puis sauterait.
 */
function progressLabel(job: ImportJob): string {
  if (job.totalRows === null) {
    return job.status === 'queued'
      ? 'En file d’attente. Le travail démarre dans quelques secondes.'
      : 'Lecture du fichier…';
  }
  return `${formatNumber(job.processedRows)} / ${formatNumber(job.totalRows)} lignes traitées`;
}

/** Mêmes conditions que `ImportsService.apply`, pour ne pas proposer un geste qui finirait en 409. */
function canApply(job: ImportJob, now = new Date()): boolean {
  if (job.status !== 'succeeded' || job.mode !== 'DRY_RUN') return false;
  if (new Date(job.expiresAt).getTime() <= now.getTime()) return false;
  return totalWriteRows(job) > 0;
}

/** Le bouton porte le chiffre : « Appliquer » ne se relit pas, « Créer 12 480 prospects » si. */
function applyLabel(job: ImportJob): string {
  if (job.updatedRows === 0) return `Créer ${formatNumber(job.createdRows)} ${nounFor(job)}`;
  const parts: string[] = [];
  if (job.createdRows > 0) {
    parts.push(`${formatNumber(job.createdRows)} création${job.createdRows > 1 ? 's' : ''}`);
  }
  parts.push(`${formatNumber(job.updatedRows)} correction${job.updatedRows > 1 ? 's' : ''}`);
  return `Appliquer ${parts.join(' et ')}`;
}

function createdVerb(job: ImportJob): string {
  return `${totalWriteRows(job) > 1 ? 'seront' : 'sera'} ${createdPast(job)}`;
}

/** `errorRows` reste exact, `errors` est bornée : la troncature doit se dire. */
function errorsCaption(report: ImportJobReport): string {
  const plural = report.errorRows > 1 ? 's' : '';
  if (!report.truncated) {
    return `${formatNumber(report.errorRows)} ligne${plural} refusée${plural}.`;
  }
  return `${formatNumber(report.maxReportedErrors)} premières erreurs sur ${formatNumber(
    report.errorRows,
  )}. Corrigez celles-ci et redéposez le fichier : les suivantes apparaîtront.`;
}

function UploadCard({
  kind,
  onKindChange,
  inputRef,
  pending,
  templatePending,
  onDownloadTemplate,
  onFile,
}: {
  kind: UploadableImportKind;
  onKindChange: (next: UploadableImportKind) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  pending: boolean;
  templatePending: boolean;
  onDownloadTemplate: (
    template: NonNullable<(typeof IMPORT_TEMPLATES)[UploadableImportKind]>,
  ) => void;
  onFile: (candidate: File | null) => void;
}) {
  const inputId = useId();
  const selectId = useId();
  const [dragging, setDragging] = useState(false);
  const selectedTemplate = IMPORT_TEMPLATES[kind];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[1.0625rem]">Déposer un classeur</CardTitle>
        <CardDescription>
          Le fichier est d’abord simulé. Rien n’est écrit tant que vous n’avez pas confirmé
          l’application.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-56 flex-col gap-1.5">
            <Label htmlFor={selectId}>Entité à importer</Label>
            <Select
              items={KIND_OPTIONS}
              value={kind}
              onValueChange={(next) => {
                // Base UI rend `value | null` : un `null` remet à vide, et
                // l'écran n'a pas d'état « aucune entité ».
                if (next !== null) onKindChange(next);
              }}
            >
              <SelectTrigger id={selectId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate === undefined ? null : (
            <Button
              type="button"
              variant="outline"
              disabled={templatePending}
              onClick={() => {
                onDownloadTemplate(selectedTemplate);
              }}
            >
              {templatePending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <DownloadIcon aria-hidden="true" />
              )}
              Télécharger le modèle
            </Button>
          )}
        </div>

        <p className="text-[0.8125rem] text-muted-foreground">
          {IMPORT_HINTS[kind]} {formatNumber(IMPORT_MAX_ROWS[kind])} lignes au maximum.
        </p>

        {/* Le champ de fichier double la zone de dépôt : le glisser-déposer
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
            onFile(event.dataTransfer.files.item(0));
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
            disabled={pending}
            onChange={(event) => {
              onFile(event.target.files?.item(0) ?? null);
              // Vidé pour que redéposer le même fichier corrigé émette bien un
              // nouvel évènement `change`.
              event.target.value = '';
            }}
          />
        </label>

        {pending ? (
          <p role="status" className="flex items-center gap-2 text-[0.875rem]">
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Envoi du classeur…
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ImportsView({ initialKind = 'PROSPECTS' }: { initialKind?: UploadableImportKind }) {
  const queryClient = useQueryClient();
  const live = useLive({ topic: 'imports' });
  const inputRef = useRef<HTMLInputElement>(null);
  const template = useFileDownload();

  const [kind, setKind] = useState<UploadableImportKind>(initialKind);
  const [jobId, setJobId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const jobQuery = useQuery({
    queryKey: queryKeys.importJob(jobId ?? ''),
    queryFn: () => fetchImportJob(jobId ?? ''),
    enabled: jobId !== null,
    // Le sondage s'arrête sur un état terminal ; `useLive` l'arrête aussi quand
    // l'onglet passe en arrière-plan.
    refetchInterval: (query) => (isRunning(query.state.data) ? live.refetchInterval(query) : false),
  });

  const job = jobQuery.data;

  // Les listes ne sont invalidées qu'une fois l'écriture faite : au clic sur
  // « Appliquer », aucune fiche n'existe encore.
  const invalidatedFor = useRef<string | null>(null);
  useEffect(() => {
    if (job === undefined || job.status !== 'succeeded' || job.mode !== 'APPLY') return;
    if (invalidatedFor.current === job.id) return;
    invalidatedFor.current = job.id;
    if (job.kind === 'VISITES' || job.kind === 'VISITES_REGISTRE') {
      void queryClient.invalidateQueries({ queryKey: ['visites'] });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
  }, [job, queryClient]);

  const deposit = useMutation({
    mutationFn: (input: { kind: Exclude<ImportKind, 'VISITES_REGISTRE'>; file: File }) =>
      createImportJob(input.kind, input.file),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKeys.importJob(created.id), created);
      setJobId(created.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.importsRoot });
    },
    onError: (error) => {
      toastApiError(error, 'Le classeur n’a pas pu être déposé.');
    },
  });

  const apply = useMutation({
    mutationFn: (id: string) => applyImportJob(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.importJob(updated.id), updated);
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.importsRoot });
      toast.success('Application lancée. L’écran suit son avancement.');
    },
    onError: (error) => {
      setConfirming(false);
      toastApiError(error, 'L’import n’a pas pu être appliqué.');
    },
  });

  function accept(candidate: File | null): void {
    if (candidate === null) return;
    if (!candidate.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Seul un classeur Excel (.xlsx) est accepté.');
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      toast.error('Fichier trop volumineux : 25 Mo au maximum.');
      return;
    }
    deposit.mutate({ kind, file: candidate });
  }

  return (
    <div className="flex flex-col gap-6">
      <UploadCard
        kind={kind}
        onKindChange={setKind}
        inputRef={inputRef}
        pending={deposit.isPending}
        templatePending={template.pending}
        onDownloadTemplate={(selected) => {
          void template.download({
            url: selected.url,
            fileName: selected.fileName,
            failureMessage: 'Le modèle n’a pas pu être généré.',
          });
        }}
        onFile={accept}
      />

      {jobQuery.isError && job === undefined ? (
        <QueryErrorInline
          error={jobQuery.error}
          onRetry={() => {
            void jobQuery.refetch();
          }}
          fallback="Ce travail d’import n’a pas pu être relu."
        />
      ) : null}

      {job === undefined ? null : (
        <JobPanel
          job={job}
          applying={apply.isPending}
          onApply={() => {
            setConfirming(true);
          }}
          onReset={() => {
            setJobId(null);
            inputRef.current?.focus();
          }}
        />
      )}

      {/* RATTRAPAGE PONCTUEL, à retirer avec `rattraper-feuilles.tsx`. */}
      <RattraperFeuilles />

      {/* L'historique se consulte APRÈS coup, et rarement : replié, il laisse
          l'écran à son seul geste, déposer un classeur. */}
      <details>
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-[0.9375rem] font-[600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <HistoryIcon className="size-4 shrink-0" aria-hidden="true" />
          Imports précédents
        </summary>
        <div className="pt-3">
          <History
            selectedId={jobId}
            onOpen={(opened) => {
              queryClient.setQueryData(queryKeys.importJob(opened.id), opened);
              setJobId(opened.id);
              requestAnimationFrame(() => {
                document
                  .getElementById(ANCRE_TRAVAIL)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              });
              void fetchImportJob(opened.id).then(telechargerLignesRefusees, () => {
                toast.error('Le rapport de cet import n’a pas pu être relu.');
              });
            }}
          />
        </div>
      </details>

      <ApplyDialog
        job={confirming && job !== undefined ? job : null}
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

function JobPanel({
  job,
  applying,
  onApply,
  onReset,
}: {
  job: ImportJob;
  applying: boolean;
  onApply: () => void;
  onReset: () => void;
}) {
  const running = isRunning(job);

  return (
    <div id={ANCRE_TRAVAIL} className="flex scroll-mt-20 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-[1.0625rem]">
            <FileSpreadsheetIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-all">{job.fileName}</span>
            <Badge variant={statusTone(job)}>{statusLabel(job)}</Badge>
            {job.mode === 'DRY_RUN' ? <Badge variant="outline">Simulation</Badge> : null}
          </CardTitle>
          <CardDescription>
            {IMPORT_KIND_LABELS[job.kind]} · déposé le {formatDateTime(job.createdAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <JobProgress job={job} running={running} />
          <Figures job={job} />
        </CardContent>
      </Card>

      <AppliedBanner job={job} />
      <ErrorsCard job={job} />
      <JobActions
        job={job}
        applying={applying}
        running={running}
        onApply={onApply}
        onReset={onReset}
      />
    </div>
  );
}

function JobProgress({ job, running }: { job: ImportJob; running: boolean }) {
  return (
    <>
      {/* `role="status"` : l'avancement change sans geste de l'utilisateur. */}
      <p role="status" className="flex items-center gap-2 text-[0.9375rem] tabular-nums">
        {running ? (
          <>
            <LoaderIcon className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            {progressLabel(job)}
          </>
        ) : (
          <TerminalState job={job} />
        )}
      </p>

      {running ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          Vous pouvez quitter cet écran : le travail court sur le serveur et se retrouve dans
          l’historique.
        </p>
      ) : null}
    </>
  );
}

function AppliedBanner({ job }: { job: ImportJob }) {
  if (job.status !== 'succeeded' || job.mode !== 'APPLY') return null;
  const registre = job.kind === 'VISITES' || job.kind === 'VISITES_REGISTRE';

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-border bg-secondary p-4"
    >
      <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
      <div className="min-w-0 text-[0.875rem]">
        <p className="font-[600]">
          {formatNumber(totalWriteRows(job))} {nounFor(job)} {createdPast(job)}.
        </p>
        <p className="mt-1 text-muted-foreground">
          Corrigez les lignes refusées dans le classeur et redéposez-le :{' '}
          {registre
            ? 'les visites déjà au registre seront de nouveau ignorées'
            : `les ${IMPORT_NOUNS[job.kind].plusieurs} déjà en base seront de nouveau ignorés`}
          , sans doublon.
        </p>
      </div>
    </div>
  );
}

const ANCRE_TRAVAIL = 'travail-import';

function telechargerLignesRefusees(job: ImportJob): void {
  if (job.report === null || job.report.errors.length === 0) return;
  const lignes = job.report.errors.map((erreur) => [
    erreur.rowNumber,
    erreur.column ?? null,
    erreur.message,
  ]);
  const classeur = job.fileName.replace(/\.xlsx$/iu, '');
  downloadCsv(
    csvRows([['Ligne', 'Colonne', 'Motif'], ...lignes]),
    `${classeur} - lignes refusées du ${job.createdAt.slice(0, 10)}.csv`,
  );
}

function ErrorsCard({ job }: { job: ImportJob }) {
  if (job.report === null || job.report.errors.length === 0) return null;
  const report = job.report;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[1.0625rem]">
          <AlertTriangleIcon className="size-4 text-destructive" aria-hidden="true" />
          Lignes refusées
        </CardTitle>
        <CardDescription>
          {errorsCaption(report)} Le numéro est celui de la ligne dans le classeur, en-tête compris.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">Ligne</TableHead>
              <TableHead className="w-56">Colonne</TableHead>
              <TableHead>Motif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.errors.map((error, index) => (
              <TableRow key={`${String(error.rowNumber)}-${error.code}-${String(index)}`}>
                <TableCell className="tabular-nums">{error.rowNumber}</TableCell>
                <TableCell className="text-muted-foreground">{error.column ?? '–'}</TableCell>
                <TableCell>{error.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function JobActions({
  job,
  applying,
  running,
  onApply,
  onReset,
}: {
  job: ImportJob;
  applying: boolean;
  running: boolean;
  onApply: () => void;
  onReset: () => void;
}) {
  const showEmptyHint =
    job.status === 'succeeded' && job.mode === 'DRY_RUN' && job.createdRows === 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {canApply(job) ? (
          <Button type="button" disabled={applying} onClick={onApply}>
            {applying ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {applyLabel(job)}
          </Button>
        ) : null}
        {running ? null : (
          <Button type="button" variant="outline" disabled={applying} onClick={onReset}>
            Déposer un autre fichier
          </Button>
        )}
      </div>

      {showEmptyHint ? (
        <p className="text-[0.875rem] font-[500] text-muted-foreground">
          {texteAucuneCreation(job)}
        </p>
      ) : null}
    </>
  );
}

function texteAucuneCreation(job: ImportJob): string {
  if (job.errorRows === 0 && job.skippedRows > 0) {
    return `Toutes les fiches (${formatNumber(job.skippedRows)}) sont déjà présentes en base de données. Aucun doublon n’a été créé.`;
  }
  return 'Aucune nouvelle fiche à créer : les données sont soit déjà en base, soit à corriger.';
}

function TerminalState({ job }: { job: ImportJob }) {
  if (job.status === 'succeeded') {
    return (
      <>
        <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden="true" />
        {formatNumber(job.processedRows)} ligne{job.processedRows > 1 ? 's' : ''} traitée
        {job.processedRows > 1 ? 's' : ''}
        {job.finishedAt === null ? '' : `, terminé le ${formatDateTime(job.finishedAt)}`}.
      </>
    );
  }

  if (job.status === 'expired') {
    return (
      <>
        <ClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        Échéance passée : le classeur a été détruit. Le rapport reste consultable ; redéposez le
        fichier pour recommencer.
      </>
    );
  }

  return (
    <>
      <AlertTriangleIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
      {job.failureMsg ?? 'Le travail a échoué.'}
    </>
  );
}

/*
 * Quatre compteurs, quatre traitements. Une ligne ignorée existe déjà en base : c'est
 * une issue attendue d'un fichier de reprise, pas un échec. Sous la teinte des erreurs,
 * douze mille « ignorées » font abandonner un import parfaitement sain.
 */
function Figures({ job }: { job: ImportJob }) {
  const simulated = job.mode === 'DRY_RUN';
  const registre = job.kind === 'VISITES_REGISTRE';

  return (
    <dl className={cn('grid gap-3 sm:grid-cols-2', registre ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
      <Figure
        label={simulated ? 'À créer' : 'Créées'}
        value={job.createdRows}
        color="text-success"
        help={
          simulated
            ? 'Lignes qui seront écrites si vous appliquez. Rien n’est en base pour l’instant.'
            : 'Fiches écrites en base.'
        }
      />
      {registre ? (
        <Figure
          label={simulated ? 'À corriger' : 'Corrigées'}
          value={job.updatedRows}
          color="text-success"
          help={
            simulated
              ? 'Visites déjà au registre dont une colonne diverge du classeur.'
              : 'Visites réécrites avec le contenu du classeur.'
          }
        />
      ) : null}
      <Figure
        label="Ignorées"
        value={job.skippedRows}
        color="text-muted-foreground"
        help="Déjà en base, ou répétées dans le fichier. Ce n’est pas une erreur : rien à corriger."
      />
      <Figure
        label="Erreurs"
        value={job.errorRows}
        color="text-destructive"
        help="Lignes refusées, listées plus bas. Elles seules demandent une correction."
      />
      <Figure
        label="Traitées"
        value={job.processedRows}
        color="text-foreground"
        help="Lignes de données lues, en-tête et ligne d’exemple exclus."
      />
    </dl>
  );
}

function Figure({
  label,
  value,
  color,
  help,
}: {
  label: string;
  value: number;
  color: string;
  help: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <dt className="text-[0.75rem] font-[600] text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className={cn('text-[1.5rem] font-[700] tabular-nums', color)}>
          {formatNumber(value)}
        </span>
        <span className="text-[0.75rem] leading-snug text-muted-foreground">{help}</span>
      </dd>
    </div>
  );
}

function History({
  selectedId,
  onOpen,
}: {
  selectedId: string | null;
  onOpen: (job: ImportJob) => void;
}) {
  const live = useLive({ topic: 'imports' });
  const [page, setPage] = useState(1);

  const history = useQuery({
    queryKey: queryKeys.importJobs(page),
    queryFn: () => fetchImportJobs(page),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      (query.state.data?.items ?? []).some((row) => isRunning(row))
        ? live.refetchInterval(query)
        : false,
  });

  const data = history.data;

  return (
    <Card>
      {/* Pas de titre ici : le repli « Imports précédents » qui ouvre cette
          carte en tient lieu. */}
      <CardHeader>
        <CardDescription>
          Un travail « échu » n’a pas échoué : son classeur a passé son échéance, son rapport reste.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-0">
        {(() => {
          if (shouldShowError({ isError: history.isError, hasData: data !== undefined }))
            return (
              <div className="px-5">
                <QueryErrorInline
                  error={history.error}
                  onRetry={() => {
                    void history.refetch();
                  }}
                  fallback="L’historique des imports n’a pas pu être chargé."
                />
              </div>
            );
          return (() => {
            if (shouldShowSkeleton({ isPending: history.isPending, hasData: data !== undefined }))
              return (
                <div className="flex flex-col gap-2 px-5">
                  {[0, 1, 2].map((row) => (
                    <Skeleton key={row} className="h-11 w-full" />
                  ))}
                </div>
              );
            return (() => {
              if (data === undefined || data.items.length === 0)
                return (
                  <div className="px-5">
                    <EmptyState
                      icon={HistoryIcon}
                      title="Aucun import"
                      description="Déposez un classeur ci-dessus : les travaux apparaîtront ici avec leur rapport."
                    />
                  </div>
                );
              return (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Fichier</TableHead>
                        <TableHead>Entité</TableHead>
                        <TableHead>État</TableHead>
                        <TableHead className="text-right">Créées</TableHead>
                        <TableHead className="text-right">Ignorées</TableHead>
                        <TableHead className="text-right">Erreurs</TableHead>
                        <TableHead>Déposé le</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={row.id === selectedId ? 'selected' : undefined}
                        >
                          <TableCell className="max-w-56 truncate font-[600]">
                            {row.fileName}
                          </TableCell>
                          <TableCell>{IMPORT_KIND_LABELS[row.kind]}</TableCell>
                          <TableCell>
                            <Badge variant={statusTone(row)}>{statusLabel(row)}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-success">
                            {formatNumber(row.createdRows)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatNumber(row.skippedRows)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right tabular-nums',
                              row.errorRows > 0 ? 'text-destructive' : 'text-muted-foreground',
                            )}
                          >
                            {formatNumber(row.errorRows)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatDateTime(row.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                onOpen(row);
                              }}
                            >
                              Ouvrir
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-1">
                    <p className="text-[0.8125rem] text-muted-foreground" role="status">
                      <span className="sr-only">Travaux d’import&nbsp;: </span>
                      {formatNumber(data.total)} travail{data.total > 1 ? 'x' : ''}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Page précédente"
                        disabled={data.page <= 1}
                        onClick={() => {
                          setPage(data.page - 1);
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
                          setPage(data.page + 1);
                        }}
                      >
                        <ChevronRightIcon className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </>
              );
            })();
          })();
        })()}
      </CardContent>
    </Card>
  );
}

function ApplyDialog({
  job,
  pending,
  onOpenChange,
  onConfirm,
}: {
  job: ImportJob | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={job !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {job === null ? null : (
          <ApplyDialogBody
            job={job}
            pending={pending}
            onCancel={() => {
              onOpenChange(false);
            }}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ApplyDialogBody({
  job,
  pending,
  onCancel,
  onConfirm,
}: {
  job: ImportJob;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const registre = job.kind === 'VISITES' || job.kind === 'VISITES_REGISTRE';

  return (
    <>
      <DialogHeader>
        <DialogTitle>{applyLabel(job)} ?</DialogTitle>
        <DialogDescription>
          {registre
            ? 'Cette action écrit les visites en base et ne s’annule pas.'
            : 'Cette action écrit en base et ne s’annule pas : une fiche supprimée ensuite garde son numéro dans l’index d’unicité.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem]">
          <span className="font-display text-[1.5rem] font-[800] tabular-nums">
            {formatNumber(totalWriteRows(job))}
          </span>{' '}
          {nounFor(job)} {createdVerb(job)} à partir de « {job.fileName} ».
        </p>

        <p className="text-[0.8125rem] text-muted-foreground">
          {formatNumber(job.skippedRows)} ligne{job.skippedRows > 1 ? 's' : ''}{' '}
          {job.skippedRows > 1 ? 'seront ignorées' : 'sera ignorée'} car déjà en base, et{' '}
          {formatNumber(job.errorRows)} refusée{job.errorRows > 1 ? 's' : ''}. Aucune des deux ne
          sera écrite.
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" disabled={pending} onClick={onConfirm}>
          {pending ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
          {applyLabel(job)}
        </Button>
      </DialogFooter>
    </>
  );
}
