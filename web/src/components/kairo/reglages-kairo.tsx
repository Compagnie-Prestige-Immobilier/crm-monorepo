import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  basculerReparationBaseKairo,
  CLE_KAIRO,
  type EtatKairo,
  type TableauKairo,
} from '@/lib/data/kairo';
import { toastApiError } from '@/lib/mutation-feedback';

export function ReglagesKairo(props: { etat: EtatKairo; desactive?: boolean | undefined }) {
  const { etat, desactive } = props;
  const client = useQueryClient();

  const bascule = useMutation({
    mutationFn: basculerReparationBaseKairo,
    onSuccess: (_, active) => {
      client.setQueryData<TableauKairo>(CLE_KAIRO, (avant) =>
        avant?.kairo == null
          ? avant
          : { ...avant, kairo: { ...avant.kairo, reparationBaseActive: active } },
      );
      toast.success(
        active ? 'Réparation automatique activée.' : 'Réparation automatique désactivée.',
      );
    },
    onError: (error) => toastApiError(error, 'Kairo n’a pas pris la commande.'),
    onSettled: () => client.invalidateQueries({ queryKey: CLE_KAIRO }),
  });

  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
      <CardContent className="flex items-center justify-between gap-6 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">
            Réparation automatique de la base
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Quand le code de référence ne passe plus ses propres vérifications, Kairo propose une
            correction à part, sans bloquer les tickets en cours.
          </p>
        </div>
        <Switch
          checked={etat.reparationBaseActive}
          disabled={desactive || bascule.isPending}
          onCheckedChange={(active) => bascule.mutate(active)}
        />
      </CardContent>
    </Card>
  );
}
