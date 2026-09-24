'use client';

import type { components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getApiClient } from '@/lib/api/browser';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { ProspectRow } from '@/lib/types';
import { cn } from '@/lib/utils';

type RendezVous = components['schemas']['RendezVousObtenu'];

const JOUR_MS = 24 * 60 * 60 * 1000;
const MOIS_COURT = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const JOUR_COURT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const TON = {
  avenir: 'border-l-primary bg-card',
  proche: 'border-l-primary bg-info-surface',
  anoter: 'border-l-warning bg-warning-surface',
  honore: 'border-l-success bg-success-surface',
  manque: 'border-l-destructive bg-destructive-surface',
  reporte: 'border-l-border bg-card',
} as const;

async function lireRendezVous(id: string): Promise<RendezVous | null> {
  const body = unwrap(
    await getApiClient().GET('/api/v1/prospects/{id}/rendez-vous', { params: { path: { id } } }),
  );
  return body.rendezVous ?? null;
}

/** Écart en jours calendaires, à l'heure de Dakar (UTC). */
const joursEntre = (de: number, a: number): number =>
  Math.round((Math.floor(a / JOUR_MS) * JOUR_MS - Math.floor(de / JOUR_MS) * JOUR_MS) / JOUR_MS);

function repere(quand: Date, now: number, prospect: ProspectRow) {
  const heure = quand.toISOString().slice(11, 16);
  if (prospect.rendezVousIssue === 'HONORE') return { ton: TON.honore, texte: 'Venu' };
  if (prospect.rendezVousIssue === 'NON_HONORE') return { ton: TON.manque, texte: 'Pas venu' };
  if (prospect.rendezVousIssue === 'REPORTE') {
    const au = prospect.rendezVousReporteAt;
    return {
      ton: TON.reporte,
      texte: au === null ? 'Reporté' : `Reporté au ${formatDateTime(au)}`,
    };
  }
  const ecart = joursEntre(now, quand.getTime());
  if (ecart < 0) {
    const passe = ecart === -1 ? 'Hier' : `Il y a ${String(-ecart)} jours`;
    return { ton: TON.anoter, texte: `${passe} · venue à noter` };
  }
  if (ecart === 0) return { ton: TON.proche, texte: `Aujourd’hui à ${heure}` };
  if (ecart === 1) return { ton: TON.proche, texte: `Demain à ${heure}` };
  return { ton: TON.avenir, texte: `Dans ${String(ecart)} jours` };
}

const titreDe = (rdv: RendezVous): string =>
  rdv.typeCode === 'RV_SITE' ? 'Rendez-vous sur site' : rdv.type;

/**
 * Le rendez-vous en cours, en tête de fiche : quand, où, et combien de temps
 * avant. `compacte` le ramène à une ligne dans l'écran d'appel.
 */
export function CarteRendezVous({
  prospect,
  compacte = false,
}: {
  prospect: ProspectRow;
  compacte?: boolean;
}) {
  const [now] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ['prospects', prospect.id, 'rendez-vous'],
    queryFn: () => lireRendezVous(prospect.id),
    enabled: prospect.phase2Status === 'APPOINTMENT',
  });
  const rdv = query.data;
  if (rdv == null || rdv.quand === null) return null;

  const quand = new Date(rdv.quand);
  const { ton, texte } = repere(quand, now, prospect);
  const heure = quand.toISOString().slice(11, 16);
  const lieu = [rdv.site, rdv.pointRencontre].filter((part) => part !== '').join(' · ');

  if (compacte) {
    return (
      <div
        role="status"
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-l-4 px-3 py-2',
          ton,
        )}
      >
        <span className="font-[700] tabular-nums first-letter:uppercase">
          {DATE_LONGUE.format(quand)} · {heure}
        </span>
        <span>{titreDe(rdv)}</span>
        {lieu === '' ? null : <span className="text-muted-foreground">{lieu}</span>}
        <span className="ml-auto font-[600]">{texte}</span>
      </div>
    );
  }

  return (
    <section
      aria-label="Rendez-vous"
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-l-4 p-4 sm:flex-row sm:items-start',
        ton,
      )}
    >
      <div className="flex w-20 shrink-0 flex-col items-center rounded-md border border-border bg-background py-2">
        <span className="text-[0.75rem] font-[700] uppercase text-primary">
          {MOIS_COURT.format(quand).replace('.', '')}
        </span>
        <span className="font-display text-[2rem] leading-none font-[700] tabular-nums">
          {quand.getUTCDate()}
        </span>
        <span className="text-[0.75rem] text-muted-foreground">{JOUR_COURT.format(quand)}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-display text-[1.0625rem] font-[700]">{titreDe(rdv)}</p>
            <p className="first-letter:uppercase">
              {DATE_LONGUE.format(quand)} à {heure}
            </p>
          </div>
          <span className="rounded-full border border-border bg-background px-3 py-1 font-[700]">
            {texte}
          </span>
        </div>
        {rdv.site === '' ? null : (
          <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-[0.9375rem]">
            <dt className="text-muted-foreground">Site</dt>
            <dd className="font-[600]">
              {rdv.site} · {formatNumber(rdv.sitePrix)} FCFA
            </dd>
            <dt className="text-muted-foreground">Rencontre</dt>
            <dd className="font-[600]">
              {rdv.pointRencontre}
              {rdv.pointRencontreCommentaire === '' ? null : (
                <span className="font-[400] text-muted-foreground">
                  {' '}
                  · {rdv.pointRencontreCommentaire}
                </span>
              )}
            </dd>
          </dl>
        )}
        {rdv.prisLe === null ? null : (
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            Pris par {rdv.prisPar === '' ? 'un téléconseiller' : rdv.prisPar} le{' '}
            {formatDateTime(rdv.prisLe)}
          </p>
        )}
      </div>
    </section>
  );
}
