import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadCloudIcon, RefreshCwIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ecrireReglagesEnrolement,
  fetchReglagesEnrolement,
  tirerPlateforme,
  viderInscriptions,
  type BilanTirage,
  type Tirage,
} from '@/lib/data/enrolement';
import { formatDateTime, formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { ProjetApi } from '@/lib/types';

function annoncerTirage(tirage: Tirage): void {
  if (tirage.erreur !== null) {
    toast.error(tirage.erreur);
    return;
  }
  const lues = `${formatNumber(tirage.lus)} inscriptions lues, ${formatNumber(tirage.crees)} nouvelles.`;
  toast.success(
    tirage.disparues === 0
      ? lues
      : `${lues} ${formatNumber(tirage.disparues)} ne sont plus sur la plateforme.`,
  );
}

function ActionsTirage({
  bloque,
  reconstruitEnCours,
  tirageEnCours,
  onReconstruire,
  onTirer,
}: {
  bloque: boolean;
  reconstruitEnCours: boolean;
  tirageEnCours: boolean;
  onReconstruire: () => void;
  onTirer: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={bloque || reconstruitEnCours}
        onClick={onReconstruire}
      >
        <RefreshCwIcon className="size-4" aria-hidden="true" />
        {reconstruitEnCours ? 'Reconstruction…' : 'Vider puis tirer'}
      </Button>

      <Button type="button" disabled={bloque || tirageEnCours} onClick={onTirer}>
        <DownloadCloudIcon className="size-4" aria-hidden="true" />
        {tirageEnCours ? 'Tirage en cours…' : 'Tirer maintenant'}
      </Button>
    </div>
  );
}

function DernierTirage({ dernier }: { dernier: BilanTirage | null }) {
  if (dernier === null) {
    return (
      <p className="text-[0.8125rem] text-muted-foreground">
        Aucun tirage effectué pour le moment.
      </p>
    );
  }

  return (
    <>
      <p className="text-[0.8125rem] text-muted-foreground">
        {`Dernier tirage le ${formatDateTime(dernier.termineLe)} : ${formatNumber(dernier.lus)} lues, ${formatNumber(dernier.crees)} créées, ${formatNumber(dernier.misAJour)} mises à jour, ${formatNumber(dernier.rapproches)} rapprochées, ${formatNumber(dernier.disparues)} disparues.`}
      </p>
      {dernier.erreur === null ? null : (
        <p role="alert" className="text-[0.875rem] text-destructive">
          Dernière erreur : {dernier.erreur}
        </p>
      )}
    </>
  );
}

export function EnrolementReglages({ projet }: { projet: ProjetApi }) {
  const queryClient = useQueryClient();
  const [reconstruction, setReconstruction] = useState(false);

  const reglages = useQuery({
    queryKey: queryKeys.enrolementReglages(projet),
    queryFn: () => fetchReglagesEnrolement(projet),
  });

  const invalider = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.enrolementRoot });
  };

  const enregistrer = useMutation({
    mutationFn: (corps: { frequenceMinutes?: number; repriseDepuis?: string }) =>
      ecrireReglagesEnrolement(projet, corps),
    onSuccess: () => {
      toast.success('Réglages enregistrés.');
      invalider();
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Les réglages n’ont pas pu être enregistrés.');
    },
  });

  const tirer = useMutation({
    mutationFn: () => tirerPlateforme(projet),
    onSuccess: (tirage) => {
      annoncerTirage(tirage);
      invalider();
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le tirage n’a pas pu être lancé.');
    },
  });

  const reconstruire = useMutation({
    mutationFn: async () => {
      const vidage = await viderInscriptions(projet);
      return { vidage, tirage: await tirerPlateforme(projet) };
    },
    onSuccess: ({ vidage, tirage }) => {
      setReconstruction(false);
      if (tirage.erreur === null) {
        toast.success(
          `${formatNumber(vidage.supprimees)} inscriptions vidées, ${formatNumber(tirage.lus)} relues.`,
        );
      } else {
        toast.error(tirage.erreur);
      }
      invalider();
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le miroir n’a pas pu être reconstruit.');
    },
  });

  if (reglages.isPending) return <Skeleton className="h-40 w-full rounded-md" />;
  if (reglages.isError) {
    return (
      <QueryErrorState
        error={reglages.error}
        onRetry={() => {
          void reglages.refetch();
        }}
        fallback="Les réglages du connecteur n’ont pas pu être lus."
      />
    );
  }

  const donnees = reglages.data;
  const dernier = donnees.dernierTirage;
  const bloque = !donnees.configuree;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`frequence-${projet}`}>Tirer toutes les</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`frequence-${projet}`}
                  type="number"
                  min={5}
                  max={1440}
                  className="w-24"
                  defaultValue={donnees.frequenceMinutes}
                  onBlur={(event) => {
                    const minutes = Number(event.target.value);
                    if (Number.isInteger(minutes) && minutes !== donnees.frequenceMinutes) {
                      enregistrer.mutate({ frequenceMinutes: minutes });
                    }
                  }}
                />
                <span className="text-[0.875rem] text-muted-foreground">minutes</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`reprise-${projet}`}>Reprendre depuis</Label>
              <Input
                id={`reprise-${projet}`}
                type="date"
                className="w-44"
                defaultValue={donnees.repriseDepuis?.slice(0, 10) ?? ''}
                onBlur={(event) => {
                  enregistrer.mutate({ repriseDepuis: event.target.value });
                }}
              />
            </div>
          </div>

          <ActionsTirage
            bloque={bloque}
            reconstruitEnCours={reconstruire.isPending}
            tirageEnCours={tirer.isPending}
            onReconstruire={() => {
              setReconstruction(true);
            }}
            onTirer={() => {
              tirer.mutate();
            }}
          />
        </div>

        {bloque ? (
          <p role="alert" className="text-[0.875rem] text-destructive">
            L’adresse et le jeton de cette plateforme ne sont pas renseignés dans l’environnement du
            serveur. Aucun tirage n’a lieu.
          </p>
        ) : null}

        <DernierTirage dernier={dernier} />
      </CardContent>

      {reconstruction ? (
        <ConfirmDialog
          open
          onOpenChange={setReconstruction}
          pending={reconstruire.isPending}
          confirmLabel="Vider puis tirer"
          title="Vider le miroir puis le reconstruire ?"
          description="Les inscriptions lues pour ce projet sont effacées du CRM, puis la plateforme est relue en entier. Elle n’est pas modifiée."
          onConfirm={() => {
            reconstruire.mutate();
          }}
        />
      ) : null}
    </Card>
  );
}
