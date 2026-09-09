import { Link } from '@tanstack/react-router';
import { PencilIcon } from 'lucide-react';

import { PastilleRelation } from '@/components/representants/pastille-relation';
import { Button } from '@/components/ui/button';
import type { Representant } from '@/lib/data/representants';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';
import { lien } from '@/lib/nav';

const SANS_VALEUR = '–';

function Attribut({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] text-muted-foreground">{label}</dt>
      <dd className="truncate text-muted-foreground">{valeur}</dd>
    </div>
  );
}

/** Sous 1024 px, une fiche par carte : un tableau de neuf colonnes n'y tient pas. */
export function CarteRepresentant({
  representant,
  href,
  onModifier,
}: {
  representant: Representant;
  href: string;
  onModifier: (() => void) | null;
}) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-[600]">
            <Link {...lien(href)} className="hover:underline focus-visible:underline">
              {representant.fullName}
            </Link>
          </p>
          <p className="truncate text-[0.8125rem] text-muted-foreground tabular-nums">
            {formatPhone(representant.phoneE164)}
          </p>
          <div className="mt-1.5">
            <PastilleRelation
              status={representant.relationStatus}
              label={representant.statutQualificationLabel}
              effect={representant.statutQualificationEffect}
              lastCallOutcome={representant.lastCallOutcome}
            />
          </div>
        </div>
        {/* Le compte de prospects dit si une fiche compte : il garde son poids. */}
        <p className="shrink-0 text-right">
          <span className="block font-display text-[1.25rem] font-[800] leading-none tabular-nums">
            {formatNumber(representant.prospectCount)}
          </span>
          <span className="block text-[0.6875rem] text-muted-foreground">
            prospect{representant.prospectCount === 1 ? '' : 's'}
          </span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8125rem]">
        <Attribut label="Département" valeur={representant.departementName} />
        <Attribut label="IEF" valeur={representant.iefName ?? SANS_VALEUR} />
        <Attribut label="Saisi par" valeur={representant.createdByName} />
        <Attribut label="Première saisie" valeur={formatDate(representant.clientCreatedAt)} />
      </dl>

      {onModifier === null ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          aria-label={`Modifier la fiche de ${representant.fullName}`}
          onClick={onModifier}
        >
          <PencilIcon className="size-4" aria-hidden="true" />
          <span aria-hidden="true">Modifier</span>
        </Button>
      )}
    </article>
  );
}
