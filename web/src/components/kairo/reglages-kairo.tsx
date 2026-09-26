import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  afficherAssistantKairos,
  basculerReparationBaseKairo,
  CLE_ASSISTANT_KAIROS,
  CLE_KAIRO,
  lireAssistantKairos,
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
            Quand la branche de base ne passe plus sa propre vérification, Kairo propose une
            correction dans une PR séparée, sans jamais bloquer le traitement des tickets en cours.
            Il ne publie que s’il juge le correctif simple et sûr.
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

export function ReglageAssistantKairos() {
  const client = useQueryClient();
  const { data } = useQuery({ queryKey: CLE_ASSISTANT_KAIROS, queryFn: lireAssistantKairos });

  const bascule = useMutation({
    mutationFn: afficherAssistantKairos,
    onSuccess: (etat) => {
      client.setQueryData(CLE_ASSISTANT_KAIROS, etat);
      toast.success(etat.affiche ? 'Assistant Kairos affiché.' : 'Assistant Kairos retiré.');
    },
    onError: (error) => toastApiError(error, 'Le réglage n’a pas été enregistré.'),
  });

  if (data === undefined) return null;
  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
      <CardContent className="flex items-center justify-between gap-6 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span id="assistant-kairos" className="text-sm font-semibold text-foreground">
            Assistant Kairos affiché
          </span>
          {data.configure ? null : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Renseignez KAIROS_URL et KAIROS_SDK_SECRET sur le serveur pour l’activer.
            </p>
          )}
        </div>
        <Switch
          aria-labelledby="assistant-kairos"
          checked={data.affiche}
          disabled={!data.configure || bascule.isPending}
          onCheckedChange={(affiche) => bascule.mutate(affiche)}
        />
      </CardContent>
    </Card>
  );
}
