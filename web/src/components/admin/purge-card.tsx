import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseIcon, ShieldAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { SelectionPurge } from '@/components/admin/purge-selection';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  domainesEntraines,
  etendreSelection,
  fetchCataloguePurge,
  lignesDeLaSelection,
  purgeSoumettable,
  purger,
  type ClePurge,
  type DomainePurge,
} from '@/lib/data/admin';
import { formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

function RecapitulatifPurge({
  domaines,
  etendus,
  confirmation,
  repere,
  enCours,
  onConfirmation,
}: {
  domaines: readonly DomainePurge[];
  etendus: readonly ClePurge[];
  confirmation: string;
  repere: string;
  enCours: boolean;
  onConfirmation: (valeur: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border p-3 text-[0.875rem]">
        {etendus.map((cle) => {
          const domaine = domaines.find((entree) => entree.key === cle);
          return (
            <li key={cle} className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">{domaine?.label ?? String(cle)}</span>
              <span className="font-[600] tabular-nums">{formatNumber(domaine?.rows ?? 0)}</span>
            </li>
          );
        })}
      </ul>

      <p className="rounded-md border border-border px-3 py-2.5 text-[0.875rem]">
        Les comptes administrateurs sont conservés.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmation-purge">Identifiant de connexion</Label>
        <Input
          id="confirmation-purge"
          value={confirmation}
          placeholder={repere}
          autoComplete="off"
          spellCheck={false}
          disabled={enCours}
          onChange={(event) => {
            onConfirmation(event.target.value);
          }}
        />
      </div>
    </div>
  );
}

export function PurgeCard() {
  const queryClient = useQueryClient();
  const [choisis, setChoisis] = useState<ClePurge[]>([]);
  const [confirmation, setConfirmation] = useState('');
  const [ouvert, setOuvert] = useState(false);

  const catalogue = useQuery({ queryKey: queryKeys.purgeCatalog, queryFn: fetchCataloguePurge });

  const purge = useMutation({
    mutationFn: () => purger(choisis, confirmation),
    onSuccess: (resultat) => {
      setOuvert(false);
      setConfirmation('');
      setChoisis([]);
      void queryClient.invalidateQueries();
      toast.success(`${formatNumber(resultat.total)} lignes supprimées.`);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'La suppression a échoué. Réessayez.');
    },
  });

  if (catalogue.isPending) return <Skeleton className="h-80 w-full" />;
  if (catalogue.isError) {
    return (
      <QueryErrorState
        error={catalogue.error}
        onRetry={() => {
          void catalogue.refetch();
        }}
        fallback="Les domaines n’ont pas pu être lus."
      />
    );
  }

  const donnees = catalogue.data;
  const domaines = donnees.domains ?? [];
  const etendus = etendreSelection(choisis, domaines);
  const lignes = lignesDeLaSelection(choisis, domaines);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <DatabaseIcon className="size-4" aria-hidden="true" />
                Suppression des données
              </CardTitle>
              <CardDescription>
                Sélection par domaine. La suppression est définitive.
              </CardDescription>
            </div>
            <Badge variant="destructive">Irréversible</Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {donnees.allowed ? (
            <SelectionPurge
              domaines={domaines}
              choisis={choisis}
              etendus={etendus}
              entraines={domainesEntraines(choisis, domaines)}
              lignes={lignes}
              enCours={purge.isPending}
              onChoisis={setChoisis}
              onDemander={() => {
                setConfirmation('');
                setOuvert(true);
              }}
            />
          ) : (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-accent-border/40 bg-accent-surface px-3 py-2.5 text-[0.8125rem] text-warning"
            >
              <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>Réservé au premier compte administrateur.</span>
            </p>
          )}
        </CardContent>
      </Card>

      {ouvert ? (
        <ConfirmDialog
          open
          onOpenChange={(suivant) => {
            if (!suivant && purge.isPending) return;
            setOuvert(suivant);
            if (!suivant) setConfirmation('');
          }}
          pending={purge.isPending}
          confirmLabel="Supprimer"
          title="Supprimer définitivement ?"
          description={`${formatNumber(lignes)} lignes seront supprimées. Aucune restauration n’est possible.`}
          onConfirm={() => {
            if (
              purgeSoumettable({
                catalogue: donnees,
                choisis,
                confirmation,
                enCours: purge.isPending,
              })
            ) {
              purge.mutate();
            }
          }}
        >
          <RecapitulatifPurge
            domaines={domaines}
            etendus={etendus}
            confirmation={confirmation}
            repere={donnees.confirmationHint}
            enCours={purge.isPending}
            onConfirmation={setConfirmation}
          />
        </ConfirmDialog>
      ) : null}
    </>
  );
}
