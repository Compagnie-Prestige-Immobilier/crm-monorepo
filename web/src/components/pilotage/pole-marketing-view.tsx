'use client';

import { useQuery } from '@tanstack/react-query';
import { MegaphoneIcon } from 'lucide-react';

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
import { fetchQualiteDuMarketing } from '@/lib/data/chiffres';
import { formatNumber } from '@/lib/format';

export function PoleMarketingView() {
  const query = useQuery({
    queryKey: ['qualite-marketing-prospects'],
    queryFn: () => fetchQualiteDuMarketing(),
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Chargement du Pôle marketing">
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
        fallback="Les données de performance marketing n’ont pas pu être chargées."
      />
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <EmptyState
        icon={MegaphoneIcon}
        title="Aucune donnée"
        description="Aucune donnée marketing disponible."
      />
    );
  }

  const partsMotifs: Part[] = (data.parMotif ?? []).map((m) => ({
    label: m.label,
    value: m.count,
  }));

  const partsDeperdition: Part[] = [
    { label: 'Fiches jointes', value: data.joints, couleur: '#1A6B44' },
    {
      label: 'Non jointes (NRP / Erronées)',
      value: Math.max(0, data.eprouves - data.joints),
      couleur: '#B05070',
    },
    {
      label: 'Non appelées (en campagne)',
      value: Math.max(0, data.total - data.eprouves - data.nonDistribues),
      couleur: '#C8921A',
    },
    { label: 'Pas encore distribuées', value: data.nonDistribues, couleur: '#8A8A8A' },
  ];

  const lignesCanaux: LigneCroisee[] = (data.parCanal ?? []).map((c) => ({
    label: c.label,
    Joints: c.joints,
    'Non joints': Math.max(0, c.prospects - c.joints),
    courbe: c.convertis,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Pôle marketing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Qualité des leads apportés (formulaires Meta, TikTok, SharePoint) et conversion par canal.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Leads marketing</span>
              <InfoPopover
                label="Leads marketing"
                description="Leads bruts apportés par le marketing via formulaires basiques (Meta, TikTok, SharePoint) avant qualification."
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
                description="Leads ayant fait l’objet d’au moins une tentative d’appel par un téléconseiller."
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
                description="Leads effectivement joints par téléphone (statuts de qualification aboutis)."
              />
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{formatNumber(data.joints)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Convertis</span>
              <InfoPopover
                label="Convertis"
                description="Leads qualifiés ayant concrétisé leur inscription ou souscription."
              />
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{formatNumber(data.convertis)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Déchet & Déperdition</span>
              <InfoPopover
                label="Déchet & Déperdition"
                description="Total des leads non convertis. Englobe la déperdition globale : fiches inexploitables, doublons, mauvais numéros, injoignables (NRP), refus, décès ou queues de poisson."
              />
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              {formatNumber(Math.max(0, data.total - data.convertis))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Score marketing</span>
              <InfoPopover
                label="Score marketing"
                description={`Note globale sur 100 calculée à parts égales sur 2 critères :
• Joignabilité (50%) = Fiches jointes / Fiches appelées. Pénalisée par les faux numéros, décès et faux contacts.
• Taux de conversion (50%) = Leads convertis / Total des leads apportés. Les doublons, fiches inexploitables et « queues de poisson » augmentent le total sans convertir, ce qui abaisse mécaniquement ce score.`}
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
            <CardTitle>Issues d’appel des prospects</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <BarresHorizontales parts={partsMotifs} gauche={120} vide="Aucune issue enregistrée" />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Répartition de la joignabilité</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <AnneauDesFamilles parts={partsDeperdition} vide="Aucun lead enregistré" />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Conversion par canal</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <BarresEtCourbe lignes={lignesCanaux} vide="Aucun canal de provenance" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
