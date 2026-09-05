'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadCloudIcon, PlugZapIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { SearchField } from '@/components/filters/search-field';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ONGLETS_ENROLEMENT,
  fetchIndicateursEnrolement,
  fetchInscriptions,
  fetchReglagesEnrolement,
  projetDeLOnglet,
  saveReglagesEnrolement,
  tirerPlateforme,
  type EnrolementIndicateurs,
  type FiltresInscriptions,
  type OngletEnrolement,
  type Projet,
} from '@/lib/data/enrolement';
import { formatDate, formatDateTime, formatNumber, formatRateOrNone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const LIBELLE_ONGLET: Record<OngletEnrolement, string> = {
  chues: 'CHUES',
  'grand-public': 'Grand Public',
};

const TOUS = 'tous';
const RAPPROCHES = 'rapproches';
const SANS_PROSPECT = 'sans-prospect';
const PRESENTES = 'presentes';
const AVEC_DISPARUES = 'avec-disparues';

const estOnglet = (valeur: string | null): valeur is OngletEnrolement =>
  (ONGLETS_ENROLEMENT as readonly string[]).includes(valeur ?? '');

export function EnrolementView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onglet: OngletEnrolement = useMemo(() => {
    const brut = searchParams.get('onglet');
    return estOnglet(brut) ? brut : 'chues';
  }, [searchParams]);

  const changerOnglet = useCallback(
    (suivant: string) => {
      const params = new URLSearchParams();
      if (suivant !== 'chues') params.set('onglet', suivant);
      const requete = params.toString();
      router.replace(requete === '' ? pathname : `${pathname}?${requete}`, { scroll: false });
    },
    [pathname, router],
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-[0.9375rem] text-muted-foreground">
        Les inscriptions lues sur les plateformes d’enrôlement, un projet par onglet. La lecture est
        à sens unique : rien n’est écrit sur les fiches prospects.
      </p>

      <Tabs value={onglet} onValueChange={changerOnglet}>
        <TabsList>
          {ONGLETS_ENROLEMENT.map((valeur) => (
            <TabsTrigger key={valeur} value={valeur}>
              {LIBELLE_ONGLET[valeur]}
            </TabsTrigger>
          ))}
        </TabsList>

        {ONGLETS_ENROLEMENT.map((valeur) => (
          <TabsContent key={valeur} value={valeur}>
            <PanneauProjet projet={projetDeLOnglet(valeur)} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/** Un seul panneau, paramétré par le projet : les deux onglets partagent tout. */
function PanneauProjet({ projet }: { projet: Projet }) {
  const [filtres, setFiltres] = useState<FiltresInscriptions>({ page: 1, pageSize: 25 });

  const indicateurs = useQuery({
    queryKey: queryKeys.enrolementIndicateurs(projet, {
      dateFrom: filtres.dateFrom,
      dateTo: filtres.dateTo,
    }),
    queryFn: () =>
      fetchIndicateursEnrolement(projet, {
        ...(filtres.dateFrom === undefined ? {} : { dateFrom: filtres.dateFrom }),
        ...(filtres.dateTo === undefined ? {} : { dateTo: filtres.dateTo }),
      }),
    placeholderData: keepPreviousData,
  });

  const inscriptions = useQuery({
    queryKey: queryKeys.enrolementInscriptions(projet, { ...filtres }),
    queryFn: () => fetchInscriptions(projet, filtres),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-6 pt-2">
      <CarteReglages projet={projet} />

      {indicateurs.isError ? (
        <QueryErrorState
          error={indicateurs.error}
          onRetry={() => void indicateurs.refetch()}
          fallback="Les indicateurs d’enrôlement n’ont pas pu être calculés."
        />
      ) : (
        <Tuiles indicateurs={indicateurs.data} />
      )}

      {indicateurs.data === undefined ? null : <Repartitions indicateurs={indicateurs.data} />}

      <FiltresBarre filtres={filtres} onChange={setFiltres} indicateurs={indicateurs.data} />

      <TableauInscriptions
        etat={inscriptions}
        page={filtres.page ?? 1}
        onPage={(page) => {
          setFiltres((courant) => ({ ...courant, page }));
        }}
      />
    </div>
  );
}

function CarteReglages({ projet }: { projet: Projet }) {
  const queryClient = useQueryClient();
  const reglages = useQuery({
    queryKey: queryKeys.enrolementReglages(projet),
    queryFn: () => fetchReglagesEnrolement(projet),
  });

  const invalider = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.enrolementRoot });
  };

  const enregistrer = useMutation({
    mutationFn: (body: { frequenceMinutes?: number; repriseDepuis?: string }) =>
      saveReglagesEnrolement(projet, body),
    onSuccess: async () => {
      toast.success('Réglages enregistrés.');
      await invalider();
    },
    onError: (error: unknown) => {
      toastApiError(error, 'Les réglages n’ont pas pu être enregistrés.');
    },
  });

  const tirer = useMutation({
    mutationFn: () => tirerPlateforme(projet),
    onSuccess: async (tirage) => {
      if (tirage.erreur === null) {
        const lues = `${formatNumber(tirage.lus)} inscriptions lues, ${formatNumber(tirage.crees)} nouvelles.`;
        toast.success(
          tirage.disparues === 0
            ? lues
            : `${lues} ${formatNumber(tirage.disparues)} ne sont plus sur la plateforme.`,
        );
      } else {
        toast.error(tirage.erreur);
      }
      await invalider();
    },
    onError: (error: unknown) => {
      toastApiError(error, 'Le tirage n’a pas pu être lancé.');
    },
  });

  if (reglages.isPending) return <Skeleton className="h-40 w-full rounded-md" />;
  if (reglages.isError) {
    return (
      <QueryErrorState
        error={reglages.error}
        onRetry={() => void reglages.refetch()}
        fallback="Les réglages du connecteur n’ont pas pu être lus."
      />
    );
  }

  const donnees = reglages.data;
  const dernier = donnees.dernierTirage;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`frequence-${projet}`}>Tirer toutes les</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`frequence-${projet}`}
                  type="number"
                  min={5}
                  max={1440}
                  className="w-24"
                  defaultValue={donnees.frequenceMinutes}
                  onBlur={(event) => {
                    const minutes = Number(event.target.value);
                    if (Number.isInteger(minutes) && minutes !== donnees.frequenceMinutes) {
                      enregistrer.mutate({ frequenceMinutes: minutes });
                    }
                  }}
                />
                <span className="text-[0.875rem] text-muted-foreground">minutes</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`reprise-${projet}`}>Reprendre depuis</Label>
              <Input
                id={`reprise-${projet}`}
                type="date"
                className="w-44"
                defaultValue={donnees.repriseDepuis?.slice(0, 10) ?? ''}
                onBlur={(event) => {
                  enregistrer.mutate({ repriseDepuis: event.target.value });
                }}
              />
            </div>
          </div>

          <Button
            type="button"
            disabled={tirer.isPending || !donnees.configuree}
            onClick={() => {
              tirer.mutate();
            }}
          >
            <DownloadCloudIcon className="size-4" />
            {tirer.isPending ? 'Tirage en cours…' : 'Tirer maintenant'}
          </Button>
        </div>

        {donnees.configuree ? null : (
          <p role="alert" className="text-[0.875rem] text-destructive">
            L’adresse et le jeton de cette plateforme ne sont pas renseignés dans l’environnement du
            serveur. Aucun tirage n’a lieu.
          </p>
        )}

        <p className="text-[0.8125rem] text-muted-foreground">
          {dernier === null
            ? 'Aucun tirage effectué pour le moment.'
            : `Dernier tirage le ${formatDateTime(dernier.termineLe)} : ${formatNumber(dernier.lus)} lues, ${formatNumber(dernier.crees)} créées, ${formatNumber(dernier.misAJour)} mises à jour, ${formatNumber(dernier.rapproches)} rapprochées, ${formatNumber(dernier.disparues)} disparues.`}
        </p>

        {dernier?.erreur == null ? null : (
          <p role="alert" className="text-[0.875rem] text-destructive">
            Dernière erreur : {dernier.erreur}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Tuiles({ indicateurs }: { indicateurs: EnrolementIndicateurs | undefined }) {
  const tuiles = [
    { label: 'Inscriptions', valeur: indicateurs && formatNumber(indicateurs.inscriptions) },
    { label: 'Rapprochées', valeur: indicateurs && formatNumber(indicateurs.rapprochees) },
    {
      label: 'Taux de rapprochement',
      valeur: indicateurs && formatRateOrNone(indicateurs.tauxRapprochement),
    },
    {
      label: 'Convertis puis inscrits',
      valeur: indicateurs && formatRateOrNone(indicateurs.tauxConversion),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tuiles.map((tuile) => (
        <Card key={tuile.label}>
          <CardContent>
            <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
              {tuile.label}
            </p>
            {tuile.valeur === undefined ? (
              <Skeleton className="mt-2 h-8 w-20" />
            ) : (
              <p className="mt-1 font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
                {tuile.valeur}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Repartitions({ indicateurs }: { indicateurs: EnrolementIndicateurs }) {
  const blocs = [
    { titre: 'Par étape', lignes: indicateurs.parEtape },
    { titre: 'Par téléconseiller', lignes: indicateurs.parTeleconseiller },
    { titre: 'Par campagne', lignes: indicateurs.parCampagne },
    { titre: 'Par méthode d’enrôlement', lignes: indicateurs.parMethode },
  ].filter((bloc) => bloc.lignes.length > 0);

  const delais = indicateurs.delais.filter((delai) => delai.medianDays !== null);
  if (blocs.length === 0 && delais.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {blocs.map((bloc) => (
        <Card key={bloc.titre}>
          <CardContent className="flex flex-col gap-2">
            <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
              {bloc.titre}
            </p>
            <ul className="flex flex-col gap-1">
              {bloc.lignes.slice(0, 8).map((ligne) => (
                <li key={ligne.id} className="flex justify-between gap-4 text-[0.875rem]">
                  <span className="truncate">{ligne.label}</span>
                  <span className="tabular-nums">{formatNumber(ligne.inscriptions)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {delais.length === 0 ? null : (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
              Délais médians
            </p>
            <ul className="flex flex-col gap-1">
              {delais.map((delai) => (
                <li key={delai.leg} className="flex justify-between gap-4 text-[0.875rem]">
                  <span className="truncate">{delai.label}</span>
                  <span className="tabular-nums">
                    {formatNumber(delai.medianDays ?? 0)} j · {formatNumber(delai.sample)} mesures
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FiltresBarre({
  filtres,
  onChange,
  indicateurs,
}: {
  filtres: FiltresInscriptions;
  onChange: (suivants: FiltresInscriptions) => void;
  indicateurs: EnrolementIndicateurs | undefined;
}) {
  const statuts = [...new Set((indicateurs?.parEtape ?? []).map((ligne) => ligne.id))];

  const poser = (partiel: Partial<FiltresInscriptions>): void => {
    onChange({ ...filtres, ...partiel, page: 1 });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <SearchField
        value={filtres.search ?? ''}
        onChange={(valeur) => {
          poser({ search: valeur });
        }}
        placeholder="Nom, e-mail ou téléphone"
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="statut-enrolement">Statut</Label>
        <Select
          value={filtres.statut ?? TOUS}
          onValueChange={(valeur) => {
            poser({ statut: valeur === TOUS || valeur === null ? undefined : valeur });
          }}
        >
          <SelectTrigger id="statut-enrolement" size="sm" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TOUS}>Tous les statuts</SelectItem>
            {statuts.map((statut) => (
              <SelectItem key={statut} value={statut}>
                {statut}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rapproche-enrolement">Rapprochement</Label>
        <Select
          value={rapprochementValeur(filtres.rapproche)}
          onValueChange={(valeur) => {
            if (valeur === null) return;
            poser({
              rapproche: valeur === TOUS ? undefined : valeur === RAPPROCHES,
            });
          }}
        >
          <SelectTrigger id="rapproche-enrolement" size="sm" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TOUS}>Toutes</SelectItem>
            <SelectItem value={RAPPROCHES}>Rapprochées d’un prospect</SelectItem>
            <SelectItem value={SANS_PROSPECT}>Sans prospect</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="presence-enrolement">Sur la plateforme</Label>
        <Select
          value={filtres.inclureDisparues === true ? AVEC_DISPARUES : PRESENTES}
          onValueChange={(valeur) => {
            if (valeur === null) return;
            poser({ inclureDisparues: valeur === AVEC_DISPARUES ? true : undefined });
          }}
        >
          <SelectTrigger id="presence-enrolement" size="sm" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PRESENTES}>Toujours présentes</SelectItem>
            <SelectItem value={AVEC_DISPARUES}>Avec les disparues</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="du-enrolement">Du</Label>
        <Input
          id="du-enrolement"
          type="date"
          className="w-40"
          value={filtres.dateFrom ?? ''}
          onChange={(event) => {
            poser({ dateFrom: event.target.value === '' ? undefined : event.target.value });
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="au-enrolement">Au</Label>
        <Input
          id="au-enrolement"
          type="date"
          className="w-40"
          value={filtres.dateTo ?? ''}
          onChange={(event) => {
            poser({ dateTo: event.target.value === '' ? undefined : event.target.value });
          }}
        />
      </div>
    </div>
  );
}

const rapprochementValeur = (rapproche: boolean | undefined): string => {
  if (rapproche === undefined) return TOUS;
  return rapproche ? RAPPROCHES : SANS_PROSPECT;
};

interface EtatInscriptions {
  data:
    | {
        items: readonly {
          id: string;
          nom: string;
          prenom: string;
          email: string | null;
          phoneE164: string | null;
          statutDistant: string;
          etapeDistante: number | null;
          inscriteLe: string | null;
          disparueLe: string | null;
          prospectId: string | null;
        }[];
        meta: { total: number; page: number; pageCount: number };
      }
    | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

function TableauInscriptions({
  etat,
  page,
  onPage,
}: {
  etat: EtatInscriptions;
  page: number;
  onPage: (page: number) => void;
}) {
  if (etat.isError) {
    return (
      <QueryErrorState
        error={etat.error}
        onRetry={() => void etat.refetch()}
        fallback="La liste des inscriptions n’a pas pu être chargée."
      />
    );
  }

  if (etat.data === undefined) return <Skeleton className="h-64 w-full rounded-md" />;

  if (etat.data.items.length === 0) {
    return (
      <EmptyState
        icon={PlugZapIcon}
        title="Aucune inscription"
        description="Lancez un tirage, ou élargissez les filtres : la plateforme n’a rien rendu sur cette période."
      />
    );
  }

  const meta = etat.data.meta;

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Étape</TableHead>
            <TableHead>Inscription</TableHead>
            <TableHead>Prospect</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {etat.data.items.map((ligne) => (
            <TableRow key={ligne.id}>
              <TableCell className="font-[600]">
                {ligne.prenom} {ligne.nom}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {ligne.email ?? ligne.phoneE164 ?? '—'}
              </TableCell>
              <TableCell>
                {ligne.statutDistant}
                {ligne.disparueLe === null ? null : (
                  <span className="ml-2 text-[0.75rem] text-muted-foreground">
                    retirée de la plateforme le {formatDate(ligne.disparueLe)}
                  </span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">{ligne.etapeDistante ?? '—'}</TableCell>
              <TableCell>
                {ligne.inscriteLe === null ? '—' : formatDate(ligne.inscriteLe)}
              </TableCell>
              <TableCell>{ligne.prospectId === null ? 'Non rapproché' : 'Rapproché'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] text-muted-foreground tabular-nums">
          {formatNumber(meta.total)} inscriptions · page {formatNumber(meta.page)} sur{' '}
          {formatNumber(Math.max(1, meta.pageCount))}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              onPage(page - 1);
            }}
          >
            Précédent
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={page >= meta.pageCount}
            onClick={() => {
              onPage(page + 1);
            }}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}
