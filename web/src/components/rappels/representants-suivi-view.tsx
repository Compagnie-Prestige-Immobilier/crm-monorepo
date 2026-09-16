'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ClockIcon, PhoneOffIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { RechercheTableau, useTriLocal } from '@/components/ui/tri-local';
import { callbackKeys, formatCallbackAt } from '@/lib/data/console';
import {
  SUIVI_PAGE_SIZE,
  fetchRepresentantsSuivi,
  type RepresentantSuivi,
} from '@/lib/data/representants';
import { fetchUsers } from '@/lib/data/users';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import type { Paginated, RepresentantRow } from '@/lib/types';
import { EMPTY_USER_FILTERS } from '@/lib/user-filters';

const ONGLETS: readonly { value: RepresentantSuivi; label: string }[] = [
  { value: 'A_RAPPELER', label: 'À rappeler' },
  { value: 'INJOIGNABLE', label: 'Injoignables' },
];

const VIDE: Record<
  RepresentantSuivi,
  { icon: typeof ClockIcon; title: string; description: string }
> = {
  A_RAPPELER: {
    icon: ClockIcon,
    title: 'Aucun représentant à rappeler',
    description:
      'Une échéance apparaît ici dès qu’un appel en promet une, ou dès qu’un numéro resté sans réponse revient en file.',
  },
  INJOIGNABLE: {
    icon: PhoneOffIcon,
    title: 'Aucun représentant injoignable',
    description: 'Un appel sans réponse fait remonter la fiche ici.',
  },
};

const suiviQueryKey = (suivi: RepresentantSuivi, lastCallById: string | null) =>
  ['representants', 'suivi', suivi, lastCallById] as const;

/**
 * Les représentants que l'équipe doit reprendre : le rappel promis et l'appel
 * resté sans réponse. Sans rapport avec les rappels de PROSPECTS listés en
 * dessous, qui viennent d'une autre table.
 */
export function RepresentantsSuiviView({
  userId,
  canFilter,
}: {
  userId: string;
  canFilter: boolean;
}) {
  const [suivi, setSuivi] = useState<RepresentantSuivi>('A_RAPPELER');
  const [filtreId, setFiltreId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  // L'API ne borne pas cette liste au demandeur : un téléconseiller n'y voit
  // que ses propres appels parce que le client l'exige.
  const lastCallById = canFilter ? filtreId : userId;

  const liste = useQuery({
    queryKey: suiviQueryKey(suivi, lastCallById),
    queryFn: () => fetchRepresentantsSuivi(suivi, lastCallById),
    placeholderData: (previous) => previous,
  });

  const teleconseillers = useQuery({
    queryKey: callbackKeys.teleconseillers,
    queryFn: () =>
      fetchUsers({ ...EMPTY_USER_FILTERS, role: 'COMMERCIAL', isActive: true, pageSize: 200 }),
    enabled: canFilter,
    staleTime: 300_000,
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[0.875rem] text-muted-foreground">
          Les rappels promis pendant la qualification, ceux que le référentiel a reprogrammés, et
          les numéros restés sans réponse.
        </p>

        {canFilter ? (
          <FilterCombobox
            label="Appelé par"
            placeholder="Tous les téléconseillers"
            className="w-72"
            options={(teleconseillers.data?.items ?? []).map((user) => ({
              value: user.id,
              label: user.fullName,
            }))}
            value={filtreId}
            onChange={setFiltreId}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Suivi des représentants">
        {ONGLETS.map((onglet) => (
          <Button
            key={onglet.value}
            type="button"
            variant={onglet.value === suivi ? 'default' : 'outline'}
            aria-pressed={onglet.value === suivi}
            onClick={() => {
              setSuivi(onglet.value);
            }}
          >
            {onglet.label}
          </Button>
        ))}
      </div>

      <Corps liste={liste} suivi={suivi} canFilter={canFilter} now={now} />
    </section>
  );
}

const COLONNES_SUIVI = {
  representant: (r: RepresentantRow) => r.fullName,
  etablissement: (r: RepresentantRow) => r.etablissement,
  quand: (r: RepresentantRow) => r.nextCallbackAt ?? r.lastCallAt,
  appelePar: (r: RepresentantRow) => r.lastCallByName,
};

function Corps({
  liste,
  suivi,
  canFilter,
  now,
}: {
  liste: UseQueryResult<Paginated<RepresentantRow>>;
  suivi: RepresentantSuivi;
  canFilter: boolean;
  now: number;
}) {
  const data = liste.data;
  const hasData = data !== undefined;

  if (shouldShowError({ isError: liste.isError, hasData })) {
    return (
      <QueryErrorState
        error={liste.error}
        fallback="Les représentants à reprendre n’ont pas pu être lus."
        onRetry={() => {
          void liste.refetch();
        }}
      />
    );
  }

  if (!hasData || shouldShowSkeleton({ isPending: liste.isPending, hasData })) {
    return <Skeleton className="h-64" />;
  }

  if (data.items.length === 0) return <EmptyState {...VIDE[suivi]} />;

  return (
    <div className="flex flex-col gap-3">
      {data.total > data.items.length ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          {formatNumber(data.total)} au total, les {formatNumber(SUIVI_PAGE_SIZE)} premiers sont
          affichés.
        </p>
      ) : null}

      <SuiviTable items={data.items} suivi={suivi} canFilter={canFilter} now={now} />
    </div>
  );
}

function SuiviTable({
  items,
  suivi,
  canFilter,
  now,
}: {
  items: RepresentantRow[];
  suivi: RepresentantSuivi;
  canFilter: boolean;
  now: number;
}) {
  const tri = useTriLocal(items, COLONNES_SUIVI);
  const colSpan = canFilter ? 4 : 3;

  return (
    <>
      <RechercheTableau
        recherche={tri.recherche}
        setRecherche={tri.setRecherche}
        total={tri.total}
        affichees={tri.lignes.length}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column={{ id: 'representant', label: 'Représentant' }}
              sortBy={tri.sortBy}
              sortDir={tri.sortDir}
              onToggle={tri.toggle}
            />
            <SortableTableHead
              column={{ id: 'etablissement', label: 'Établissement' }}
              sortBy={tri.sortBy}
              sortDir={tri.sortDir}
              onToggle={tri.toggle}
            />
            <SortableTableHead
              column={{ id: 'quand', label: suivi === 'A_RAPPELER' ? 'Échéance' : 'Dernier appel' }}
              sortBy={tri.sortBy}
              sortDir={tri.sortDir}
              onToggle={tri.toggle}
            />
            {canFilter ? (
              <SortableTableHead
                column={{ id: 'appelePar', label: 'Appelé par' }}
                sortBy={tri.sortBy}
                sortDir={tri.sortDir}
                onToggle={tri.toggle}
              />
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tri.lignes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-muted-foreground">
                Aucun représentant ne correspond à la recherche.
              </TableCell>
            </TableRow>
          ) : null}
          {tri.lignes.map((representant) => (
            <TableRow key={representant.id}>
              <TableCell>
                <Link
                  href={`/teleconseil/representants/${representant.id}`}
                  className="font-[600] underline underline-offset-4"
                >
                  {representant.fullName}
                </Link>
                <span className="block text-[0.75rem] text-muted-foreground tabular-nums">
                  {formatPhone(representant.phoneE164)}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {representant.etablissement ?? 'Non renseigné'}
              </TableCell>
              <TableCell>
                <Quand suivi={suivi} representant={representant} now={now} />
              </TableCell>
              {canFilter ? <TableCell>{representant.lastCallByName ?? 'Inconnu'}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

function Quand({
  suivi,
  representant,
  now,
}: {
  suivi: RepresentantSuivi;
  representant: RepresentantRow;
  now: number;
}) {
  if (suivi === 'INJOIGNABLE') {
    const at = representant.lastCallAt;
    if (at === null) return <span className="text-muted-foreground">Inconnu</span>;
    return <time dateTime={at}>{formatDateTime(at)}</time>;
  }

  const at = representant.nextCallbackAt;
  if (at === null) return <span className="text-muted-foreground">Sans échéance</span>;

  const origine = origineDuRappel(representant);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <time dateTime={at}>{formatCallbackAt(at, now)}</time>
      {Date.parse(at) < now ? <Badge variant="destructive">En retard</Badge> : null}
      {origine === null ? null : (
        <Badge variant={origine === 'PROMIS' ? 'secondary' : 'outline'}>
          {origine === 'PROMIS' ? 'Promis' : 'Automatique'}
        </Badge>
      )}
    </div>
  );
}

/**
 * Un rappel promis se tient à l'heure dite, un rappel reprogrammé se déplace :
 * confondus, le téléconseiller ne sait plus lequel il doit honorer.
 * `nextCallbackOrigine` manque encore au client engendré.
 */
function origineDuRappel(representant: RepresentantRow): 'PROMIS' | 'AUTOMATIQUE' | null {
  const { nextCallbackOrigine } = representant as {
    nextCallbackOrigine?: 'PROMIS' | 'AUTOMATIQUE' | null;
  };
  return nextCallbackOrigine ?? null;
}
