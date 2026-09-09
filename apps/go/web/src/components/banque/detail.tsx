import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanknoteIcon,
  CircleSlashIcon,
  ShieldAlertIcon,
} from 'lucide-react';
import { useState } from 'react';

import { DialogueAvancer, DialogueRejeter } from '@/components/banque/detail-dialogues';
import { actionPrincipale, etapeDeType, type ActionPrincipale } from '@/components/banque/flux';
import { formatMontant } from '@/components/banque/montant';
import { EtapeBadge } from '@/components/banque/pieces';
import { Chronologie } from '@/components/banque/chronologie';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchDossier,
  fetchEtapes,
  type DossierBanque,
  type EtapeBanque,
} from '@/lib/data/bank-cases';
import { REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { formatDateTime, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { PROJET_API, type Projet, type Role } from '@/lib/types';

function RetourListe({ projet }: { projet: Projet }) {
  return (
    <Link
      to="/$projet/dossiers"
      params={{ projet }}
      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
    >
      <ArrowLeftIcon aria-hidden="true" />
      Tous les dossiers
    </Link>
  );
}

function ActionSuivante({
  action,
  onAvancer,
}: {
  action: ActionPrincipale;
  onAvancer: () => void;
}) {
  if (action.genre === 'avancer') {
    return (
      <Button type="button" onClick={onAvancer}>
        <ArrowRightIcon aria-hidden="true" />
        Passer à « {action.cible.label} »
      </Button>
    );
  }
  if (action.genre === 'encaisser') {
    return (
      <Button type="button" onClick={onAvancer}>
        <BanknoteIcon aria-hidden="true" />
        Déclarer l’encaissement
      </Button>
    );
  }
  return (
    <p role="status" className="text-[0.8125rem] text-muted-foreground">
      {action.raison}
    </p>
  );
}

function Actions({
  dossier,
  action,
  etapeRejet,
  role,
  onAvancer,
  onRejeter,
}: {
  dossier: DossierBanque;
  action: ActionPrincipale;
  etapeRejet: EtapeBanque | undefined;
  role: Role;
  onAvancer: () => void;
  onRejeter: () => void;
}) {
  if (dossier.isTerminal) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-[0.8125rem] text-muted-foreground"
      >
        <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {role === 'ADMIN'
          ? 'Étape terminale. Correction possible par un administrateur, avec justification.'
          : 'Étape terminale. Dossier verrouillé.'}
      </p>
    );
  }

  // L'action principale est épinglée en tête ; le rejet est à côté, sans place
  // privilégiée : il ne doit jamais être le bouton qu'on atteint par réflexe.
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <ActionSuivante action={action} onAvancer={onAvancer} />
      {etapeRejet === undefined || !etapeRejet.isActive ? null : (
        <Button type="button" variant="destructive" onClick={onRejeter}>
          <CircleSlashIcon aria-hidden="true" />
          Rejeter le dossier
        </Button>
      )}
    </div>
  );
}

function Synthese({ dossier }: { dossier: DossierBanque }) {
  return (
    <>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-[1.25rem]">{dossier.reference}</CardTitle>
            <p className="mt-1 truncate text-[0.9375rem]">{dossier.customerName}</p>
            <p className="truncate text-[0.8125rem] text-muted-foreground">
              {formatPhone(dossier.customerPhoneE164)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <EtapeBadge etape={dossier.currentStage} />
            {dossier.amountXof === null ? null : (
              <p className="font-display text-[1.5rem] font-[800] tracking-[-0.02em]">
                {formatMontant(dossier.amountXof)}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <dl className="grid gap-3 px-5 text-[0.8125rem] sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Banque de traitement</dt>
          <dd className="truncate font-[600]">{dossier.processingBankName}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Ouvert le</dt>
          <dd className="font-[600]">
            <time dateTime={dossier.createdAt}>{formatDateTime(dossier.createdAt)}</time>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Dernière intervention</dt>
          <dd className="truncate font-[600]">{dossier.updatedByName ?? dossier.createdByName}</dd>
        </div>
      </dl>
      {dossier.rejectionReason === null ? null : (
        <p className="mx-5 rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.875rem] text-destructive">
          <span className="font-[600]">Rejeté : {dossier.rejectionReason.label}.</span>
          {dossier.rejectionDetail === null ? '' : ` ${dossier.rejectionDetail}`}
        </p>
      )}
    </>
  );
}

export function DetailDossierBancaire({
  dossierId,
  projet,
  role,
}: {
  dossierId: string;
  projet: Projet;
  role: Role;
}) {
  const [avancer, setAvancer] = useState(false);
  const [rejeter, setRejeter] = useState(false);
  const projetApi = PROJET_API[projet];

  const detail = useQuery({
    queryKey: queryKeys.bankCase(dossierId, projet),
    queryFn: () => fetchDossier(dossierId, projetApi),
  });
  const etapes = useQuery({
    queryKey: queryKeys.bankStages(true),
    queryFn: () => fetchEtapes(true),
    staleTime: REFERENTIELS_STALE_MS,
  });

  if (detail.isPending || etapes.isPending) return <SqueletteDetail />;

  if (detail.isError || etapes.isError) {
    return (
      <div className="flex flex-col gap-6">
        <RetourListe projet={projet} />
        <QueryErrorState
          error={detail.error ?? etapes.error}
          onRetry={() => {
            void detail.refetch();
            void etapes.refetch();
          }}
          fallback="Ce dossier n’a pas pu être chargé."
        />
      </div>
    );
  }

  const dossier = detail.data.bankCase;
  const action = actionPrincipale(etapes.data, dossier.currentStage);
  const etapeRejet = etapeDeType(etapes.data, 'REJECTED');

  return (
    <div className="flex flex-col gap-6">
      <RetourListe projet={projet} />

      <Card className="animate-rise">
        <Synthese dossier={dossier} />
        <CardContent>
          <Actions
            dossier={dossier}
            action={action}
            etapeRejet={etapeRejet}
            role={role}
            onAvancer={() => {
              setAvancer(true);
            }}
            onRejeter={() => {
              setRejeter(true);
            }}
          />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
          Historique du dossier
        </h2>
        <Chronologie transitions={detail.data.history ?? []} />
      </section>

      <DialogueAvancer
        ouvert={avancer && action.genre !== 'aucune'}
        onOuvert={setAvancer}
        dossierId={dossierId}
        projet={projet}
        rev={dossier.rev}
        cible={action.genre === 'aucune' ? null : action.cible}
        encaissement={action.genre === 'encaisser'}
      />
      <DialogueRejeter
        ouvert={rejeter}
        onOuvert={setRejeter}
        dossierId={dossierId}
        projet={projet}
        rev={dossier.rev}
        etapeRejet={etapeRejet}
      />
    </div>
  );
}

function SqueletteDetail() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="h-9 w-44" />
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-72" />
          <Skeleton className="h-11 w-64" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-4">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
