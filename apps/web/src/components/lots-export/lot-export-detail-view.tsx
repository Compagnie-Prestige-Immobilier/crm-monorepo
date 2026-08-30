'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  FileArchiveIcon,
  FileDownIcon,
  FileSpreadsheetIcon,
  LoaderIcon,
} from 'lucide-react';
import Link from 'next/link';

import { useFileDownload } from '@/components/exports/download-button';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchLotExport,
  lotExportFileName,
  lotExportUrl,
  lotProgrammeFileName,
  lotProgrammeUrl,
} from '@/lib/data/lots-export';
import { formatDate, formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  CALL_OUTCOME_LABELS,
  ENROLLMENT_METHOD_LABELS,
  REP_CALL_OUTCOME_LABELS,
} from '@/lib/types';

/**
 * L'API rend l'issue brute d'un appel de prospect OU de représentant, dans un
 * même champ de texte : les deux tables de libellés se recouvrent sans se
 * contredire.
 */
const ISSUE_LABELS: Record<string, string> = {
  ...REP_CALL_OUTCOME_LABELS,
  ...CALL_OUTCOME_LABELS,
};

/**
 * `comment` et `rendezVousAt` sont déclarés sans type dans le DTO de l'API : le
 * contrat engendré les rend en objet vide, alors que le serveur envoie du texte.
 */
const texte = (valeur: unknown): string | null =>
  typeof valeur === 'string' && valeur !== '' ? valeur : null;

function rendezVous(valeur: unknown): string {
  const iso = texte(valeur);
  return iso === null ? '' : ` · rendez-vous le ${formatDateTime(iso)}`;
}

export function LotExportDetailView({ id }: { id: string }) {
  const telechargement = useFileDownload();
  const lot = useQuery({
    queryKey: queryKeys.lotsExportDetail(id),
    queryFn: () => fetchLotExport(id),
  });

  if (lot.isPending)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );

  if (lot.isError)
    return (
      <QueryErrorState
        error={lot.error}
        onRetry={() => {
          void lot.refetch();
        }}
        fallback="Ce lot n’a pas pu être chargé."
      />
    );

  const {
    name,
    scopeLabel,
    itemCount,
    createdAt,
    createdByName,
    callsSince,
    fichesAppelees,
    distribution,
    repartition,
  } = lot.data;
  const parTeleconseiller = Object.entries(lot.data.callsByTeleconseiller).sort(
    (a, b) => b[1] - a[1],
  );
  const colonnes = Array.from({ length: distribution.jours }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/chues/campagnes"
        className="inline-flex w-fit items-center gap-1.5 text-[0.875rem] text-muted-foreground hover:underline focus-visible:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Tous les lots d’export
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          {/* `h2` : la barre du panel porte déjà l'unique `h1` de la page. */}
          <h2 className="font-display text-h2 font-[800]">{name}</h2>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">
            {scopeLabel} · <span className="tabular-nums">{formatNumber(itemCount)}</span> fiche
            {itemCount > 1 ? 's' : ''} réparties entre{' '}
            <span className="tabular-nums">{formatNumber(repartition.length)}</span> téléconseiller
            {repartition.length > 1 ? 's' : ''} sur{' '}
            <span className="tabular-nums">{formatNumber(distribution.jours)}</span> jour
            {distribution.jours > 1 ? 's' : ''}, le {formatDate(createdAt)}, par {createdByName}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={telechargement.pending}
            onClick={() => {
              void telechargement.download({
                url: lotExportUrl(id, 'zip'),
                fileName: lotExportFileName(name, 'zip'),
                failureMessage: 'L’archive n’a pas pu être générée.',
              });
            }}
          >
            {telechargement.pending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileArchiveIcon aria-hidden="true" />
            )}
            Tous les programmes (ZIP)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={telechargement.pending}
            onClick={() => {
              void telechargement.download({
                url: lotExportUrl(id, 'xlsx'),
                fileName: lotExportFileName(name, 'xlsx'),
                failureMessage: 'Le classeur n’a pas pu être généré.',
              });
            }}
          >
            <FileSpreadsheetIcon aria-hidden="true" />
            Classeur Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
            Programmes d’appel
          </h3>
          <p className="mt-1 text-[0.875rem] text-muted-foreground">
            {formatNumber(distribution.fichesParJour)} fiches par téléconseiller et par jour. Chaque
            programme s’imprime sur une fiche.
          </p>
        </CardHeader>
        <CardContent>
          {repartition.length === 0 ? (
            <p className="text-[0.875rem] text-muted-foreground">
              Aucun téléconseiller n’a reçu de fiche.
            </p>
          ) : (
            <Table aria-label="Programmes d’appel">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Téléconseiller</TableHead>
                  {colonnes.map((jour) => (
                    <TableHead key={jour} scope="col" className="text-right">
                      Jour {jour}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {repartition.map((ligne) => (
                  <TableRow key={ligne.teleconseillerId}>
                    <th scope="row" className="px-3 py-2.5 text-left align-middle font-[600]">
                      {ligne.teleconseillerName}
                    </th>
                    {colonnes.map((jour) => {
                      const fiches =
                        ligne.jours.find((entree) => entree.jour === jour)?.fiches ?? 0;
                      return (
                        <TableCell key={jour}>
                          <span className="flex items-center justify-end gap-2">
                            <span className="tabular-nums">{formatNumber(fiches)}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={`Programme de ${ligne.teleconseillerName}, jour ${String(jour)}`}
                              disabled={fiches === 0 || telechargement.pending}
                              onClick={() => {
                                void telechargement.download({
                                  url: lotProgrammeUrl(id, ligne.teleconseillerId, jour),
                                  fileName: lotProgrammeFileName(ligne.teleconseillerName, jour),
                                  failureMessage: `Le programme du jour ${String(jour)} n’a pas pu être généré.`,
                                });
                              }}
                            >
                              <FileDownIcon aria-hidden="true" />
                            </Button>
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-display text-h4 font-[700] leading-tight tracking-[-0.02em]">
            Appels passés sur ces fiches depuis la création
          </h3>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-[0.9375rem]">
            <span className="tabular-nums">{formatNumber(fichesAppelees)}</span> fiche
            {fichesAppelees > 1 ? 's' : ''} appelée{fichesAppelees > 1 ? 's' : ''} sur{' '}
            <span className="tabular-nums">{formatNumber(itemCount)}</span>,{' '}
            <span className="tabular-nums">{formatNumber(callsSince)}</span> appel
            {callsSince > 1 ? 's' : ''} consigné{callsSince > 1 ? 's' : ''}.
          </p>

          {parTeleconseiller.length > 0 ? (
            <div>
              <h4 className="mb-2 text-[0.8125rem] font-[600] text-muted-foreground">
                Par téléconseiller
              </h4>
              <ul className="flex flex-wrap gap-2">
                {parTeleconseiller.map(([nom, nombre]) => (
                  <li key={nom}>
                    <Badge variant="outline">
                      {nom} : {formatNumber(nombre)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {lot.data.recentAttempts.length === 0 ? (
            <p className="text-[0.875rem] text-muted-foreground">
              Aucun appel consigné depuis la création.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {lot.data.recentAttempts.map((tentative) => (
                <li key={tentative.id} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {ISSUE_LABELS[tentative.outcome] ?? tentative.outcome}
                    </Badge>
                    <span className="font-[600]">{tentative.shortCode}</span>
                    <span className="text-[0.8125rem] text-muted-foreground tabular-nums">
                      {formatPhone(tentative.phoneE164)}
                    </span>
                    {tentative.method === null ? null : (
                      <span className="text-[0.8125rem] text-muted-foreground">
                        {ENROLLMENT_METHOD_LABELS[tentative.method]}
                      </span>
                    )}
                  </div>
                  <p className="text-[0.8125rem] text-muted-foreground">
                    {formatDateTime(tentative.createdAt)}, par {tentative.performedByName}
                    {rendezVous(tentative.rendezVousAt)}
                  </p>
                  {texte(tentative.comment) === null ? null : (
                    <p className="text-[0.875rem]">{texte(tentative.comment)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
