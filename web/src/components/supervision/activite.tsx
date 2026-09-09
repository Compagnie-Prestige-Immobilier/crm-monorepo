import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  DownloadIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  TargetIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { QueryErrorState } from '@/components/query-error-state';
import { BarreActivite } from '@/components/supervision/activite-barre';
import {
  TableauActivite,
  TableauParTranche,
  valeurAffichee,
} from '@/components/supervision/activite-tableau';
import {
  COLONNES,
  famillesDuProjet,
  type Colonne,
  type Famille,
} from '@/components/supervision/colonnes';
import { EfficaciteParCreneau } from '@/components/supervision/creneaux';
import { FichesOuvertes } from '@/components/supervision/fiches';
import { RendementSurLaPeriode } from '@/components/supervision/rendement';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  lignesActivite,
  moyennesActivite,
  totauxActivite,
  totauxParTranche,
  trierLignes,
  type CleActivite,
  type CleTri,
  type SensTri,
} from '@/lib/data/activite-agregats';
import { telechargerCsv } from '@/lib/csv';
import {
  aujourdhui,
  cleActivite,
  fetchActivite,
  periodeDuPreset,
  type Granularite,
  type Periode,
  type Preset,
} from '@/lib/data/supervision';
import type { Projet, ProjetApi } from '@/lib/types';

const TUILES: Record<Famille, { cle: CleActivite; icon: LucideIcon }[]> = {
  representants: [
    { cle: 'repCalls', icon: PhoneCallIcon },
    { cle: 'repReachabilityRate', icon: PhoneOffIcon },
    { cle: 'repFichesAcceptees', icon: TargetIcon },
    { cle: 'prospectsCreated', icon: UserPlusIcon },
  ],
  prospects: [
    { cle: 'calls', icon: PhoneCallIcon },
    { cle: 'ficheReachRate', icon: PhoneOffIcon },
    { cle: 'methodObtained', icon: TargetIcon },
    { cle: 'prospectsCreated', icon: UserPlusIcon },
  ],
};

function Tuile({
  label,
  valeur,
  colonne,
  icon: Icon,
  index,
}: {
  label: string;
  valeur: number | null;
  colonne: Colonne;
  icon: LucideIcon;
  index: number;
}) {
  return (
    <Card className="animate-rise" style={{ animationDelay: `${String(index * 60)}ms` }}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
            {valeurAffichee(colonne, valeur)}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export function VueActivite({
  projet,
  projetApi,
  peutReglerLesCreneaux,
}: {
  projet: Projet;
  projetApi: ProjetApi;
  peutReglerLesCreneaux: boolean;
}) {
  const familles = famillesDuProjet(projet);
  const [famille, setFamille] = useState<Famille>(familles[0] ?? 'prospects');
  const colonnes = COLONNES[famille];
  const [preset, setPreset] = useState<Preset>('today');
  const [periode, setPeriode] = useState<Periode>(() => periodeDuPreset('today'));
  const [granularite, setGranularite] = useState<Granularite>('day');
  const [cleTri, setCleTri] = useState<CleTri>(colonnes[0]?.cle ?? 'name');
  const [sens, setSens] = useState<SensTri>('desc');

  const activite = useQuery({
    queryKey: cleActivite(periode, granularite, projetApi),
    queryFn: () => fetchActivite({ periode, granularite, projet: projetApi }),
    placeholderData: keepPreviousData,
  });

  function choisirFamille(suivante: Famille): void {
    setFamille(suivante);
    setCleTri(COLONNES[suivante][0]?.cle ?? 'name');
    setSens('desc');
  }

  function trier(cle: CleTri): void {
    if (cle === cleTri) {
      setSens(sens === 'asc' ? 'desc' : 'asc');
      return;
    }
    setCleTri(cle);
    setSens(cle === 'name' ? 'asc' : 'desc');
  }

  const barre = (
    <BarreActivite
      familles={familles}
      famille={famille}
      onFamille={choisirFamille}
      preset={preset}
      onPreset={setPreset}
      periode={periode}
      onPeriode={setPeriode}
      granularite={granularite}
      onGranularite={setGranularite}
    />
  );

  if (activite.data === undefined) {
    return (
      <div className="flex flex-col gap-6">
        {barre}
        {activite.isError ? (
          <QueryErrorState
            error={activite.error}
            onRetry={() => {
              void activite.refetch();
            }}
            fallback="L’activité de la période n’a pas pu être lue. Réessayez."
          />
        ) : (
          <Skeleton className="h-64 w-full rounded-lg" />
        )}
      </div>
    );
  }

  const lignes = trierLignes(lignesActivite(activite.data), cleTri, sens);
  const totaux = totauxActivite(lignes);
  const exporterCsv = (): void => {
    telechargerCsv(`cpi-supervision-activite-${aujourdhui()}.csv`, [
      ['Téléconseiller', ...colonnes.map((colonne) => colonne.label)],
      ...lignes.map((ligne) => [ligne.name, ...colonnes.map((colonne) => ligne[colonne.cle])]),
      ['Total équipe', ...colonnes.map((colonne) => totaux[colonne.cle])],
    ]);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.9375rem] text-muted-foreground">
        Ce volet mesure les appels et les saisies. La connexion à l’application est suivie dans
        Présence. « Confirmés » compte les appels retrouvés dans le journal du téléphone Android.
      </p>
      {barre}
      <Button variant="outline" size="sm" className="self-start" onClick={exporterCsv}>
        <DownloadIcon aria-hidden="true" />
        Exporter en CSV
      </Button>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TUILES[famille].map((tuile, index) => {
          const colonne = colonnes.find((candidate) => candidate.cle === tuile.cle);
          if (colonne === undefined) return null;
          return (
            <Tuile
              key={tuile.cle}
              index={index}
              label={colonne.label}
              colonne={colonne}
              valeur={totaux[tuile.cle]}
              icon={tuile.icon}
            />
          );
        })}
      </div>

      <TableauActivite
        lignes={lignes}
        totaux={totaux}
        moyennes={moyennesActivite(totaux)}
        colonnes={colonnes}
        cleTri={cleTri}
        sens={sens}
        onTrier={trier}
      />

      <p className="text-[0.8125rem] text-muted-foreground">
        Chaque colonne porte sur la date de l’acte, dans la période choisie.
      </p>

      <EfficaciteParCreneau
        periode={periode}
        granularite={granularite}
        projet={projetApi}
        famille={famille}
        peutRegler={peutReglerLesCreneaux}
      />

      <FichesOuvertes periode={periode} />

      <RendementSurLaPeriode notes={activite.data.scores ?? []} />

      <TableauParTranche
        tranches={totauxParTranche(activite.data.items ?? [])}
        colonnes={colonnes}
        granularite={granularite}
      />
    </div>
  );
}
