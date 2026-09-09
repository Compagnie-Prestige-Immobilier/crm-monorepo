import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { retirerInscription, type Inscription } from '@/lib/data/enrolement';
import { formatDate, formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { ProjetApi } from '@/lib/types';

export function TableauInscriptions({
  projet,
  items,
  meta,
  page,
  onPage,
}: {
  projet: ProjetApi;
  items: readonly Inscription[];
  meta: { total: number; page: number; pageCount: number };
  page: number;
  onPage: (page: number) => void;
}) {
  const queryClient = useQueryClient();
  const [aRetirer, setARetirer] = useState<Inscription | null>(null);

  const retirer = useMutation({
    mutationFn: (id: string) => retirerInscription(projet, id),
    onSuccess: () => {
      setARetirer(null);
      toast.success('Inscription retirée du miroir.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrolementRoot });
    },
    onError: (erreur) => {
      toastApiError(erreur, 'L’inscription n’a pas pu être retirée.');
    },
  });

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-16 text-center">
        <p className="font-[600]">Aucune inscription</p>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          Lancez un tirage, ou élargissez les filtres : la plateforme n’a rien rendu sur cette
          période.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nom</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Étape</TableHead>
              <TableHead>Inscription</TableHead>
              <TableHead>Prospect</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Retirer</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((ligne) => (
              <TableRow key={ligne.id}>
                <TableCell className="font-[600]">
                  {ligne.prenom} {ligne.nom}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {ligne.email ?? ligne.phoneE164 ?? '–'}
                </TableCell>
                <TableCell>
                  {ligne.statutDistant}
                  {ligne.disparueLe === null ? null : (
                    <span className="ml-2 text-[0.75rem] text-muted-foreground">
                      retirée de la plateforme le {formatDate(ligne.disparueLe)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{ligne.etapeDistante ?? '–'}</TableCell>
                <TableCell>
                  {ligne.inscriteLe === null ? '–' : formatDate(ligne.inscriteLe)}
                </TableCell>
                <TableCell>{ligne.prospectId === null ? 'Non rapproché' : 'Rapproché'}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Retirer ${ligne.prenom} ${ligne.nom} du miroir`}
                    onClick={() => {
                      setARetirer(ligne);
                    }}
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] tabular-nums text-muted-foreground">
          {formatNumber(meta.total)} inscriptions · page {formatNumber(meta.page)} sur{' '}
          {formatNumber(Math.max(1, meta.pageCount))}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              onPage(page - 1);
            }}
          >
            Précédent
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={page >= meta.pageCount}
            onClick={() => {
              onPage(page + 1);
            }}
          >
            Suivant
          </Button>
        </div>
      </div>

      {aRetirer === null ? null : (
        <ConfirmDialog
          open
          onOpenChange={(ouvert) => {
            if (!ouvert) setARetirer(null);
          }}
          pending={retirer.isPending}
          confirmLabel="Retirer"
          title="Retirer cette inscription du miroir ?"
          description={`${aRetirer.prenom} ${aRetirer.nom} disparaît de cet écran. La plateforme n’est pas touchée : le prochain tirage la redépose si elle y figure encore.`}
          onConfirm={() => {
            retirer.mutate(aRetirer.id);
          }}
        />
      )}
    </div>
  );
}
