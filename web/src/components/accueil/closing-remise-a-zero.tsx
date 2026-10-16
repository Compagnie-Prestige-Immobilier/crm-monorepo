'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  CLE_RENDEZ_VOUS,
  reinitialiserClosing,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';
import { formatDateTime, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { peut } from '@/lib/types';

/** Le téléphone et la date distinguent deux homonymes avant d'écrire. */
export function repereRendezVous(rendezVous: RendezVousObtenu): string {
  const quand = rendezVous.quand === null ? null : `RV du ${formatDateTime(rendezVous.quand)}`;
  return [formatPhone(rendezVous.phoneE164), quand].filter(Boolean).join(' · ');
}

/** Un closing saisi sur le mauvais rendez-vous s'efface avec la présence notée. */
export function RemiseAZeroClosing({
  rendezVous,
  onFait,
}: {
  rendezVous: RendezVousObtenu;
  onFait: () => void;
}) {
  const client = useQueryClient();
  const { data: user } = useQuery(meQueryOptions);
  const [ouvert, setOuvert] = useState(false);
  const remise = useMutation({
    mutationFn: () => reinitialiserClosing(rendezVous.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CLE_RENDEZ_VOUS });
      void client.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      toast.success('Closing remis à zéro. Le rendez-vous attend de nouveau la venue.');
      setOuvert(false);
      onFait();
    },
    onError: (error) => {
      toastApiError(error, 'Le closing n’a pas été remis à zéro.');
    },
  });
  if (!peut(user, 'rendez_vous.reinitialiser_closing')) return null;
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="gap-1.5 self-start text-destructive"
        onClick={() => {
          setOuvert(true);
        }}
      >
        <RotateCcwIcon className="size-3.5" aria-hidden="true" />
        Remettre à zéro
      </Button>
      <ConfirmDialog
        open={ouvert}
        onOpenChange={setOuvert}
        pending={remise.isPending}
        onConfirm={() => {
          remise.mutate();
        }}
        confirmLabel="Remettre à zéro"
        confirmVariant="destructive"
        title={`Remettre à zéro le closing de ${rendezVous.prenom} ${rendezVous.nom} ?`}
        description={`${repereRendezVous(rendezVous)}. Le formulaire et la présence notée s’effacent : le rendez-vous attend de nouveau la venue. Le journal garde ce qui est effacé.`}
      />
    </>
  );
}
