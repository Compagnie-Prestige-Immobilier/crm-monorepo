import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { Consignation } from '@/components/chues/console-consignation';
import { useFicheEnMain } from '@/components/chues/console-ouverture';
import { useDebouncedValue, useVerrouFiches } from '@/components/chues/hooks';
import { QueryErrorState } from '@/components/query-error-state';
import { buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PHASE2_STATUS_LABELS, type Prospect, type ProspectQuery } from '@/lib/data/console';
import { fetchPageProspects, type PageProspects } from '@/lib/data/grand-public';
import { formatDateTime, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { PROJET_API, type Projet } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Sans recherche : les vingt dernières fiches ajoutées au projet. */
const filtres = (projet: Projet, search: string): ProspectQuery => ({
  projet: PROJET_API[projet],
  ...(search === '' ? {} : { search }),
  pageSize: 20,
  sortBy: 'clientCreatedAt',
  sortOrder: 'desc',
});

/**
 * Convertir un prospect. L'écran ouvre sur la recherche, la fiche choisie reçoit
 * l'appel, puis on revient à la liste. `?fiche=<id>`, depuis les rappels, ouvre
 * directement la fiche visée.
 */
export function ConsoleAnnuaire({
  projet,
  fiche: demandee,
}: {
  projet: Projet;
  fiche: string | null;
}) {
  const queryClient = useQueryClient();
  const verrouActif = useVerrouFiches();
  const fiche = useFicheEnMain(demandee);

  const [search, setSearch] = useState('');
  const [confirme, setConfirme] = useState<string | null>(null);
  const cherche = useDebouncedValue(search).trim();

  const annuaire = useQuery({
    queryKey: queryKeys.prospects(filtres(projet, cherche)),
    queryFn: () => fetchPageProspects(filtres(projet, cherche)),
    enabled: fiche.annuaireActif,
    placeholderData: (precedent) => precedent,
  });

  if (fiche.consultee !== null) {
    return (
      <Consignation
        key={fiche.consultee.prospect.id}
        prospect={fiche.consultee.prospect}
        ouverture={fiche.consultee.ouverture}
        projet={projet}
        verrouActif={verrouActif}
        onAbandon={fiche.revenir}
        onEnregistre={(nom) => {
          setConfirme(nom);
          fiche.revenir();
          // La tentative a fermé l'ouverture : la barre supérieure lit ce cache
          // pour refuser la déconnexion, et le laisser périmé l'y enfermerait.
          queryClient.setQueryData(queryKeys.ouvertureCourante, null);
          void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
          void queryClient.invalidateQueries({ queryKey: queryKeys.callbacksRoot });
        }}
      />
    );
  }

  if (fiche.lienEnCours) return <ListeSkeleton />;

  return (
    <div className="flex w-full flex-col gap-5">
      {fiche.lienEnEchec ? (
        <p
          role="alert"
          className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
        >
          La fiche ouverte depuis les rappels n’a pas pu être chargée. Cherchez-la ci-dessous.
        </p>
      ) : null}

      {confirme === null ? null : (
        <p role="status" className="text-[0.875rem] font-[600] text-accent-text">
          Appel enregistré pour {confirme}.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="console-annuaire" className="text-[0.875rem] font-[600]">
          Quel prospect avez-vous appelé ?
        </label>
        <Input
          id="console-annuaire"
          type="search"
          autoComplete="off"
          placeholder="Chercher un prospect : nom ou numéro"
          className="h-12 text-[1rem]"
          value={search}
          onChange={(evenement) => {
            setSearch(evenement.target.value);
          }}
        />
      </div>

      <p className="text-[0.8125rem] text-muted-foreground">
        {cherche === ''
          ? 'Les vingt dernières fiches ajoutées. Cherchez un nom ou un numéro pour en voir d’autres.'
          : 'Choisissez qui vous venez d’appeler.'}
      </p>

      <ListeAnnuaire
        annuaire={annuaire}
        cherche={cherche}
        projet={projet}
        onChoisir={(ligne) => {
          setConfirme(null);
          fiche.choisir(ligne);
        }}
      />

      <ConfirmDialog
        open={fiche.aConfirmer !== null}
        onOpenChange={(suivant) => {
          if (!suivant) fiche.abandonner();
        }}
        title={`Ouvrir la fiche de ${nomDe(fiche.aConfirmer)} ?`}
        description={verrouActif ? 'Vous ne pourrez pas la quitter sans la qualifier.' : null}
        confirmLabel="Ouvrir"
        confirmVariant="default"
        pending={fiche.ouvertureEnCours}
        onConfirm={() => {
          if (fiche.aConfirmer !== null) fiche.confirmer(fiche.aConfirmer);
        }}
      />
    </div>
  );
}

const nomDe = (prospect: Prospect | null): string =>
  prospect === null ? '' : `${prospect.nom} ${prospect.prenom}`;

function ListeSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}

function Vide({ cherche, projet }: { cherche: string; projet: Projet }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.9375rem]">
        {cherche === ''
          ? 'Aucun prospect pour l’instant.'
          : 'Aucun résultat. Vérifiez le nom ou le numéro.'}
      </p>
      <Link
        to={projet === 'grand-public' ? '/$projet/nouveau' : '/$projet/prospects/nouveau'}
        params={{ projet }}
        className={cn(buttonVariants(), 'self-start')}
      >
        Ajouter un prospect
      </Link>
    </div>
  );
}

function Repere({ prospect }: { prospect: Prospect }) {
  const dernier =
    prospect.lastAttemptAt === null
      ? ' · jamais appelé'
      : ` · dernier appel ${formatDateTime(prospect.lastAttemptAt)}`;
  return (
    <span className="text-[0.8125rem] text-muted-foreground">
      <span className="tabular-nums">{formatPhone(prospect.phoneE164)}</span>
      {prospect.banqueName === null ? '' : ` · ${prospect.banqueName}`}
      {dernier}
    </span>
  );
}

function ListeAnnuaire({
  annuaire,
  cherche,
  projet,
  onChoisir,
}: {
  annuaire: UseQueryResult<PageProspects>;
  cherche: string;
  projet: Projet;
  onChoisir: (ligne: Prospect) => void;
}) {
  if (annuaire.isError) {
    return (
      <QueryErrorState
        error={annuaire.error}
        fallback="L’annuaire n’a pas pu être lu."
        onRetry={() => {
          void annuaire.refetch();
        }}
      />
    );
  }

  if (annuaire.data === undefined) return <ListeSkeleton />;
  if (annuaire.data.items.length === 0) return <Vide cherche={cherche} projet={projet} />;

  return (
    <ol className="flex flex-col gap-2">
      {annuaire.data.items.map((ligne) => (
        <li key={ligne.id}>
          <button
            type="button"
            onClick={() => {
              onChoisir(ligne);
            }}
            className={cn(
              'flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-border px-3 py-3 text-left',
              'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[0.9375rem] font-[600]">
                {ligne.nom} {ligne.prenom}
              </span>
              <Repere prospect={ligne} />
            </span>
            {ligne.phase2Status === 'PENDING' ? null : (
              <span className="rounded-full border border-border px-2 py-0.5 text-[0.75rem] text-muted-foreground">
                {PHASE2_STATUS_LABELS[ligne.phase2Status]}
              </span>
            )}
          </button>
        </li>
      ))}
    </ol>
  );
}
