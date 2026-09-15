'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  LoaderIcon,
  UploadIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useFileDownload } from '@/components/exports/download-button';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  importRepresentants,
  REPRESENTANTS_TEMPLATE_FILE_NAME,
  REPRESENTANTS_TEMPLATE_URL,
  type ImportReport,
} from '@/lib/data/representants-import';
import { RelationBadge } from '@/components/representants/relation-badge';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ACCEPTED = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function RepresentantsImportView() {
  const queryClient = useQueryClient();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const template = useFileDownload();

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const simulate = useMutation({
    mutationFn: (candidate: File) => importRepresentants(candidate, true),
    onSuccess: (result) => {
      setReport(result);
    },
    onError: (error) => {
      setReport(null);
      toastApiError(error, 'Le fichier n’a pas pu être analysé.');
    },
  });

  const apply = useMutation({
    mutationFn: (candidate: File) => importRepresentants(candidate, false),
    onSuccess: (result) => {
      setReport(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
      toast.success(
        `${formatNumber(result.created)} représentant${result.created > 1 ? 's' : ''} créé${result.created > 1 ? 's' : ''}.`,
      );
    },
    onError: (error) => {
      toastApiError(error, 'L’import n’a pas pu être appliqué.');
    },
  });

  function accept(candidate: File | null): void {
    setReport(null);
    if (candidate === null) {
      setFile(null);
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      toast.error('Fichier trop volumineux : 10 Mo au maximum.');
      return;
    }
    setFile(candidate);
    simulate.mutate(candidate);
  }

  const applied = report !== null && !report.dryRun;

  return (
    <div className="flex flex-col gap-6">
      {/* Un LIEN habillé en bouton : la primitive `Button` de Base UI poserait
          `role="button"` sur le `<a>` et lui retirerait sa sémantique de lien. */}
      <Link
        href="/teleconseil/representants"
        className={cn(buttonVariants({ variant: 'ghost' }), 'w-fit -ml-2')}
      >
        <ArrowLeftIcon aria-hidden="true" />
        Tous les représentants
      </Link>

      {/* ─── 1. Le modèle ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[1.0625rem]">Partir du modèle</CardTitle>
          <CardDescription>
            En-têtes figés, une ligne d’exemple, et des listes déroulantes de départements et d’IEF
            alimentées depuis les référentiels du jour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            disabled={template.pending}
            onClick={() => {
              void template.download({
                url: REPRESENTANTS_TEMPLATE_URL,
                fileName: REPRESENTANTS_TEMPLATE_FILE_NAME,
                failureMessage: 'Le modèle n’a pas pu être généré.',
              });
            }}
          >
            {template.pending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <DownloadIcon aria-hidden="true" />
            )}
            Télécharger le modèle Excel
          </Button>
        </CardContent>
      </Card>

      {/* ─── 2. Le dépôt ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[1.0625rem]">Déposer le fichier rempli</CardTitle>
          <CardDescription>
            Le fichier est d’abord ANALYSÉ : rien n’est enregistré tant que vous n’avez pas
            confirmé.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/*
            Zone de dépôt DOUBLÉE d'un champ de fichier réel : le glisser-déposer
            n'est pas atteignable au clavier, et une zone qui n'existerait qu'en
            `onDrop` fermerait l'écran à qui n'utilise pas la souris. Le `label`
            porte le clic, l'`input` porte le focus et l'annonce.
          */}
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
              {file === null ? 'Glissez le classeur ici, ou choisissez un fichier' : file.name}
            </span>
            <span className="text-[0.8125rem] text-muted-foreground">
              Format .xlsx, 10 Mo au maximum.
            </span>
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              onChange={(event) => {
                accept(event.target.files?.item(0) ?? null);
                event.target.value = '';
              }}
            />
          </label>

          {simulate.isPending ? (
            <p role="status" className="flex items-center gap-2 text-[0.875rem]">
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              Analyse du fichier…
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ─── 3. Le rapport ──────────────────────────────────────────────── */}
      {report !== null ? (
        <ImportReportPanel
          report={report}
          applied={applied}
          applying={apply.isPending}
          onApply={() => {
            if (file !== null) apply.mutate(file);
          }}
          onReset={() => {
            setFile(null);
            setReport(null);
            inputRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

function ResumeApplique({ created }: { created: number }) {
  const pluriel = created > 1 ? 's' : '';

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-border bg-secondary p-4"
    >
      <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
      <div className="min-w-0 text-[0.875rem]">
        <p className="font-[600]">
          {formatNumber(created)} fiche{pluriel} créée{pluriel}.
        </p>
        <p className="mt-1 text-muted-foreground">
          Les lignes en erreur n’ont pas été écrites. Corrigez-les dans le classeur et redéposez-le
          : les doublons seront de nouveau écartés.
        </p>
      </div>
    </div>
  );
}

function plurielSiPlusieurs(count: number): string {
  return count > 1 ? 's' : '';
}

function celluleOuVide(value: string | null): string {
  return value ?? '–';
}

function celluleDate(value: string | null): string {
  if (value === null) return '–';
  return formatDate(value);
}

function LignesRejetees({ errors }: { errors: ImportReport['errors'] }) {
  if (errors.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[1.0625rem]">
          <AlertTriangleIcon className="size-4 text-destructive" aria-hidden="true" />
          Lignes rejetées
        </CardTitle>
        <CardDescription>
          Le numéro renvoie à la ligne DANS le classeur, en-tête compris : il suffit de l’ouvrir et
          d’y aller.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20">Ligne</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Valeur fautive</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((error) => (
                <TableRow key={`${String(error.line)}-${error.code}`}>
                  <TableCell className="tabular-nums">{error.line}</TableCell>
                  <TableCell>{error.message}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {celluleOuVide(error.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ApercuLignesValides({
  preview,
  validCount,
}: {
  preview: ImportReport['preview'];
  validCount: number;
}) {
  if (preview.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[1.0625rem]">
          <FileSpreadsheetIcon className="size-4" aria-hidden="true" />
          Aperçu des lignes valides
        </CardTitle>
        <CardDescription>
          {formatNumber(preview.length)} première
          {plurielSiPlusieurs(preview.length)} ligne{plurielSiPlusieurs(preview.length)} sur{' '}
          {formatNumber(validCount)}. Le téléphone est celui que le serveur a normalisé.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20">Ligne</TableHead>
                <TableHead>Représentant</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>IEF</TableHead>
                <TableHead>Établissement</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Dernier appel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((row) => (
                <TableRow key={row.line}>
                  <TableCell className="tabular-nums">{row.line}</TableCell>
                  <TableCell className="font-[600]">{row.fullName}</TableCell>
                  <TableCell className="tabular-nums">{formatPhone(row.phoneE164)}</TableCell>
                  <TableCell>{row.departementName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {celluleOuVide(row.iefName)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {celluleOuVide(row.etablissement)}
                  </TableCell>
                  <TableCell>
                    <RelationBadge status={row.relationStatus} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {celluleDate(row.calledAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionsImport({
  applied,
  applying,
  validCount,
  onApply,
  onReset,
}: {
  applied: boolean;
  applying: boolean;
  validCount: number;
  onApply: () => void;
  onReset: () => void;
}) {
  if (applied) {
    return (
      <Button type="button" onClick={onReset}>
        Importer un autre fichier
      </Button>
    );
  }

  return (
    <>
      <Button type="button" disabled={applying || validCount === 0} onClick={onApply}>
        {applying ? (
          <>
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Import en cours…
          </>
        ) : (
          `Créer ${formatNumber(validCount)} représentant${plurielSiPlusieurs(validCount)}`
        )}
      </Button>
      <Button type="button" variant="ghost" disabled={applying} onClick={onReset}>
        Changer de fichier
      </Button>
    </>
  );
}

function ImportReportPanel({
  report,
  applied,
  applying,
  onApply,
  onReset,
}: {
  report: ImportReport;
  applied: boolean;
  applying: boolean;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-4">
        <Figure label="Lignes lues" value={report.totalRows} />
        <Figure label="Valides" value={report.valid} tone="success" />
        <Figure label="En erreur" value={report.rejected} tone="destructive" />
        <Figure label="Doublons" value={report.duplicates} tone="warning" />
      </dl>

      {applied ? <ResumeApplique created={report.created} /> : null}

      <LignesRejetees errors={report.errors} />
      <ApercuLignesValides preview={report.preview} validCount={report.valid} />

      <div className="flex flex-wrap items-center gap-3">
        <ActionsImport
          applied={applied}
          applying={applying}
          validCount={report.valid}
          onApply={onApply}
          onReset={onReset}
        />
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'destructive' | 'warning';
}) {
  const color = (() => {
    if (tone === 'success') return 'text-success';
    return (() => {
      if (tone === 'destructive') return 'text-destructive';
      return (() => {
        if (tone === 'warning') return 'text-warning';
        return '';
      })();
    })();
  })();

  return (
    <div className="rounded-md border border-border p-3">
      <dt className="text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-[1.25rem] font-[700] tabular-nums ${color}`}>
        {formatNumber(value)}
      </dd>
    </div>
  );
}
