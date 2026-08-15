'use client';

import { CalendarRangeIcon } from 'lucide-react';
import { useId } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MAX_SPREAD_DAYS, MIN_SPREAD_DAYS } from '@/lib/data/phase2';
import { formatNumber } from '@/lib/format';

/**
 * « Étaler sur N jours », partagé par les deux dialogues de création.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le paramètre existe pour un chiffre précis : 120 000 fiches.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sans étalement, une campagne sur toute la base produit UN programme par
 * téléconseiller, de plusieurs centaines de pages, qu'aucun d'entre eux ne peut
 * ni imprimer ni tenir. Découpé en sept journées, le même tirage donne sept
 * liasses tenables, et la charge du jour devient une décision prise avant le
 * tirage plutôt qu'un constat après impression.
 *
 * Une liste déroulante et non un champ numérique : les bornes (1 à 31) sont
 * celles de la contrainte CHECK en base, et une saisie libre laisserait taper
 * « 60 » pour se faire refuser après coup, à l'étape de confirmation.
 */

const DAY_OPTIONS: readonly number[] = Array.from(
  { length: MAX_SPREAD_DAYS - MIN_SPREAD_DAYS + 1 },
  (_, index) => MIN_SPREAD_DAYS + index,
);

export function SpreadDaysField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const fieldId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId} className="flex items-center gap-2">
        <CalendarRangeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        Étaler sur
      </Label>
      <Select
        value={String(value)}
        onValueChange={(next) => {
          const parsed = Number.parseInt(next, 10);
          onChange(Number.isFinite(parsed) ? parsed : MIN_SPREAD_DAYS);
        }}
      >
        <SelectTrigger id={fieldId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {DAY_OPTIONS.map((days) => (
            <SelectItem key={days} value={String(days)}>
              {days === 1 ? 'Une seule journée' : `${formatNumber(days)} journées`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[0.75rem] text-muted-foreground">
        {value === 1
          ? 'Un programme unique par téléconseiller.'
          : `Un programme par jour et par téléconseiller, soit ${formatNumber(value)} liasses chacun.`}
      </p>
    </div>
  );
}

/**
 * La charge journalière, chiffrée.
 *
 * C'est le seul chiffre qui répond à la question posée : « est-ce tenable ? ».
 * Le total de la campagne ne s'y substitue pas, et une moyenne non plus : la
 * répartition met le reliquat sur les PREMIÈRES journées, donc le jour 1 est
 * toujours le plus chargé. L'annoncer évite de découvrir l'écart sur le papier.
 */
export function SpreadPreview({
  spreadDays,
  perDay,
  unit = 'appels',
}: {
  spreadDays: number;
  perDay: readonly number[];
  unit?: string;
}) {
  if (spreadDays <= 1 || perDay.length === 0) return null;

  const heaviest = Math.max(...perDay);

  return (
    <div>
      <h3 className="flex items-center gap-2 pb-2 text-[0.8125rem] font-[600]">
        <CalendarRangeIcon className="size-4" aria-hidden="true" />
        Charge par journée, pour un téléconseiller
      </h3>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {perDay.map((count, index) => (
          <li
            key={index}
            className="flex items-center justify-between gap-3 rounded-sm bg-muted px-3 py-1.5 text-[0.8125rem]"
          >
            <span className="text-muted-foreground">Jour {index + 1}</span>
            <span className="font-[600] tabular-nums">
              {formatNumber(count)} {unit}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.75rem] text-muted-foreground">
        Journée la plus chargée : {formatNumber(heaviest)} {unit}.
      </p>
    </div>
  );
}
