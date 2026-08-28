'use client';

import { ShieldCheckIcon, UploadCloudIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  useAndroidUploadProgress,
  useAndroidUploadSnapshot,
  useMarkMandatory,
  type AndroidUploadSnapshot,
} from '@/components/settings/android-release-upload';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  formatFileSize,
  shortHash,
  UploadAbortedError,
  type AndroidRelease,
} from '@/lib/data/app-updates';
import { toastApiError } from '@/lib/mutation-feedback';

const TOAST_ID = 'android-release-upload';

function UploadToastBody({
  fileName,
  loaded,
  total,
  percent,
  onCancel,
}: {
  fileName: string;
  loaded: number;
  total: number;
  percent: number;
  onCancel: () => void;
}) {
  return (
    <div className="flex w-[21rem] max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-md border border-border bg-popover px-4 py-3 text-popover-foreground shadow-elev-lg">
      <div className="flex items-center gap-2">
        <UploadCloudIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-[600]">{fileName}</p>
        <span className="figure shrink-0 text-[0.75rem] text-muted-foreground">
          {percent} {'%'}
        </span>
      </div>
      <Progress value={percent} aria-label={`Envoi de ${fileName}`} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.75rem] text-muted-foreground">
          {formatFileSize(loaded)} sur {formatFileSize(total)}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function PublishedDialog({
  release,
  onClose,
  onMandatory,
}: {
  release: AndroidRelease;
  onClose: () => void;
  onMandatory: (release: AndroidRelease) => void;
}) {
  const mandatory = useMarkMandatory();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Version publiée</DialogTitle>
          <DialogDescription>
            Voici ce que le serveur a lu dans le fichier. Rien n’a été saisi à la main.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-[0.875rem]">
          <dt className="text-muted-foreground">Version</dt>
          <dd className="font-[600]">{release.versionName}</dd>
          <dt className="text-muted-foreground">Build</dt>
          <dd className="figure">{release.versionCode}</dd>
          <dt className="text-muted-foreground">Taille</dt>
          <dd className="figure">{formatFileSize(release.fileSize)}</dd>
          <dt className="text-muted-foreground">Empreinte</dt>
          <dd className="break-all font-mono text-[0.8125rem]">{shortHash(release.sha256)}</dd>
          <dt className="text-muted-foreground">Signataire</dt>
          <dd className="break-all font-mono text-[0.8125rem]">
            {shortHash(release.signerSha256)}
          </dd>
        </dl>

        {release.mandatory ? (
          <p className="flex items-start gap-2 rounded-md border border-success/30 bg-success-surface px-3 py-2.5 text-[0.875rem] text-success">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Cette version est déjà une mise à jour obligatoire.</span>
          </p>
        ) : (
          <p className="rounded-md border border-border bg-secondary/60 px-3 py-2.5 text-[0.875rem]">
            <span className="font-[600]">Rendre obligatoire</span>
            <span className="block text-muted-foreground">
              Les téléphones en dessous de cette version devront l’installer pour continuer.
            </span>
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          {release.mandatory ? null : (
            <Button
              type="button"
              disabled={mandatory.isPending}
              onClick={() => {
                mandatory.mutate(release.versionCode, { onSuccess: onMandatory });
              }}
            >
              <ShieldCheckIcon aria-hidden="true" />
              Rendre obligatoire
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** La fenêtre se déduit du dernier envoi réussi, de sa fermeture et du plancher qu'on vient de poser. */
function publishedRelease(
  snapshot: AndroidUploadSnapshot | undefined,
  closed: number | null,
  marked: AndroidRelease | null,
): AndroidRelease | null {
  if (snapshot?.status !== 'success' || snapshot.data === undefined) return null;
  if (closed === snapshot.id) return null;
  if (marked !== null && marked.versionCode === snapshot.data.versionCode) return marked;
  return snapshot.data;
}

/**
 * Monté à côté du `Toaster`, donc vivant sur tous les écrans : l'envoi d'un APK
 * garde sa barre en bas à droite quand l'administrateur quitte Paramètres.
 */
export function AndroidReleaseUploadToast() {
  const snapshot = useAndroidUploadSnapshot();
  const progress = useAndroidUploadProgress();
  const [closed, setClosed] = useState<number | null>(null);
  const [marked, setMarked] = useState<AndroidRelease | null>(null);
  const settled = useRef<number | null>(null);
  const published = publishedRelease(snapshot, closed, marked);

  const pending = snapshot?.status === 'pending';

  useEffect(() => {
    if (snapshot === undefined || snapshot.status !== 'pending') return;

    const fileName = progress?.fileName ?? snapshot.variables?.file.name ?? 'Fichier';
    const total = progress?.total ?? snapshot.variables?.file.size ?? 0;
    const loaded = progress?.loaded ?? 0;
    const percent = total === 0 ? 0 : Math.min(100, Math.round((loaded / total) * 100));
    const controller = snapshot.variables?.controller;

    toast.custom(
      () => (
        <UploadToastBody
          fileName={fileName}
          loaded={loaded}
          total={total}
          percent={percent}
          onCancel={() => {
            controller?.abort();
          }}
        />
      ),
      { id: TOAST_ID, duration: Number.POSITIVE_INFINITY },
    );
  }, [snapshot, progress]);

  useEffect(() => {
    if (snapshot === undefined || snapshot.status === 'pending' || snapshot.status === 'idle') {
      return;
    }
    if (settled.current === snapshot.id) return;
    settled.current = snapshot.id;

    toast.dismiss(TOAST_ID);

    if (snapshot.status === 'success' && snapshot.data !== undefined) {
      toast.success(`CPI GO ${snapshot.data.versionName} publiée.`);
      return;
    }
    if (snapshot.error instanceof UploadAbortedError) {
      toast('Envoi annulé.');
      return;
    }
    toastApiError(snapshot.error, 'La publication a échoué.');
  }, [snapshot]);

  useEffect(() => {
    if (!pending) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [pending]);

  if (published === null || snapshot === undefined) return null;

  return (
    <PublishedDialog
      release={published}
      onClose={() => {
        setClosed(snapshot.id);
      }}
      onMandatory={setMarked}
    />
  );
}
