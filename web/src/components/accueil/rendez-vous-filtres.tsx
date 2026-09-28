'use client';

import { DownloadIcon } from 'lucide-react';
import { useId } from 'react';

import { DatePicker } from '@/components/filters/date-picker';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type EtapeRendezVous,
  type FiltresRendezVous,
  lienExportRendezVous,
} from '@/lib/data/rendez-vous';
import { dakarNow } from '@/lib/data/visites';

export const ETAPES: readonly { value: EtapeRendezVous; label: string; vide: string }[] = [
  {
    value: 'A_CONFIRMER',
    label: 'À confirmer',
    vide: 'Rien à confirmer. Les rendez-vous pris au téléphone arrivent ici.',
  },
  {
    value: 'CONFIRMES',
    label: 'Confirmés',
    vide: 'Aucun rendez-vous confirmé à venir. Confirmez ceux de l’onglet « À confirmer ».',
  },
  {
    value: 'A_CLOSER',
    label: 'À closer',
    vide: 'Aucun closing en attente. Il s’ouvre quand un prospect est noté présent.',
  },
  { value: 'EN_RETARD', label: 'En retard', vide: 'Aucun rendez-vous passé sans suite.' },
  {
    value: 'HISTORIQUE',
    label: 'Historique',
    vide: 'Les rendez-vous annulés, absents ou closés apparaîtront ici.',
  },
];

const TYPES: readonly { value: string; label: string }[] = [
  { value: 'tous', label: 'Tous les types' },
  { value: 'RV_CPI', label: 'RV CPI' },
  { value: 'RV_SITE', label: 'RV site' },
  { value: 'RV_EXTERNE', label: 'RV externe' },
];

type Changer = (patch: Partial<FiltresRendezVous>) => void;

export function EtapesRendezVous({
  etape,
  parEtape,
  changer,
}: {
  etape: EtapeRendezVous;
  parEtape: Record<string, number> | undefined;
  changer: Changer;
}) {
  return (
    <Tabs
      value={etape}
      onValueChange={(valeur) => {
        changer({ etape: valeur as EtapeRendezVous });
      }}
    >
      <TabsList className="max-w-full justify-start overflow-x-auto">
        {ETAPES.map((choix) => (
          <TabsTrigger key={choix.value} value={choix.value} className="gap-2">
            {choix.label}
            <span className="rounded-full bg-muted px-1.5 text-[0.75rem] tabular-nums">
              {parEtape?.[choix.value] ?? 0}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function Periode({ du, au, changer }: { du: string; au: string; changer: Changer }) {
  const duId = useId();
  const auId = useId();
  const today = dakarNow().date;
  const aujourdhui = du === today && au === today;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Button
        size="sm"
        variant={aujourdhui ? 'default' : 'outline'}
        aria-pressed={aujourdhui}
        onClick={() => {
          changer(aujourdhui ? { du: '', au: '' } : { du: today, au: today });
        }}
      >
        Aujourd’hui
      </Button>
      <DatePicker
        id={duId}
        label="Du"
        value={du || null}
        max={au || null}
        onChange={(valeur) => {
          changer({ du: valeur ?? '' });
        }}
      />
      <DatePicker
        id={auId}
        label="Au"
        value={au || null}
        min={du || null}
        onChange={(valeur) => {
          changer({ au: valeur ?? '' });
        }}
      />
    </div>
  );
}

export function BarreRendezVous({
  filtres,
  changer,
  peutExporter,
}: {
  filtres: FiltresRendezVous;
  changer: Changer;
  peutExporter: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <Input
        type="search"
        value={filtres.search}
        placeholder="Nom ou numéro"
        aria-label="Rechercher un rendez-vous"
        className="max-w-xs"
        onChange={(event) => {
          changer({ search: event.target.value });
        }}
      />
      <Select
        items={TYPES}
        value={filtres.type === '' ? 'tous' : filtres.type}
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
      <Periode du={filtres.du} au={filtres.au} changer={changer} />
      {peutExporter ? (
        <a
          href={lienExportRendezVous(filtres)}
          className={buttonVariants({
            variant: 'outline',
            size: 'sm',
            className: 'ml-auto gap-1.5',
          })}
        >
          <DownloadIcon className="size-3.5" aria-hidden="true" />
          Exporter
        </a>
      ) : null}
    </div>
  );
}
