import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  libelleEtat,
  lireSignalements,
  reprendreSignalement,
  signalementActif,
  type Signalement,
} from '@/lib/data/support';
import { toastApiError } from '@/lib/mutation-feedback';

const CLE = ['support', 'signalements'] as const;

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function details(signalement: Signalement): string[] {
  const lignes = [libelleEtat(signalement)];
  if (signalement.numeroGlpi !== null && signalement.etat !== 'termine') {
    lignes.push(`ticket n° ${String(signalement.numeroGlpi)}`);
  }
  const manquantes = signalement.images - signalement.imagesTransmises;
  if (manquantes > 0 && signalement.numeroGlpi !== null) {
    lignes.push(
      `${String(manquantes)} image${manquantes > 1 ? 's' : ''} non transmise${manquantes > 1 ? 's' : ''}`,
    );
  }
  return lignes;
}

function Ligne({ signalement, reprendre }: { signalement: Signalement; reprendre: () => void }) {
  return (
    <li className="flex flex-col gap-1 border-b py-2 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[0.8125rem]">{signalement.description}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {dateCourte(signalement.creeLe)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {signalementActif(signalement) ? (
          <Loader2Icon className="size-3 animate-spin" aria-hidden="true" />
        ) : null}
        <span>{details(signalement).join(' · ')}</span>
      </div>
      {signalement.erreur === null ? null : (
        <p role="status" className="text-xs text-destructive">
          {signalement.erreur}
        </p>
      )}
      {signalement.reprenable ? (
        <Button variant="outline" size="sm" className="self-start" onClick={reprendre}>
          Reprendre l'envoi
        </Button>
      ) : null}
    </li>
  );
}

/** Le serveur transmet même panneau fermé : l'actualisation ne court que tant
 * qu'une demande visible progresse. */
export function SuiviSignalements({ ouvert }: { ouvert: boolean }) {
  const cache = useQueryClient();
  const signalements = useQuery({
    queryKey: CLE,
    queryFn: lireSignalements,
    enabled: ouvert,
    refetchInterval: (query) => (query.state.data?.some(signalementActif) === true ? 5000 : false),
  });
  const reprise = useMutation({
    mutationFn: reprendreSignalement,
    onSuccess: () => cache.invalidateQueries({ queryKey: CLE }),
    onError: (error) => {
      toastApiError(error, "L'envoi n'a pas pu être repris.");
    },
  });

  const liste = signalements.data ?? [];
  if (liste.length === 0) return null;
  return (
    <section className="border-t pt-3">
      <h3 className="text-[0.8125rem] font-medium">Vos signalements récents</h3>
      <ul className="mt-1">
        {liste.slice(0, 5).map((s) => (
          <Ligne key={s.id} signalement={s} reprendre={() => reprise.mutate(s.id)} />
        ))}
      </ul>
    </section>
  );
}

export function rafraichirSignalements(cache: ReturnType<typeof useQueryClient>): void {
  void cache.invalidateQueries({ queryKey: CLE });
}
