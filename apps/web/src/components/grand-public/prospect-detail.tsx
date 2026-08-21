import { ArrowLeftIcon, PhoneIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Absent } from '@/components/grand-public/absence';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PROSPECT_TYPE_LABELS, formatDureeMois } from '@/lib/data/grand-public';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import {
  CALL_OUTCOME_LABELS,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  type ProspectRow,
  type ProspectStatut,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUT_VARIANT: Record<ProspectStatut, 'secondary' | 'info' | 'success' | 'destructive'> = {
  NOUVEAU: 'secondary',
  CONTACTE: 'info',
  CONVERTI: 'success',
  PERDU: 'destructive',
};

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-[0.8125rem] font-[600] text-muted-foreground sm:w-56 sm:shrink-0">
        {label}
      </dt>
      <dd className="min-w-0 text-[0.9375rem]">{children}</dd>
    </div>
  );
}

function Texte({ value, absent }: { value: string | null; absent: string }) {
  if (value === null || value === '') return <Absent>{absent}</Absent>;
  return <span>{value}</span>;
}

/**
 * Le segment se calcule par croisement syndicat × banque. Nommer ce qui manque
 * dit quoi aller chercher ; « BDD4 » aurait affirmé un croisement qui n'a pas eu lieu.
 */
function raisonSansSegment(prospect: ProspectRow): string {
  if (prospect.banqueId === null && prospect.syndicatId === null) {
    return 'Ni banque ni syndicat : la fiche n’entre dans aucune base.';
  }
  if (prospect.banqueId === null) return 'La banque manque pour le calculer.';
  return 'Le syndicat manque pour le calculer.';
}

export function GrandPublicProspectDetail({ prospect }: { prospect: ProspectRow }) {
  if (prospect.projet !== 'GRAND_PUBLIC') {
    return (
      <Card role="alert" className="animate-rise mx-auto max-w-lg items-center gap-3 px-6 py-16 text-center">
        <h1 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
          Cette fiche relève du projet CHUES
        </h1>
        <p className="max-w-md text-[0.9375rem] text-muted-foreground">
          Les deux projets ne partagent aucun écran. Elle se consulte depuis le suivi CHUES.
        </p>
        <Link href="/chues/prospects" className={cn(buttonVariants({ variant: 'outline' }), 'mt-1')}>
          Ouvrir le suivi CHUES
        </Link>
      </Card>
    );
  }

  const name = `${prospect.prenom} ${prospect.nom}`.trim();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button render={<Link href="/grand-public" />} variant="ghost" className="w-fit -ml-2">
        <ArrowLeftIcon aria-hidden="true" />
        Prospects Grand Public
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">{name}</h1>
          <a
            href={`tel:${prospect.phoneE164}`}
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-sm text-[1.0625rem] tabular-nums underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <PhoneIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {formatPhone(prospect.phoneE164)}
          </a>
        </div>
        <Badge variant={STATUT_VARIANT[prospect.statut]} className="text-[0.8125rem]">
          {PROSPECT_STATUT_LABELS[prospect.statut]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Le prospect</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Ligne label="Situation">
              {prospect.type === null ? (
                <Absent>Question non posée</Absent>
              ) : (
                PROSPECT_TYPE_LABELS[prospect.type]
              )}
            </Ligne>
            <Ligne label="Profession">
              <Texte value={prospect.profession} absent="Non renseignée" />
            </Ligne>
            <Ligne label="Canal de provenance">
              <Texte value={prospect.canalProvenanceLabel} absent="Non renseigné" />
            </Ligne>
            <Ligne label="Durée du système">
              {prospect.dureeSystemeMois === null ? (
                <Absent>Non renseignée</Absent>
              ) : (
                formatDureeMois(prospect.dureeSystemeMois)
              )}
            </Ligne>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rattachements</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Ligne label="Banque de domiciliation">
              <Texte value={prospect.banqueName} absent="Non renseignée" />
            </Ligne>
            <Ligne label="Syndicat">
              <Texte value={prospect.syndicatSigle} absent="Aucun" />
            </Ligne>
            <Ligne label="Représentant">
              <Texte value={prospect.representantName} absent="Sans représentant" />
            </Ligne>
            <Ligne label="Segment">
              {prospect.segment === null ? (
                <span className="flex flex-col gap-0.5">
                  <Absent>Aucun</Absent>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {raisonSansSegment(prospect)}
                  </span>
                </span>
              ) : (
                <Badge variant="outline">{SEGMENT_LABELS[prospect.segment]}</Badge>
              )}
            </Ligne>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suivi</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Ligne label="Téléconseiller">{prospect.ownedByCommercialName}</Ligne>
            <Ligne label="Saisi le">
              <time dateTime={prospect.clientCreatedAt} className="tabular-nums">
                {formatDate(prospect.clientCreatedAt)}
              </time>
            </Ligne>
            <Ligne label="Dernier appel">
              {prospect.lastOutcome === null ? (
                <Absent>Jamais appelé</Absent>
              ) : (
                <span className="flex flex-col gap-0.5">
                  <span className="font-[600]">{CALL_OUTCOME_LABELS[prospect.lastOutcome]}</span>
                  {prospect.lastComment !== null && prospect.lastComment !== '' ? (
                    <span className="text-[0.8125rem] text-muted-foreground">
                      {prospect.lastComment}
                    </span>
                  ) : null}
                  {prospect.lastAttemptAt !== null ? (
                    <time
                      dateTime={prospect.lastAttemptAt}
                      className="text-[0.8125rem] text-muted-foreground tabular-nums"
                    >
                      {formatDateTime(prospect.lastAttemptAt)}
                    </time>
                  ) : null}
                </span>
              )}
            </Ligne>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
