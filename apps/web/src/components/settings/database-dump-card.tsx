'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DatabaseIcon,
  DownloadIcon,
  InfoIcon,
  LoaderIcon,
  MailIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { useFileDownload } from '@/components/exports/download-button';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
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
import {
  DATABASE_DUMP_DOWNLOAD_URL,
  databaseDumpFileName,
  dumpNoticeWarning,
  dumpStatusLabel,
  fetchDatabaseDump,
  formatDumpSize,
  isDumpRunning,
  requestDatabaseDump,
} from '@/lib/data/db-dump';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/**
 * `role="status"` : l'état change tout seul pendant le sondage, hors du flux de
 * lecture. Sans annonce, un lecteur d'écran ne saurait pas que l'export est
 * devenu téléchargeable.
 */
function EtatExport({
  data,
  running,
  notice,
}: {
  data: Awaited<ReturnType<typeof fetchDatabaseDump>>;
  running: boolean;
  notice: string | null;
}) {
  return (
    <div role="status" className="flex flex-col gap-2">
      {running ? (
        <p className="flex items-start gap-2 text-[0.875rem]">
          <LoaderIcon className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden="true" />
          <span>
            <span className="font-[600]">Export en cours.</span> L’opération dure plusieurs minutes.
            Vous pouvez quitter le panel&nbsp;: la cloche des notifications vous préviendra dès que
            l’archive sera prête.
          </span>
        </p>
      ) : (
        <p className="text-[0.875rem] text-muted-foreground">{dumpStatusLabel(data)}</p>
      )}

      {data.status === 'ready' ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          {formatDumpSize(data.fileSize)}
          {data.finishedAt === null ? null : (
            <>
              {' · produit le '}
              <time dateTime={data.finishedAt}>{formatDateTime(data.finishedAt)}</time>
            </>
          )}
          {data.expiresAt === null ? null : (
            <>
              {' · détruit le '}
              <time dateTime={data.expiresAt}>{formatDateTime(data.expiresAt)}</time>
            </>
          )}
        </p>
      ) : null}

      {data.status === 'ready' && data.sha256 !== null ? (
        <p className="break-all text-[0.75rem] text-muted-foreground">sha256 {data.sha256}</p>
      ) : null}

      {data.status === 'failed' && data.failureReason !== null ? (
        <p className="flex items-start gap-2 rounded-md border border-destructive/30 px-3 py-2.5 text-[0.8125rem] text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{data.failureReason}</span>
        </p>
      ) : null}

      {notice === null ? null : (
        <p className="flex items-start gap-2 rounded-md border border-accent-border/40 bg-accent-surface px-3 py-2.5 text-[0.8125rem] text-warning">
          <MailIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}
    </div>
  );
}

export function DatabaseDumpCard() {
  const queryClient = useQueryClient();
  const confirmId = useId();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const download = useFileDownload();

  const live = useLive({ topic: 'db-dump' });

  const dump = useQuery({
    queryKey: queryKeys.databaseDump,
    queryFn: () => fetchDatabaseDump(),
    refetchInterval: (query) =>
      isDumpRunning(query.state.data)
        ? live.refetchInterval({ state: { status: query.state.status } })
        : false,
  });

  const request = useMutation({
    mutationFn: () => requestDatabaseDump(),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.databaseDump, next);
      setConfirming(false);
      setConfirmed(false);
      toast.success('Export lancé. La cloche du panel vous préviendra dès qu’il sera prêt.');
    },
    onError: (error) => {
      setConfirming(false);
      toastApiError(error, 'L’export n’a pas pu être lancé.');
    },
  });

  if (dump.isPending) return <Skeleton className="h-64 w-full" />;
  if (dump.isError) {
    return (
      <QueryErrorState
        error={dump.error}
        onRetry={() => void dump.refetch()}
        fallback="L’état de l’export n’a pas pu être lu."
      />
    );
  }

  const data = dump.data;
  const running = isDumpRunning(data);
  const notice = dumpNoticeWarning(data);

  return (
    <>
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseIcon className="size-4" aria-hidden="true" />
            Export intégral de la base
          </CardTitle>
          <CardDescription>
            Structure et contenu complets, dans une archive compressée. Réservé aux sauvegardes et
            aux migrations.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <EtatExport data={data} running={running} notice={notice} />

          <div className="flex flex-wrap items-center gap-3">
            {data.downloadable ? (
              <Button
                type="button"
                disabled={download.pending}
                onClick={() => {
                  void download
                    .download({
                      url: DATABASE_DUMP_DOWNLOAD_URL,
                      fileName: databaseDumpFileName(),
                      failureMessage: 'Le téléchargement de l’export a échoué.',
                    })
                    .then(() => {
                      void queryClient.invalidateQueries({ queryKey: queryKeys.databaseDump });
                    });
                }}
              >
                {download.pending ? (
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <DownloadIcon aria-hidden="true" />
                )}
                Télécharger l’archive
              </Button>
            ) : null}

            <Button
              type="button"
              variant={data.downloadable ? 'ghost' : 'secondary'}
              disabled={running || request.isPending}
              onClick={() => {
                setConfirmed(false);
                setConfirming(true);
              }}
            >
              {running ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Export en cours…
                </>
              ) : (
                <>
                  <DatabaseIcon aria-hidden="true" />
                  Demander un export
                </>
              )}
            </Button>
            {running ? null : (
              <p className="text-[0.75rem] text-muted-foreground">Confirmation requise.</p>
            )}
          </div>

          <p className="flex items-start gap-2 text-[0.75rem] text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              L’avis de fin arrive dans la cloche du panel, sans e-mail et sans AUCUN lien. Le
              téléchargement se fait depuis cet écran, dans votre session. L’archive est détruite
              dès qu’elle a été téléchargée.
            </span>
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open && request.isPending) return;
          setConfirming(open);
          if (!open) setConfirmed(false);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer une copie complète de la base ?</DialogTitle>
            <DialogDescription>
              Le fichier produit contient l’intégralité des données de la plateforme.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/*
              L'ÉNUMÉRATION, et elle est le cœur de cet écran.

              « Un export de la base » ne veut rien dire à qui décide. La liste
              nomme ce que le fichier contiendra vraiment, y compris ce que
              personne ne pense à y trouver : les empreintes de mots de passe.
            */}
            <ul className="flex list-disc flex-col gap-1 rounded-md border border-border p-3 pl-7 text-[0.875rem]">
              <li>Toutes les fiches prospects, avec les noms et les numéros de téléphone.</li>
              <li>Tous les dossiers bancaires, avec les montants en francs CFA.</li>
              <li>Tous les comptes utilisateurs, avec les empreintes de leurs mots de passe.</li>
              <li>Toutes les campagnes, les demandes clients et l’historique des actions.</li>
              <li>L’espace démo possède sa propre base et ne peut pas produire cette archive.</li>
            </ul>

            <p className="flex items-start gap-2 rounded-md border border-accent-border/40 bg-accent-surface px-3 py-2.5 text-[0.875rem] text-warning">
              <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-[600]">
                  Ce fichier vaut la base elle-même. Il concerne des personnes réelles.
                </span>{' '}
                Une fois sur votre poste, il n’est plus protégé par vos droits d’accès. Ne le
                transférez pas par messagerie, ne le déposez pas sur un stockage personnel, et
                effacez-le dès qu’il a servi.
              </span>
            </p>

            <p className="flex items-start gap-2 rounded-md border border-success/30 bg-success-surface px-3 py-2.5 text-[0.875rem] text-success">
              <MailIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-[600]">Aucun e-mail, aucun lien.</span> L’avis de fin arrive
                dans la cloche du panel, et nulle part ailleurs&nbsp;: rien ne part par messagerie.
                Le téléchargement se fait sur cet écran, dans votre session, et l’archive est
                détruite aussitôt après.
              </span>
            </p>

            <label
              htmlFor={confirmId}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-[0.875rem] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
            >
              <input
                id={confirmId}
                type="checkbox"
                checked={confirmed}
                disabled={request.isPending}
                className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                onChange={(event) => {
                  setConfirmed(event.target.checked);
                }}
              />
              <span>
                Je comprends que ce fichier contient toutes les données de la plateforme, et j’en
                assume la garde.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={request.isPending}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={!confirmed || request.isPending}
              onClick={() => {
                request.mutate();
              }}
            >
              {request.isPending ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Lancement…
                </>
              ) : (
                <>
                  <DatabaseIcon aria-hidden="true" />
                  Lancer l’export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
