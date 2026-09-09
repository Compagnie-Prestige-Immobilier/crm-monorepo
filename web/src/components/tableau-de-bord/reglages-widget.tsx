import { SlidersHorizontalIcon } from 'lucide-react';

import type { Presentation, ReglagesHonores } from '@/components/tableau-de-bord/sources';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProprietesReglage {
  widgetId: string;
  presentation: Presentation;
  onChange: (presentation: Presentation) => void;
}

const PALETTES = [
  ['serie', 'Série CPI'],
  ['neutre', 'Monochrome bordeaux'],
  ['categorielle', 'Accent or'],
] as const;

const TRIS = [
  ['valeur-desc', 'Valeur décroissante'],
  ['valeur-asc', 'Valeur croissante'],
  ['alphabetique', 'Alphabétique'],
] as const;

function ChampPalette({ widgetId, presentation, onChange }: ProprietesReglage) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`palette-${widgetId}`}>Palette</Label>
      <Select
        value={presentation.palette ?? 'serie'}
        onValueChange={(valeur) => {
          if (valeur === null) return;
          onChange({ ...presentation, palette: valeur as NonNullable<Presentation['palette']> });
        }}
      >
        <SelectTrigger id={`palette-${widgetId}`} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PALETTES.map(([valeur, libelle]) => (
            <SelectItem key={valeur} value={valeur}>
              {libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ChampTri({ widgetId, presentation, onChange }: ProprietesReglage) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`tri-${widgetId}`}>Tri du classement</Label>
      <Select
        value={presentation.tri ?? 'valeur-desc'}
        onValueChange={(valeur) => {
          if (valeur === null) return;
          onChange({ ...presentation, tri: valeur as NonNullable<Presentation['tri']> });
        }}
      >
        <SelectTrigger id={`tri-${widgetId}`} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TRIS.map(([valeur, libelle]) => (
            <SelectItem key={valeur} value={valeur}>
              {libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ChampAutresApres({ widgetId, presentation, onChange }: ProprietesReglage) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`autres-${widgetId}`}>Regrouper au-delà de</Label>
      <Input
        id={`autres-${widgetId}`}
        type="number"
        min={3}
        max={15}
        value={presentation.autresApres ?? 5}
        onChange={(evenement) => {
          const valeur = Number(evenement.target.value);
          if (Number.isNaN(valeur)) return;
          onChange({ ...presentation, autresApres: Math.min(15, Math.max(3, valeur)) });
        }}
      />
    </div>
  );
}

function Bascule({
  actif,
  actifLabel,
  inactifLabel,
  onBasculer,
}: {
  actif: boolean;
  actifLabel: string;
  inactifLabel: string;
  onBasculer: () => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" aria-pressed={actif} onClick={onBasculer}>
      {actif ? actifLabel : inactifLabel}
    </Button>
  );
}

export function reglagesVisibles(honores: ReglagesHonores, triPertinent: boolean): boolean {
  return honores.palette || honores.valeurs || honores.legende || triPertinent;
}

export function ReglagesPopover({
  titre,
  widgetId,
  honores,
  triPertinent,
  presentation,
  onChange,
}: {
  titre: string;
  widgetId: string;
  honores: ReglagesHonores;
  triPertinent: boolean;
  presentation: Presentation;
  onChange: (presentation: Presentation) => void;
}) {
  const commun = { widgetId, presentation, onChange };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Réglages de ${titre}`}
          />
        }
      >
        <SlidersHorizontalIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-3 p-3" align="end">
        {honores.palette ? <ChampPalette {...commun} /> : null}
        {honores.valeurs ? (
          <Bascule
            actif={presentation.valeurs === true}
            actifLabel="Valeurs affichées"
            inactifLabel="Afficher les valeurs"
            onBasculer={() => {
              onChange({ ...presentation, valeurs: presentation.valeurs !== true });
            }}
          />
        ) : null}
        {honores.legende ? (
          <Bascule
            actif={presentation.legende === true}
            actifLabel="Légende affichée"
            inactifLabel="Afficher la légende"
            onBasculer={() => {
              onChange({ ...presentation, legende: presentation.legende !== true });
            }}
          />
        ) : null}
        {triPertinent ? <ChampTri {...commun} /> : null}
        {triPertinent ? <ChampAutresApres {...commun} /> : null}
      </PopoverContent>
    </Popover>
  );
}
