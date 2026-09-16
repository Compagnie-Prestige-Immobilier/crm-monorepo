'use client';

import { useQuery } from '@tanstack/react-query';
import { DatabaseIcon } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';
import {
  AnneauDesFamilles,
  BarresEtCourbe,
  BarresHorizontales,
  type LigneCroisee,
  type Part,
} from '@/components/pilotage/qualite-charts';
import { QueryErrorState } from '@/components/query-error-state';
import { InfoPopover } from '@/components/stats/stat-info';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchQualiteDeLaBase } from '@/lib/data/chiffres';
import { formatNumber } from '@/lib/format';

export function PoleDeploiementView() {
  const query = useQuery({
    queryKey: ['qualite-base-representants'],
    queryFn: () => fetchQualiteDeLaBase(),
  });

  if (query.isPending) {
    return (
      <div
        className="flex flex-col gap-6"
        role="status"
        aria-label="Chargement du Pôle déploiement"
      >
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <QueryErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        fallback="Les données de qualité de la base représentants n’ont pas pu être chargées."
      />
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <EmptyState
        icon={DatabaseIcon}
        title="Aucune donnée"
        description="La base représentants est vide."
      />
    );
  }

  const partsStatut: Part[] = (data.parStatut ?? []).map((s) => ({
    label: s.label,
    value: s.count,
  }));

  const lignesDepartement: LigneCroisee[] = (data.parDepartement ?? []).map((d) => ({
    label: d.label,
    Joints: d.joints,
    'Non joints': Math.max(0, d.fiches - d.joints),
    courbe: d.prospects,
  }));

  const partsCompletude: Part[] = (data.completude ?? []).map((c) => ({
    label: c.code,
    value: c.count,
  }));

  const partsJoignabilite: Part[] = [
    { label: 'Fiches jointes', value: data.joints },
    { label: 'Non jointes (NRP / Erronées)', value: Math.max(0, data.eprouves - data.joints) },
    { label: 'Non appelées (Jamais testées)', value: Math.max(0, data.total - data.eprouves) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Pôle déploiement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Qualité de la base des représentants et rendement par département.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Total fiches</span>
              <InfoPopover
                label="Total fiches"
                description="Nombre total de fiches représentants répertoriées dans la base."
              />
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{formatNumber(data.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Fiches appelées</span>
              <InfoPopover
                label="Fiches appelées"
                description="Représentants ayant fait l’objet d’au moins un appel de qualification."
              />
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{formatNumber(data.eprouves)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Fiches jointes</span>
              <InfoPopover
                label="Fiches jointes"
                description="Représentants effectivement joints au téléphone (statuts de qualification aboutis)."
              />
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{formatNumber(data.joints)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Productifs</span>
              <InfoPopover
                label="Productifs"
                description="Représentants ayant apporté au moins un prospect."
              />
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{formatNumber(data.productifs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Déchet & Injoignables</span>
              <InfoPopover
                label="Déchet & Injoignables"
                description="Nombre de fiches représentants injoignables après tentative d'appel : numéros erronés, NRP, refus, décès ou fiches inexploitables."
              />
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              {formatNumber(Math.max(0, data.eprouves - data.joints))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Score base</span>
              <InfoPopover
                label="Score base"
                description={`Note globale sur 100 calculée à parts égales sur 2 critères :
• Joignabilité (50%) = Représentants joints / Représentants appelés.
• Productivité (50%) = Représentants productifs (apportant des prospects) / Total fiches représentants.`}
              />
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              {data.score === null ? '—' : `${formatNumber(data.score)} / 100`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Qualification des représentants</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <AnneauDesFamilles parts={partsStatut} vide="Aucune qualification enregistrée" />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Joignabilité de la base</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <AnneauDesFamilles parts={partsJoignabilite} vide="Aucun représentant enregistré" />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Complétude des fiches</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <BarresHorizontales
              parts={partsCompletude}
              gauche={100}
              vide="Aucune donnée de complétude"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rendement par département</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <BarresEtCourbe lignes={lignesDepartement} vide="Aucun département renseigné" />
        </CardContent>
      </Card>
    </div>
  );
}
