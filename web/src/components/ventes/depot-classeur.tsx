'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, UploadIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { deposerClasseurVentes } from '@/lib/data/ventes';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

export function DepotClasseur({ premier }: { premier: boolean }) {
  const queryClient = useQueryClient();
  const fichierId = useId();
  const depuisId = useId();
  const [ouvert, setOuvert] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [depuis, setDepuis] = useState('');

  const depot = useMutation({
    mutationFn: () => {
      if (fichier === null) throw new Error('Choisissez le classeur.');
      return deposerClasseurVentes(fichier, depuis);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.ventes, data);
      toast.success(`${data.ventes.length} ventes importées.`);
      setOuvert(false);
      setFichier(null);
    },
    onError: (error) => toastApiError(error, 'Le classeur n’a pas pu être importé.'),
  });

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <Button variant={premier ? 'default' : 'outline'} onClick={() => setOuvert(true)}>
        <UploadIcon aria-hidden="true" />
        {premier ? 'Importer le tableau des ventes' : 'Remplacer le classeur'}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importer le tableau des ventes</DialogTitle>
          <DialogDescription>
            Les onglets « Tableau des ventes » et « Échéances mensuelles » sont lus. Le classeur
            précédent est remplacé.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fichierId}>Classeur Excel</Label>
            <Input
              id={fichierId}
              type="file"
              accept=".xlsx"
              onChange={(event) => setFichier(event.target.files?.item(0) ?? null)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={depuisId}>Ventes souscrites à partir du</Label>
            <Input
              id={depuisId}
              type="date"
              value={depuis}
              onChange={(event) => setDepuis(event.target.value)}
            />
            <p className="text-[0.8125rem] text-muted-foreground">Vide : toutes les ventes.</p>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={fichier === null || depot.isPending} onClick={() => depot.mutate()}>
            {depot.isPending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
