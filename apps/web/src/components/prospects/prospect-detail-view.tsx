'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { DetailBackLink } from '@/components/detail-back-link';
import { BoutonWhatsApp } from '@/components/prospects/bouton-whatsapp';
import { ChampsAjoutes } from '@/components/prospects/champs-ajoutes';
import { ProspectSegmentHistory } from '@/components/prospects/prospect-segment-history';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/data/admin';
import {
  fetchProspect,
  fetchProspectCallAttempts,
  fetchProspectDeviceCalls,
  marquerProspectRevue,
  type DeviceCallDetection,
} from '@/lib/data/prospects';
import { toastApiError } from '@/lib/mutation-feedback';
import {
  formatDate,
  formatDateTime,
  formatDetectedCall,
  formatDeviceCall,
  formatNumber,
  formatPhone,
} from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  CALL_OUTCOME_LABELS,
  ENROLLMENT_METHOD_LABELS,
  PHASE2_STATUS_LABELS,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  peutRevoirUneDemande,
  type ProspectRow,
  type Role,
} from '@/lib/types';

const NO_VALUE = '–';

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-[600]">{children}</dd>
    </div>
  );
}

function ouiNon(value: boolean | null): string {
  if (value === null) return NO_VALUE;
  return value ? 'Oui' : 'Non';
}

/** La fiche CHUES telle que les téléconseillers l'ont remplie, et chaque appel passé dessus. */
export function ProspectDetailView({ prospectId, role }: { prospectId: string; role: Role }) {
  const fiche = useQuery({
    queryKey: queryKeys.prospect(prospectId),
    queryFn: () => fetchProspect(prospectId),
  });
  const appels = useQuery({
    queryKey: ['prospects', 'call-attempts', prospectId],
    queryFn: () => fetchProspectCallAttempts(prospectId),
  });
  const releves = useQuery({
    queryKey: ['prospects', 'device-calls', prospectId],
    queryFn: () => fetchProspectDeviceCalls(prospectId),
  });

  if (fiche.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/chues/prospects">Tous les prospects</DetailBackLink>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (fiche.isError) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/chues/prospects">Tous les prospects</DetailBackLink>
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

  const prospect: ProspectRow = fiche.data;

  return (
    <div className="flex flex-col gap-6">
      <DetailBackLink href="/chues/prospects">Tous les prospects</DetailBackLink>

      <Card className="animate-rise">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-[1.25rem]">
                {prospect.prenom} {prospect.nom}
              </CardTitle>
              <p className="truncate text-[0.8125rem] text-muted-foreground tabular-nums">
                {formatPhone(prospect.phoneE164)}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="outline">{PROSPECT_STATUT_LABELS[prospect.statut]}</Badge>
              <Badge variant="secondary">{PHASE2_STATUS_LABELS[prospect.phase2Status]}</Badge>
              <RevueDemande prospect={prospect} role={role} />
              <BoutonWhatsApp prospect={prospect} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-[0.8125rem] sm:grid-cols-4">
            <Ligne label="WhatsApp">
              {prospect.whatsappNumber === null ? NO_VALUE : formatPhone(prospect.whatsappNumber)}
            </Ligne>
            <Ligne label="Profession">{prospect.profession ?? NO_VALUE}</Ligne>
            <Ligne label="Établissement">{prospect.etablissement ?? NO_VALUE}</Ligne>
            <Ligne label="Banque">{prospect.banqueName ?? NO_VALUE}</Ligne>
            <Ligne label="Syndicat">{prospect.syndicatSigle ?? NO_VALUE}</Ligne>
            <Ligne label="Représentant">{prospect.representantName ?? NO_VALUE}</Ligne>
            <Ligne label="Segment">
              {prospect.segment === null ? NO_VALUE : SEGMENT_LABELS[prospect.segment]}
            </Ligne>
            <Ligne label="Méthode d’enrôlement">
              {prospect.enrollmentMethod === null
                ? NO_VALUE
                : ENROLLMENT_METHOD_LABELS[prospect.enrollmentMethod]}
            </Ligne>
            <Ligne label="Téléconseiller">{prospect.ownedByCommercialName}</Ligne>
            <Ligne label="Saisi le">{formatDate(prospect.clientCreatedAt)}</Ligne>
            <Ligne label="Dernier appel">
              {prospect.lastCallOutcome === null
                ? 'Jamais appelé'
                : CALL_OUTCOME_LABELS[prospect.lastCallOutcome]}
            </Ligne>
            <Ligne label="Appelé le">
              {prospect.lastCallAt === null ? NO_VALUE : formatDateTime(prospect.lastCallAt)}
            </Ligne>
            <Ligne label="Tentatives">{formatNumber(prospect.callAttemptCount)}</Ligne>
          </dl>
        </CardContent>
      </Card>

      <ChampsAjoutes prospect={prospect} />

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
          {appels.isSuccess ? <AppelsProspect items={appels.data} /> : null}
          {releves.isSuccess ? <RelevesTelephone items={releves.data} /> : null}
        </CardContent>
      </Card>

      {role === 'ADMIN' || role === 'COMMERCIAL' ? (
        <Card>
          <CardHeader>
            <CardTitle>Segment</CardTitle>
          </CardHeader>
          <CardContent>
            <ProspectSegmentHistory prospectId={prospectId} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * La revue du closing. Rien à afficher tant que la demande n'est pas convertie :
 * il n'y a alors rien à transmettre à l'enrôlement.
 */
function RevueDemande({ prospect, role }: { prospect: ProspectRow; role: Role }) {
  const queryClient = useQueryClient();
  const revue = useMutation({
    mutationFn: () => marquerProspectRevue(prospect.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      toast.success('Demande revue.');
    },
    onError: (error) => {
      toastApiError(error, 'La revue n’a pas pu être enregistrée.');
    },
  });

  if (prospect.statut !== 'CONVERTI') return null;

  if (prospect.revueAt !== null) {
    return (
      <Badge variant="success">
        Revue le {formatDate(prospect.revueAt)}
        {prospect.revueByName === null ? '' : ` par ${prospect.revueByName}`}
      </Badge>
    );
  }

  return (
    <>
      <Badge variant="warning">Demande non revue</Badge>
      {peutRevoirUneDemande(role) ? (
        <Button
          size="sm"
          disabled={revue.isPending}
          onClick={() => {
            revue.mutate();
          }}
        >
          Marquer revue
        </Button>
      ) : null}
    </>
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

type Appel = Awaited<ReturnType<typeof fetchProspectCallAttempts>>[number];

function AppelsProspect({ items }: { items: readonly Appel[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        Aucun appel consigné. Le premier se note depuis la console ou le téléphone.
      </p>
    );
  }
  return (
    <ol aria-label="Appels" className="flex flex-col divide-y divide-border">
      {items.map((appel) => (
        <li key={appel.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {appel.reasonLabel ?? CALL_OUTCOME_LABELS[appel.outcome]}
            </Badge>
            {appel.method === null ? null : (
              <span className="text-[0.8125rem]">{ENROLLMENT_METHOD_LABELS[appel.method]}</span>
            )}
          </div>
          <p className="text-[0.75rem] text-muted-foreground">
            <time dateTime={appel.clientCreatedAt} className="tabular-nums">
              {formatDateTime(appel.clientCreatedAt)}
            </time>{' '}
            · {appel.performedByName}
          </p>
          <p className="text-[0.8125rem] text-muted-foreground">{formatDeviceCall(appel)}</p>
          {appel.dureeTraitementSecondes === null ? null : (
            <p className="text-[0.8125rem] text-muted-foreground">
              Traitement : {formatDuration(appel.dureeTraitementSecondes)}
            </p>
          )}
          <p className="text-[0.8125rem] text-muted-foreground">
            Fonctionnaire : {ouiNon(appel.fonctionnaire)} · Engagement en cours :{' '}
            {ouiNon(appel.engagementEnCours)}
            {appel.dureeEtablissementMois === null
              ? ''
              : ` · ${formatNumber(appel.dureeEtablissementMois)} mois dans la fonction`}
            {appel.email === null || appel.email === '' ? '' : ` · ${appel.email}`}
          </p>
          {appel.rendezVousAt === null ? null : (
            <p className="text-[0.8125rem]">Rendez-vous le {formatDateTime(appel.rendezVousAt)}</p>
          )}
          {appel.comment === null || appel.comment === '' ? null : (
            <p className="max-w-prose text-[0.875rem]">
              {/* L'issue « Autre » exige le commentaire : c'est un motif. */}
              <span className="text-muted-foreground">
                {appel.outcome === 'OTHER' ? 'Motif' : 'Commentaire'} :{' '}
              </span>
              {appel.comment}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
