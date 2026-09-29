'use client';

import { useQuery } from '@tanstack/react-query';
import { FileTextIcon, PhoneIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchProspects } from '@/lib/data/prospects';
import { EMPTY_FILTERS } from '@/lib/filters';
import { formatDateTime, formatPhone } from '@/lib/format';
import { type ProspectRow } from '@/lib/types';

type Suivi = 'INTERESTED' | 'HESITANT';

const SUIVIS: Record<Suivi, { label: string; ton: 'success' | 'warning' }> = {
  INTERESTED: { label: 'Intéressé', ton: 'success' },
  HESITANT: { label: 'Hésitant', ton: 'warning' },
};

const PAR_PAGE = 50;

function Actions({ prospect }: { prospect: ProspectRow }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {prospect.phoneE164 === null ? null : (
        <a
          href={`tel:${prospect.phoneE164}`}
          aria-label={`Appeler ${prospect.prenom} ${prospect.nom}`}
          className={buttonVariants({ size: 'sm', className: 'gap-1.5' })}
        >
          <PhoneIcon className="size-3.5" aria-hidden="true" />
          Appeler
        </a>
      )}
      <Link
        href={`/teleconseil/prospects/${prospect.id}`}
        className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-1.5' })}
      >
        <FileTextIcon className="size-3.5" aria-hidden="true" />
        Ouvrir la fiche
      </Link>
    </div>
  );
}

const dernierAppel = (prospect: ProspectRow): string =>
  prospect.lastCallAt === null ? 'Jamais appelé' : formatDateTime(prospect.lastCallAt);

function Tableau({ items, suivi }: { items: ProspectRow[]; suivi: Suivi }) {
  const etat = SUIVIS[suivi];
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <Table aria-label={etat.label}>
          <TableHeader>
            <TableRow>
              <TableHead>Prospect</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernier appel</TableHead>
              <TableHead>Téléconseiller</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((prospect) => (
              <TableRow key={prospect.id}>
                <TableCell className="font-[600]">
                  {prospect.prenom} {prospect.nom}
                </TableCell>
                <TableCell className="font-mono whitespace-nowrap">
                  {prospect.phoneE164 === null ? '' : formatPhone(prospect.phoneE164)}
                </TableCell>
                <TableCell>
                  <Badge variant={etat.ton}>{etat.label}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {dernierAppel(prospect)}
                </TableCell>
                <TableCell>{prospect.ownedByCommercialName}</TableCell>
                <TableCell>
                  <Actions prospect={prospect} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label={etat.label} className="flex flex-col gap-2 md:hidden">
        {items.map((prospect) => (
          <li
            key={prospect.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-[600]">
                {prospect.prenom} {prospect.nom}
              </p>
              <Badge variant={etat.ton}>{etat.label}</Badge>
            </div>
            <p className="text-[0.8125rem] text-muted-foreground">
              {dernierAppel(prospect)} · {prospect.ownedByCommercialName}
            </p>
            <Actions prospect={prospect} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Les fiches à amener jusqu'au rendez-vous, tous téléconseillers confondus. */
export function InteressesListe() {
  const [suivi, setSuivi] = useState<Suivi>('INTERESTED');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const liste = useQuery({
    queryKey: ['prospects', 'suivi-cc', suivi, search, page],
    queryFn: () =>
      fetchProspects({ ...EMPTY_FILTERS, phase2Status: suivi, search, page, pageSize: PAR_PAGE }),
  });
  const items = liste.data?.items ?? [];
  const pageCount = liste.data?.pageCount ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={suivi}
        onValueChange={(valeur) => {
          setSuivi(valeur as Suivi);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="INTERESTED">Intéressés</TabsTrigger>
          <TabsTrigger value="HESITANT">Hésitants</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={search}
          placeholder="Nom ou numéro"
          aria-label="Rechercher un prospect"
          className="max-w-xs"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        {liste.data === undefined ? null : (
          <p className="text-sm text-muted-foreground">
            {liste.data.total} {SUIVIS[suivi].label.toLowerCase()}
            {liste.data.total > 1 ? 's' : ''}
          </p>
        )}
      </div>
      {liste.isError ? (
        <QueryErrorState error={liste.error} onRetry={() => void liste.refetch()} />
      ) : null}
      {liste.isPending ? <Skeleton className="h-64 w-full rounded-lg" /> : null}
      {liste.data === undefined ? null : (
        <Resultats
          items={items}
          suivi={suivi}
          recherche={search !== ''}
          page={page}
          pageCount={pageCount}
          setPage={setPage}
        />
      )}
    </div>
  );
}

function Resultats({
  items,
  suivi,
  recherche,
  page,
  pageCount,
  setPage,
}: {
  items: ProspectRow[];
  suivi: Suivi;
  recherche: boolean;
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {recherche
          ? 'Aucune fiche pour cette recherche. Videz la recherche.'
          : 'Aucune fiche ici. Elles arrivent quand un téléconseiller clôt un appel sur ce statut.'}
      </p>
    );
  }
  return (
    <>
      <Tableau items={items} suivi={suivi} />
      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              setPage(page - 1);
            }}
          >
            Précédents
          </Button>
          <span className="tabular-nums">
            Page {page} sur {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => {
              setPage(page + 1);
            }}
          >
            Suivants
          </Button>
        </div>
      ) : null}
    </>
  );
}
