import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { TYPES } from '@/components/accueil/rendez-vous-filtres';
import { DetailSynthese } from '@/components/accueil/rendez-vous-synthese-detail';
import { ChartCard } from '@/components/dashboard/chart-card';
import { EmptyChart } from '@/components/dashboard/empty-chart';
import {
  AnneauChart,
  BarresHorizontalesChart,
  TuileWidget,
} from '@/components/dashboard/visites-charts';
import { QueryErrorState } from '@/components/query-error-state';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type EtapeRendezVous,
  type FiltresSynthese,
  lireSyntheseRendezVous,
  type SyntheseRendezVous,
} from '@/lib/data/rendez-vous';
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

interface Carte {
  label: string;
  description: string;
  etape: EtapeRendezVous;
  reporte?: boolean;
}

const CARTES: readonly Carte[] = [
  { label: 'Total', description: 'Tous les rendez-vous de la période.', etape: '' },
  {
    label: 'À confirmer',
    description: 'Rendez-vous à venir que personne n’a encore confirmés.',
    etape: 'A_CONFIRMER',
  },
  {
    label: 'À recontacter',
    description: 'La personne demande à être rappelée avant de fixer la date.',
    etape: 'A_RECONTACTER',
  },
  { label: 'Confirmés', description: 'Rendez-vous à venir confirmés.', etape: 'CONFIRMES' },
  {
    label: 'En retard',
    description: 'Date passée, sans présence, absence ni annulation enregistrée.',
    etape: 'EN_RETARD',
  },
  {
    label: 'Présents, closing à compléter',
    description: 'La personne est venue ; le closing n’est pas encore qualifié.',
    etape: 'A_CLOSER',
  },
  {
    label: 'Historique',
    description: 'Rendez-vous clos : closing qualifié, absence ou annulation.',
    etape: 'HISTORIQUE',
  },
  {
    label: 'Reportés',
    description: 'Rendez-vous dont la date a été déplacée au moins une fois.',
    etape: '',
    reporte: true,
  },
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

function valeurDe(carte: Carte, synthese: SyntheseRendezVous): number {
  if (carte.reporte === true) return synthese.reportes;
  if (carte.etape === '') return synthese.total;
  return synthese.parEtape[carte.etape] ?? 0;
}

function Tuile({
  carte,
  valeur,
  onOuvrir,
}: {
  carte: Carte;
  valeur: number;
  onOuvrir: () => void;
}) {
  return (
    <ChartCard
      title={carte.label}
      info={carte.description}
      hauteur="compacte"
      className="transition-colors hover:border-primary/40"
    >
      <button
        type="button"
        aria-label={`Voir les rendez-vous : ${carte.label}`}
        className="h-full w-full cursor-pointer rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={onOuvrir}
      >
        <TuileWidget valeur={valeur} libelle={carte.label} />
      </button>
    </ChartCard>
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
  onOuvrir,
}: {
  synthese: SyntheseRendezVous;
  onOuvrir: (carte: Carte) => void;
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARTES.map((carte) => (
          <Tuile
            key={carte.label}
            carte={carte}
            valeur={valeurDe(carte, synthese)}
            onOuvrir={() => {
              onOuvrir(carte);
            }}
          />
        ))}
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

function Contenu({
  requete,
  onOuvrir,
}: {
  requete: UseQueryResult<SyntheseRendezVous>;
  onOuvrir: (carte: Carte) => void;
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
  return <Synthese synthese={requete.data} onOuvrir={onOuvrir} />;
}

function TableauDeBordRendezVousPage() {
  const [type, setType] = useState('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [ouverte, setOuverte] = useState<Carte | null>(null);
  const filtresDetail: FiltresSynthese | null =
    ouverte === null
      ? null
      : { etape: ouverte.etape, reporte: ouverte.reporte === true, type, du, au };
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
      <Contenu requete={requete} onOuvrir={setOuverte} />
      <DetailSynthese
        titre={ouverte?.label ?? ''}
        filtres={filtresDetail}
        onClose={() => {
          setOuverte(null);
        }}
      />
    </div>
  );
}
