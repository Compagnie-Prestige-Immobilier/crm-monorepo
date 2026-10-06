import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { TYPES } from '@/components/accueil/rendez-vous-filtres';
import { ChartCard } from '@/components/dashboard/chart-card';
import { EmptyChart } from '@/components/dashboard/empty-chart';
import { AnneauChart, BarresHorizontalesChart } from '@/components/dashboard/visites-charts';
import { QueryErrorState } from '@/components/query-error-state';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { lireSyntheseRendezVous, type SyntheseRendezVous } from '@/lib/data/rendez-vous';
import { formatNumber } from '@/lib/format';
import { type Contexte, RefusPermission } from '@/lib/guard';
import { type NamedCount, peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/accueil/tableau-de-bord-rdv')({
  beforeLoad: ({ context }: Contexte) => {
    if (!peut(context.user, 'rendez_vous.voir')) {
      throw new RefusPermission(context.user);
    }
  },
  component: TableauDeBordRendezVousPage,
});

const ETAPES: readonly { code: string; label: string }[] = [
  { code: 'A_CONFIRMER', label: 'À confirmer' },
  { code: 'A_RECONTACTER', label: 'À recontacter' },
  { code: 'CONFIRMES', label: 'Confirmés' },
  { code: 'EN_RETARD', label: 'En retard' },
  { code: 'A_CLOSER', label: 'Présents, closing à compléter' },
  { code: 'HISTORIQUE', label: 'Historique' },
];

const ISSUES: Record<string, string> = {
  HONORE: 'Honoré',
  NON_HONORE: 'Non honoré',
  '': 'Sans issue',
};

const CONFIRMATIONS: Record<string, string> = {
  CONFIRME: 'Confirmé',
  ANNULE: 'Annulé',
  A_RECONTACTER: 'À recontacter',
  '': 'Sans confirmation',
};

function comptes(parCode: Record<string, number>, libelles: Record<string, string>): NamedCount[] {
  return Object.entries(libelles)
    .map(([code, label]) => ({ id: code, label, value: parCode[code] ?? 0 }))
    .filter((compte) => compte.value > 0);
}

function Tuile({ label, valeur }: { label: string; valeur: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-[0.8125rem] text-muted-foreground">{label}</span>
        <span className="text-2xl font-[700] tabular-nums">{formatNumber(valeur)}</span>
      </CardContent>
    </Card>
  );
}

function Repartition({
  titre,
  items,
  anneau = false,
}: {
  titre: string;
  items: NamedCount[];
  anneau?: boolean;
}) {
  let graphique = <BarresHorizontalesChart items={items} />;
  if (items.length === 0) {
    graphique = <EmptyChart message="Aucun rendez-vous sur cette période." />;
  } else if (anneau) {
    graphique = <AnneauChart items={items} />;
  }
  return (
    <ChartCard title={titre} hauteur="haute">
      {graphique}
    </ChartCard>
  );
}

function Synthese({ synthese }: { synthese: SyntheseRendezVous }) {
  const parType = synthese.parType.map((ligne) => ({
    id: ligne.code,
    label: ligne.libelle,
    value: ligne.nombre,
  }));
  const parSite = synthese.parSite.map((ligne) => ({
    id: ligne.code,
    label: ligne.libelle === '' ? 'Sans site' : ligne.libelle,
    value: ligne.nombre,
  }));
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Tuile label="Total" valeur={synthese.total} />
        {ETAPES.map((etape) => (
          <Tuile key={etape.code} label={etape.label} valeur={synthese.parEtape[etape.code] ?? 0} />
        ))}
        <Tuile label="Reportés" valeur={synthese.reportes} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Repartition titre="Issue" items={comptes(synthese.parIssue, ISSUES)} anneau />
        <Repartition
          titre="Confirmation"
          items={comptes(synthese.parConfirmation, CONFIRMATIONS)}
          anneau
        />
        <Repartition titre="Type de rendez-vous" items={parType} />
        <Repartition titre="Site" items={parSite} />
      </div>
    </div>
  );
}

function Contenu({ requete }: { requete: UseQueryResult<SyntheseRendezVous> }) {
  if (requete.isError) {
    return (
      <QueryErrorState
        error={requete.error}
        onRetry={() => {
          void requete.refetch();
        }}
      />
    );
  }
  if (requete.data === undefined) return <Skeleton className="h-80 w-full rounded-lg" />;
  return <Synthese synthese={requete.data} />;
}

function TableauDeBordRendezVousPage() {
  const [type, setType] = useState('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const requete = useQuery({
    queryKey: ['accueil', 'rendez-vous', 'synthese', type, du, au],
    queryFn: () => lireSyntheseRendezVous(type, du, au),
  });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-xl font-[700]">Tableau de bord des rendez-vous</h1>
        <Select
          items={TYPES}
          value={type === '' ? 'tous' : type}
          onValueChange={(valeur) => {
            setType(valeur === 'tous' || valeur === null ? '' : valeur);
          }}
        >
          <SelectTrigger aria-label="Type de rendez-vous" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((choix) => (
              <SelectItem key={choix.value} value={choix.value}>
                {choix.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={du}
          aria-label="Du"
          className="w-40"
          onChange={(event) => {
            setDu(event.target.value);
          }}
        />
        <Input
          type="date"
          value={au}
          aria-label="Au"
          className="w-40"
          onChange={(event) => {
            setAu(event.target.value);
          }}
        />
      </div>
      <Contenu requete={requete} />
    </div>
  );
}
