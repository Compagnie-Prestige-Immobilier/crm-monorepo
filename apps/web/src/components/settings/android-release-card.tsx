'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2Icon, FileUpIcon, LoaderIcon, SmartphoneIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAndroidUpdate, formatFileSize, uploadAndroidUpdate } from '@/lib/data/app-updates';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

export function AndroidReleaseCard() {
  const queryClient = useQueryClient();
  const fileId = useId();
  const versionNameId = useId();
  const versionCodeId = useId();
  const notesId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [forceUpdate, setForceUpdate] = useState(true);
  const [notes, setNotes] = useState('');

  const release = useQuery({
    queryKey: queryKeys.androidUpdate,
    queryFn: () => fetchAndroidUpdate(),
  });
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Sélectionnez un fichier APK.');
      return uploadAndroidUpdate({ file, versionName, versionCode, forceUpdate, notes });
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.androidUpdate, next);
      setFile(null);
      setVersionName('');
      setVersionCode('');
      setNotes('');
      toast.success(`CPI GO ${next.versionName} publiée.`);
    },
    onError: (error) => {
      toastApiError(error, 'La publication APK a échoué.');
    },
  });

  if (release.isPending) return <Skeleton className="h-80 w-full" />;
  if (release.isError) {
    return (
      <QueryErrorState
        error={release.error}
        onRetry={() => void release.refetch()}
        fallback="La release Android n’a pas pu être lue."
      />
    );
  }

  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SmartphoneIcon className="size-4" aria-hidden="true" />
          Mise à jour mobile Android
        </CardTitle>
        <CardDescription>
          La prochaine version est téléchargée dès que le téléphone retrouve Internet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {release.data.available ? (
          <div className="flex items-start gap-3 rounded-md border border-accent-border/40 bg-accent-surface px-3 py-3">
            <CheckCircle2Icon
              className="mt-0.5 size-4 shrink-0 text-accent-text"
              aria-hidden="true"
            />
            <div className="min-w-0 text-[0.8125rem]">
              <p className="font-[600]">
                CPI GO {release.data.versionName} · build {release.data.versionCode}
              </p>
              <p className="text-muted-foreground">
                {formatFileSize(release.data.fileSize)} ·{' '}
                {release.data.forceUpdate ? 'Installation obligatoire' : 'Installation proposée'}
              </p>
              {release.data.notes ? (
                <p className="mt-1 text-muted-foreground">{release.data.notes}</p>
              ) : null}
            </div>
            <Badge
              variant={release.data.forceUpdate ? 'destructive' : 'secondary'}
              className="ml-auto shrink-0"
            >
              {release.data.forceUpdate ? 'Obligatoire' : 'Disponible'}
            </Badge>
          </div>
        ) : (
          <p role="status" className="text-[0.8125rem] text-muted-foreground">
            Aucune release Android publiée.
          </p>
        )}

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            upload.mutate();
          }}
        >
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={fileId}>Fichier APK</Label>
            <Input
              id={fileId}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              required
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
              }}
            />
            {file ? (
              <p className="text-[0.75rem] text-muted-foreground">
                {file.name} · {formatFileSize(file.size)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={versionNameId}>Version affichée</Label>
            <Input
              id={versionNameId}
              required
              maxLength={32}
              placeholder="1.1.0"
              value={versionName}
              onChange={(event) => {
                setVersionName(event.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={versionCodeId}>Version Android (code)</Label>
            <Input
              id={versionCodeId}
              required
              min="1"
              step="1"
              type="number"
              inputMode="numeric"
              placeholder="2"
              value={versionCode}
              onChange={(event) => {
                setVersionCode(event.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={notesId}>Notes de version (facultatif)</Label>
            <textarea
              id={notesId}
              maxLength={2000}
              rows={3}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
              className="rounded-md border border-input-border bg-input-background px-3 py-2 text-[0.875rem] outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring"
              placeholder="Corrections et nouveautés…"
            />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-[0.875rem] sm:col-span-2">
            <input
              type="checkbox"
              checked={forceUpdate}
              onChange={(event) => {
                setForceUpdate(event.target.checked);
              }}
              className="size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="font-[600]">Forcer l’installation</span>
              <span className="block text-[0.75rem] text-muted-foreground">
                Les utilisateurs ne pourront pas continuer avec l’ancienne version.
              </span>
            </span>
          </label>
          <Button
            type="submit"
            disabled={upload.isPending || !file}
            className="sm:col-span-2 sm:w-fit"
          >
            {upload.isPending ? (
              <LoaderIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <FileUpIcon aria-hidden="true" />
            )}
            {upload.isPending ? 'Publication…' : 'Publier la release'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
