'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { Consignation } from '@/components/console/console-view';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { callbackKeys } from '@/lib/data/console';
import { ouvrirFiche, type OuvertureFiche } from '@/lib/data/ouvertures';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { ProspectRow } from '@/lib/types';

/**
 * L'appel d'un prospect, ouvert depuis la liste : le même écran que la console,
 * sans passer par son annuaire. L'ouverture porte le chronomètre et le
 * brouillon repris au rappel ; son échec ne retient pas l'appel.
 */
export function AppelProspect({ prospect }: { prospect: ProspectRow }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const retour = (): void => {
    router.push('/grand-public');
  };

  const ouvrir = useMutation({
    mutationFn: (): Promise<OuvertureFiche> => ouvrirFiche({ prospectId: prospect.id }),
    onSuccess: (ouverture) => {
      queryClient.setQueryData(queryKeys.ouvertureCourante, ouverture);
    },
    onError: (error) => {
      toastApiError(error, 'Le chronomètre n’a pas démarré. L’appel se consigne quand même.');
    },
  });

  const lancee = useRef(false);
  useEffect(() => {
    if (lancee.current) return;
    lancee.current = true;
    ouvrir.mutate();
  }, [ouvrir]);

  if (ouvrir.isPending) return <ChargementFiche />;

  return (
    <Consignation
      prospect={prospect}
      ouverture={ouvrir.data ?? null}
      projet="GRAND_PUBLIC"
      onAbandon={retour}
      onEnregistre={(_nom, detailStatut) => {
        queryClient.setQueryData(queryKeys.ouvertureCourante, null);
        void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
        void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
        toast.success(
          `Appel consigné pour ${prospect.prenom} ${prospect.nom}${detailStatut ? ` · ${detailStatut}` : ''}`,
        );
        retour();
      }}
    />
  );
}

function ChargementFiche() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-12 w-80" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
