'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CircleCheckIcon, MessageCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ListeCartes, NumeroAppel } from '@/components/ui/liste-cartes';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchEcheancesEnRetard, formatFcfa, type EcheanceEnRetard } from '@/lib/data/ventes';
import { formatDate, formatNumber } from '@/lib/format';

const TAILLE = 50;

const pluriel = (n: number, mot: string) => `${formatNumber(n)} ${mot}${n > 1 ? 's' : ''}`;

function BoutonWhatsAppRelance({ ligne }: { ligne: EcheanceEnRetard }) {
  if (ligne.telephoneE164 === null) return null;
  return (
    <a
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
      href={`https://wa.me/${ligne.telephoneE164.replaceAll(/\D/gu, '')}?text=${encodeURIComponent(ligne.messageWhatsapp)}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <MessageCircleIcon aria-hidden="true" />
      Relancer sur WhatsApp
    </a>
  );
}

function Retard({ ligne }: { ligne: EcheanceEnRetard }) {
  return <Badge variant="destructive">{pluriel(ligne.joursRetard, 'jour')} de retard</Badge>;
}

export function EcheancesEnRetardView() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['ventes', 'retards', page],
    queryFn: () => fetchEcheancesEnRetard(page, TAILLE),
    placeholderData: keepPreviousData,
  });

  if (query.isPending) return <Skeleton className="h-96 w-full rounded-lg" />;
  if (query.isError) {
    return (
      <QueryErrorState
        error={query.error}
        fallback="Les échéances en retard n’ont pas pu être lues."
        onRetry={() => void query.refetch()}
      />
    );
  }
  const { lignes, total, tronque } = query.data;
  if (total === 0) {
    return (
      <EmptyState
        icon={CircleCheckIcon}
        title="Aucune échéance en retard"
        description="Chaque vente à crédit a reçu ses versements attendus. Les prochains sont dans Échéances."
        action={
          <Link href="/ventes/echeances" className={buttonVariants({ variant: 'outline' })}>
            Voir les échéances
          </Link>
        }
      />
    );
  }
  const pages = Math.max(1, Math.ceil(total / TAILLE));
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-[0.9375rem]">
        {pluriel(total, 'vente')} avec au moins une échéance impayée.
      </p>
      {tronque ? (
        <p className="rounded-md bg-warning-surface p-3 text-warning">
          Seules les 5 000 ventes à crédit les plus anciennes sont examinées.
        </p>
      ) : null}
      <ListeCartes
        items={lignes}
        libelle="Échéances en retard"
        cle={(ligne) => String(ligne.venteId)}
        titre={(ligne) => `${ligne.client} · ${formatFcfa(ligne.montantDu)}`}
        sousTitre={(ligne) => (
          <>
            <span>
              {ligne.site} · vente n° {ligne.numero}
            </span>
            <span>
              {pluriel(ligne.echeancesManquees, 'échéance')} manquée
              {ligne.echeancesManquees > 1 ? 's' : ''}
            </span>
            <Retard ligne={ligne} />
          </>
        )}
        numero={(ligne) => ligne.telephoneE164}
        action={(ligne) => <BoutonWhatsAppRelance ligne={ligne} />}
      />
      <Table containerClassName="hidden md:block rounded-lg border border-border bg-card">
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Site</TableHead>
            <TableHead className="text-right">Montant dû</TableHead>
            <TableHead className="text-right">Échéances manquées</TableHead>
            <TableHead>Première impayée</TableHead>
            <TableHead>Retard</TableHead>
            <TableHead>
              <span className="sr-only">Relancer</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignes.map((ligne) => (
            <TableRow key={ligne.venteId}>
              <TableCell>
                <span className="block font-[600]">{ligne.client}</span>
                {ligne.telephoneE164 === null ? (
                  <span className="text-[0.8125rem] text-muted-foreground">{ligne.telephone}</span>
                ) : (
                  <NumeroAppel
                    phoneE164={ligne.telephoneE164}
                    className="block w-fit text-[0.8125rem] text-muted-foreground"
                  />
                )}
              </TableCell>
              <TableCell>
                {ligne.site}
                <span className="block text-[0.8125rem] text-muted-foreground">
                  Vente n° {ligne.numero}
                </span>
              </TableCell>
              <TableCell className="text-right font-[600] tabular-nums">
                {formatFcfa(ligne.montantDu)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(ligne.echeancesManquees)}
              </TableCell>
              <TableCell>{formatDate(ligne.premiereImpayee)}</TableCell>
              <TableCell>
                <Retard ligne={ligne} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <BoutonWhatsAppRelance ligne={ligne} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Précédente
          </Button>
          <span>
            Page {page} sur {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages || query.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Suivante
          </Button>
        </div>
      ) : null}
    </div>
  );
}
