'use client';

import type { components } from '@crm/api-client';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Reglages = components['schemas']['RvSiteReglages'];
type Reservation = components['schemas']['QualificationRvSiteReservation'];

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
const deuxChiffres = (n: number): string => String(n).padStart(2, '0');

/** Les heures pleines encore libres d'un jour ouvert : ni passées, ni complètes. */
function heuresDuJour(
  jour: Date,
  reglages: Reglages,
  reserves: ReadonlyMap<string, number>,
  now: number,
): string[] {
  if (!reglages.jours.includes(jourIso(jour))) return [];
  const heures = Array.from(
    { length: reglages.heureFin - reglages.heureDebut + 1 },
    (_, rang) =>
      new Date(`${cleJour(jour)}T${deuxChiffres(reglages.heureDebut + rang)}:00:00.000Z`),
  );
  const max = reglages.maxVisites;
  return heures
    .filter((at) => at.getTime() > now)
    .filter((at) => max === undefined || (reserves.get(at.toISOString()) ?? 0) < max)
    .map((at) => at.toISOString());
}

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
  reservations,
  choisi,
  now,
  onChoisir,
}: {
  reglages: Reglages;
  reservations: readonly Reservation[];
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
  const reserves = new Map(reservations.map((r) => [new Date(r.quand).toISOString(), r.nombre]));

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
  const heures = jourChoisi === null ? [] : heuresDuJour(jourChoisi, reglages, reserves, now);

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
            const dansHorizon = date.getTime() >= aujourdhui.getTime() && date.getTime() <= limite;
            const ouvert = dansHorizon && heuresDuJour(date, reglages, reserves, now).length > 0;
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
        {jourChoisi === null ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Choisissez un jour en surbrillance.
          </p>
        ) : (
          <>
            <p className="font-[600] first-letter:uppercase">{JOUR_LONG.format(jourChoisi)}</p>
            <div className="flex max-w-md flex-wrap gap-2">
              {heures.map((at) => (
                <Button
                  key={at}
                  variant={at === choisi ? 'default' : 'outline'}
                  aria-pressed={at === choisi}
                  className="tabular-nums"
                  onClick={() => {
                    onChoisir(at);
                  }}
                >
                  {at.slice(11, 16)}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
