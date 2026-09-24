'use client';

import type { components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiClient } from '@/lib/api/browser';
import { toastApiError } from '@/lib/mutation-feedback';

type Reglages = components['schemas']['RvSiteReglages'];

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const HEURES = Array.from({ length: 24 }, (_, heure) => heure);
const CLASSE_SELECT = 'h-11 rounded-md border border-input bg-background px-3 text-[0.875rem]';
const CLE = ['rv-site', 'reglages'] as const;

async function lireReglages(): Promise<Reglages> {
  return unwrap(await getApiClient().GET('/api/v1/rv-site/reglages'));
}

async function ecrireReglages(body: Reglages): Promise<Reglages> {
  return unwrap(await getApiClient().PUT('/api/v1/rv-site/reglages', { body }));
}

const libelleHeure = (heure: number): string => `${String(heure).padStart(2, '0')}:00`;

/** Quand un RV site peut se prendre : jours, heures ouvrables, horizon et visites par heure. */
export function ReglagesRvSiteTab() {
  const query = useQuery({ queryKey: CLE, queryFn: lireReglages });
  if (query.isError) {
    return <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.data === undefined) return null;
  return <FormulaireRvSite initial={query.data} />;
}

function FormulaireRvSite({ initial }: { initial: Reglages }) {
  const queryClient = useQueryClient();
  const [jours, setJours] = useState<number[]>(initial.jours);
  const [debut, setDebut] = useState(initial.heureDebut);
  const [fin, setFin] = useState(initial.heureFin);
  const [horizon, setHorizon] = useState(String(initial.horizonJours));
  const [max, setMax] = useState(
    initial.maxVisites === undefined ? '' : String(initial.maxVisites),
  );

  const save = useMutation({
    mutationFn: ecrireReglages,
    onSuccess: (reglages) => {
      queryClient.setQueryData(CLE, reglages);
      void queryClient.invalidateQueries({ queryKey: ['phase2', 'rv-site'] });
      toast.success('Réglages RV site enregistrés.');
    },
    onError: (error) => {
      toastApiError(error, 'Enregistrement impossible.');
    },
  });

  const basculer = (jour: number): void => {
    setJours((avant) =>
      avant.includes(jour)
        ? avant.filter((j) => j !== jour)
        : [...avant, jour].sort((a, b) => a - b),
    );
  };
  const horizonValide = Number(horizon) >= 1 && Number(horizon) <= 365;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 font-[600]">Jours ouverts</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {JOURS.map((nom, rang) => (
            <label key={nom} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={jours.includes(rang + 1)}
                onChange={() => {
                  basculer(rang + 1);
                }}
              />
              {nom}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="rv-site-debut">Première heure</Label>
          <select
            id="rv-site-debut"
            className={CLASSE_SELECT}
            value={debut}
            onChange={(event) => {
              setDebut(Number(event.target.value));
            }}
          >
            {HEURES.map((heure) => (
              <option key={heure} value={heure}>
                {libelleHeure(heure)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rv-site-fin">Dernière heure</Label>
          <select
            id="rv-site-fin"
            className={CLASSE_SELECT}
            value={fin}
            onChange={(event) => {
              setFin(Number(event.target.value));
            }}
          >
            {HEURES.map((heure) => (
              <option key={heure} value={heure}>
                {libelleHeure(heure)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rv-site-horizon">Horizon (jours)</Label>
          <Input
            id="rv-site-horizon"
            type="number"
            min="1"
            max="365"
            className="w-32"
            value={horizon}
            onChange={(event) => {
              setHorizon(event.target.value);
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rv-site-max">Visites par heure</Label>
          <Input
            id="rv-site-max"
            type="number"
            min="1"
            placeholder="Sans limite"
            className="w-32"
            value={max}
            onChange={(event) => {
              setMax(event.target.value);
            }}
          />
        </div>
      </div>

      {debut > fin ? (
        <p role="alert" className="text-[0.875rem] text-destructive">
          La première heure doit précéder la dernière.
        </p>
      ) : null}

      <div>
        <Button
          disabled={debut > fin || !horizonValide || save.isPending}
          onClick={() => {
            save.mutate({
              jours,
              heureDebut: debut,
              heureFin: fin,
              horizonJours: Number(horizon),
              ...(max === '' ? {} : { maxVisites: Number(max) }),
            });
          }}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
