'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, FileSpreadsheetIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import { ChartCard } from '@/components/dashboard/chart-card';
import { CategoryBarChart } from '@/components/dashboard/charts';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  MOIS_LABELS,
  evolution,
  fetchVisitesStats,
  moisPrecedent,
  nonRenseigne,
  partDe,
  periodeLabel,
  serieJournaliere,
  serieMensuelle,
  visitesCsv,
  visitesCsvFileName,
  visitesStatsKey,
  type AxeVisites,
  type VisitesPeriode,
  type VisitesStats,
} from '@/lib/data/visites-stats';
import { formatNumber, formatPercent, formatRateOrNone } from '@/lib/format';
import { useCanvasPresentation } from '@/lib/use-canvas-presentation';

function capitaliser(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function moisCourant(): VisitesPeriode {
  const maintenant = new Date();
  return { annee: maintenant.getUTCFullYear(), mois: maintenant.getUTCMonth() + 1 };
}

// Le BOM est ce qui fait lire l'UTF-8 a Excel, qui sinon casse les accents.
function telechargerCsv(texte: string, nomFichier: string): void {
  const url = URL.createObjectURL(new Blob([`﻿${texte}`], { type: 'text/csv;charset=utf-8' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

export function VisitesDashboard({ periodeInitiale }: { periodeInitiale?: VisitesPeriode }) {
  const [periode, setPeriode] = useState<VisitesPeriode>(periodeInitiale ?? moisCourant());
  const precedent = moisPrecedent(periode);

  // Pas de `keepPreviousData` : garder les chiffres du mois quitte les afficherait
  // sous le titre du mois demande.
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: visitesStatsKey(periode),
    queryFn: () => fetchVisitesStats(periode),
  });

  const veille = useQuery({
    queryKey: visitesStatsKey(precedent ?? periode),
    queryFn: () => fetchVisitesStats(precedent ?? periode),
    enabled: precedent !== null,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em]">
            Visites
          </h2>
          <p className="mt-2 text-[1.0625rem] font-[600] text-foreground">
            {capitaliser(periodeLabel(periode))}
          </p>
        </div>

        <Button
          variant="outline"
          disabled={data === undefined}
          onClick={() => {
            if (data === undefined) return;
            telechargerCsv(visitesCsv(data, periode), visitesCsvFileName(periode));
          }}
        >
          <FileSpreadsheetIcon aria-hidden="true" />
          Exporter
        </Button>
      </div>

      <SelecteurPeriode periode={periode} onChange={setPeriode} />

      {isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Les visites n’ont pas pu être comptées. Réessayez."
        />
      ) : null}

      {isPending ? <SquelettePeriode /> : null}

      {data !== undefined ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tuile
              libelle="Total des visites"
              valeur={data.total}
              detail={ecartLisible(
                precedent === null ? null : evolution(data.total, veille.data?.total ?? 0),
              )}
            />
            {data.parEntreprise.map((ligne) => (
              <Tuile
                key={ligne.id}
                libelle={ligne.label}
                valeur={ligne.count}
                detail={formatRateOrNone(partDe(ligne.count, data.total))}
              />
            ))}
          </div>

          <HorsRepartition stats={data} />

          <BlocAxe
            titre="Destinataires"
            entete="Destinataire"
            serie="Visites par destinataire"
            axe={data.parDestinataire}
            total={data.total}
            sansValeur={data.sansDestinataire}
          />
          <BlocAxe
            titre="Directions"
            entete="Direction"
            serie="Visites par direction"
            axe={data.parDirection}
            total={data.total}
            sansValeur={data.sansDirection}
          />
          <BlocAxe
            titre="Objets des visites"
            entete="Objet"
            serie="Visites par objet"
            axe={data.parObjet}
            total={data.total}
            sansValeur={nonRenseigne(data.total, data.parObjet)}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Visites par mois">
              <CategoryBarChart
                items={serieMensuelle(periode.annee, data.parMois).map((point) => ({
                  id: String(point.mois),
                  label: point.label,
                  value: point.total,
                }))}
                label="Visites par mois"
              />
            </ChartCard>

            {periode.mois === null ? null : (
              <ChartCard title="Visites par jour">
                <CategoryBarChart
                  items={serieJournaliere(periode.annee, periode.mois, data.parJour).map(
                    (point) => ({
                      id: String(point.jour),
                      label: String(point.jour),
                      value: point.total,
                    }),
                  )}
                  label="Visites par jour"
                />
              </ChartCard>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ecartLisible(ecart: number | null): string | null {
  if (ecart === null) return null;
  return `${formatPercent(ecart)} par rapport au mois précédent`;
}

function Tuile({
  libelle,
  valeur,
  detail,
}: {
  libelle: string;
  valeur: number;
  detail: string | null;
}) {
  return (
    <Card>
      <CardContent>
        <p className="truncate text-[0.8125rem] font-[700] uppercase tracking-wide text-foreground">
          {libelle}
        </p>
        <p className="mt-2 font-display text-[2.25rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
          {formatNumber(valeur)}
        </p>
        {detail === null ? null : (
          <p className="mt-2 text-[0.8125rem] text-foreground tabular-nums">{detail}</p>
        )}
      </CardContent>
    </Card>
  );
}

function HorsRepartition({ stats }: { stats: VisitesStats }) {
  const manquants: readonly (readonly [string, number])[] = [
    ['Sans entreprise', nonRenseigne(stats.total, stats.parEntreprise)],
    ['Sans destinataire', stats.sansDestinataire],
    ['Sans direction', stats.sansDirection],
  ];

  return (
    <section className="rounded-lg border border-border bg-secondary p-5 text-card-foreground">
      <h3 className="font-display text-[1.125rem] font-[700] tracking-[-0.02em]">
        Visites hors répartition
      </h3>
      {manquants.some(([, valeur]) => valeur > 0) ? (
        <p className="mt-2 text-[0.9375rem] text-foreground">
          Comptées dans le total, absentes des répartitions ci-dessous.
        </p>
      ) : null}
      <dl className="mt-4 flex flex-wrap gap-x-12 gap-y-4">
        {manquants.map(([libelle, valeur]) => (
          <div key={libelle}>
            <dt className="text-[0.8125rem] font-[700] uppercase tracking-wide text-foreground">
              {libelle}
            </dt>
            <dd className="mt-1 font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
              {formatNumber(valeur)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function BlocAxe({
  titre,
  entete,
  serie,
  axe,
  total,
  sansValeur,
}: {
  titre: string;
  entete: string;
  serie: string;
  axe: AxeVisites;
  total: number;
  sansValeur: number;
}) {
  const region = useRef<HTMLDivElement>(null);

  useCanvasPresentation(region);

  return (
    <Card>
      <CardContent>
        <h3 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{titre}</h3>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {/* Hauteur fixe : Chart.js mesure son conteneur, et un parent
              auto-dimensionne produit une boucle de redimensionnement. */}
          <div ref={region} className="h-64 min-w-0" role="group" aria-label={`${serie} graphique`}>
            <CategoryBarChart
              items={axe.map((ligne) => ({
                id: ligne.id,
                label: ligne.label,
                value: ligne.count,
              }))}
              label={serie}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{entete}</TableHead>
                <TableHead className="text-right">Visites</TableHead>
                <TableHead className="text-right">Part</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {axe.map((ligne) => (
                <TableRow key={ligne.id}>
                  <TableCell className="font-[600]">{ligne.label}</TableCell>
                  <TableCell className="text-right text-[1rem] font-[700] tabular-nums">
                    {formatNumber(ligne.count)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRateOrNone(partDe(ligne.count, total))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Non renseigné</TableCell>
                <TableCell className="text-right text-[1rem] font-[700] tabular-nums">
                  {formatNumber(sansValeur)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRateOrNone(partDe(sansValeur, total))}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SelecteurPeriode({
  periode,
  onChange,
}: {
  periode: VisitesPeriode;
  onChange: (periode: VisitesPeriode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Période affichée">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Année précédente"
          onClick={() => {
            onChange({ ...periode, annee: periode.annee - 1 });
          }}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <span className="min-w-16 text-center font-display text-[1.25rem] font-[800] tabular-nums">
          {String(periode.annee)}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Année suivante"
          onClick={() => {
            onChange({ ...periode, annee: periode.annee + 1 });
          }}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {MOIS_LABELS.map((label, index) => (
          <Button
            key={label}
            variant={periode.mois === index + 1 ? 'default' : 'outline'}
            aria-pressed={periode.mois === index + 1}
            className="min-w-24"
            onClick={() => {
              onChange({ ...periode, mois: index + 1 });
            }}
          >
            {capitaliser(label)}
          </Button>
        ))}
        <Button
          variant={periode.mois === null ? 'default' : 'outline'}
          aria-pressed={periode.mois === null}
          className="min-w-32"
          onClick={() => {
            onChange({ ...periode, mois: null });
          }}
        >
          Année entière
        </Button>
      </div>
    </div>
  );
}

function SquelettePeriode() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
