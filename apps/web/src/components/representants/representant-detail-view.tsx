'use client';

import { useQuery } from '@tanstack/react-query';

import { DetailBackLink } from '@/components/detail-back-link';
import { QueryErrorState } from '@/components/query-error-state';
import { RelationBadge } from '@/components/representants/relation-badge';
import { RepresentantComments } from '@/components/representants/representant-comments';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EMPTY_FILTERS } from '@/lib/filters';
import { formatDate, formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { fetchProspects } from '@/lib/data/prospects';
import {
  fetchRepresentant,
  fetchRepresentantRelationHistory,
  scriptOf,
  whatsappLabel,
  type RepresentantRelationChange,
} from '@/lib/data/representants';
import { queryKeys } from '@/lib/query-keys';
import { REPRESENTANT_RELATION_LABELS } from '@/lib/representant-filters';
import { PROSPECT_STATUT_LABELS } from '@/lib/types';

const NO_VALUE = '–';

const SOURCE_LABELS = { WEB: 'Panneau', MOBILE: 'Mobile' } as const;

function ouiNonNsp(value: boolean | null): string {
  if (value === null) return NO_VALUE;
  return value ? 'Oui' : 'Non';
}

export function RepresentantDetailView({
  representantId,
  author,
  canAdminister = false,
  readOnly = false,
}: {
  representantId: string;
  author: { id: string; fullName: string };
  canAdminister?: boolean;
  readOnly?: boolean;
}) {
  const fiche = useQuery({
    queryKey: queryKeys.representant(representantId),
    queryFn: () => fetchRepresentant(representantId),
  });

  const history = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'relation-history'],
    queryFn: () => fetchRepresentantRelationHistory(representantId),
  });

  const prospectFilters = { ...EMPTY_FILTERS, representantId };
  const prospects = useQuery({
    queryKey: queryKeys.prospects(prospectFilters),
    queryFn: () => fetchProspects(prospectFilters),
  });

  if (fiche.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/chues/representants">Tous les représentants</DetailBackLink>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (fiche.isError) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/chues/representants">Tous les représentants</DetailBackLink>
        <QueryErrorState
          error={fiche.error}
          onRetry={() => {
            void fiche.refetch();
          }}
          fallback="Cette fiche n’a pas pu être chargée."
        />
      </div>
    );
  }

  const representant = fiche.data;
  const script = scriptOf(representant);

  return (
    <div className="flex flex-col gap-6">
      <DetailBackLink href="/chues/representants">Tous les représentants</DetailBackLink>

      <Card className="animate-rise">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-[1.25rem]">
                {representant.fullName}
                {representant.prenom === null || representant.prenom === '' ? null : (
                  <span className="ml-2 text-[0.875rem] font-[400] text-muted-foreground">
                    {representant.prenom}
                  </span>
                )}
              </CardTitle>
              <p className="truncate text-[0.8125rem] text-muted-foreground tabular-nums">
                {formatPhone(representant.phoneE164)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <RelationBadge status={representant.relationStatus} />
              <p className="text-right">
                <span className="block font-display text-[1.5rem] font-[800] leading-none tabular-nums">
                  {formatNumber(representant.prospectCount)}
                </span>
                <span className="block text-[0.6875rem] text-muted-foreground">
                  prospect{representant.prospectCount === 1 ? '' : 's'}
                </span>
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-[0.8125rem] sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Département</dt>
              <dd className="truncate font-[600]">{representant.departementName}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">IEF</dt>
              <dd className="truncate font-[600]">{representant.iefName ?? NO_VALUE}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Saisi par</dt>
              <dd className="truncate font-[600]">{representant.createdByName}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Première saisie</dt>
              <dd className="font-[600]">
                <time dateTime={representant.clientCreatedAt}>
                  {formatDate(representant.clientCreatedAt)}
                </time>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">WhatsApp</dt>
              <dd className="truncate font-[600]">{whatsappLabel(script)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Profession</dt>
              <dd className="truncate font-[600]">{script.profession ?? 'Non demandée'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Établissement</dt>
              <dd className="truncate font-[600]">{representant.etablissement ?? NO_VALUE}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Niveau de syndicat</dt>
              <dd className="truncate font-[600]">{representant.syndicat ?? NO_VALUE}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Déjà contacté</dt>
              <dd className="truncate font-[600]">{ouiNonNsp(representant.contacte)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Connaît l’UES</dt>
              <dd className="truncate font-[600]">{ouiNonNsp(representant.connaitUES)}</dd>
            </div>
          </dl>

          {/* La note EST un champ de la fiche : elle reste dans la fiche, sous
              son intitulé, et non dans le fil qui suit. */}
          {representant.notes === null || representant.notes === '' ? null : (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-[0.75rem] text-muted-foreground">Note de la fiche</p>
              <p className="max-w-prose text-[0.875rem]">{representant.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fil de la fiche</CardTitle>
        </CardHeader>
        <CardContent>
          <RepresentantComments
            representantId={representantId}
            author={author}
            canAdminister={canAdminister}
            readOnly={readOnly}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histoire de la relation</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            if (history.isPending) return <Skeleton className="h-24 w-full" />;
            return (() => {
              if (history.isError)
                return (
                  <QueryErrorState
                    error={history.error}
                    onRetry={() => {
                      void history.refetch();
                    }}
                    fallback="L’histoire de la relation n’a pas pu être chargée."
                  />
                );
              return <Timeline changes={history.data} />;
            })();
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prospects apportés</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            if (prospects.isPending) return <Skeleton className="h-24 w-full" />;
            return (() => {
              if (prospects.isError)
                return (
                  <QueryErrorState
                    error={prospects.error}
                    onRetry={() => {
                      void prospects.refetch();
                    }}
                    fallback="Les prospects de ce représentant n’ont pas pu être chargés."
                  />
                );
              return (() => {
                if (prospects.data.items.length === 0)
                  return (
                    <p className="text-[0.875rem] text-muted-foreground">
                      Aucune fiche remise pour l’instant. C’est la dizaine de prospects attendue de
                      chaque représentant qui reste à recueillir.
                    </p>
                  );
                return (
                  <ul className="flex flex-col divide-y divide-border">
                    {prospects.data.items.map((prospect) => (
                      <li
                        key={prospect.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-[600]">
                            {prospect.prenom} {prospect.nom}
                          </p>
                          <p className="truncate text-[0.75rem] text-muted-foreground tabular-nums">
                            {formatPhone(prospect.phoneE164)}
                          </p>
                        </div>
                        <Badge variant="outline">{PROSPECT_STATUT_LABELS[prospect.statut]}</Badge>
                      </li>
                    ))}
                  </ul>
                );
              })();
            })();
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

function Timeline({ changes }: { changes: readonly RepresentantRelationChange[] }) {
  if (changes.length === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        Aucune bascule enregistrée. Le statut se pose en consignant un appel, ou en modifiant la
        fiche.
      </p>
    );
  }

  return (
    <ol aria-label="Histoire de la relation" className="relative flex flex-col gap-6 pl-7">
      <span
        aria-hidden="true"
        className="absolute top-2 bottom-2 left-[0.4375rem] w-px bg-border"
      />
      {changes.map((change) => (
        <li key={change.id} className="relative">
          <span
            aria-hidden="true"
            className="absolute top-1.5 -left-7 size-3.5 rounded-full border-2 border-card bg-primary"
          />
          <p className="font-[600]">
            {REPRESENTANT_RELATION_LABELS[change.fromStatus]} →{' '}
            {REPRESENTANT_RELATION_LABELS[change.toStatus]}
          </p>

          <p className="text-[0.75rem] text-muted-foreground">
            <time dateTime={change.changedAt} className="tabular-nums">
              {formatDateTime(change.changedAt)}
            </time>{' '}
            · {change.changedByName} · {SOURCE_LABELS[change.source]}
          </p>

          {change.reason === null || change.reason === '' ? null : (
            <p className="mt-1 max-w-prose text-[0.875rem]">Motif : {change.reason}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
