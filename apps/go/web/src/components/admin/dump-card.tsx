import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseIcon, DownloadIcon, LoaderIcon, MailIcon, TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';

import { ApiError } from '@/api/client';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  alerteAvisDump,
  demanderDump,
  dumpEnCours,
  fetchDump,
  formatTailleDump,
  libelleEtatDump,
  URL_TELECHARGEMENT_DUMP,
  type EtatDump,
} from '@/lib/data/db-dump';
import { formatDateTime } from '@/lib/format';
import { LIVE_SLOW_INTERVAL_MS } from '@/lib/live';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/**
 * L'export intégral est fermé par défaut : la route rend alors 404. C'est une
 * réponse normale, pas une panne, et la carte disparaît.
 */
function estIndisponible(erreur: unknown): boolean {
  return erreur instanceof ApiError && (erreur.status === 404 || erreur.status === 403);
}

function Details({ dump }: { dump: EtatDump }) {
  if (dump.status !== 'ready') return null;
  return (
    <>
      <p className="text-[0.8125rem] text-muted-foreground">
        {formatTailleDump(dump.fileSize)}
        {dump.finishedAt === null ? null : (
          <>
            {' · produit le '}
            <time dateTime={dump.finishedAt}>{formatDateTime(dump.finishedAt)}</time>
          </>
        )}
        {dump.expiresAt === null ? null : (
          <>
            {' · détruit le '}
            <time dateTime={dump.expiresAt}>{formatDateTime(dump.expiresAt)}</time>
          </>
        )}
      </p>
      {dump.sha256 === null ? null : (
        <p className="text-[0.75rem] break-all text-muted-foreground">sha256 {dump.sha256}</p>
      )}
    </>
  );
}

export function DumpCard() {
  const queryClient = useQueryClient();

  const dump = useQuery({
    queryKey: queryKeys.databaseDump,
    queryFn: fetchDump,
    retry: false,
    refetchInterval: (requete) =>
      dumpEnCours(requete.state.data) ? 10_000 : LIVE_SLOW_INTERVAL_MS,
  });

  const demande = useMutation({
    mutationFn: demanderDump,
    onSuccess: (etat) => {
      queryClient.setQueryData(queryKeys.databaseDump, etat);
      toast.success('Export lancé. La cloche préviendra dès qu’il sera prêt.');
    },
    onError: (erreur) => {
      toastApiError(erreur, 'L’export n’a pas pu être lancé.');
    },
  });

  if (dump.isPending) return <Skeleton className="h-64 w-full" />;
  if (dump.isError) {
    if (estIndisponible(dump.error)) return null;
    return (
      <QueryErrorState
        error={dump.error}
        onRetry={() => {
          void dump.refetch();
        }}
        fallback="L’état de l’export n’a pas pu être lu."
      />
    );
  }

  const donnees = dump.data;
  const enCours = dumpEnCours(donnees);
  const avis = alerteAvisDump(donnees);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseIcon className="size-4" aria-hidden="true" />
          Export intégral de la base
        </CardTitle>
        <CardDescription>
          Une archive complète, détruite après son téléchargement ou à son échéance.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <EtatDumpBloc dump={donnees} enCours={enCours} avis={avis} />

        <div className="flex flex-wrap items-center gap-3">
          {donnees.downloadable ? (
            <a href={URL_TELECHARGEMENT_DUMP} download className={buttonVariants()}>
              <DownloadIcon aria-hidden="true" />
              Télécharger l’archive
            </a>
          ) : null}

          <Button
            type="button"
            variant={donnees.downloadable ? 'ghost' : 'secondary'}
            disabled={enCours || demande.isPending}
            onClick={() => {
              demande.mutate();
            }}
          >
            {enCours || demande.isPending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <DatabaseIcon aria-hidden="true" />
            )}
            {enCours ? 'Export en cours…' : 'Demander un export'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EtatDumpBloc({
  dump,
  enCours,
  avis,
}: {
  dump: EtatDump;
  enCours: boolean;
  avis: string | null;
}) {
  return (
    <div role="status" className="flex flex-col gap-2">
      {enCours ? (
        <p className="flex items-start gap-2 text-[0.875rem]">
          <LoaderIcon className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden="true" />
          <span>
            <span className="font-[600]">Export en cours.</span> L’opération dure plusieurs minutes.
            Vous pouvez quitter cet écran.
          </span>
        </p>
      ) : (
        <p className="text-[0.875rem] text-muted-foreground">{libelleEtatDump(dump)}</p>
      )}

      <Details dump={dump} />

      {dump.status === 'failed' && dump.failureReason !== null ? (
        <p className="flex items-start gap-2 rounded-md border border-destructive/30 px-3 py-2.5 text-[0.8125rem] text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{dump.failureReason}</span>
        </p>
      ) : null}

      {avis === null ? null : (
        <p className="flex items-start gap-2 rounded-md border border-accent-border/40 bg-accent-surface px-3 py-2.5 text-[0.8125rem] text-warning">
          <MailIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{avis}</span>
        </p>
      )}
    </div>
  );
}
