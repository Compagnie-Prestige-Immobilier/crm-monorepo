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
import {
  formatDate,
  formatDateTime,
  formatDetectedCall,
  formatDeviceCall,
  formatNumber,
  formatPhone,
} from '@/lib/format';
import { fetchProspects } from '@/lib/data/prospects';
import {
  fetchRepresentant,
  fetchRepresentantCallAttempts,
  fetchRepresentantDeviceCalls,
  fetchRepresentantRelationHistory,
  scriptOf,
  whatsappLabel,
  type DeviceCallDetection,
  type RepresentantCallAttempt,
  type RepresentantRelationChange,
} from '@/lib/data/representants';
import { queryKeys } from '@/lib/query-keys';
import { REPRESENTANT_RELATION_LABELS } from '@/lib/representant-filters';
import { PROSPECT_STATUT_LABELS, REP_CALL_OUTCOME_LABELS } from '@/lib/types';

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

  const appels = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'call-attempts'],
    queryFn: () => fetchRepresentantCallAttempts(representantId),
  });

  const releves = useQuery({
    queryKey: [...queryKeys.representant(representantId), 'device-calls'],
    queryFn: () => fetchRepresentantDeviceCalls(representantId),
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
              <RelationBadge
                status={representant.relationStatus}
                label={representant.statutQualificationLabel}
                effect={representant.statutQualificationEffect}
                lastCallOutcome={representant.lastCallOutcome}
              />
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
              <dt className="text-muted-foreground">Syndicat</dt>
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
            <div className="min-w-0">
              <dt className="text-muted-foreground">Dernier appel</dt>
              <dd className="truncate font-[600]">
                {representant.lastCallOutcome == null
                  ? 'Jamais appelé'
                  : REP_CALL_OUTCOME_LABELS[representant.lastCallOutcome]}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Appelé le</dt>
              <dd className="truncate font-[600]">
                {representant.lastCallAt == null
                  ? NO_VALUE
                  : formatDateTime(representant.lastCallAt)}
              </dd>
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

      {/* « Mes contacts » ouvre la fiche sur cette ancre. */}
      <Card id="appels">
        <CardHeader>
          <CardTitle>Appels</CardTitle>
        </CardHeader>
        <CardContent>
          {appels.isPending ? <Skeleton className="h-24 w-full" /> : null}
          {appels.isError ? (
            <QueryErrorState
              error={appels.error}
              onRetry={() => {
                void appels.refetch();
              }}
              fallback="Les appels n’ont pas pu être chargés."
            />
          ) : null}
          {appels.isSuccess ? <Appels items={appels.data} /> : null}
          {releves.isSuccess ? <RelevesTelephone items={releves.data} /> : null}
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

/** Chaque appel avec les réponses du script telles qu'elles ont été dites ce jour-là. */
function Appels({ items }: { items: readonly RepresentantCallAttempt[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        Aucun appel consigné. Le premier se note depuis la console ou le téléphone.
      </p>
    );
  }
  return (
    <ol aria-label="Appels" className="flex flex-col divide-y divide-border">
      {items.map((appel) => {
        const reponses = [
          appel.etablissementConfirme === null
            ? null
            : `Établissement confirmé : ${ouiNonNsp(appel.etablissementConfirme)}`,
          appel.contacte === null ? null : `Contacté : ${ouiNonNsp(appel.contacte)}`,
          appel.connaitUES === null ? null : `Connaît l’UES : ${ouiNonNsp(appel.connaitUES)}`,
          appel.syndicat === null || appel.syndicat === '' ? null : `Syndicat : ${appel.syndicat}`,
        ].filter((ligne) => ligne !== null);
        return (
          <li key={appel.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {appel.statutQualificationLabel ?? REP_CALL_OUTCOME_LABELS[appel.outcome]}
              </Badge>
              {appel.callbackAt === null ? null : (
                <span className="text-[0.8125rem]">
                  Rappel le {formatDateTime(appel.callbackAt)}
                </span>
              )}
            </div>
            <p className="text-[0.75rem] text-muted-foreground">
              <time dateTime={appel.clientCreatedAt} className="tabular-nums">
                {formatDateTime(appel.clientCreatedAt)}
              </time>{' '}
              · {appel.performedByName}
            </p>
            <p className="text-[0.8125rem] text-muted-foreground">{formatDeviceCall(appel)}</p>
            {reponses.length === 0 ? null : (
              <p className="text-[0.8125rem] text-muted-foreground">{reponses.join(' · ')}</p>
            )}
            {appel.suggestedPhoneE164 === null ? null : (
              <p className="text-[0.8125rem]">
                Personne proposée : {appel.suggestedName ?? 'sans nom'},{' '}
                {formatPhone(appel.suggestedPhoneE164)}
                {appel.suggestedNote === null || appel.suggestedNote === ''
                  ? ''
                  : ` · ${appel.suggestedNote}`}
              </p>
            )}
            {appel.comment === null || appel.comment === '' ? null : (
              <p className="max-w-prose text-[0.875rem]">{appel.comment}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Ce que le journal du téléphone a relevé, consigné en tentative ou non. */
function RelevesTelephone({ items }: { items: readonly DeviceCallDetection[] }) {
  if (items.length === 0) return null;

  const nonConsignes = items.filter((releve) => releve.attemptId === null);
  const consignes = items.filter((releve) => releve.attemptId !== null);

  return (
    <section className="mt-4 border-t border-border pt-4">
      <p className="text-[0.75rem] text-muted-foreground">Relevés par le téléphone</p>
      {nonConsignes.length === 0 ? null : (
        <ul
          aria-label="Relevés par le téléphone"
          className="mt-2 flex flex-col divide-y divide-border"
        >
          {nonConsignes.map((releve) => (
            <ReleveTelephone key={releve.id} releve={releve} />
          ))}
        </ul>
      )}
      {consignes.length === 0 ? null : (
        <details className="mt-2">
          <summary className="w-fit cursor-pointer rounded-md py-1 text-[0.8125rem] font-[600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {formatNumber(consignes.length)} appel{consignes.length === 1 ? '' : 's'} consigné
            {consignes.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1 flex flex-col divide-y divide-border">
            {consignes.map((releve) => (
              <ReleveTelephone key={releve.id} releve={releve} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ReleveTelephone({ releve }: { releve: DeviceCallDetection }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0">
      <Badge variant={releve.attemptId === null ? 'warning' : 'success'}>
        {releve.attemptId === null ? 'Non consigné' : 'Consigné'}
      </Badge>
      <span className="text-[0.8125rem] tabular-nums">{formatDetectedCall(releve)}</span>
      <span className="text-[0.75rem] text-muted-foreground">{releve.performedByName}</span>
    </li>
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
