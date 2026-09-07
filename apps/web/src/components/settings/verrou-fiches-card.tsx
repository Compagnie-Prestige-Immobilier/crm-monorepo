'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { fetchParametresChues, updateParametresChues } from '@/lib/data/parametres-chues';
import { apiErrorText } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/** Enregistre au clic, sans passer par le brouillon texte des autres cartes. */
export function VerrouFichesCard() {
  const queryClient = useQueryClient();
  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: () => fetchParametresChues(),
  });

  const bascule = useMutation({
    mutationFn: (verrouFiches: boolean) => updateParametresChues({ verrouFiches }),
    onSuccess: (suivants) => {
      queryClient.setQueryData(queryKeys.parametresChues, suivants);
      void queryClient.invalidateQueries({ queryKey: queryKeys.parametresChuesJournal });
    },
    onError: (erreur) => {
      toast.error(apiErrorText(erreur, 'Le verrou n’a pas pu être modifié.'));
    },
  });

  if (parametres.isPending) return <Skeleton className="h-28 rounded-lg" />;
  if (parametres.isError)
    return (
      <QueryErrorState
        error={parametres.error}
        onRetry={() => {
          void parametres.refetch();
        }}
        fallback="Le verrou des fiches n’a pas pu être lu."
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verrou des fiches</CardTitle>
      </CardHeader>
      <CardContent className="flex items-start justify-between gap-4">
        <p className="max-w-md text-[0.875rem] text-muted-foreground">
          Coupé, un téléconseiller peut ouvrir une fiche sans qualifier la précédente : le serveur
          referme l’ancienne ouverture de lui-même.
        </p>
        <Switch
          checked={parametres.data.verrouFiches}
          disabled={bascule.isPending}
          onCheckedChange={(coche: boolean) => {
            bascule.mutate(coche);
          }}
          aria-label="Verrou des fiches"
        />
      </CardContent>
    </Card>
  );
}
