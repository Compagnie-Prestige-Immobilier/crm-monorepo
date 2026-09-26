'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  COURRIEL_STATUT_LABELS,
  COURRIEL_TYPE_LABELS,
  fetchCourriels,
  resendCourriel,
  type ObjetCourriel,
  type TypeCourriel,
} from '@/lib/data/courriels';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Courriel } from '@/lib/types';

const VARIANTE_STATUT: Record<
  Courriel['statut'],
  'secondary' | 'success' | 'info' | 'destructive' | 'outline'
> = {
  ENVOYE: 'secondary',
  REMIS: 'success',
  OUVERT: 'info',
  EN_ATTENTE: 'secondary',
  ECHEC: 'destructive',
  EN_ATTENTE: 'outline',
};

export function StatutCourriel({ courriel }: { courriel: Courriel }) {
  return (
    <Badge variant={VARIANTE_STATUT[courriel.statut]}>
      {COURRIEL_STATUT_LABELS[courriel.statut]}
    </Badge>
  );
}

/** Les courriels partis pour un objet, avec leur sort Brevo et le renvoi. */
export function BankCourriels({
  objetType,
  objetId,
}: {
  objetType: ObjetCourriel;
  objetId: string;
}) {
  const queryClient = useQueryClient();
  const courriels = useQuery({
    queryKey: queryKeys.courriels(objetType, objetId),
    queryFn: () => fetchCourriels(objetType, objetId),
  });
  const renvoi = useMutation({
    mutationFn: (id: string) => resendCourriel(id),
    onSuccess: (courriel) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.courrielsRoot });
      if (courriel.statut === 'ECHEC') {
        toast.error(courriel.erreur ?? 'Le renvoi a échoué.');
        return;
      }
      toast.success('Courriel renvoyé.');
    },
    onError: (error) => {
      toastApiError(error, 'Le renvoi a échoué.');
    },
  });

  if (courriels.isPending) return <Skeleton className="h-24 rounded-lg" />;
  if (courriels.isError || courriels.data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 text-[0.875rem] text-muted-foreground">
          <MailIcon className="size-4 shrink-0" aria-hidden="true" />
          Aucun courriel envoyé pour ce dossier.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <ul className="divide-y divide-border">
          {courriels.data.map((courriel) => (
            <li
              key={courriel.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-[600]">
                  {COURRIEL_TYPE_LABELS[courriel.type as TypeCourriel] ?? courriel.type}
                </p>
                <p className="truncate text-[0.8125rem] text-muted-foreground">{courriel.sujet}</p>
                <p className="text-[0.75rem] text-muted-foreground">
                  À {courriel.destinataires.join(', ') || 'personne'}
                  {courriel.copies.length > 0 ? `, copie ${courriel.copies.join(', ')}` : ''}
                  {' · '}
                  <time dateTime={courriel.createdAt}>{formatDateTime(courriel.createdAt)}</time>
                  {courriel.remisLe !== null ? `, remis ${formatDateTime(courriel.remisLe)}` : ''}
                  {courriel.ouvertLe !== null
                    ? `, ouvert ${formatDateTime(courriel.ouvertLe)}`
                    : ''}
                </p>
                {courriel.statut === 'ECHEC' && courriel.erreur !== null ? (
                  <p className="mt-1 text-[0.8125rem] text-destructive">{courriel.erreur}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <StatutCourriel courriel={courriel} />
                {courriel.statut === 'ECHEC' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={renvoi.isPending}
                    onClick={() => {
                      renvoi.mutate(courriel.id);
                    }}
                  >
                    <RotateCcwIcon aria-hidden="true" />
                    Renvoyer
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
