import { useQuery } from '@tanstack/react-query';

import { FILTRES_VIDES } from '@/components/prospects/filtres';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PROSPECT_STATUT_LABELS } from '@/lib/data/grand-public';
import { fetchProspects, type Prospect } from '@/lib/data/prospects';
import { formatDate, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export function CarteProspect({
  prospect,
  choisi,
  onChoisir,
}: {
  prospect: Prospect;
  choisi: boolean;
  onChoisir: () => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-md border-2 p-3 transition-colors',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
        choisi ? 'border-primary bg-secondary' : 'border-border hover:bg-secondary/50',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <input
            type="radio"
            name="fusion-survivant"
            checked={choisi}
            onChange={onChoisir}
            className="sr-only"
          />
          <span className="font-[600]">
            {prospect.prenom} {prospect.nom}
          </span>
        </span>
        {choisi ? <Badge>Conservée</Badge> : <Badge variant="outline">Absorbée</Badge>}
      </span>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
        <dt className="text-muted-foreground">Téléphone</dt>
        <dd className="truncate tabular-nums">{formatPhone(prospect.phoneE164)}</dd>
        <dt className="text-muted-foreground">Statut</dt>
        <dd>{PROSPECT_STATUT_LABELS[prospect.statut]}</dd>
        <dt className="text-muted-foreground">Représentant</dt>
        <dd className="truncate">{prospect.representantName ?? '–'}</dd>
        <dt className="text-muted-foreground">Téléconseiller</dt>
        <dd className="truncate">{prospect.ownedByCommercialName}</dd>
        <dt className="text-muted-foreground">Saisi le</dt>
        <dd className="tabular-nums">{formatDate(prospect.clientCreatedAt)}</dd>
      </dl>
    </label>
  );
}

export function Candidats({
  recherche,
  exclureId,
  choisiId,
  onChoisir,
}: {
  recherche: string;
  exclureId: string;
  choisiId: string | null;
  onChoisir: (prospect: Prospect) => void;
}) {
  const filtres = { ...FILTRES_VIDES, search: recherche, pageSize: 10 };
  const liste = useQuery({
    queryKey: queryKeys.prospects(filtres),
    queryFn: () => fetchProspects(filtres),
    enabled: recherche.trim().length >= 2,
  });

  if (recherche.trim().length < 2) return null;

  const lignes = (liste.data?.items ?? []).filter((ligne) => ligne.id !== exclureId);

  return (
    <div className="max-h-52 overflow-y-auto rounded-md border border-border">
      {liste.isPending ? (
        <div className="flex flex-col gap-2 p-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : null}
      {liste.isSuccess && lignes.length === 0 ? (
        <p className="p-4 text-center text-[0.8125rem] text-muted-foreground">
          Aucune autre fiche ne correspond.
        </p>
      ) : null}
      <ul>
        {lignes.map((ligne) => (
          <li key={ligne.id}>
            <button
              type="button"
              aria-pressed={choisiId === ligne.id}
              onClick={() => {
                onChoisir(ligne);
              }}
              className={cn(
                'flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                choisiId === ligne.id && 'bg-secondary',
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-[600]">
                  {ligne.prenom} {ligne.nom}
                </span>
                <span className="block truncate text-[0.75rem] text-muted-foreground">
                  {formatPhone(ligne.phoneE164)} · {ligne.representantName ?? 'sans représentant'}
                </span>
              </span>
              <span className="shrink-0 text-[0.75rem] text-muted-foreground">
                {formatDate(ligne.clientCreatedAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
