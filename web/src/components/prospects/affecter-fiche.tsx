'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoundCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchLotsExport } from '@/lib/data/lots-export';
import { affecterProspect, type AffectationCible } from '@/lib/data/prospects';
import { fetchReferenceData } from '@/lib/data/reference';
import { affecterRepresentant } from '@/lib/data/representants';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { peut } from '@/lib/types';

type Mode = 'TELECONSEILLER' | 'CAMPAGNE';
type Option = { value: string; label: string };
type Cible = 'prospect' | 'representant';

const CHAMP: Record<Mode, { label: string; placeholder: string; bascule: string }> = {
  TELECONSEILLER: {
    label: 'Téléconseiller',
    placeholder: 'Choisir un téléconseiller',
    bascule: 'ou une campagne en cours',
  },
  CAMPAGNE: {
    label: 'Campagne en cours',
    placeholder: 'Choisir une campagne',
    bascule: 'ou un téléconseiller',
  },
};

const autreMode = (mode: Mode): Mode => (mode === 'TELECONSEILLER' ? 'CAMPAGNE' : 'TELECONSEILLER');

const destinationDe = (mode: Mode, choix: string): AffectationCible =>
  mode === 'TELECONSEILLER' ? { teleconseillerId: choix } : { campagneId: choix };

const affecter = (cible: Cible, id: string, destination: AffectationCible): Promise<void> =>
  cible === 'prospect' ? affecterProspect(id, destination) : affecterRepresentant(id, destination);

const suiviePar = (
  commerciaux: readonly Option[] | undefined,
  titulaireId: string | null,
): string => {
  const titulaire = commerciaux?.find((compte) => compte.value === titulaireId);
  return titulaire === undefined
    ? 'Aucun téléconseiller ne la suit.'
    : `Suivie par ${titulaire.label}.`;
};

const optionsDe = (
  mode: Mode,
  commerciaux: readonly Option[] | undefined,
  campagnes: readonly Option[] | undefined,
): readonly Option[] => (mode === 'TELECONSEILLER' ? commerciaux : campagnes) ?? [];

/** Rien à affecter tant qu'aucune destination n'est choisie, ou que c'est déjà le titulaire. */
const sansEffet = (mode: Mode, choix: string | null, titulaireId: string | null): boolean =>
  choix === null || (mode === 'TELECONSEILLER' && choix === titulaireId);

function useCampagnesAffectables(cible: Cible, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.lotsExport({ affectation: cible }),
    queryFn: () => fetchLotsExport({ pageSize: 100 }),
    enabled,
    select: (page): Option[] =>
      page.items
        .filter((lot) => lot.pausedAt === null)
        .filter((lot) => (lot.cible === 'PROSPECTS') === (cible === 'prospect'))
        .map((lot) => ({ value: lot.id, label: lot.name })),
  });
}

/** L'encadrement confie la fiche à un téléconseiller, ou à une campagne qui désigne son membre le moins chargé. */
export function AffecterFiche({
  cible,
  id,
  nom,
  titulaireId,
  onAffectee,
}: {
  cible: Cible;
  id: string;
  nom: string;
  titulaireId: string | null;
  onAffectee?: () => void;
}) {
  const { data: user } = useQuery(meQueryOptions);
  const queryClient = useQueryClient();
  const [ouverte, setOuverte] = useState(false);
  const [mode, setMode] = useState<Mode>('TELECONSEILLER');
  const [choix, setChoix] = useState<string | null>(null);
  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
    enabled: ouverte,
  });
  const campagnes = useCampagnesAffectables(cible, ouverte && mode === 'CAMPAGNE');
  const affectation = useMutation({
    mutationFn: () => {
      if (choix === null) throw new Error('Aucune destination choisie.');
      return affecter(cible, id, destinationDe(mode, choix));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportRoot });
      onAffectee?.();
      setOuverte(false);
      toast.success('Fiche affectée.');
    },
    onError: (error) => toastApiError(error, 'La fiche n’a pas pu être affectée.'),
  });

  if (!peut(user, 'prospects.reaffecter_tout')) return null;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setMode('TELECONSEILLER');
          setChoix(titulaireId);
          setOuverte(true);
        }}
      >
        <UserRoundCheckIcon aria-hidden="true" />
        Affecter à
      </Button>
      <Dialog open={ouverte} onOpenChange={setOuverte}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Affecter {nom}</DialogTitle>
            <DialogDescription>{suiviePar(reference?.commerciaux, titulaireId)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <FilterCombobox
              label={CHAMP[mode].label}
              placeholder={CHAMP[mode].placeholder}
              options={optionsDe(mode, reference?.commerciaux, campagnes.data)}
              value={choix}
              onChange={setChoix}
            />
            <Button
              variant="link"
              className="justify-start px-0"
              onClick={() => {
                setMode(autreMode(mode));
                setChoix(null);
              }}
            >
              {CHAMP[mode].bascule}
            </Button>
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
              disabled={sansEffet(mode, choix, titulaireId) || affectation.isPending}
              onClick={() => {
                affectation.mutate();
              }}
            >
              Affecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
