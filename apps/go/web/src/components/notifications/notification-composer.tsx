import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { LoaderIcon, SendIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { RedactionForm } from '@/components/notifications/notification-redaction-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toastApiError } from '@/lib/mutation-feedback';
import type { Role } from '@/lib/types';
import {
  confirmationSentence,
  createNotification,
  fetchAudiencePreview,
  notificationKeys,
  type NotificationCategory,
  type SendableAudience,
} from '@/lib/data/notifications';

/** Dakar est UTC+0 toute l'année : la saisie locale est déjà l'heure universelle. */
function localToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(local)) return null;
  const parsed = new Date(`${local}:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function scheduleIssueFor(
  scheduleLater: boolean,
  scheduledIso: string | null,
  now: number,
): string | null {
  if (!scheduleLater) return null;
  if (scheduledIso === null || Date.parse(scheduledIso) <= now) {
    return 'Choisissez une date et une heure à venir.';
  }
  return null;
}

function redactionIssueFor(
  title: string,
  body: string,
  audience: SendableAudience,
  audienceRole: Role | null,
  audienceUserIds: readonly string[],
  scheduleIssue: string | null,
): string | null {
  if (title.trim() === '') return 'Le titre est obligatoire.';
  if (body.trim() === '') return 'Le message est obligatoire.';
  if (audience === 'ROLE' && audienceRole === null) return 'Choisissez un rôle.';
  if (audience === 'USERS' && audienceUserIds.length === 0) return 'Choisissez au moins un compte.';
  return scheduleIssue;
}

export function NotificationComposer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [now] = useState(() => Date.now());
  const [step, setStep] = useState<'redaction' | 'confirmation'>('redaction');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('ANNONCE');
  const [audience, setAudience] = useState<SendableAudience>('ALL');
  const [audienceRole, setAudienceRole] = useState<Role | null>(null);
  const [audienceUserIds, setAudienceUserIds] = useState<string[]>([]);
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState('');

  function reset(): void {
    setStep('redaction');
    setTitle('');
    setBody('');
    setCategory('ANNONCE');
    setAudience('ALL');
    setAudienceRole(null);
    setAudienceUserIds([]);
    setScheduleLater(false);
    setScheduledLocal('');
  }

  const scheduledIso = scheduleLater ? localToIso(scheduledLocal) : null;
  const scheduleIssue = scheduleIssueFor(scheduleLater, scheduledIso, now);
  const redactionIssue = redactionIssueFor(
    title,
    body,
    audience,
    audienceRole,
    audienceUserIds,
    scheduleIssue,
  );

  const previewQuery = {
    audience,
    ...(audience === 'ROLE' && audienceRole ? { audienceRole } : {}),
    ...(audience === 'USERS' && audienceUserIds.length > 0
      ? { audienceUserIds: audienceUserIds.join(',') }
      : {}),
  };
  const preview = useQuery({
    queryKey: notificationKeys.preview(previewQuery),
    queryFn: () => fetchAudiencePreview(previewQuery),
    enabled: open && step === 'confirmation',
  });

  const send = useMutation({
    mutationFn: () =>
      createNotification({
        title: title.trim(),
        body: body.trim(),
        category,
        audience,
        ...(audience === 'ROLE' && audienceRole ? { audienceRole } : {}),
        ...(audience === 'USERS' && audienceUserIds.length > 0 ? { audienceUserIds } : {}),
        ...(scheduledIso === null ? {} : { scheduledFor: scheduledIso }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.root });
      toast.success(scheduledIso === null ? 'Notification envoyée.' : 'Notification programmée.');
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'L’envoi a échoué.');
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'redaction' ? 'Nouvelle notification' : 'Confirmer l’envoi'}
          </DialogTitle>
          <DialogDescription>
            {step === 'redaction'
              ? 'Envoi aux destinataires choisis.'
              : 'L’envoi est irréversible.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'redaction' ? (
          <RedactionForm
            title={title}
            body={body}
            category={category}
            audience={audience}
            audienceRole={audienceRole}
            audienceUserIds={audienceUserIds}
            scheduleLater={scheduleLater}
            scheduledLocal={scheduledLocal}
            scheduleIssue={scheduleIssue}
            issue={redactionIssue}
            onTitle={setTitle}
            onBody={setBody}
            onCategory={setCategory}
            onAudience={setAudience}
            onAudienceRole={setAudienceRole}
            onAudienceUserIds={setAudienceUserIds}
            onScheduleLater={setScheduleLater}
            onScheduledLocal={setScheduledLocal}
            onContinue={() => {
              setStep('confirmation');
            }}
          />
        ) : (
          <ConfirmationStep
            title={title}
            body={body}
            preview={preview}
            sending={send.isPending}
            scheduled={scheduledIso !== null}
            onBack={() => {
              setStep('redaction');
            }}
            onSend={() => {
              send.mutate();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function previewMessage(preview: UseQueryResult<{ recipientCount: number }>): string {
  if (preview.isPending) return 'Calcul du public…';
  if (preview.isError) return 'Le public n’a pas pu être calculé.';
  return confirmationSentence(preview.data.recipientCount);
}

function ConfirmationStep({
  title,
  body,
  preview,
  sending,
  scheduled,
  onBack,
  onSend,
}: {
  title: string;
  body: string;
  preview: UseQueryResult<{ recipientCount: number }>;
  sending: boolean;
  scheduled: boolean;
  onBack: () => void;
  onSend: () => void;
}) {
  const canSend =
    !sending && !preview.isPending && !preview.isError && preview.data.recipientCount > 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem]">
        {previewMessage(preview)}
      </p>
      <p className="text-[0.9375rem] font-[600]">{title}</p>
      <p className="text-[0.875rem] text-muted-foreground">{body}</p>

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={sending} onClick={onBack}>
          Revenir
        </Button>
        <Button type="button" disabled={!canSend} onClick={onSend}>
          {sending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <SendIcon aria-hidden="true" />
          )}
          {scheduled ? 'Programmer' : 'Envoyer'}
        </Button>
      </DialogFooter>
    </div>
  );
}
