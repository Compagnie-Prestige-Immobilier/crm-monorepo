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
import type { BankCaseTransition, BankRejectionReason, Role } from '@/lib/types';

/** Code du motif « Autre » : le seul qui exige une précision libre (API). */
const OTHER_REASON_CODE = 'AUTRE';

export function BankCaseDetailView({ caseId, role }: { caseId: string; role: Role }) {
  const queryClient = useQueryClient();
  const [advancing, setAdvancing] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const detail = useQuery({
    queryKey: queryKeys.bankCase(caseId),
    queryFn: () => fetchBankCase(caseId),
  });

  const stages = useQuery({
    queryKey: queryKeys.bankStages(true),
    queryFn: () => fetchBankStages(true),
    staleTime: 5 * 60_000,
  });

  if (detail.isPending || stages.isPending) return <BankCaseDetailSkeleton />;

  /**
   * Le retour à la liste est rendu AVANT l'état d'erreur, pas après.
   *
   * Une référence périmée (un signet, un lien collé dans un message) produit un
   * 404, que `QueryErrorState` ne propose pas de rejouer : recliquer ne fera pas
   * réapparaître un dossier supprimé. Sans ce lien, l'écran n'avait donc plus
   * aucune issue, et le bouton « Précédent » du navigateur n'est pas une
   * réponse de conception.
   */
  if (detail.isError) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/dossiers">Tous les dossiers</DetailBackLink>
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
        <DetailBackLink href="/dossiers">Tous les dossiers</DetailBackLink>
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
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankCase(caseId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankCasesRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankAnalyticsRoot });
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailBackLink href="/dossiers">Tous les dossiers</DetailBackLink>

      {/* ─── En-tête ─────────────────────────────────────────────────── */}
      <Card className="animate-rise">
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
              <dd className="truncate font-[600]">
                {bankCase.updatedByName ?? bankCase.createdByName}
              </dd>
            </div>
          </dl>

          {bankCase.rejectionReason !== null ? (
            <p className="rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.875rem] text-destructive">
              <span className="font-[600]">Rejeté : {bankCase.rejectionReason.label}.</span>
              {bankCase.rejectionDetail !== null && bankCase.rejectionDetail !== ''
                ? ` ${bankCase.rejectionDetail}`
                : ''}
            </p>
          ) : null}

          {/* ─── Actions ─────────────────────────────────────────────── */}
          {canAct ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              {/* L'action principale est ÉPINGLÉE en tête, en pleine variante :
                  faire avancer un dossier est le geste que l'agent répète
                  vingt fois par jour. Le rejet est à côté, en `destructive`
                  et sans place privilégiée : il ne doit jamais être le bouton
                  qu'on atteint par réflexe. */}
              {action.kind === 'advance' ? (
                <Button
                  type="button"
                  onClick={() => {
                    setAdvancing(true);
                  }}
                >
                  <ArrowRightIcon aria-hidden="true" />
                  Passer à « {action.target.label} »
                </Button>
              ) : action.kind === 'cash' ? (
                <Button
                  type="button"
                  onClick={() => {
                    setAdvancing(true);
                  }}
                >
                  <BanknoteIcon aria-hidden="true" />
                  Déclarer l’encaissement
                </Button>
              ) : (
                <p role="status" className="text-[0.8125rem] text-muted-foreground">
                  {action.reason}
                </p>
              )}

              {rejectedStage !== undefined && rejectedStage.isActive ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setRejecting(true);
                  }}
                >
                  <CircleSlashIcon aria-hidden="true" />
                  Rejeter le dossier
                </Button>
              ) : null}
            </div>
          ) : (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-[0.8125rem] text-muted-foreground"
            >
              <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {role === 'ADMIN'
                ? 'Étape terminale. Correction possible par un administrateur, avec justification.'
                : 'Étape terminale. Dossier verrouillé.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Historique ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
          Historique du dossier
        </h2>
        <Timeline history={detail.data.history} />
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

// ─── Chronologie ────────────────────────────────────────────────────────────

/**
 * Chronologie verticale, du plus ancien au plus récent : l'ordre dans lequel
 * l'API renvoie l'historique, et l'ordre dans lequel les faits se sont produits.
 *
 * Une `<ol>` et non une pile de `<div>` : c'est une séquence ordonnée, et un
 * lecteur d'écran doit l'annoncer comme telle (« liste de 5 éléments,
 * élément 3 sur 5 »). Le trait vertical et les pastilles sont purement
 * décoratifs, donc `aria-hidden`.
 */
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
                  // La présence d'un motif de correction distingue une
                  // rectification d'administrateur d'une avancée normale. Sans
                  // marque, l'historique laisserait croire à un parcours
                  // ordinaire là où quelqu'un est revenu en arrière.
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

// ─── Dialogue d'avancement / d'encaissement ─────────────────────────────────

function AdvanceDialog({
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
        // Le montant n'est envoyé QUE vers l'encaissement : posté vers une
        // étape ouverte, l'API répondrait BANK_CASE_AMOUNT_NOT_ALLOWED.
        ...(isCashing && amount !== null ? { amountXof: amount } : {}),
        ...(comment.trim() !== '' ? { comment } : {}),
      });
    },
    onSuccess: (result) => {
      onDone();
      // Le succès n'est annoncé qu'après la réponse du serveur, et il reprend
      // l'étape RÉELLEMENT atteinte plutôt que celle demandée.
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
          <DialogTitle>
            {isCashing ? 'Déclarer l’encaissement' : `Passer à « ${target?.label ?? ''} »`}
          </DialogTitle>
          <DialogDescription>
            {isCashing
              ? 'L’encaissement clôt le dossier. Correction possible ensuite par un administrateur.'
              : 'Étape suivante du flux ouvert.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {isCashing ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={amountId}>
                Montant encaissé
                <span className="text-destructive" aria-label="obligatoire">
                  *
                </span>
              </Label>
              <Input
                id={amountId}
                // `inputMode` et non `type="number"` : un champ numérique HTML
                // convertit la valeur en `number` côté DOM, ce qui perdrait de
                // la précision au-delà de 2^53 : exactement ce que le contrat
                // évite en exposant les montants en chaîne.
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={amount ?? ''}
                placeholder="1200000"
                aria-describedby={`${amountId}-apercu`}
                onChange={(event) => {
                  setAmount(parseMoneyInput(event.target.value));
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
                  <span className="font-[400] text-muted-foreground">
                    Montant strictement positif.
                  </span>
                ) : (
                  formatXof(amount)
                )}
              </p>
            </div>
          ) : null}

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
            // Verrouillé pendant l'envoi : deux clics enverraient deux
            // transitions, et la seconde échouerait en conflit de révision : ce
            // que l'agent lirait comme un échec alors que la première a réussi.
            disabled={advance.isPending || !amountValid}
            onClick={() => {
              advance.mutate();
            }}
          >
            {advance.isPending ? (
              <>
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                Enregistrement…
              </>
            ) : isCashing ? (
              'Confirmer l’encaissement'
            ) : (
              'Confirmer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialogue de rejet ──────────────────────────────────────────────────────

function RejectDialog({
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

  const selectedReason: BankRejectionReason | undefined = (reasons.data ?? []).find(
    (reason) => reason.id === reasonIdValue,
  );
  const detailRequired = selectedReason?.code === OTHER_REASON_CODE;

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

  const canSubmit =
    targetStageId !== null &&
    reasonIdValue !== null &&
    (!detailRequired || detail.trim() !== '') &&
    !reject.isPending;

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
                items={(reasons.data ?? []).map((reason) => ({
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
                  {(reasons.data ?? []).map((reason) => (
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

export function BankCaseDetailSkeleton() {
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
