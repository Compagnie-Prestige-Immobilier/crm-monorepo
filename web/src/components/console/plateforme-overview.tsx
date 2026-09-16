'use client';

import { ResponsiveBar } from '@nivo/bar';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { RechercheTableau, useTriLocal } from '@/components/ui/tri-local';
import {
  fetchPlateformeEquipe,
  plateformeEquipeKey,
  updatePlateformeObjectif,
  type PlateformeCcp,
  type PlateformeEquipe,
} from '@/lib/data/plateforme';
import { fetchProspectsAQualifier } from '@/lib/data/prospects';
import { formatDateTime, formatNumber } from '@/lib/format';
import { apiErrorText, toastApiError } from '@/lib/mutation-feedback';
import { useChartTheme } from '@/lib/chart-theme';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

const projets = [
  { value: null, label: 'Deux projets' },
  { value: 'CHUES' as const, label: 'CHUES' },
  { value: 'GRAND_PUBLIC' as const, label: 'Grand Public' },
] as const;

function themePour(theme: ReturnType<typeof useChartTheme>) {
  return {
    text: { fill: theme.tick, fontSize: 11 },
    axis: {
      domain: { line: { stroke: 'transparent' } },
      ticks: { line: { stroke: 'transparent' }, text: { fill: theme.tick } },
    },
    grid: { line: { stroke: theme.grid, strokeDasharray: '3 5' } },
    tooltip: { container: { background: theme.tooltipBackground, color: theme.tooltipForeground } },
  };
}

export function PlateformeOverview({
  encadrement,
  regleObjectif,
}: {
  encadrement: boolean;
  regleObjectif: boolean;
}) {
  const resultats = useQueries({
    queries: projets.map((projet) => ({
      queryKey: ['plateforme-overview', projet.value, encadrement],
      queryFn: async () => {
        const base = { projet: projet.value, search: '', plateforme: true, tous: encadrement };
        const [tous, aAppeler] = await Promise.all([
          fetchProspectsAQualifier({ ...base, page: 1 }),
          fetchProspectsAQualifier({ ...base, resteAAppeler: true, page: 1 }),
        ]);
        return { total: tous.total, aAppeler: aAppeler.total };
      },
      staleTime: 30_000,
    })),
  });

  const charge = resultats.some((resultat) => resultat.isPending);
  const total = resultats[0]?.data?.total ?? 0;
  const aAppeler = resultats[0]?.data?.aAppeler ?? 0;
  const appelees = Math.max(0, total - aAppeler);
  const theme = useChartTheme();
  const reducedMotion = usePrefersReducedMotion();
  const barres = resultats.slice(1).map((resultat, index) => ({
    projet: projets[index + 1]?.label ?? '',
    'À appeler': resultat.data?.aAppeler ?? 0,
    Appelées: Math.max(0, (resultat.data?.total ?? 0) - (resultat.data?.aAppeler ?? 0)),
  }));

  return (
    <section className="flex flex-col gap-6" aria-labelledby="plateforme-apercu-titre">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          Pilotage CCP
        </p>
        {/* `h2` : la barre du panel porte déjà l'unique `h1` de la page. */}
        <h2 id="plateforme-apercu-titre" className="mt-1 font-display text-3xl font-bold">
          Suivi de la file plateforme
        </h2>
        <p className="mt-2 text-muted-foreground">
          Les contacts transmis par les plateformes, y compris les parcours interrompus.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          title="Fiches de la file"
          value={total}
          detail="CHUES et Grand Public"
          loading={charge}
        />
        <Metric
          title="À appeler"
          value={aAppeler}
          detail="Dans la file partagée"
          loading={charge}
        />
        <Metric
          title="Déjà traitées"
          value={appelees}
          detail="Depuis leur arrivée dans la file"
          loading={charge}
        />
      </div>

      <EquipeCCP regleObjectif={regleObjectif} />

      <Card>
        <CardHeader>
          <CardTitle>Progression de la file</CardTitle>
          <CardDescription>Les fiches à appeler et déjà traitées, par projet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72" aria-label="Graphique des inscriptions par projet">
            <ResponsiveBar
              data={barres}
              keys={['À appeler', 'Appelées']}
              indexBy="projet"
              groupMode="grouped"
              margin={{ top: 12, right: 16, bottom: 44, left: 44 }}
              padding={0.35}
              borderRadius={5}
              colors={[theme.series[0] ?? '#7f0018', theme.series[1] ?? '#d3a529']}
              enableLabel={false}
              axisBottom={{ tickSize: 0, tickPadding: 10 }}
              axisLeft={{ tickSize: 0, tickPadding: 8 }}
              theme={themePour(theme)}
              animate={!reducedMotion}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function avancement(appels: number, objectif: number): string {
  if (objectif === 0) return '';
  return ` sur ${formatNumber(objectif)}, ${String(Math.round((appels / objectif) * 100))} %`;
}

const COLONNES_CCP = {
  fullName: (ccp: PlateformeCcp) => ccp.fullName,
  appelsJour: (ccp: PlateformeCcp) => ccp.appelsJour,
  jointsJour: (ccp: PlateformeCcp) => ccp.jointsJour,
  appelsSemaine: (ccp: PlateformeCcp) => ccp.appelsSemaine,
  rappelsEnAttente: (ccp: PlateformeCcp) => ccp.rappelsEnAttente,
  dernierAppel: (ccp: PlateformeCcp) => ccp.dernierAppel,
};

const ENTETES_CCP = [
  { id: 'fullName', label: 'CCP' },
  { id: 'appelsJour', label: 'Appels du jour', className: 'text-right' },
  { id: 'jointsJour', label: 'Joints', className: 'text-right' },
  { id: 'appelsSemaine', label: 'Semaine', className: 'text-right' },
  { id: 'rappelsEnAttente', label: 'Rappels promis', className: 'text-right' },
  { id: 'dernierAppel', label: 'Dernier appel' },
] as const;

function EquipeCCP({ regleObjectif }: { regleObjectif: boolean }) {
  const queryClient = useQueryClient();
  const equipe = useQuery({
    queryKey: plateformeEquipeKey,
    queryFn: () => fetchPlateformeEquipe(),
    refetchInterval: 60_000,
  });
  const objectif = useMutation({
    mutationFn: (valeur: number) => updatePlateformeObjectif(valeur),
    onSuccess: (donnees) => {
      queryClient.setQueryData(plateformeEquipeKey, donnees);
      toast.success('Objectif enregistré.');
    },
    onError: (error) => {
      toastApiError(error, 'L’objectif n’a pas été enregistré.');
    },
  });
  const cible = equipe.data?.objectifAppelsParJour ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Les CCP aujourd’hui</CardTitle>
        <CardDescription>
          Appels passés et fiches jointes depuis ce matin, appels depuis lundi, rappels encore
          promis.
        </CardDescription>
        {regleObjectif ? (
          <div className="mt-2 flex items-center gap-2">
            <Label htmlFor="objectif-ccp">Objectif par CCP et par jour</Label>
            <Input
              id="objectif-ccp"
              type="number"
              min={0}
              max={1000}
              className="w-24"
              defaultValue={cible}
              onBlur={(event) => {
                const valeur = Number(event.target.value);
                if (Number.isInteger(valeur) && valeur !== cible) objectif.mutate(valeur);
              }}
            />
            <span className="text-[0.875rem] text-muted-foreground">appels. Zéro : aucun.</span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <EquipeCorps equipe={equipe} cible={cible} />
      </CardContent>
    </Card>
  );
}

function EquipeCorps({
  equipe,
  cible,
}: {
  equipe: UseQueryResult<PlateformeEquipe>;
  cible: number;
}) {
  const tri = useTriLocal(equipe.data?.ccps ?? [], COLONNES_CCP);

  if (equipe.isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (equipe.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {apiErrorText(equipe.error, 'L’équipe n’a pas pu être chargée.')}
      </p>
    );
  }
  if (equipe.data.ccps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun CCP actif. Donnez ce rôle à un compte dans Utilisateurs.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <RechercheTableau
        recherche={tri.recherche}
        setRecherche={tri.setRecherche}
        total={tri.total}
        affichees={tri.lignes.length}
      />
      <Table aria-label="Activité des CCP">
        <TableHeader>
          <TableRow>
            {ENTETES_CCP.map((colonne) => (
              <SortableTableHead
                key={colonne.id}
                column={colonne}
                className={'className' in colonne ? colonne.className : undefined}
                sortBy={tri.sortBy}
                sortDir={tri.sortDir}
                onToggle={tri.toggle}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tri.lignes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Aucun CCP ne correspond à la recherche.
              </TableCell>
            </TableRow>
          ) : null}
          {tri.lignes.map((ccp) => (
            <TableRow key={ccp.id}>
              <th scope="row" className="px-3 py-2.5 text-left align-middle font-[600]">
                {ccp.fullName}
              </th>
              <TableCell className="text-right tabular-nums">
                {formatNumber(ccp.appelsJour)}
                {avancement(ccp.appelsJour, cible)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(ccp.jointsJour)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(ccp.appelsSemaine)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(ccp.rappelsEnAttente)}
              </TableCell>
              <TableCell>
                {ccp.dernierAppel === null ? 'Jamais' : formatDateTime(ccp.dernierAppel)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Metric({
  title,
  value,
  detail,
  loading,
}: {
  title: string;
  value: number;
  detail: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-4xl">{loading ? '…' : formatNumber(value)}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}
