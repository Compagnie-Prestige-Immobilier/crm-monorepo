import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadIcon, Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFileDownload } from '@/components/exports/download-button';
import {
  libelleEtat,
  lireSignalements,
  reprendreSignalement,
  signalementActif,
  type Signalement,
} from '@/lib/data/support';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

const CLE = ['support', 'signalements'] as const;

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
          {formatDateTime(signalement.creeLe)}
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
  return (
    <section className="flex flex-col gap-2 border-t pt-3">
      {liste.length === 0 ? null : (
        <>
          <h3 className="text-[0.8125rem] font-medium">Vos signalements récents</h3>
          <ul>
            {liste.slice(0, 5).map((s) => (
              <Ligne key={s.id} signalement={s} reprendre={() => reprise.mutate(s.id)} />
            ))}
          </ul>
        </>
      )}
      <ExportTickets />
    </section>
  );
}

function ExportTickets() {
  const { pending, download } = useFileDownload();
  return (
    <div className="flex flex-wrap gap-2">
      {(['pdf', 'xlsx'] as const).map((format) => (
        <Button
          key={format}
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            void download({
              url: `/api/v1/support/tickets/export?format=${format}`,
              fileName: `tickets-support.${format}`,
              failureMessage: "L'export a échoué. Réessayez.",
            })
          }
        >
          {pending ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <DownloadIcon className="size-4" aria-hidden="true" />
          )}
          {format === 'pdf' ? 'Exporter en PDF' : 'Exporter en Excel'}
        </Button>
      ))}
    </div>
  );
}

export function rafraichirSignalements(cache: ReturnType<typeof useQueryClient>): void {
  void cache.invalidateQueries({ queryKey: CLE });
}
