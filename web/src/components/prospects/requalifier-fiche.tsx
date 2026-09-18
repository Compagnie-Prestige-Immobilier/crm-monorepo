'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { requalifierProspect } from '@/lib/data/prospects';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { peut, type Projet, type ProspectRow, type ProspectStatut } from '@/lib/types';

type StatutRequalifiable = 'NOUVEAU' | 'CONTACTE' | 'CONVERTI' | 'PERDU';

const CHOIX: readonly { value: StatutRequalifiable; label: string }[] = [
  { value: 'NOUVEAU', label: 'À traiter (remise à zéro)' },
  { value: 'CONTACTE', label: 'Contacté' },
  { value: 'CONVERTI', label: 'Converti' },
  { value: 'PERDU', label: 'Perdu' },
];

export function RequalifierFiche({
  prospect,
  projet,
  statut,
  onRequalifiee,
}: {
  prospect: ProspectRow;
  projet: Projet;
  statut: ProspectStatut;
  onRequalifiee?: (saved: ProspectRow) => void;
}) {
  const { data: user } = useQuery(meQueryOptions);
  const queryClient = useQueryClient();
  const [ouverte, setOuverte] = useState(false);
  const [choix, setChoix] = useState<StatutRequalifiable>('NOUVEAU');
  const requalification = useMutation({
    mutationFn: () => requalifierProspect(prospect.id, { projet, statut: choix }),
    onSuccess: (saved) => {
      onRequalifiee?.(saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      setOuverte(false);
      toast.success('Fiche requalifiée.');
    },
    onError: (error) => toastApiError(error, 'La fiche n’a pas pu être requalifiée.'),
  });

  if (!peut(user, 'prospects.superviser') || statut === 'CONVERTI') return null;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOuverte(true);
        }}
      >
        <RotateCcwIcon aria-hidden="true" />
        Requalifier
      </Button>
      <Dialog open={ouverte} onOpenChange={setOuverte}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Requalifier {prospect.prenom} {prospect.nom}
            </DialogTitle>
            <DialogDescription>
              Les appels déjà passés restent dans l’historique de leur téléconseiller.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="requalifier-statut">Nouveau statut</Label>
            <Select
              items={CHOIX}
              value={choix}
              onValueChange={(value) => {
                if (value !== null) setChoix(value);
              }}
            >
              <SelectTrigger id="requalifier-statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHOIX.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOuverte(false);
              }}
            >
              Annuler
            </Button>
            <Button
              disabled={requalification.isPending}
              onClick={() => {
                requalification.mutate();
              }}
            >
              Requalifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
