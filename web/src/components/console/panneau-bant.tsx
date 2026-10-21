'use client';

import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiClient } from '@/lib/api/browser';

export type Bant = Omit<components['schemas']['ProspectBant'], 'score'>;

interface Option<T extends string = string> {
  value: T;
  label: string;
}

const PROJETS: Option<NonNullable<Bant['projet']>>[] = [
  { value: 'TERRAIN', label: 'Acheter un terrain' },
  { value: 'BIEN', label: 'Acheter un bien' },
  { value: 'CONSTRUIRE', label: 'Faire construire' },
  { value: 'COLLECTIF', label: 'Projet collectif : coopérative, groupement, association' },
  { value: 'CONSEIL', label: 'Conseil domanial et foncier' },
  { value: 'AUTRE', label: 'Autre' },
];
const DOCUMENTS: Option<NonNullable<Bant['document']>>[] = [
  { value: 'TITRE_FONCIER', label: 'Titre foncier' },
  { value: 'BAIL', label: 'Bail / notification de bail' },
  { value: 'DELIBERATION', label: 'Délibération' },
  { value: 'CONSEIL', label: 'Je souhaite être conseillé(e)' },
  { value: 'AUTRE', label: 'Autre' },
];
const BUDGETS: Option<NonNullable<Bant['budget']>>[] = [
  { value: 'M1_5', label: '1 à 5 M FCFA' },
  { value: 'M5_15', label: '5 à 15 M FCFA' },
  { value: 'M15_30', label: '15 à 30 M FCFA' },
  { value: 'M30_75', label: '30 à 75 M FCFA' },
  { value: 'PLUS_75', label: 'Plus de 75 M FCFA' },
];
const SUIVIS: Option<NonNullable<Bant['suivi']>>[] = [
  { value: 'MOI_MEME', label: 'Moi-même, je réside au Sénégal' },
  { value: 'PROCHE_PROCURATION', label: 'Un proche, avec procuration' },
  { value: 'PROCHE_SANS_PROCURATION', label: 'Un proche, sans procuration pour l’instant' },
  { value: 'MANDATAIRE', label: 'Un mandataire ou notaire' },
  { value: 'DISTANCE', label: 'Personne, je gérerai à distance' },
];

const niveaux = (libelles: readonly string[]): Option[] =>
  libelles.map((label, i) => ({ value: String(5 - i), label: `${5 - i} : ${label}` }));

const CALENDRIER = niveaux([
  'Urgence, décision sous 10 jours',
  'Court terme, sous 1 mois',
  'Moyen terme, 2 à 3 mois',
  'Long terme, 6 à 12 mois',
  'Pas de calendrier défini',
]);
const BESOIN = niveaux([
  'Besoin critique urgent',
  'Besoin fort motivé, projet à 6 à 12 mois',
  'Besoin identifié, pas urgent',
  'Envie sans besoin précis',
  'Curiosité pure, pas de projet',
]);
const AUTORITE = niveaux([
  'Décide seul',
  'En parlera au conjoint mais peut décider',
  'Doit avoir l’accord du conjoint',
  'Doit demander à un tuteur',
  'Pas d’autonomie',
]);
const CAPACITE = niveaux([
  'Au comptant',
  'Acompte 50 % et 24 mois',
  'Acompte 30 à 40 % et 24 mois',
  'Moins de 30 %, revenus incertains',
  'Pas d’argent disponible',
]);

export function bantDe(prospect: { bant: components['schemas']['ProspectBant'] }): Bant {
  const { score: _score, ...bant } = prospect.bant;
  return bant;
}

export function scoreBant(bant: Bant): number | null {
  const { calendrier, besoin, autorite, capacite } = bant;
  if ([calendrier, besoin, autorite, capacite].every((n) => n == null)) return null;
  return (calendrier ?? 0) * 4 + (besoin ?? 0) * 5 + (autorite ?? 0) * 5 + (capacite ?? 0) * 6;
}

export async function enregistrerBant(
  prospectId: string,
  bant: Bant,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.PUT('/api/v1/prospects/{id}/bant', {
      params: { path: { id: prospectId } },
      body: bant,
    }),
  );
}

function ChampBant<T extends string>({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T | null | undefined;
  disabled: boolean;
  onChange: (value: T | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={options}
        value={value ?? ''}
        disabled={disabled}
        onValueChange={(choisie) => {
          onChange(options.find((option) => option.value === choisie)?.value ?? null);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Non renseigné" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const enNiveau = (value: string | null): number | null => (value === null ? null : Number(value));
const enTexte = (value: number | null | undefined): string | null =>
  value == null ? null : String(value);

export function PanneauBant({
  bant,
  disabled,
  onChange,
}: {
  bant: Bant;
  disabled: boolean;
  onChange: (patch: Partial<Bant>) => void;
}) {
  const zones = useQuery({
    queryKey: ['ventes', 'zones'],
    queryFn: async () =>
      unwrap(await getApiClient().GET('/api/v1/ventes/zones')).zones.map((nom) => ({
        value: nom,
        label: nom,
      })),
    staleTime: 300_000,
  });
  const score = scoreBant(bant);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.875rem] text-muted-foreground">
        Score BANT : <span className="font-semibold text-foreground">{score ?? '-'}</span> / 100
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampBant
          label="Projet"
          options={PROJETS}
          value={bant.projet}
          disabled={disabled}
          onChange={(projet) => onChange({ projet })}
        />
        <ChampBant
          label="Zone"
          options={[...(zones.data ?? []), { value: 'AUTRE', label: 'Autre' }]}
          value={bant.zone}
          disabled={disabled}
          onChange={(zone) => onChange({ zone })}
        />
        <ChampBant
          label="Document juridique recherché"
          options={DOCUMENTS}
          value={bant.document}
          disabled={disabled}
          onChange={(document) => onChange({ document })}
        />
        <ChampBant
          label="Budget"
          options={BUDGETS}
          value={bant.budget}
          disabled={disabled}
          onChange={(budget) => onChange({ budget })}
        />
        <ChampBant
          label="Suivi du dossier au Sénégal"
          options={SUIVIS}
          value={bant.suivi}
          disabled={disabled}
          onChange={(suivi) => onChange({ suivi })}
        />
        <ChampBant
          label="Calendrier (T, 20 points)"
          options={CALENDRIER}
          value={enTexte(bant.calendrier)}
          disabled={disabled}
          onChange={(v) => onChange({ calendrier: enNiveau(v) })}
        />
        <ChampBant
          label="Besoin (N, 25 points)"
          options={BESOIN}
          value={enTexte(bant.besoin)}
          disabled={disabled}
          onChange={(v) => onChange({ besoin: enNiveau(v) })}
        />
        <ChampBant
          label="Autorité (A, 25 points)"
          options={AUTORITE}
          value={enTexte(bant.autorite)}
          disabled={disabled}
          onChange={(v) => onChange({ autorite: enNiveau(v) })}
        />
        <ChampBant
          label="Budget disponible (B, 30 points)"
          options={CAPACITE}
          value={enTexte(bant.capacite)}
          disabled={disabled}
          onChange={(v) => onChange({ capacite: enNiveau(v) })}
        />
      </div>
    </div>
  );
}
