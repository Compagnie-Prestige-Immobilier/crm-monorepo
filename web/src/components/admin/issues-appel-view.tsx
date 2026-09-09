import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { MotifFormDialog } from '@/components/admin/motif-form-dialog';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  activerMotif,
  fetchMotifsAdministration,
  LIBELLES_EFFET_MOTIF,
  type MotifIssue,
} from '@/lib/data/call-outcome-reasons';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const CLE_MOTIFS = [...queryKeys.referentielsRoot, 'issues-appel'] as const;

function saisieExigee(motif: MotifIssue): string {
  const exigences = [
    motif.requiresComment ? 'commentaire' : null,
    motif.requiresCallback ? 'date de rappel' : null,
  ].filter((valeur) => valeur !== null);
  return exigences.length === 0 ? '–' : exigences.join(', ');
}

export function IssuesAppelView() {
  const queryClient = useQueryClient();
  const [edite, setEdite] = useState<MotifIssue | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const motifs = useQuery({ queryKey: CLE_MOTIFS, queryFn: fetchMotifsAdministration });

  const activation = useMutation({
    mutationFn: (motif: MotifIssue) => activerMotif(motif.id, !motif.isActive),
    onSuccess: (motif) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      toast.success(motif.isActive ? `${motif.label} remis en service.` : `${motif.label} retiré.`);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le motif n’a pas pu être modifié.');
    },
  });

  if (motifs.isError) {
    return (
      <QueryErrorState
        error={motifs.error}
        onRetry={() => {
          void motifs.refetch();
        }}
        fallback="Les motifs n’ont pas pu être chargés."
      />
    );
  }

  const ouvrir = (motif: MotifIssue | null): void => {
    setEdite(motif);
    setOuvert(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Issues proposées au téléconseiller à la fin d’un appel. L’effet décide de ce qu’il advient
          du prospect.
        </p>
        <Button
          type="button"
          onClick={() => {
            ouvrir(null);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Nouveau motif
        </Button>
      </div>

      {motifs.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Code</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Effet sur le prospect</TableHead>
                <TableHead>Saisie exigée</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {motifs.data.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-12 text-center">
                    <p className="font-[600]">Aucun motif d’issue.</p>
                    <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                      Ajoutez-en un pour qualifier la fin des appels.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                motifs.data.map((motif) => (
                  <TableRow key={motif.id}>
                    <TableCell className="font-mono text-[0.8125rem]">{motif.code}</TableCell>
                    <TableCell className="font-[600]">
                      {motif.label}
                      {motif.isSystem ? (
                        <Badge variant="secondary" className="ml-2">
                          Système
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{LIBELLES_EFFET_MOTIF[motif.effect]}</TableCell>
                    <TableCell className="text-[0.8125rem] text-muted-foreground">
                      {saisieExigee(motif)}
                    </TableCell>
                    <TableCell>
                      {motif.isActive ? (
                        <Badge variant="secondary">En service</Badge>
                      ) : (
                        <Badge variant="destructive">Retiré</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Modifier ${motif.label}`}
                        onClick={() => {
                          ouvrir(motif);
                        }}
                      >
                        <PencilIcon className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={activation.isPending || motif.isSystem}
                        aria-label={
                          motif.isActive ? `Retirer ${motif.label}` : `Réactiver ${motif.label}`
                        }
                        onClick={() => {
                          activation.mutate(motif);
                        }}
                      >
                        {motif.isActive ? (
                          <PowerOffIcon className="size-4" aria-hidden="true" />
                        ) : (
                          <PowerIcon className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {ouvert ? (
        <MotifFormDialog
          key={edite?.id ?? 'nouveau'}
          motif={edite}
          open={ouvert}
          onOpenChange={setOuvert}
        />
      ) : null}
    </div>
  );
}
