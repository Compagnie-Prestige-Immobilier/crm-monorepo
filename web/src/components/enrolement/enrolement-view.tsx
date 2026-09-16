'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadCloudIcon, PlugZapIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { formatDelai } from '@/components/enrolement/delais-enrolement';
import { DetailInscription } from '@/components/enrolement/detail-inscription';
import { CourbeEnrolement, EntonnoirCarte } from '@/components/enrolement/entonnoir-enrolement';
import { Pagination, StatutsBandeau, tonStatut } from '@/components/enrolement/liste-controles';
import { SyntheseEnrolement } from '@/components/enrolement/synthese-enrolement';
import { SearchField } from '@/components/filters/search-field';
import {
  AIDE_DELAIS,
  AIDE_RAPPROCHEMENT,
  AIDE_TAUX_RAPPROCHEMENT,
  aideDelai,
} from '@/components/enrolement/aides';
import { QueryErrorState } from '@/components/query-error-state';
import { InfoPopover } from '@/components/stats/stat-info';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  purgerInscriptions,
  saveReglagesEnrolement,
  supprimerInscription,
  tirerPlateforme,
  type EnrolementIndicateurs,
  type FiltresInscriptions,
  type OngletEnrolement,
  type Projet,
} from '@/lib/data/enrolement';
import { formatDate, formatDateTime, formatNumber, formatRateOrNone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/** La synthèse compare les deux plateformes ; les onglets suivants en tirent une seule. */
const SYNTHESE = 'synthese';
const ONGLETS = [SYNTHESE, ...ONGLETS_ENROLEMENT] as const;

const LIBELLE_ONGLET: Record<OngletEnrolement, string> = {
  chues: 'CHUES',
  'grand-public': 'Grand Public',
};

const TOUS = 'tous';
const PAGE_PAR_DEFAUT = 25;
const RAPPROCHES = 'rapproches';
const SANS_PROSPECT = 'sans-prospect';
const PRESENTES = 'presentes';
const AVEC_DISPARUES = 'avec-disparues';

const libelle = (valeur: (typeof ONGLETS)[number]): string =>
  valeur === SYNTHESE ? 'Synthèse' : LIBELLE_ONGLET[valeur];

const estOnglet = (valeur: string | null): valeur is OngletEnrolement =>
  (ONGLETS_ENROLEMENT as readonly string[]).includes(valeur ?? '');

export function EnrolementView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onglet: (typeof ONGLETS)[number] = useMemo(() => {
    const brut = searchParams.get('onglet');
    return estOnglet(brut) ? brut : SYNTHESE;
  }, [searchParams]);

  const changerOnglet = useCallback(
    (suivant: string) => {
      const params = new URLSearchParams();
      if (suivant !== SYNTHESE) params.set('onglet', suivant);
      const requete = params.toString();
      router.replace(requete === '' ? pathname : `${pathname}?${requete}`, { scroll: false });
    },
    [pathname, router],
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-[0.9375rem] text-muted-foreground">
        Les inscriptions actives lues sur les plateformes d’enrôlement, un projet par onglet. Une
        inscription rapprochée rejoint la file du projet correspondant.
      </p>

      <Tabs value={onglet} onValueChange={changerOnglet}>
        <TabsList>
          {ONGLETS.map((valeur) => (
            <TabsTrigger key={valeur} value={valeur}>
              {libelle(valeur)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={SYNTHESE}>
          <SyntheseEnrolement />
        </TabsContent>

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
  const [filtres, setFiltres] = useState<FiltresInscriptions>({
    page: 1,
    pageSize: PAGE_PAR_DEFAUT,
  });
  const [detailId, setDetailId] = useState<string | null>(null);

  const poserFiltre = (partiel: Partial<FiltresInscriptions>): void => {
    setFiltres((courant) => ({ ...courant, ...partiel }));
  };

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

      <div className="grid gap-4 lg:grid-cols-2">
        <EntonnoirCarte
          entonnoir={indicateurs.data?.entonnoir}
          actif={filtres.avancement}
          onChoisir={(avancement) => {
            poserFiltre({ avancement, page: 1 });
          }}
        />
        <CourbeEnrolement
          titre="Inscriptions par jour"
          series={[{ nom: 'Inscriptions', points: indicateurs.data?.parJour ?? [] }]}
        />
      </div>

      {indicateurs.data === undefined ? null : <Repartitions indicateurs={indicateurs.data} />}

      <StatutsBandeau
        statuts={indicateurs.data?.parEtape ?? []}
        total={indicateurs.data?.inscriptions}
        actif={filtres.statut}
        onChoisir={(statut) => {
          poserFiltre({ statut, page: 1 });
        }}
      />

      <FiltresBarre filtres={filtres} onChange={setFiltres} />

      <TableauInscriptions
        etat={inscriptions}
        projet={projet}
        libelles={libellesStatuts(indicateurs.data)}
        pageSize={filtres.pageSize ?? PAGE_PAR_DEFAUT}
        onPage={(page) => {
          poserFiltre({ page });
        }}
        onPageSize={(pageSize) => {
          poserFiltre({ pageSize, page: 1 });
        }}
        onOuvrir={setDetailId}
      />

      <DetailInscription
        projet={projet}
        id={detailId}
        libelles={libellesStatuts(indicateurs.data)}
        onClose={() => {
          setDetailId(null);
        }}
      />
    </div>
  );
}

/** Les libellés de statut vivent côté serveur : la liste les reprend, elle ne les réinvente pas. */
function libellesStatuts(indicateurs: EnrolementIndicateurs | undefined): Map<string, string> {
  return new Map((indicateurs?.parEtape ?? []).map((ligne) => [ligne.id, ligne.label]));
}

function isActionDisabled(pending: boolean, configuree: boolean): boolean {
  return pending || !configuree;
}

function libelleBouton(pending: boolean, enCours: string, repos: string): string {
  return pending ? enCours : repos;
}

function repriseDefaultValue(repriseDepuis: string | null | undefined): string {
  return repriseDepuis?.slice(0, 10) ?? '';
}

function CarteReglages({ projet }: { projet: Projet }) {
  const queryClient = useQueryClient();
  const [reconstruction, setReconstruction] = useState(false);
  const reglages = useQuery({
    queryKey: queryKeys.enrolementReglages(projet),
    queryFn: () => fetchReglagesEnrolement(projet),
  });

  const invalider = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.enrolementRoot });
  };

  const enregistrer = useMutation({
    mutationFn: (body: {
      frequenceMinutes?: number;
      repriseDepuis?: string;
      statutsComplets?: string[];
      seuilAttentePlateforme?: number;
    }) => saveReglagesEnrolement(projet, body),
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

  const reconstruire = useMutation({
    mutationFn: async () => {
      const purge = await purgerInscriptions(projet);
      return { purge, tirage: await tirerPlateforme(projet) };
    },
    onSuccess: async ({ purge, tirage }) => {
      setReconstruction(false);
      if (tirage.erreur === null) {
        toast.success(
          `${formatNumber(purge.supprimees)} inscriptions vidées, ${formatNumber(tirage.lus)} relues.`,
        );
      } else {
        toast.error(tirage.erreur);
      }
      await invalider();
    },
    onError: (error: unknown) => {
      toastApiError(error, 'Le miroir n’a pas pu être reconstruit.');
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
                defaultValue={repriseDefaultValue(donnees.repriseDepuis)}
                onBlur={(event) => {
                  enregistrer.mutate({ repriseDepuis: event.target.value });
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`complets-${projet}`}>Statuts « dossier complet »</Label>
              <Input
                id={`complets-${projet}`}
                className="w-64"
                placeholder="Vide : décision datée sur la plateforme"
                defaultValue={donnees.statutsComplets.join(', ')}
                onBlur={(event) => {
                  const statuts = event.target.value
                    .split(/[,;]+/u)
                    .map((s) => s.trim())
                    .filter((s) => s !== '');
                  if (statuts.join(',') !== donnees.statutsComplets.join(',')) {
                    enregistrer.mutate({ statutsComplets: statuts });
                  }
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`seuil-plateforme-${projet}`}>Alerter l’encadrement au-delà de</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`seuil-plateforme-${projet}`}
                  type="number"
                  min={0}
                  max={100000}
                  className="w-24"
                  defaultValue={donnees.seuilAttentePlateforme}
                  onBlur={(event) => {
                    const seuil = Number(event.target.value);
                    if (Number.isInteger(seuil) && seuil !== donnees.seuilAttentePlateforme) {
                      enregistrer.mutate({ seuilAttentePlateforme: seuil });
                    }
                  }}
                />
                <span className="text-[0.875rem] text-muted-foreground">
                  fiches plateforme sans premier appel. Zéro : jamais.
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isActionDisabled(reconstruire.isPending, donnees.configuree)}
              onClick={() => {
                setReconstruction(true);
              }}
            >
              <RefreshCwIcon className="size-4" />
              {libelleBouton(reconstruire.isPending, 'Reconstruction…', 'Vider puis tirer')}
            </Button>

            <Button
              type="button"
              disabled={isActionDisabled(tirer.isPending, donnees.configuree)}
              onClick={() => {
                tirer.mutate();
              }}
            >
              <DownloadCloudIcon className="size-4" />
              {libelleBouton(tirer.isPending, 'Tirage en cours…', 'Tirer maintenant')}
            </Button>
          </div>
        </div>

        <ConfirmDialog
          open={reconstruction}
          onOpenChange={setReconstruction}
          title="Vider le miroir puis le reconstruire ?"
          description="Les inscriptions lues pour ce projet sont effacées du CRM, puis la plateforme est relue en entier. Elle n’est pas modifiée. Les rapprochements sont recalculés à l’identique."
          confirmLabel="Vider puis tirer"
          pending={reconstruire.isPending}
          onConfirm={() => {
            reconstruire.mutate();
          }}
        />

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
    {
      label: 'Inscriptions',
      valeur: indicateurs && formatNumber(indicateurs.inscriptions),
      aide: 'Les comptes lus sur la plateforme et déposés dans le CRM. Une inscription que la plateforme ne rend plus est marquée retirée et sort de tous les chiffres.',
    },
    {
      label: 'Rapprochées',
      valeur: indicateurs && formatNumber(indicateurs.rapprochees),
      aide: AIDE_RAPPROCHEMENT,
    },
    {
      label: 'Taux de rapprochement',
      valeur: indicateurs && formatRateOrNone(indicateurs.tauxRapprochement),
      aide: AIDE_TAUX_RAPPROCHEMENT,
    },
    {
      label: 'Convertis puis inscrits',
      valeur: indicateurs && formatRateOrNone(indicateurs.tauxConversion),
      aide: 'Part des prospects convertis de ce projet qui se retrouvent inscrits sur la plateforme. Se lit dans l’autre sens que le rapprochement : il part des prospects, pas des inscriptions, et ignore le filtre de période.',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tuiles.map((tuile) => (
        <Card key={tuile.label}>
          <CardContent>
            <p className="flex items-center gap-1 text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
              {tuile.label}
              <InfoPopover label={tuile.label} description={tuile.aide} />
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
    { titre: 'Par agent de la plateforme', lignes: indicateurs.parAgentPlateforme },
    { titre: 'Pièces du dossier', lignes: indicateurs.parPiece },
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
            <p className="flex items-center gap-1 text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
              Délais de traitement
              <InfoPopover label="Délais de traitement" description={AIDE_DELAIS} />
            </p>
            <ul className="flex flex-col gap-2">
              {delais.map((delai) => (
                <li key={delai.leg} className="flex flex-col gap-0.5 text-[0.875rem]">
                  <span className="inline-flex items-center gap-1">
                    {delai.label}
                    <InfoPopover label={delai.label} description={aideDelai(delai.leg)} />
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatDelai(delai.moyenneDays ?? 0)} en moyenne · la moitié en moins de{' '}
                    {formatDelai(delai.medianDays ?? 0)} · sur {formatNumber(delai.sample)} dossier
                    {delai.sample > 1 ? 's' : ''}
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
}: {
  filtres: FiltresInscriptions;
  onChange: (suivants: FiltresInscriptions) => void;
}) {
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
  projet,
  pageSize,
  onPage,
  onPageSize,
  onOuvrir,
  libelles,
}: {
  etat: EtatInscriptions;
  projet: Projet;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (taille: number) => void;
  onOuvrir: (id: string) => void;
  libelles: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const [aRetirer, setARetirer] = useState<{ id: string; nom: string } | null>(null);

  const retirer = useMutation({
    mutationFn: (id: string) => supprimerInscription(projet, id),
    onSuccess: async () => {
      setARetirer(null);
      toast.success('Inscription retirée du miroir.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.enrolementRoot });
    },
    onError: (error: unknown) => {
      toastApiError(error, 'L’inscription n’a pas pu être retirée.');
    },
  });

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
            <TableHead>
              <span className="inline-flex items-center gap-1">
                Prospect
                <InfoPopover label="Rapprochement" description={AIDE_RAPPROCHEMENT} />
              </span>
            </TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {etat.data.items.map((ligne) => (
            <TableRow key={ligne.id}>
              <TableCell className="font-[600]">
                <button
                  type="button"
                  className="text-left underline-offset-4 hover:underline"
                  onClick={() => {
                    onOuvrir(ligne.id);
                  }}
                >
                  {ligne.prenom} {ligne.nom}
                </button>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {ligne.email ?? ligne.phoneE164 ?? '—'}
              </TableCell>
              <TableCell>
                <Badge variant={tonStatut(ligne.statutDistant)}>
                  {libelles.get(ligne.statutDistant) ?? ligne.statutDistant}
                </Badge>
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
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Retirer ${ligne.prenom} ${ligne.nom} du miroir`}
                  onClick={() => {
                    setARetirer({ id: ligne.id, nom: `${ligne.prenom} ${ligne.nom}` });
                  }}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={aRetirer !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setARetirer(null);
        }}
        title="Retirer cette inscription du miroir ?"
        description={`${aRetirer?.nom ?? ''} disparaît de cet écran. La plateforme n’est pas touchée : le prochain tirage la redépose si elle y figure encore.`}
        confirmLabel="Retirer"
        pending={retirer.isPending}
        onConfirm={() => {
          if (aRetirer !== null) retirer.mutate(aRetirer.id);
        }}
      />

      <Pagination meta={meta} pageSize={pageSize} onPage={onPage} onPageSize={onPageSize} />
    </div>
  );
}
