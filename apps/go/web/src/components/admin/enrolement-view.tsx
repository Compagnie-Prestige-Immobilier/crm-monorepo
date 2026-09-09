import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';

import {
  RepartitionsEnrolement,
  TuilesEnrolement,
} from '@/components/admin/enrolement-indicateurs';
import { TableauInscriptions } from '@/components/admin/enrolement-inscriptions';
import { EnrolementReglages } from '@/components/admin/enrolement-reglages';
import { QueryErrorState } from '@/components/query-error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchIndicateursEnrolement,
  fetchInscriptions,
  FILTRES_INSCRIPTIONS_VIDES,
  type FiltresInscriptions,
  type IndicateursEnrolement,
  type Inscription,
  type PageEnrolement,
} from '@/lib/data/enrolement';
import { queryKeys } from '@/lib/query-keys';
import { PROJET_API, PROJETS, type Projet, type ProjetApi } from '@/lib/types';

const LIBELLES_PROJET: Record<Projet, string> = {
  chues: 'CHUES',
  'grand-public': 'Grand Public',
};

const TOUS = 'tous';
const RAPPROCHES = 'rapproches';
const SANS_PROSPECT = 'sans-prospect';

function valeurRapprochement(rapproche: boolean | null): string {
  if (rapproche === null) return TOUS;
  return rapproche ? RAPPROCHES : SANS_PROSPECT;
}

export function EnrolementView() {
  const [projet, setProjet] = useState<string>(PROJETS[0]);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-[0.9375rem] text-muted-foreground">
        Les inscriptions lues sur les plateformes d’enrôlement, un projet par onglet. La lecture est
        à sens unique : rien n’est écrit sur les fiches prospects.
      </p>

      <Tabs
        value={projet}
        onValueChange={(valeur) => {
          if (typeof valeur === 'string') setProjet(valeur);
        }}
      >
        <TabsList>
          {PROJETS.map((valeur) => (
            <TabsTrigger key={valeur} value={valeur}>
              {LIBELLES_PROJET[valeur]}
            </TabsTrigger>
          ))}
        </TabsList>

        {PROJETS.map((valeur) => (
          <TabsContent key={valeur} value={valeur}>
            <PanneauProjet projet={PROJET_API[valeur]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PanneauProjet({ projet }: { projet: ProjetApi }) {
  const [filtres, setFiltres] = useState<FiltresInscriptions>(FILTRES_INSCRIPTIONS_VIDES);

  const indicateurs = useQuery({
    queryKey: queryKeys.enrolementIndicateurs(projet, {
      dateFrom: filtres.dateFrom,
      dateTo: filtres.dateTo,
    }),
    queryFn: () => fetchIndicateursEnrolement(projet, filtres),
    placeholderData: keepPreviousData,
  });

  const inscriptions = useQuery({
    queryKey: queryKeys.enrolementInscriptions(projet, { ...filtres }),
    queryFn: () => fetchInscriptions(projet, filtres),
    placeholderData: keepPreviousData,
  });

  const poser = (patch: Partial<FiltresInscriptions>): void => {
    setFiltres((courant) => ({ ...courant, ...patch, page: patch.page ?? 1 }));
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      <EnrolementReglages projet={projet} />

      {indicateurs.isError ? (
        <QueryErrorState
          error={indicateurs.error}
          onRetry={() => {
            void indicateurs.refetch();
          }}
          fallback="Les indicateurs d’enrôlement n’ont pas pu être calculés."
        />
      ) : (
        <TuilesEnrolement indicateurs={indicateurs.data} />
      )}

      {indicateurs.data === undefined ? null : (
        <RepartitionsEnrolement indicateurs={indicateurs.data} />
      )}

      <Filtres filtres={filtres} indicateurs={indicateurs.data} onChange={poser} />

      <Liste
        etat={inscriptions}
        projet={projet}
        page={filtres.page}
        onPage={(page) => {
          poser({ page });
        }}
      />
    </div>
  );
}

function Liste({
  etat,
  projet,
  page,
  onPage,
}: {
  etat: UseQueryResult<{ items: Inscription[]; meta: PageEnrolement }>;
  projet: ProjetApi;
  page: number;
  onPage: (page: number) => void;
}) {
  if (etat.isError) {
    return (
      <QueryErrorState
        error={etat.error}
        onRetry={() => {
          void etat.refetch();
        }}
        fallback="La liste des inscriptions n’a pas pu être chargée."
      />
    );
  }
  if (etat.data === undefined) return <Skeleton className="h-64 w-full rounded-md" />;

  return (
    <TableauInscriptions
      projet={projet}
      items={etat.data.items}
      meta={etat.data.meta}
      page={page}
      onPage={onPage}
    />
  );
}

function Filtres({
  filtres,
  indicateurs,
  onChange,
}: {
  filtres: FiltresInscriptions;
  indicateurs: IndicateursEnrolement | undefined;
  onChange: (patch: Partial<FiltresInscriptions>) => void;
}) {
  const statuts = [...new Set((indicateurs?.parEtape ?? []).map((ligne) => ligne.id))];
  const optionsStatut = [
    { value: TOUS, label: 'Tous les statuts' },
    ...statuts.map((statut) => ({ value: statut, label: statut })),
  ];
  const optionsRapprochement = [
    { value: TOUS, label: 'Toutes' },
    { value: RAPPROCHES, label: 'Rapprochées d’un prospect' },
    { value: SANS_PROSPECT, label: 'Sans prospect' },
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="recherche-enrolement">Recherche</Label>
        <Input
          id="recherche-enrolement"
          type="search"
          placeholder="Nom, e-mail ou téléphone"
          value={filtres.search}
          onChange={(event) => {
            onChange({ search: event.target.value });
          }}
        />
      </div>

      <div className="flex w-52 flex-col gap-1.5">
        <Label htmlFor="statut-enrolement">Statut</Label>
        <Select
          items={optionsStatut}
          value={filtres.statut ?? TOUS}
          onValueChange={(valeur) => {
            if (typeof valeur !== 'string') return;
            onChange({ statut: valeur === TOUS ? null : valeur });
          }}
        >
          <SelectTrigger id="statut-enrolement" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {optionsStatut.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-56 flex-col gap-1.5">
        <Label htmlFor="rapproche-enrolement">Rapprochement</Label>
        <Select
          items={optionsRapprochement}
          value={valeurRapprochement(filtres.rapproche)}
          onValueChange={(valeur) => {
            if (typeof valeur !== 'string') return;
            onChange({ rapproche: valeur === TOUS ? null : valeur === RAPPROCHES });
          }}
        >
          <SelectTrigger id="rapproche-enrolement" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {optionsRapprochement.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-[0.8125rem]">
        <input
          type="checkbox"
          className="size-4 accent-[var(--primary)]"
          checked={filtres.inclureDisparues}
          onChange={(event) => {
            onChange({ inclureDisparues: event.target.checked });
          }}
        />
        Avec les disparues
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="du-enrolement">Du</Label>
        <Input
          id="du-enrolement"
          type="date"
          className="w-40"
          value={filtres.dateFrom}
          onChange={(event) => {
            onChange({ dateFrom: event.target.value });
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="au-enrolement">Au</Label>
        <Input
          id="au-enrolement"
          type="date"
          className="w-40"
          value={filtres.dateTo}
          onChange={(event) => {
            onChange({ dateTo: event.target.value });
          }}
        />
      </div>
    </div>
  );
}
