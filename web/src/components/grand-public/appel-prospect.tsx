'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { Consignation } from '@/components/console/console-view';
import { cleAppels, ModifierAppel } from '@/components/grand-public/historique-appels';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { callbackKeys } from '@/lib/data/console';
import { ouvrirFiche, type OuvertureFiche } from '@/lib/data/ouvertures';
import { fetchProspectCallAttempts } from '@/lib/data/prospects';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { CALL_OUTCOME_LABELS, type ProspectRow } from '@/lib/types';

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
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <DerniereQualification
        prospect={prospect}
        onModifiee={() => {
          router.refresh();
        }}
      />
      <Consignation
        prospect={prospect}
        ouverture={ouvrir.data ?? null}
        projet="GRAND_PUBLIC"
        canCreateProspect={false}
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
    </div>
  );
}

/** Une fiche déjà qualifiée se corrige ici : la modification remplace le dernier appel, sans en consigner un nouveau. */
function DerniereQualification({
  prospect,
  onModifiee,
}: {
  prospect: ProspectRow;
  onModifiee: () => void;
}) {
  const appels = useQuery({
    queryKey: cleAppels(prospect.id),
    queryFn: () => fetchProspectCallAttempts(prospect.id),
  });
  const dernier = appels.data?.[0];
  if (dernier === undefined) return null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-muted-foreground">Dernière qualification</p>
          <p className="font-[600]">
            {dernier.reasonLabel ?? CALL_OUTCOME_LABELS[dernier.outcome]}
          </p>
          <p className="text-[0.8125rem] text-muted-foreground">
            {formatDateTime(dernier.clientCreatedAt)} · {dernier.performedByName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/grand-public/${prospect.id}`}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Voir l’historique
          </Link>
          {dernier.editable ? (
            <ModifierAppel
              appel={dernier}
              prospectId={prospect.id}
              libelle="Modifier la qualification"
              onFicheModifiee={onModifiee}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
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
