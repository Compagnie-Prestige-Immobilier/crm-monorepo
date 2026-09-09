import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { DialogueEtape } from '@/components/banque/etape-dialogue';
import { ActionsEtape, LigneEtape } from '@/components/banque/etapes-lignes';
import { etapesOuvertes, etapesTerminales, LIBELLES_TYPE_ETAPE } from '@/components/banque/flux';
import { EtapeBadge } from '@/components/banque/pieces';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  activerEtape,
  fetchEtapes,
  reordonnerEtapes,
  type EtapeBanque,
} from '@/lib/data/bank-cases';
import { apiErrorCode, toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const CODE_ETAPE_OCCUPEE = 'BANK_STAGE_HAS_OPEN_CASES';

export function EtapesBancaires() {
  const queryClient = useQueryClient();
  const [creation, setCreation] = useState(false);
  const [renommee, setRenommee] = useState<EtapeBanque | null>(null);
  const [aDesactiver, setADesactiver] = useState<EtapeBanque | null>(null);

  const etapes = useQuery({
    queryKey: queryKeys.bankStages(true),
    queryFn: () => fetchEtapes(true),
  });

  function invalider(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankStagesRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankCasesRoot });
  }

  const reordonner = useMutation({
    mutationFn: (ids: string[]) => reordonnerEtapes(ids),
    onSuccess: () => {
      invalider();
      toast.success('Ordre du flux mis à jour.');
    },
    onError: (erreur: unknown) => {
      toastApiError(erreur, 'Le réordonnancement a échoué.');
    },
  });

  const basculer = useMutation({
    mutationFn: (entree: { id: string; actif: boolean }) => activerEtape(entree.id, entree.actif),
    onSuccess: (etape) => {
      invalider();
      setADesactiver(null);
      toast.success(
        etape.isActive ? `« ${etape.label} » réactivée.` : `« ${etape.label} » désactivée.`,
      );
    },
    onError: (erreur: unknown) => {
      if (apiErrorCode(erreur) === CODE_ETAPE_OCCUPEE) {
        toast.error(
          'Des dossiers occupent cette étape. Faites-les avancer ou rejetez-les avant de la désactiver.',
        );
        return;
      }
      toastApiError(erreur, 'Le changement d’état a échoué.');
    },
  });

  if (etapes.isPending) return <SqueletteEtapes />;

  if (etapes.isError) {
    return (
      <QueryErrorState
        error={etapes.error}
        onRetry={() => {
          void etapes.refetch();
        }}
        fallback="Le flux de traitement n’a pas pu être chargé."
      />
    );
  }

  const ouvertes = etapesOuvertes(etapes.data);

  function deplacer(index: number, sens: -1 | 1): void {
    const cible = index + sens;
    if (cible < 0 || cible >= ouvertes.length) return;
    // L'étape initiale reste en tête : la déplacer viderait le point d'entrée du flux.
    if (ouvertes[0]?.isInitial === true && (index === 0 || cible === 0)) return;

    const suite = [...ouvertes];
    const deplacee = suite[index];
    const echangee = suite[cible];
    if (deplacee === undefined || echangee === undefined) return;
    suite[index] = echangee;
    suite[cible] = deplacee;
    reordonner.mutate(suite.map((etape) => etape.id));
  }

  const initialeVerrouillee = ouvertes[0]?.isInitial === true;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Les dossiers parcourent ces étapes dans l’ordre. Une étape désactivée est sautée.
          L’encaissement se déclare à la dernière étape ouverte.
        </p>
        <Button
          type="button"
          onClick={() => {
            setCreation(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Nouvelle étape
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Étapes ouvertes</CardTitle>
          <CardDescription>Ordre du flux, de la première à la dernière.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ol className="divide-y divide-border">
            {ouvertes.map((etape, index) => (
              <LigneEtape key={etape.id} etape={etape} rang={index + 1}>
                <ActionsEtape
                  etape={etape}
                  monter={index > 0 && !(initialeVerrouillee && index === 1)}
                  descendre={index < ouvertes.length - 1 && !(initialeVerrouillee && index === 0)}
                  occupe={reordonner.isPending || basculer.isPending}
                  onDeplacer={(sens) => {
                    deplacer(index, sens);
                  }}
                  onRenommer={() => {
                    setRenommee(etape);
                  }}
                  onBasculer={() => {
                    if (etape.isActive) {
                      setADesactiver(etape);
                      return;
                    }
                    basculer.mutate({ id: etape.id, actif: true });
                  }}
                />
              </LigneEtape>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Étapes terminales</CardTitle>
          <CardDescription>
            Non configurables. Encaissement : montant strictement positif. Rejet : motif
            obligatoire, montant à zéro.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {etapesTerminales(etapes.data).map((etape) => (
              <li key={etape.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <EtapeBadge etape={etape} />
                <span className="min-w-0 truncate text-[0.8125rem] text-muted-foreground">
                  {LIBELLES_TYPE_ETAPE[etape.type]} · code {etape.code}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <DialogueEtape mode="creation" etape={null} ouvert={creation} onOuvert={setCreation} />
      <DialogueEtape
        mode="renommage"
        etape={renommee}
        ouvert={renommee !== null}
        onOuvert={(ouvert) => {
          if (!ouvert) setRenommee(null);
        }}
      />

      <ConfirmDialog
        open={aDesactiver !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setADesactiver(null);
        }}
        title={`Désactiver « ${aDesactiver?.label ?? ''} » ?`}
        description="L’étape est retirée du flux et l’historique reste intact. Refusé si des dossiers occupent encore cette étape."
        confirmLabel="Désactiver"
        pending={basculer.isPending}
        onConfirm={() => {
          if (aDesactiver !== null) basculer.mutate({ id: aDesactiver.id, actif: false });
        }}
      />
    </div>
  );
}

function SqueletteEtapes() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="h-4 w-96" />
      <Card>
        <CardContent className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
