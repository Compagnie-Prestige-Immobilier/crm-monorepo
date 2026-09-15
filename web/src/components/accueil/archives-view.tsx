'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Pages } from '@/components/console/rep-annuaire';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { detruireVisite, visitesArchiveesQuery } from '@/lib/data/visites-archives';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 50;

/**
 * Les visites retirées du registre. La direction seule y accède, et ne peut
 * détruire qu'au bout de trente jours : le serveur refuse avant, pour qu'un
 * geste d'humeur ne soit pas irréversible.
 */
export function ArchivesView() {
  const client = useQueryClient();
  const [aDetruire, setADetruire] = useState<{ id: string; nom: string } | null>(null);
  const [page, setPage] = useState(1);
  const archives = useQuery(visitesArchiveesQuery(page, PAGE_SIZE));

  const destruction = useMutation({
    mutationFn: (id: string) => detruireVisite(id),
    onSuccess: () => {
      setADetruire(null);
      void client.invalidateQueries({ queryKey: ['visites'] });
      toast.success('Visite détruite définitivement.');
    },
    onError: (erreur: Error) => {
      toast.error(erreur.message);
    },
  });

  if (archives.data === undefined) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="flex flex-col gap-6">
      {/* Pas de titre ici : la barre du haut porte le `h1` de chaque écran. */}
      <p className="text-sm text-muted-foreground">
        Retirées du registre, des statistiques et de l’impression. Elles se détruisent
        définitivement au bout de trente jours.
      </p>

      {archives.data.items.length === 0 ? (
        <EmptyState
          icon={Trash2Icon}
          title="Aucune visite archivée"
          description="Une visite retirée du registre apparaîtra ici."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {archives.data.items.map((visite) => (
            <li
              key={visite.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-[600]">{visite.visitorName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {visite.reference} · visite du {formatDate(visite.date)}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={destruction.isPending}
                onClick={() => {
                  setADetruire({ id: visite.id, nom: visite.visitorName });
                }}
              >
                <Trash2Icon className="size-4" aria-hidden="true" />
                Détruire
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Pages page={page} pageCount={archives.data.meta.pageCount} onPage={setPage} />

      <ConfirmDialog
        open={aDetruire !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setADetruire(null);
        }}
        title={`Détruire la visite de ${aDetruire?.nom ?? ''} ?`}
        description="La ligne disparaît de la base. C’est définitif et sans retour possible."
        confirmLabel="Détruire définitivement"
        pending={destruction.isPending}
        onConfirm={() => {
          if (aDetruire !== null) destruction.mutate(aDetruire.id);
        }}
      />
    </div>
  );
}
