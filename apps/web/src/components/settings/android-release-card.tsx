'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2Icon,
  FileUpIcon,
  InfoIcon,
  LoaderIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAndroidUpdate, formatFileSize, uploadAndroidUpdate } from '@/lib/data/app-updates';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

export function AndroidReleaseCard() {
  const queryClient = useQueryClient();
  const fileId = useId();
  const notesId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [forceUpdate, setForceUpdate] = useState(true);
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [detected, setDetected] = useState<{ versionName: string; versionCode: number } | null>(
    null,
  );

  const release = useQuery({
    queryKey: queryKeys.androidUpdate,
    queryFn: () => fetchAndroidUpdate(),
  });
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Sélectionnez un fichier APK.');
      return uploadAndroidUpdate({ file, forceUpdate, notes });
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.androidUpdate, next);
      setFile(null);
      setNotes('');
      setConfirming(false);
      setDetected({ versionName: next.versionName, versionCode: next.versionCode });
      toast.success(`CPI GO ${next.versionName} publiée.`);
    },
    onError: (error) => {
      setConfirming(false);
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
    <>
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

          {/* Ce que le serveur a LU dans le manifeste du dernier envoi. Affiché
              une fois la publication faite, parce que c'est le seul moment où
              la valeur est connue et vérifiée. */}
          {detected ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-success/30 bg-success-surface px-3 py-2.5 text-[0.8125rem] text-success"
            >
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-[600]">Version lue dans l’APK.</span> Le manifeste du fichier
                déclare la version {detected.versionName}, build {detected.versionCode}. Rien n’a
                été saisi à la main.
              </span>
            </p>
          ) : null}

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setConfirming(true);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fileId}>Fichier APK</Label>
              <Input
                id={fileId}
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                required
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setDetected(null);
                }}
              />
              {file ? (
                <p className="text-[0.75rem] text-muted-foreground">
                  {file.name} · {formatFileSize(file.size)}
                </p>
              ) : null}
              <p className="flex items-start gap-2 text-[0.75rem] text-muted-foreground">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  La version et le numéro de build sont lus dans le fichier. Un APK d’un autre
                  éditeur, ou dont le build ne dépasse pas celui en ligne, est refusé.
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
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

            <label className="flex min-h-11 items-center gap-3 text-[0.875rem]">
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

            <Button type="submit" disabled={upload.isPending || !file} className="sm:w-fit">
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

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open && upload.isPending) return;
          setConfirming(open);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Publier cette release ?</DialogTitle>
            <DialogDescription>
              {file ? `${file.name} · ${formatFileSize(file.size)}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <p className="flex items-start gap-2 rounded-md border border-accent-border/40 bg-accent-surface px-3 py-2.5 text-[0.875rem] text-warning">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {forceUpdate ? (
                  <>
                    <span className="font-[600]">
                      Tous les téléphones du parc seront bloqués jusqu’à l’installation.
                    </span>{' '}
                    Chaque appareil téléchargera ce fichier dès qu’il retrouvera Internet, et
                    l’application refusera de s’ouvrir avant la mise à jour.
                  </>
                ) : (
                  <>
                    <span className="font-[600]">
                      Ce fichier sera proposé à tous les téléphones du parc.
                    </span>{' '}
                    Chaque appareil le téléchargera dès qu’il retrouvera Internet.
                  </>
                )}
              </span>
            </p>

            <p className="flex items-start gap-2 rounded-md border border-success/30 bg-success-surface px-3 py-2.5 text-[0.875rem] text-success">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-[600]">La version est lue dans le fichier.</span> Le serveur
                ouvre le manifeste de l’APK et en tire la version et le numéro de build. Un fichier
                d’un autre éditeur, un build qui ne dépasse pas celui en ligne, ou un manifeste
                illisible sont refusés avant toute publication.
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={upload.isPending}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={upload.isPending || !file}
              onClick={() => {
                upload.mutate();
              }}
            >
              {upload.isPending ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Publication…
                </>
              ) : (
                <>
                  <FileUpIcon aria-hidden="true" />
                  Publier la release
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
