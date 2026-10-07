import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { TYPES } from '@/components/accueil/rendez-vous-filtres';
import { plageDuPreset, type PeriodePreset } from '@/components/accueil/tableau-de-bord/periode';
import { ChartCard } from '@/components/dashboard/chart-card';
import { EmptyChart } from '@/components/dashboard/empty-chart';
import { AnneauChart, BarresHorizontalesChart } from '@/components/dashboard/visites-charts';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
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
import { formatNumber, formatRateOrNone } from '@/lib/format';
import { type Contexte, RefusPermission } from '@/lib/guard';
import { type NamedCount, peut } from '@/lib/types';

type Affichage = 'nombre' | 'taux';

const PERIODES_RAPIDES: readonly { preset: PeriodePreset; label: string }[] = [
  { preset: 'aujourdhui', label: 'Aujourd’hui' },
  { preset: 'cette-semaine', label: 'Cette semaine' },
  { preset: 'ce-mois', label: 'Ce mois-ci' },
];

interface FiltresTableauDeBordRdv {
  type: string;
  du: string;
  au: string;
  preset: PeriodePreset | null;
  affichage: Affichage;
}

const CLE_FILTRES = 'accueil.tableau-de-bord-rdv.filtres';

const FILTRES_PAR_DEFAUT: FiltresTableauDeBordRdv = {
  type: '',
  du: '',
  au: '',
  preset: null,
  affichage: 'nombre',
};

/** Les filtres restent posés d'une rubrique à l'autre : plus besoin de recliquer « Aujourd'hui ». */
function filtresMemorises(): FiltresTableauDeBordRdv {
  try {
    const brut = localStorage.getItem(CLE_FILTRES);
    if (brut === null) return FILTRES_PAR_DEFAUT;
    const valeur = JSON.parse(brut) as Partial<FiltresTableauDeBordRdv>;
    const preset = PERIODES_RAPIDES.some((periode) => periode.preset === valeur.preset)
      ? (valeur.preset as PeriodePreset)
      : null;
    return {
      type: typeof valeur.type === 'string' ? valeur.type : '',
      du: typeof valeur.du === 'string' ? valeur.du : '',
      au: typeof valeur.au === 'string' ? valeur.au : '',
      preset,
      affichage: valeur.affichage === 'taux' ? 'taux' : 'nombre',
    };
  } catch {
    return FILTRES_PAR_DEFAUT;
  }
}

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

function Tuile({
  label,
  valeur,
  total,
  affichage,
}: {
  label: string;
  valeur: number;
  total: number;
  affichage: Affichage;
}) {
  const texte =
    affichage === 'taux'
      ? formatRateOrNone(total === 0 ? null : Math.round((valeur / total) * 1000) / 10)
      : formatNumber(valeur);
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-[0.8125rem] text-muted-foreground">{label}</span>
        <span className="text-2xl font-[700] tabular-nums">{texte}</span>
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

function Synthese({
  synthese,
  type,
  affichage,
}: {
  synthese: SyntheseRendezVous;
  type: string;
  affichage: Affichage;
}) {
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
        <Tuile label="Total" valeur={synthese.total} total={synthese.total} affichage="nombre" />
        {ETAPES.map((etape) => (
          <Tuile
            key={etape.code}
            label={etape.label}
            valeur={synthese.parEtape[etape.code] ?? 0}
            total={synthese.total}
            affichage={affichage}
          />
        ))}
        <Tuile
          label="Reportés"
          valeur={synthese.reportes}
          total={synthese.total}
          affichage={affichage}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Repartition
          titre="Confirmation"
          items={comptes(synthese.parConfirmation, CONFIRMATIONS)}
          anneau
        />
        <Repartition titre="Type de rendez-vous" items={parType} />
        {type === 'RV_SITE' ? <Repartition titre="Site" items={parSite} /> : null}
      </div>
    </div>
  );
}

function Contenu({
  requete,
  type,
  affichage,
}: {
  requete: UseQueryResult<SyntheseRendezVous>;
  type: string;
  affichage: Affichage;
}) {
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
  return <Synthese synthese={requete.data} type={type} affichage={affichage} />;
}

function TableauDeBordRendezVousPage() {
  const [filtres, setFiltresState] = useState<FiltresTableauDeBordRdv>(filtresMemorises);
  const { type, du, au, preset, affichage } = filtres;

  function changer(patch: Partial<FiltresTableauDeBordRdv>): void {
    setFiltresState((precedent) => {
      const suivant = { ...precedent, ...patch };
      try {
        localStorage.setItem(CLE_FILTRES, JSON.stringify(suivant));
      } catch {
        // Sans stockage, les filtres ne survivent pas au changement de rubrique : acceptable.
      }
      return suivant;
    });
  }

  const requete = useQuery({
    queryKey: ['accueil', 'rendez-vous', 'synthese', type, du, au],
    queryFn: () => lireSyntheseRendezVous(type, du, au),
  });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-xl font-[700]">Tableau de bord des rendez-vous</h1>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <Button
            type="button"
            variant={affichage === 'nombre' ? 'default' : 'ghost'}
            size="sm"
            aria-pressed={affichage === 'nombre'}
            onClick={() => {
              changer({ affichage: 'nombre' });
            }}
          >
            Nombre
          </Button>
          <Button
            type="button"
            variant={affichage === 'taux' ? 'default' : 'ghost'}
            size="sm"
            aria-pressed={affichage === 'taux'}
            onClick={() => {
              changer({ affichage: 'taux' });
            }}
          >
            Taux
          </Button>
        </div>
        <Select
          items={TYPES}
          value={type === '' ? 'tous' : type}
          onValueChange={(valeur) => {
            changer({ type: valeur === 'tous' || valeur === null ? '' : valeur });
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
        {PERIODES_RAPIDES.map((periode) => (
          <Button
            key={periode.preset}
            type="button"
            variant={preset === periode.preset ? 'default' : 'outline'}
            size="sm"
            aria-pressed={preset === periode.preset}
            onClick={() => {
              const plage = plageDuPreset(periode.preset, new Date());
              changer({ preset: periode.preset, du: plage.du, au: plage.au });
            }}
          >
            {periode.label}
          </Button>
        ))}
        <Input
          type="date"
          value={du}
          aria-label="Du"
          className="w-40"
          onChange={(event) => {
            changer({ du: event.target.value, preset: null });
          }}
        />
        <Input
          type="date"
          value={au}
          aria-label="Au"
          className="w-40"
          onChange={(event) => {
            changer({ au: event.target.value, preset: null });
          }}
        />
      </div>
      <Contenu requete={requete} type={type} affichage={affichage} />
    </div>
  );
}
