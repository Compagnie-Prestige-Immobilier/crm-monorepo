'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightIcon,
  BanknoteIcon,
  CircleSlashIcon,
  LoaderIcon,
  ShieldAlertIcon,
} from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { BankCourriels } from '@/components/bank/bank-courriels';
import { PiecesDeposees } from '@/components/bank/bank-pieces';
import { StageBadge } from '@/components/bank/stage-badge';
import { DetailBackLink } from '@/components/detail-back-link';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { bankBasePath } from '@/lib/bank-filters';
import {
  createBankCaseTransition,
  fetchBankCase,
  fetchBankStages,
  fetchRejectionReasons,
  primaryAction,
  stageOfType,
} from '@/lib/data/bank-cases';
import { formatDateTime, formatPhone } from '@/lib/format';
import { formatXof, parseMoneyInput } from '@/lib/money';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type {
  BankCase,
  BankCaseStage,
  BankCaseTransition,
  BankRejectionReason,
  Projet,
  Role,
} from '@/lib/types';

const OTHER_REASON_CODE = 'AUTRE';

function ActionPrincipale({
  action,
  onAdvance,
}: {
  action: ReturnType<typeof primaryAction>;
  onAdvance: () => void;
}) {
  if (action.kind === 'advance') {
    return (
      <Button type="button" onClick={onAdvance}>
        <ArrowRightIcon aria-hidden="true" />
        Passer à « {action.target.label} »
      </Button>
    );
  }

  if (action.kind === 'cash') {
    return (
      <Button type="button" onClick={onAdvance}>
        <BanknoteIcon aria-hidden="true" />
        Déclarer l’encaissement
      </Button>
    );
  }

  return (
    <p role="status" className="text-[0.8125rem] text-muted-foreground">
      {action.reason}
    </p>
  );
}

function BankCaseHeader({ bankCase }: { bankCase: BankCase }) {
  return (
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-[1.25rem] tabular-nums">{bankCase.reference}</CardTitle>
          <p className="mt-1 truncate text-[0.9375rem]">{bankCase.customerName}</p>
          <p className="truncate text-[0.8125rem] text-muted-foreground tabular-nums">
            {formatPhone(bankCase.customerPhoneE164)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StageBadge stage={bankCase.currentStage} />
          {bankCase.amountXof !== null ? (
            <p className="font-display text-[1.5rem] font-[800] tracking-[-0.02em] tabular-nums">
              {formatXof(bankCase.amountXof)}
            </p>
          ) : null}
        </div>
      </div>
    </CardHeader>
  );
}

function lastActor(bankCase: BankCase): string {
  return bankCase.updatedByName ?? bankCase.createdByName;
}

function RejectionNotice({
  reason,
  detail,
}: {
  reason: BankRejectionReason | null;
  detail: string | null;
}) {
  if (reason === null) return null;
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.875rem] text-destructive">
      <span className="font-[600]">Rejeté : {reason.label}.</span>
      {detail !== null && detail !== '' ? ` ${detail}` : ''}
    </p>
  );
}

// Pas de rejet avant la prise en traitement : le serveur refuse, le bouton n'existe pas.
function RejectButton({
  rejectedStage,
  enTraitement,
  onReject,
}: {
  rejectedStage: BankCaseStage | undefined;
  enTraitement: boolean;
  onReject: () => void;
}) {
  if (rejectedStage === undefined || !rejectedStage.isActive || !enTraitement) return null;
  return (
    <Button type="button" variant="destructive" onClick={onReject}>
      <CircleSlashIcon aria-hidden="true" />
      Rejeter le dossier
    </Button>
  );
}

function BankCaseActions({
  canAct,
  action,
  rejectedStage,
  enTraitement,
  role,
  onAdvance,
  onReject,
}: {
  canAct: boolean;
  action: ReturnType<typeof primaryAction>;
  rejectedStage: BankCaseStage | undefined;
  enTraitement: boolean;
  role: Role;
  onAdvance: () => void;
  onReject: () => void;
}) {
  if (!canAct) {
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

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      {/* L'action principale est ÉPINGLÉE en tête, en pleine variante :
          faire avancer un dossier est le geste que l'agent répète
          vingt fois par jour. Le rejet est à côté, en `destructive`
          et sans place privilégiée : il ne doit jamais être le bouton
          qu'on atteint par réflexe. */}
      <ActionPrincipale action={action} onAdvance={onAdvance} />
      <RejectButton rejectedStage={rejectedStage} enTraitement={enTraitement} onReject={onReject} />
    </div>
  );
}

/** Sans les justificatifs, la banque instruit un dossier qu'elle n'a pas lu. */
function PiecesDeLaPlateforme({ bankCase }: { bankCase: BankCase }) {
  if (bankCase.inscriptionId === null) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
        Pièces déposées sur la plateforme
      </p>
      <PiecesDeposees inscriptionId={bankCase.inscriptionId} />
    </div>
  );
}

function BankCaseSummaryCard({
  bankCase,
  canAct,
  action,
  rejectedStage,
  role,
  onAdvance,
  onReject,
}: {
  bankCase: BankCase;
  canAct: boolean;
  action: ReturnType<typeof primaryAction>;
  rejectedStage: BankCaseStage | undefined;
  role: Role;
  onAdvance: () => void;
  onReject: () => void;
}) {
  return (
    <Card className="animate-rise">
      <BankCaseHeader bankCase={bankCase} />
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 text-[0.8125rem] sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Banque de traitement</dt>
            <dd className="truncate font-[600]">{bankCase.processingBankName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Ouvert le</dt>
            <dd className="font-[600]">
              <time dateTime={bankCase.createdAt}>{formatDateTime(bankCase.createdAt)}</time>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Dernière intervention</dt>
            <dd className="truncate font-[600]">{lastActor(bankCase)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Suivi par</dt>
            <dd className="truncate font-[600]">
              {bankCase.suiviParName ?? 'Aucun téléconseiller'}
            </dd>
          </div>
        </dl>

        <PiecesDeLaPlateforme bankCase={bankCase} />

        <RejectionNotice reason={bankCase.rejectionReason} detail={bankCase.rejectionDetail} />

        {/* ─── Actions ─────────────────────────────────────────────── */}
        <BankCaseActions
          canAct={canAct}
          action={action}
          rejectedStage={rejectedStage}
          enTraitement={!bankCase.currentStage.isInitial}
          role={role}
          onAdvance={onAdvance}
          onReject={onReject}
        />
      </CardContent>
    </Card>
  );
}

export function BankCaseDetailView({
  caseId,
  role,
  projet,
}: {
  caseId: string;
  role: Role;
  projet: Projet;
}) {
  const queryClient = useQueryClient();
  const listHref = `${bankBasePath(projet)}/dossiers`;
  const [advancing, setAdvancing] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const detail = useQuery({
    queryKey: queryKeys.bankCase(caseId, projet),
    queryFn: () => fetchBankCase(caseId, projet),
  });

  const stages = useQuery({
    queryKey: queryKeys.bankStages(true),
    queryFn: () => fetchBankStages(true),
    staleTime: 5 * 60_000,
  });

  if (detail.isPending || stages.isPending) return <BankCaseDetailSkeleton />;

  if (detail.isError) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href={listHref}>Tous les dossiers</DetailBackLink>
        <QueryErrorState
          error={detail.error}
          onRetry={() => {
            void detail.refetch();
          }}
          fallback="Ce dossier n’a pas pu être chargé."
        />
      </div>
    );
  }

  if (stages.isError) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href={listHref}>Tous les dossiers</DetailBackLink>
        <QueryErrorState
          error={stages.error}
          onRetry={() => {
            void stages.refetch();
          }}
          fallback="Le flux de traitement n’a pas pu être chargé."
        />
      </div>
    );
  }

  const bankCase = detail.data.bankCase;
  const action = primaryAction(stages.data, bankCase.currentStage);
  const rejectedStage = stageOfType(stages.data, 'REJECTED');
  const canAct = !bankCase.isTerminal;

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankCase(caseId, projet) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankCasesRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankAnalyticsRoot });
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailBackLink href={listHref}>Tous les dossiers</DetailBackLink>

      {/* ─── En-tête ─────────────────────────────────────────────────── */}
      <BankCaseSummaryCard
        bankCase={bankCase}
        canAct={canAct}
        action={action}
        rejectedStage={rejectedStage}
        role={role}
        onAdvance={() => {
          setAdvancing(true);
        }}
        onReject={() => {
          setRejecting(true);
        }}
      />

      {/* ─── Historique ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
          Historique du dossier
        </h2>
        <Timeline history={detail.data.history} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">Courriels</h2>
        <BankCourriels objetType="bank_case" objetId={caseId} />
      </section>

      <AdvanceDialog
        open={advancing && action.kind !== 'none'}
        onOpenChange={setAdvancing}
        caseId={caseId}
        expectedRev={bankCase.rev}
        target={action.kind === 'none' ? null : action.target}
        isCashing={action.kind === 'cash'}
        onDone={invalidate}
      />

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        caseId={caseId}
        expectedRev={bankCase.rev}
        targetStageId={rejectedStage?.id ?? null}
        onDone={invalidate}
      />
    </div>
  );
}

function Timeline({ history }: { history: readonly BankCaseTransition[] }) {
  if (history.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-[0.875rem] text-muted-foreground">Aucune transition enregistrée.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <ol className="relative flex flex-col gap-6 pl-7">
          <span
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[0.4375rem] w-px bg-border"
          />
          {history.map((transition) => (
            <li key={transition.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-7 size-3.5 rounded-full border-2 border-card bg-primary"
              />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="font-[600]">
                  {transition.fromStage === null
                    ? `Ouverture : ${transition.toStage.label}`
                    : `${transition.fromStage.label} → ${transition.toStage.label}`}
                </p>
                {transition.correctionReason !== null ? (
                  <Badge variant="warning">Correction administrateur</Badge>
                ) : null}
              </div>

              <p className="text-[0.75rem] text-muted-foreground">
                <time dateTime={transition.createdAt} className="tabular-nums">
                  {formatDateTime(transition.createdAt)}
                </time>{' '}
                · {transition.performedByName}
              </p>

              {transition.amountXof !== null ? (
                <p className="mt-1 text-[0.875rem] tabular-nums">
                  Montant : <span className="font-[600]">{formatXof(transition.amountXof)}</span>
                </p>
              ) : null}

              {transition.rejectionReason !== null ? (
                <p className="mt-1 text-[0.875rem]">
                  Motif : <span className="font-[600]">{transition.rejectionReason.label}</span>
                  {transition.rejectionDetail !== null && transition.rejectionDetail !== ''
                    ? `. ${transition.rejectionDetail}`
                    : ''}
                </p>
              ) : null}

              {transition.comment !== null && transition.comment !== '' ? (
                <p className="mt-1 max-w-prose text-[0.875rem] text-muted-foreground">
                  {transition.comment}
                </p>
              ) : null}

              {transition.correctionReason !== null ? (
                <p className="mt-1 max-w-prose text-[0.8125rem] text-warning">
                  Justification : {transition.correctionReason}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function advanceDialogTitle(isCashing: boolean, target: { label: string } | null): string {
  if (isCashing) return 'Déclarer l’encaissement';
  return `Passer à « ${target?.label ?? ''} »`;
}

function advanceDialogDescription(isCashing: boolean): string {
  return isCashing
    ? 'L’encaissement clôt le dossier. Correction possible ensuite par un administrateur.'
    : 'Étape suivante du flux ouvert.';
}

function AdvanceAmountField({
  isCashing,
  amountId,
  amount,
  onChange,
}: {
  isCashing: boolean;
  amountId: string;
  amount: string | null;
  onChange: (value: string | null) => void;
}) {
  if (!isCashing) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={amountId}>
        Montant encaissé
        <span className="text-destructive" aria-label="obligatoire">
          *
        </span>
      </Label>
      <Input
        id={amountId}
        inputMode="numeric"
        autoComplete="off"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- champ unique du dialogue
        autoFocus
        value={amount ?? ''}
        placeholder="1200000"
        aria-describedby={`${amountId}-apercu`}
        onChange={(event) => {
          onChange(parseMoneyInput(event.target.value));
        }}
      />
      {/* Aperçu formaté EN DIRECT : « 1200000 » et « 12000000 » se
          distinguent mal à la lecture, et un zéro de trop est une
          erreur qu'on ne rattrape pas après validation. */}
      <p
        id={`${amountId}-apercu`}
        role="status"
        className="text-[0.9375rem] font-[600] tabular-nums"
      >
        {amount === null ? (
          <span className="font-[400] text-muted-foreground">Montant strictement positif.</span>
        ) : (
          formatXof(amount)
        )}
      </p>
    </div>
  );
}

function AdvanceSubmitLabel({ pending, isCashing }: { pending: boolean; isCashing: boolean }) {
  if (pending) {
    return (
      <>
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        Enregistrement…
      </>
    );
  }
  return isCashing ? 'Confirmer l’encaissement' : 'Confirmer';
}

export function AdvanceDialog({
  open,
  onOpenChange,
  caseId,
  expectedRev,
  target,
  isCashing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  expectedRev: number;
  target: { id: string; label: string } | null;
  isCashing: boolean;
  onDone: () => void;
}) {
  const amountId = useId();
  const commentId = useId();
  const [amount, setAmount] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const advance = useMutation({
    mutationFn: () => {
      if (target === null) throw new Error('Aucune étape cible.');
      return createBankCaseTransition(caseId, {
        targetStageId: target.id,
        expectedRev,
        ...(isCashing && amount !== null ? { amountXof: amount } : {}),
        ...(comment.trim() !== '' ? { comment } : {}),
      });
    },
    onSuccess: (result) => {
      onDone();
      toast.success(`Dossier passé à « ${result.bankCase.currentStage.label} ».`);
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'La transition a échoué.');
    },
  });

  function reset(): void {
    setAmount(null);
    setComment('');
  }

  const amountValid = !isCashing || (amount !== null && /[1-9]/u.test(amount));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && advance.isPending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{advanceDialogTitle(isCashing, target)}</DialogTitle>
          <DialogDescription>{advanceDialogDescription(isCashing)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <AdvanceAmountField
            isCashing={isCashing}
            amountId={amountId}
            amount={amount}
            onChange={setAmount}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={commentId}>Commentaire (facultatif)</Label>
            <Textarea
              id={commentId}
              value={comment}
              maxLength={2000}
              placeholder="Précision"
              onChange={(event) => {
                setComment(event.target.value);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={advance.isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={advance.isPending || !amountValid}
            onClick={() => {
              advance.mutate();
            }}
          >
            <AdvanceSubmitLabel pending={advance.isPending} isCashing={isCashing} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isDetailRequired(
  reasons: readonly BankRejectionReason[],
  reasonId: string | null,
): boolean {
  const selected = reasons.find((reason) => reason.id === reasonId);
  return selected?.code === OTHER_REASON_CODE;
}

function canSubmitReject({
  targetStageId,
  reasonIdValue,
  detailRequired,
  detail,
  pending,
}: {
  targetStageId: string | null;
  reasonIdValue: string | null;
  detailRequired: boolean;
  detail: string;
  pending: boolean;
}): boolean {
  return (
    targetStageId !== null &&
    reasonIdValue !== null &&
    (!detailRequired || detail.trim() !== '') &&
    !pending
  );
}

export function RejectDialog({
  open,
  onOpenChange,
  caseId,
  expectedRev,
  targetStageId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  expectedRev: number;
  targetStageId: string | null;
  onDone: () => void;
}) {
  const reasonId = useId();
  const detailId = useId();
  const commentId = useId();

  const [reasonIdValue, setReasonIdValue] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [comment, setComment] = useState('');

  const reasons = useQuery({
    queryKey: queryKeys.bankRejectionReasons,
    queryFn: () => fetchRejectionReasons(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const reasonList = reasons.data ?? [];
  const detailRequired = isDetailRequired(reasonList, reasonIdValue);

  const reject = useMutation({
    mutationFn: () => {
      if (targetStageId === null || reasonIdValue === null) {
        throw new Error('Motif ou étape de rejet manquant.');
      }
      return createBankCaseTransition(caseId, {
        targetStageId,
        expectedRev,
        rejectionReasonId: reasonIdValue,
        ...(detail.trim() !== '' ? { rejectionDetail: detail } : {}),
        ...(comment.trim() !== '' ? { comment } : {}),
      });
    },
    onSuccess: () => {
      onDone();
      toast.success('Dossier rejeté. Montant : 0 FCFA.');
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'Le rejet a échoué.');
    },
  });

  function reset(): void {
    setReasonIdValue(null);
    setDetail('');
    setComment('');
  }

  const canSubmit = canSubmitReject({
    targetStageId,
    reasonIdValue,
    detailRequired,
    detail,
    pending: reject.isPending,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && reject.isPending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rejeter ce dossier ?</DialogTitle>
          <DialogDescription>
            {/* On ÉCRIT le montant en toutes lettres. Le serveur force 0 sur un
                rejet, quoi qu'on lui envoie : mais un agent qui vient de voir
                un montant à l'écran croirait sinon que le rejet le conserve, et
                s'étonnerait de le voir disparaître de la synthèse. */}
            Le rejet clôt le dossier. <strong className="font-[600]">Montant : 0 FCFA</strong>.
            Correction possible ensuite par un administrateur.
          </DialogDescription>
        </DialogHeader>

        {targetStageId === null ? (
          <p role="alert" className="text-[0.875rem] text-destructive">
            Aucune étape de rejet active. Un administrateur doit en activer une.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={reasonId}>
                Motif de rejet
                <span className="text-destructive" aria-label="obligatoire">
                  *
                </span>
              </Label>
              {/* `items` : `Select.Value` de Base UI affiche la VALEUR choisie,
                  pas le texte de l'item — ici, l'identifiant du motif. */}
              <Select
                items={reasonList.map((reason) => ({
                  value: reason.id,
                  label: reason.label,
                }))}
                value={reasonIdValue ?? ''}
                onValueChange={(value) => {
                  if (value === null) return;
                  setReasonIdValue(value);
                }}
              >
                <SelectTrigger id={reasonId} className="w-full">
                  <SelectValue placeholder="Choisir un motif" />
                </SelectTrigger>
                <SelectContent>
                  {reasonList.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {detailRequired ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={detailId}>
                  Précision
                  <span className="text-destructive" aria-label="obligatoire">
                    *
                  </span>
                </Label>
                <Textarea
                  id={detailId}
                  value={detail}
                  maxLength={2000}
                  // oxlint-disable-next-line jsx-a11y/no-autofocus -- champ unique du dialogue
                  autoFocus
                  aria-describedby={`${detailId}-aide`}
                  onChange={(event) => {
                    setDetail(event.target.value);
                  }}
                />
                <p id={`${detailId}-aide`} className="text-[0.75rem] text-muted-foreground">
                  Obligatoire pour ce motif.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={commentId}>Commentaire (facultatif)</Label>
              <Textarea
                id={commentId}
                value={comment}
                maxLength={2000}
                onChange={(event) => {
                  setComment(event.target.value);
                }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={reject.isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit}
            onClick={() => {
              reject.mutate();
            }}
          >
            {reject.isPending ? (
              <>
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              'Rejeter définitivement'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BankCaseDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="h-11 w-44" />
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
