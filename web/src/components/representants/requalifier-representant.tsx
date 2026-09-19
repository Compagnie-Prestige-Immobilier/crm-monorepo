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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { poserStatutRepresentant } from '@/lib/data/representants';
import {
  fetchStatutsQualification,
  libelleStatut,
  type StatutQualification,
} from '@/lib/data/statuts-qualification';
import { dakarLocalToIso } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { peut } from '@/lib/types';

type Famille = 'JOIGNABLE' | 'INJOIGNABLE';

const FAMILLES: readonly { value: Famille; label: string }[] = [
  { value: 'JOIGNABLE', label: 'Joignable' },
  { value: 'INJOIGNABLE', label: 'Injoignable' },
];

const libelle = (
  statut: StatutQualification,
  catalogue: readonly StatutQualification[],
): string => {
  const parent = catalogue.find((item) => item.id === statut.parentId);
  return parent === undefined
    ? libelleStatut(statut)
    : `${libelleStatut(parent)} · ${libelleStatut(statut)}`;
};

export function RequalifierRepresentant({
  representantId,
  nom,
}: {
  representantId: string;
  nom: string;
}) {
  const { data: user } = useQuery(meQueryOptions);
  const queryClient = useQueryClient();
  const [ouverte, setOuverte] = useState(false);
  const [famille, setFamille] = useState<Famille>('JOIGNABLE');
  const [statutId, setStatutId] = useState<string | null>(null);
  const [echeance, setEcheance] = useState('');
  const catalogue = useQuery({
    queryKey: queryKeys.statutsQualification,
    queryFn: () => fetchStatutsQualification(),
    enabled: ouverte,
  });
  const liste = catalogue.data ?? [];
  const statuts = liste.filter((statut) =>
    famille === 'JOIGNABLE' ? statut.effect !== 'UNREACHABLE' : statut.effect === 'UNREACHABLE',
  );
  const statut = statuts.find((item) => item.id === statutId) ?? null;
  const exigeDate = statut?.effect === 'SCHEDULE_CALLBACK';
  const pret = statut !== null && (!exigeDate || dakarLocalToIso(echeance) !== null);

  const requalification = useMutation({
    mutationFn: async () => {
      if (statut === null) return;
      const callbackAt = exigeDate ? dakarLocalToIso(echeance) : null;
      await poserStatutRepresentant(representantId, {
        statutQualificationId: statut.id,
        ...(callbackAt === null ? {} : { callbackAt }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      setOuverte(false);
      toast.success('Fiche requalifiée.');
    },
    onError: (error) => toastApiError(error, 'La fiche n’a pas pu être requalifiée.'),
  });

  if (!peut(user, 'prospects.superviser')) return null;

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
            <DialogTitle>Requalifier {nom}</DialogTitle>
            <DialogDescription>Nouveau statut, sans appel.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Tabs
              value={famille}
              onValueChange={(value) => {
                setFamille(value as Famille);
                setStatutId(null);
              }}
            >
              <TabsList className="w-full">
                {FAMILLES.map((item) => (
                  <TabsTrigger key={item.value} value={item.value} className="flex-1">
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="grid gap-2">
              <Label htmlFor="requalifier-rep-statut">Statut</Label>
              <Select
                items={statuts.map((item) => ({ value: item.id, label: libelle(item, liste) }))}
                value={statutId}
                onValueChange={setStatutId}
              >
                <SelectTrigger id="requalifier-rep-statut">
                  <SelectValue placeholder="Choisir un statut" />
                </SelectTrigger>
                <SelectContent>
                  {statuts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {libelle(item, liste)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {exigeDate ? (
              <div className="grid gap-2">
                <Label htmlFor="requalifier-rep-echeance">Date du rappel (heure de Dakar)</Label>
                <Input
                  id="requalifier-rep-echeance"
                  type="datetime-local"
                  value={echeance}
                  onChange={(event) => {
                    setEcheance(event.target.value);
                  }}
                />
              </div>
            ) : null}
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
              disabled={!pret || requalification.isPending}
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
