'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { PhoneCallIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { QueryErrorState } from '@/components/query-error-state';
import { RelationBadge } from '@/components/representants/relation-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { callbackKeys } from '@/lib/data/console';
import { fetchProspectsAppeles } from '@/lib/data/prospects';
import { SUIVI_PAGE_SIZE, fetchRepresentantsAppeles } from '@/lib/data/representants';
import { fetchUsers } from '@/lib/data/users';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import {
  CALL_OUTCOME_LABELS,
  CALL_OUTCOME_VARIANTS,
  PHASE2_STATUS_LABELS,
  REP_CALL_OUTCOME_LABELS,
  REP_CALL_OUTCOME_VARIANTS,
  type Paginated,
  type Projet,
  type ProspectRow,
  type RepresentantRow,
} from '@/lib/types';
import { EMPTY_USER_FILTERS } from '@/lib/user-filters';

type Onglet = 'PROSPECTS' | 'REPRESENTANTS';

const ONGLETS: readonly { value: Onglet; label: string }[] = [
  { value: 'PROSPECTS', label: 'Prospects' },
  { value: 'REPRESENTANTS', label: 'Représentants' },
];

const SANS_VALEUR = <span className="text-muted-foreground">–</span>;

/** Section « Appels » des fiches CHUES. Grand Public n'en a pas encore. */
const ANCRE_APPELS = '#appels';

const ficheProspect = (projet: Projet, prospect: ProspectRow): string =>
  projet === 'GRAND_PUBLIC'
    ? `/grand-public/${prospect.id}`
    : `/chues/prospects/${prospect.id}${ANCRE_APPELS}`;

const ficheRepresentant = (id: string): string => `/chues/representants/${id}${ANCRE_APPELS}`;

function LigneVersFiche({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <TableRow
      className="h-11 cursor-pointer"
      onClick={(event) => {
        if (event.target instanceof HTMLElement && event.target.closest('a') !== null) return;
        // Relâcher une sélection de texte ne doit pas quitter la liste.
        if (window.getSelection()?.isCollapsed === false) return;
        router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}

export function MesContactsView({
  projet,
  userId,
  canFilter,
}: {
  projet: Projet;
  userId: string;
  canFilter: boolean;
}) {
  const [onglet, setOnglet] = useState<Onglet>('PROSPECTS');
  const [filtreId, setFiltreId] = useState<string | null>(null);

  // L'API ne borne ces listes ni au demandeur ni aux fiches appelées : sans
  // identifiant, elle rendrait aussi les fiches que personne n'a jamais appelées.
  const lastCallById = canFilter ? (filtreId ?? userId) : userId;

  const avecRepresentants = projet === 'CHUES';
  const vueRepresentants = avecRepresentants && onglet === 'REPRESENTANTS';

  const prospects = useQuery({
    queryKey: ['mes-contacts', 'prospects', projet, lastCallById],
    queryFn: () => fetchProspectsAppeles(lastCallById, projet),
    enabled: !vueRepresentants,
    placeholderData: (previous) => previous,
  });

  const representants = useQuery({
    queryKey: ['mes-contacts', 'representants', lastCallById],
    queryFn: () => fetchRepresentantsAppeles(lastCallById),
    enabled: vueRepresentants,
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
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
            Mes contacts
          </h1>
          <p className="text-[0.875rem] text-muted-foreground">
            Les personnes appelées, de l’appel le plus récent au plus ancien.
          </p>
        </div>

        {canFilter ? (
          <FilterCombobox
            label="Appelé par"
            placeholder="Mes appels"
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

      {avecRepresentants ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type de contact">
          {ONGLETS.map((entree) => (
            <Button
              key={entree.value}
              type="button"
              variant={entree.value === onglet ? 'default' : 'outline'}
              aria-pressed={entree.value === onglet}
              onClick={() => {
                setOnglet(entree.value);
              }}
            >
              {entree.label}
            </Button>
          ))}
        </div>
      ) : null}

      {vueRepresentants ? (
        <Liste
          liste={representants}
          vide="Un représentant apparaît ici dès que vous consignez un appel sur sa fiche."
          echec="Les représentants appelés n’ont pas pu être lus."
        >
          {(items) => <TableRepresentants items={items} />}
        </Liste>
      ) : (
        <Liste
          liste={prospects}
          vide="Un prospect apparaît ici dès que vous consignez un appel sur sa fiche."
          echec="Les prospects appelés n’ont pas pu être lus."
        >
          {(items) => <TableProspects items={items} projet={projet} />}
        </Liste>
      )}
    </section>
  );
}

function Liste<T>({
  liste,
  vide,
  echec,
  children,
}: {
  liste: UseQueryResult<Paginated<T>>;
  vide: string;
  echec: string;
  children: (items: T[]) => ReactNode;
}) {
  const data = liste.data;
  const hasData = data !== undefined;

  if (shouldShowError({ isError: liste.isError, hasData })) {
    return (
      <QueryErrorState
        error={liste.error}
        fallback={echec}
        onRetry={() => {
          void liste.refetch();
        }}
      />
    );
  }

  if (!hasData || shouldShowSkeleton({ isPending: liste.isPending, hasData })) {
    return <Skeleton className="h-64" />;
  }

  if (data.items.length === 0) {
    return <EmptyState icon={PhoneCallIcon} title="Aucun appel enregistré" description={vide} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.total > data.items.length ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          {formatNumber(data.total)} au total, les {formatNumber(SUIVI_PAGE_SIZE)} plus récents sont
          affichés.
        </p>
      ) : null}
      {children(data.items)}
    </div>
  );
}

function EnTete() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Nom</TableHead>
        <TableHead>Téléphone</TableHead>
        <TableHead>Dernier appel</TableHead>
        <TableHead>Issue</TableHead>
        <TableHead>Statut</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function Quand({ at }: { at: string | null }) {
  if (at === null) return SANS_VALEUR;
  return <time dateTime={at}>{formatDateTime(at)}</time>;
}

function TableRepresentants({ items }: { items: RepresentantRow[] }) {
  return (
    <Table>
      <EnTete />
      <TableBody>
        {items.map((representant) => (
          <LigneVersFiche key={representant.id} href={ficheRepresentant(representant.id)}>
            <TableCell>
              <Link
                href={ficheRepresentant(representant.id)}
                className="font-[600] underline underline-offset-4"
              >
                {representant.fullName}
              </Link>
            </TableCell>
            <TableCell className="tabular-nums">{formatPhone(representant.phoneE164)}</TableCell>
            <TableCell>
              <Quand at={representant.lastCallAt} />
            </TableCell>
            <TableCell>
              {representant.lastCallOutcome === null ? (
                SANS_VALEUR
              ) : (
                <Badge variant={REP_CALL_OUTCOME_VARIANTS[representant.lastCallOutcome]}>
                  {REP_CALL_OUTCOME_LABELS[representant.lastCallOutcome]}
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <RelationBadge
                status={representant.relationStatus}
                label={representant.statutQualificationLabel}
                effect={representant.statutQualificationEffect}
                lastCallOutcome={representant.lastCallOutcome}
              />
            </TableCell>
          </LigneVersFiche>
        ))}
      </TableBody>
    </Table>
  );
}

function TableProspects({ items, projet }: { items: ProspectRow[]; projet: Projet }) {
  return (
    <Table>
      <EnTete />
      <TableBody>
        {items.map((prospect) => (
          <LigneVersFiche key={prospect.id} href={ficheProspect(projet, prospect)}>
            <TableCell>
              <Link
                href={ficheProspect(projet, prospect)}
                className="font-[600] underline underline-offset-4"
              >
                {prospect.prenom} {prospect.nom}
              </Link>
            </TableCell>
            <TableCell className="tabular-nums">{formatPhone(prospect.phoneE164)}</TableCell>
            <TableCell>
              <Quand at={prospect.lastCallAt} />
            </TableCell>
            <TableCell>
              {prospect.lastCallOutcome === null ? (
                SANS_VALEUR
              ) : (
                <Badge variant={CALL_OUTCOME_VARIANTS[prospect.lastCallOutcome]}>
                  {CALL_OUTCOME_LABELS[prospect.lastCallOutcome]}
                </Badge>
              )}
            </TableCell>
            <TableCell>{PHASE2_STATUS_LABELS[prospect.phase2Status]}</TableCell>
          </LigneVersFiche>
        ))}
      </TableBody>
    </Table>
  );
}
