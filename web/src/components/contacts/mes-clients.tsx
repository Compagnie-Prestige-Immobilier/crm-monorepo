'use client';

import { useQuery } from '@tanstack/react-query';
import { WalletIcon } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/empty-state';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { QueryErrorState } from '@/components/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchClientsContacts, type ClientContact } from '@/lib/data/prospects';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';
import type { Projet } from '@/lib/types';

const SANS_VALEUR = <span className="text-muted-foreground">–</span>;

const montant = (valeur: number): string => `${formatNumber(valeur)} F`;

function LigneClient({ client }: { client: ClientContact }) {
  return (
    <TableRow className="h-11">
      <TableCell>
        <Link href={`/teleconseil/prospects/${client.id}`} className="font-medium hover:underline">
          {client.prenom} {client.nom}
        </Link>
        <p className="text-[0.75rem] text-muted-foreground">
          {client.phoneE164 === null ? '' : formatPhone(client.phoneE164)}
        </p>
      </TableCell>
      <TableCell>
        <ProjetBadge projet={client.projet} />
      </TableCell>
      <TableCell>{client.vente ? client.site : SANS_VALEUR}</TableCell>
      <TableCell>
        {client.vente && client.dateSouscription !== null
          ? formatDate(client.dateSouscription)
          : SANS_VALEUR}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {client.vente ? `${formatNumber(client.nombreLots)} · ${client.numerosLots}` : SANS_VALEUR}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {client.vente ? montant(client.prixTotal) : SANS_VALEUR}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {client.vente ? montant(client.reliquat) : SANS_VALEUR}
      </TableCell>
    </TableRow>
  );
}

/** Les clients d'un téléconseiller : ses contacts vendus, avec la vente rapprochée par téléphone. */
export function MesClients({ appelePar, projet }: { appelePar: string; projet: Projet | null }) {
  const clients = useQuery({
    queryKey: ['mes-contacts', 'clients', appelePar, projet],
    queryFn: () => fetchClientsContacts(appelePar, projet),
    placeholderData: (previous) => previous,
  });

  if (clients.isError) {
    return (
      <QueryErrorState
        error={clients.error}
        onRetry={() => {
          void clients.refetch();
        }}
        fallback="Les clients n’ont pas pu être lus."
      />
    );
  }
  if (clients.data === undefined) {
    return <Skeleton className="h-40" />;
  }
  if (clients.data.length === 0) {
    return (
      <EmptyState
        icon={WalletIcon}
        title="Aucun client pour l’instant"
        description="Un contact apparaît ici dès qu’une vente le concerne, par le classeur des ventes ou une vente saisie."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Projet</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Souscription</TableHead>
            <TableHead className="text-right">Lots</TableHead>
            <TableHead className="text-right">Prix total</TableHead>
            <TableHead className="text-right">Reliquat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.data.map((client) => (
            <LigneClient key={client.id} client={client} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
