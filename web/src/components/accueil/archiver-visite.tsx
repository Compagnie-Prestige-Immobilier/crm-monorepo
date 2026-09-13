'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArchiveIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { archiverVisite } from '@/lib/data/visites-archives';

/**
 * Le registre n'avait aucun retrait : une visite saisie par erreur y restait
 * pour toujours. L'archivage la sort du registre, des statistiques et de
 * l'impression ; seule la direction peut ensuite la détruire.
 */
export function ArchiverVisite({ visiteId, visiteur }: { visiteId: string; visiteur: string }) {
  const client = useQueryClient();
  const [ouvert, setOuvert] = useState(false);

  const archivage = useMutation({
    mutationFn: () => archiverVisite(visiteId),
    onSuccess: () => {
      setOuvert(false);
      void client.invalidateQueries({ queryKey: ['visites'] });
      toast.success('Visite archivée. Elle sort du registre.');
    },
    onError: (erreur: Error) => {
      toast.error(erreur.message);
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Archiver la visite de ${visiteur}`}
        onClick={() => {
          setOuvert(true);
        }}
      >
        <ArchiveIcon aria-hidden="true" />
        Archiver
      </Button>

      <ConfirmDialog
        open={ouvert}
        onOpenChange={setOuvert}
        title={`Archiver la visite de ${visiteur} ?`}
        description="Elle sort du registre, des statistiques et de l’impression. La direction pourra la détruire définitivement au bout de trente jours."
        confirmLabel="Archiver"
        pending={archivage.isPending}
        onConfirm={() => {
          archivage.mutate();
        }}
      />
    </>
  );
}
