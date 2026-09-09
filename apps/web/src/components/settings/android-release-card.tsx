'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUpIcon, ShieldCheckIcon, SmartphoneIcon, UploadCloudIcon } from 'lucide-react';
import { useId, useState, type DragEvent } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import {
  useAndroidReleaseUpload,
  useAndroidUploadSnapshot,
  useMarkMandatory,
} from '@/components/settings/android-release-upload';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchAndroidReleases,
  formatFileSize,
  shortHash,
  withdrawAndroidRelease,
  type AndroidRelease,
} from '@/lib/data/app-updates';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const RETRAIT_AVERTISSEMENT =
  'Le retrait arrête la distribution de cette version et abaisse le plancher. ' +
  'Il ne désinstalle rien sur les téléphones qui l’ont déjà.';

function isApk(file: File): boolean {
  return file.name.toLowerCase().endsWith('.apk');
}

function ReleaseRow({
  release,
  onMandatory,
  onWithdraw,
  busy,
}: {
  release: AndroidRelease;
  onMandatory: (versionCode: number) => void;
  onWithdraw: (release: AndroidRelease) => void;
  busy: boolean;
}) {
  const withdrawn = release.withdrawnAt !== null;

  return (
    <TableRow>
      <TableCell className="font-[600]">{release.versionCode}</TableCell>
      <TableCell>{release.versionName}</TableCell>
      <TableCell className="whitespace-nowrap">{formatDateTime(release.publishedAt)}</TableCell>
      <TableCell>{release.publishedByName ?? '—'}</TableCell>
      <TableCell className="whitespace-nowrap">{formatFileSize(release.fileSize)}</TableCell>
      <TableCell>
        {release.mandatory ? (
          <Badge variant="warning">Mise à jour obligatoire</Badge>
        ) : (
          <span className="text-muted-foreground">Non</span>
        )}
      </TableCell>
      <TableCell>
        {withdrawn ? (
          <Badge variant="secondary">Retirée</Badge>
        ) : (
          <Badge variant="success">En ligne</Badge>
        )}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {withdrawn ? null : (
          <span className="inline-flex gap-1">
            {release.mandatory ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  onMandatory(release.versionCode);
                }}
              >
                Rendre obligatoire
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                onWithdraw(release);
              }}
            >
              Retirer
            </Button>
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

function PublishedSummary({
  online,
  floor,
}: {
  online: AndroidRelease | undefined;
  floor: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border bg-secondary/50 px-3 py-3 text-[0.8125rem]">
      <p>
        <span className="text-muted-foreground">En ligne : </span>
        {online === undefined ? (
          'aucune version publiée'
        ) : (
          <span className="font-[600]">
            CPI GO {online.versionName} · build {online.versionCode}
          </span>
        )}
      </p>
      <p>
        <span className="text-muted-foreground">Plancher obligatoire : </span>
        <span className="font-[600]">{floor === null ? 'aucun' : `build ${String(floor)}`}</span>
      </p>
    </div>
  );
}

function SelectedFileLabel({ file }: { file: File | null }) {
  if (file === null) return null;
  return (
    <p className="text-[0.8125rem] font-[600]">
      {file.name} · {formatFileSize(file.size)}
    </p>
  );
}

function UploadHint({ uploading }: { uploading: boolean }) {
  if (!uploading) return null;
  return (
    <output className="text-[0.75rem] text-muted-foreground">
      L’envoi continue en bas de l’écran, même si vous changez de page.
    </output>
  );
}

function ReleaseUploadForm({
  upload,
  uploading,
}: {
  upload: ReturnType<typeof useAndroidReleaseUpload>;
  uploading: boolean;
}) {
  const fileId = useId();
  const notesId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [dragging, setDragging] = useState(false);

  const accept = (candidate: File | null | undefined): void => {
    if (candidate === null || candidate === undefined) return;
    if (!isApk(candidate)) {
      toast.error('Déposez un fichier .apk.');
      return;
    }
    setFile(candidate);
  };

  const drop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files[0]);
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (file === null || uploading) return;
        upload.mutate({ file, notes, controller: new AbortController() });
        setFile(null);
        setNotes('');
      }}
    >
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={drop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-6 text-center',
          dragging ? 'border-ring bg-accent-surface' : 'border-input-border',
        )}
      >
        <UploadCloudIcon className="size-5 text-muted-foreground" aria-hidden="true" />
        <input
          id={fileId}
          type="file"
          accept=".apk"
          className="peer sr-only"
          onChange={(event) => {
            accept(event.target.files?.[0]);
          }}
        />
        <Label
          htmlFor={fileId}
          className="cursor-pointer rounded-md border border-border bg-card px-3 py-2 font-[600] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
        >
          Choisir un fichier APK
        </Label>
        <p className="text-[0.75rem] text-muted-foreground">
          ou glissez le fichier ici. Seuls les fichiers .apk sont acceptés.
        </p>
        <SelectedFileLabel file={file} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={notesId}>Notes de version (facultatif)</Label>
        <Textarea
          id={notesId}
          maxLength={2000}
          rows={3}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
          placeholder="Corrections et nouveautés…"
        />
      </div>

      <Button type="submit" disabled={file === null || uploading} className="sm:w-fit">
        <FileUpIcon aria-hidden="true" />
        {uploading ? 'Envoi en cours…' : 'Publier'}
      </Button>
      <UploadHint uploading={uploading} />
    </form>
  );
}

function ReleasesHistoryTable({
  items,
  busy,
  onMandatory,
  onWithdraw,
}: {
  items: readonly AndroidRelease[];
  busy: boolean;
  onMandatory: (versionCode: number) => void;
  onWithdraw: (release: AndroidRelease) => void;
}) {
  if (items.length === 0) {
    return <p className="text-[0.8125rem] text-muted-foreground">Aucune version publiée.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Build</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Publiée le</TableHead>
          <TableHead>Par</TableHead>
          <TableHead>Taille</TableHead>
          <TableHead>Obligatoire</TableHead>
          <TableHead>État</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((release) => (
          <ReleaseRow
            key={release.versionCode}
            release={release}
            busy={busy}
            onMandatory={onMandatory}
            onWithdraw={onWithdraw}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function confirmWithdraw(
  toWithdraw: AndroidRelease | null,
  withdraw: { mutate: (versionCode: number) => void },
): void {
  if (toWithdraw !== null) withdraw.mutate(toWithdraw.versionCode);
}

function WithdrawReleaseDialog({
  toWithdraw,
  pending,
  onClose,
  onConfirm,
}: {
  toWithdraw: AndroidRelease | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={toWithdraw !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Retirer CPI GO ${toWithdraw?.versionName ?? ''} ?`}
      description={RETRAIT_AVERTISSEMENT}
      confirmLabel="Retirer"
      pending={pending}
      onConfirm={onConfirm}
    >
      <p className="flex items-start gap-2 rounded-md border border-border bg-secondary/60 px-3 py-2.5 text-[0.8125rem]">
        <ShieldCheckIcon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span>
          Build {toWithdraw?.versionCode ?? ''} · Signataire{' '}
          {toWithdraw === null ? '' : shortHash(toWithdraw.signerSha256)}
        </span>
      </p>
    </ConfirmDialog>
  );
}

export function AndroidReleaseCard() {
  const queryClient = useQueryClient();
  const [toWithdraw, setToWithdraw] = useState<AndroidRelease | null>(null);

  const releases = useQuery({
    queryKey: queryKeys.androidReleases,
    queryFn: () => fetchAndroidReleases(),
  });
  const upload = useAndroidReleaseUpload();
  const mandatory = useMarkMandatory();
  const snapshot = useAndroidUploadSnapshot();
  const uploading = snapshot?.status === 'pending';

  const withdraw = useMutation({
    mutationFn: (versionCode: number) => withdrawAndroidRelease(versionCode),
    onSuccess: (release) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.androidReleases });
      setToWithdraw(null);
      toast.success(`CPI GO ${release.versionName} retirée.`);
    },
    onError: (error) => {
      toastApiError(error, 'Le retrait a échoué.');
    },
  });

  if (releases.isPending) return <Skeleton className="h-96 w-full" />;
  if (releases.isError) {
    return (
      <QueryErrorState
        error={releases.error}
        onRetry={() => void releases.refetch()}
        fallback="L’historique des versions Android n’a pas pu être lu."
      />
    );
  }

  const items = releases.data.items;
  const online = items.find((release) => release.withdrawnAt === null);
  const floor = releases.data.minVersionCode;
  const busy = mandatory.isPending || withdraw.isPending;

  return (
    <>
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
            Version Android
          </CardTitle>
          <CardDescription>
            Le fichier est vérifié par le serveur avant d’être distribué. La version et le numéro de
            build sont lus dans l’APK.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <PublishedSummary online={online} floor={floor} />
          <ReleaseUploadForm upload={upload} uploading={uploading} />
        </CardContent>
      </Card>

      <Card className="animate-rise">
        <CardHeader>
          <CardTitle>Historique des versions</CardTitle>
          <CardDescription>
            Les versions retirées restent listées : elles ne sont plus distribuées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReleasesHistoryTable
            items={items}
            busy={busy}
            onMandatory={(versionCode) => {
              mandatory.mutate(versionCode);
            }}
            onWithdraw={setToWithdraw}
          />
        </CardContent>
      </Card>

      <WithdrawReleaseDialog
        toWithdraw={toWithdraw}
        pending={withdraw.isPending}
        onClose={() => {
          setToWithdraw(null);
        }}
        onConfirm={() => {
          confirmWithdraw(toWithdraw, withdraw);
        }}
      />
    </>
  );
}
