'use client';

import type { components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { getApiClient } from '@/lib/api/browser';
import { cn } from '@/lib/utils';

type Reglages = components['schemas']['RvSiteReglages'];
type Creneau = components['schemas']['RvSiteCreneau'];

const JOUR_MS = 24 * 60 * 60 * 1000;
const ENTETES = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const JOUR_LONG = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** Jour ISO (1 lundi, 7 dimanche) d'une date lue en UTC, l'heure de Dakar. */
const jourIso = (date: Date): number => (date.getUTCDay() === 0 ? 7 : date.getUTCDay());
const cleJour = (date: Date): string => date.toISOString().slice(0, 10);

async function fetchCreneauxParJour(du: string, au: string): Promise<Map<string, Creneau[]>> {
  const { creneaux } = unwrap(
    await getApiClient().GET('/api/v1/phase2/rv-site/creneaux', { params: { query: { du, au } } }),
  );
  const parJour = new Map<string, Creneau[]>();
  for (const creneau of creneaux) {
    const quand = new Date(creneau.quand).toISOString();
    const jour = quand.slice(0, 10);
    parJour.set(jour, [...(parJour.get(jour) ?? []), { ...creneau, quand }]);
  }
  return parJour;
}

const libellePlaces = (restantes: number): string => {
  if (restantes === 0) return 'Complet';
  return `${restantes} place${restantes > 1 ? 's' : ''}`;
};

/** Les jours d'un mois, précédés des cases vides qui alignent le 1er sur son jour. */
function grilleDuMois(mois: Date): (Date | null)[] {
  const premier = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth(), 1));
  const total = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + 1, 0)).getUTCDate();
  const vides: null[] = Array.from({ length: jourIso(premier) - 1 }, () => null);
  const jours = Array.from(
    { length: total },
    (_, rang) => new Date(premier.getTime() + rang * JOUR_MS),
  );
  return [...vides, ...jours];
}

export function CalendrierRvSite({
  reglages,
  choisi,
  now,
  onChoisir,
}: {
  reglages: Reglages;
  choisi: string | null;
  now: number;
  onChoisir: (at: string) => void;
}) {
  const aujourdhui = new Date(`${new Date(now).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const limite = aujourdhui.getTime() + reglages.horizonJours * JOUR_MS;
  const [mois, setMois] = useState(
    () => new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), 1)),
  );
  const [jour, setJour] = useState<string | null>(choisi === null ? null : choisi.slice(0, 10));
  const premierJour = cleJour(mois);
  const dernierJour = cleJour(new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + 1, 0)));
  const creneaux = useQuery({
    queryKey: ['phase2', 'rv-site', 'creneaux', premierJour],
    queryFn: () => fetchCreneauxParJour(premierJour, dernierJour),
    refetchOnMount: 'always',
  });
  const libres = (cle: string): boolean =>
    (creneaux.data?.get(cle) ?? []).some((creneau) => creneau.restantes !== 0);

  if (reglages.jours.length === 0) {
    return (
      <p className="text-[0.875rem]">
        Aucun jour n’est ouvert aux RV site. Un administrateur les ouvre dans Listes de référence.
      </p>
    );
  }

  const decaler = (pas: number): void => {
    setMois(new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + pas, 1)));
  };
  const jourChoisi = jour === null ? null : new Date(`${jour}T00:00:00.000Z`);
  const heures = jour === null ? [] : (creneaux.data?.get(jour) ?? []);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="w-full max-w-80 rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mois précédent"
            disabled={mois.getTime() <= aujourdhui.getTime()}
            onClick={() => {
              decaler(-1);
            }}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <p className="font-[600] capitalize">{MOIS.format(mois)}</p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mois suivant"
            disabled={Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + 1, 1) > limite}
            onClick={() => {
              decaler(1);
            }}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[0.75rem] text-muted-foreground">
          {ENTETES.map((entete) => (
            <span key={entete}>{entete}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grilleDuMois(mois).map((date, rang) => {
            if (date === null) return <span key={`vide-${String(rang)}`} />;
            const cle = cleJour(date);
            const ouvert = libres(cle);
            return (
              <button
                key={cle}
                type="button"
                disabled={!ouvert}
                aria-pressed={cle === jour}
                aria-label={JOUR_LONG.format(date)}
                className={cn(
                  'h-9 rounded-md text-[0.875rem] tabular-nums pointer-coarse:h-11',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  ouvert ? 'bg-muted font-[600] hover:bg-muted/60' : 'text-muted-foreground/50',
                  cle === jour && 'bg-primary text-primary-foreground hover:bg-primary',
                )}
                onClick={() => {
                  setJour(cle);
                }}
              >
                {date.getUTCDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {creneaux.isError ? (
          <p role="alert" className="text-[0.875rem] text-destructive">
            Les créneaux n’ont pas pu être lus.{' '}
            <Button variant="link" className="h-auto p-0" onClick={() => void creneaux.refetch()}>
              Réessayer
            </Button>
          </p>
        ) : null}
        {creneaux.isPending ? (
          <p className="text-[0.875rem] text-muted-foreground">Chargement des créneaux…</p>
        ) : null}
        {jourChoisi === null ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Choisissez un jour en surbrillance.
          </p>
        ) : (
          <>
            <p className="font-[600] first-letter:uppercase">{JOUR_LONG.format(jourChoisi)}</p>
            <div className="flex max-w-md flex-wrap gap-2">
              {heures.map(({ quand, restantes }) => (
                <Button
                  key={quand}
                  variant={quand === choisi ? 'default' : 'outline'}
                  aria-pressed={quand === choisi}
                  disabled={restantes === 0}
                  className="h-auto min-h-11 flex-col gap-0 py-1 tabular-nums"
                  onClick={() => {
                    onChoisir(quand);
                  }}
                >
                  {quand.slice(11, 16)}
                  {restantes === null ? null : (
                    <span className="text-[0.75rem] font-[400]">{libellePlaces(restantes)}</span>
                  )}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
