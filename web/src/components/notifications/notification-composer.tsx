'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { AlertTriangleIcon, CheckIcon, LoaderIcon, SendIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { dakarLocalToIso, formatDakarDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { cn } from '@/lib/utils';
import { ApercuNotification } from './apercu-notification';
import {
  EMPTY_AUDIENCE,
  KNOWN_ROUTES,
  SENDABLE_AUDIENCES,
  audienceProblem,
  audienceQuery,
  confirmationSentence,
  routeProblem,
  type AudienceSelection,
} from './audience';
import {
  createNotification,
  fetchAudiencePreview,
  notificationKeys,
} from '@/lib/data/notifications';
import {
  AUDIENCE_LABELS,
  CATEGORY_LABELS,
  ROLE_LABELS,
  type AudiencePreview,
  type NotificationCategory,
  type Role,
} from './types';

type Step = 'redaction' | 'confirmation';
type When = 'now' | 'later';

const CATEGORIES: NotificationCategory[] = ['ANNONCE', 'RAPPEL', 'DOSSIER', 'SYSTEME'];
const ROLES: Role[] = [
  'ADMIN',
  'COMMERCIAL',
  'BANQUE_FINANCE',
  'SUPERVISEUR',
  'DIRECTION',
  'ACCUEIL',
  'CHARGE_CLIENTELE',
];

const CATEGORY_ITEMS = CATEGORIES.map((item) => ({ value: item, label: CATEGORY_LABELS[item] }));
const AUDIENCE_ITEMS = SENDABLE_AUDIENCES.map((item) => ({
  value: item,
  label: AUDIENCE_LABELS[item],
}));
const ROLE_ITEMS = ROLES.map((item) => ({ value: item, label: ROLE_LABELS[item] }));

const TITLE_MAX = 120;
const BODY_MAX = 500;

/** L'échéance se valide à chaque frappe : l'horloge avance pendant la saisie. */
function echeanceDe(
  when: When,
  scheduledFor: string,
): { iso: string | null; issue: string | null } {
  if (when !== 'later') return { iso: null, issue: null };
  const iso = dakarLocalToIso(scheduledFor);
  if (iso === null || Date.parse(iso) <= Date.now()) {
    return { iso, issue: 'Choisissez une date et une heure à venir.' };
  }
  return { iso, issue: null };
}

function problemeDeTexte(saisi: string, max: number, label: string): string | null {
  if (saisi.trim() === '') return `${label} est obligatoire.`;
  if (saisi.length > max) {
    return `${label} fait ${String(saisi.length)} caractères, ${String(max)} au maximum.`;
  }
  return null;
}

function premierBlocage(issues: readonly (string | null)[]): string | null {
  return issues.find((issue) => issue !== null) ?? null;
}

function previewEnabled(open: boolean, step: Step, audienceIssue: string | null): boolean {
  return open && step === 'confirmation' && audienceIssue === null;
}

function canSend(sendPending: boolean, preview: UseQueryResult<AudiencePreview>): boolean {
  return !sendPending && !preview.isPending && !preview.isError && preview.data.recipientCount > 0;
}

function requiredFieldIssue(value: string, issue: string | null): string | undefined {
  if (value.trim() === '') return undefined;
  return issue ?? undefined;
}

function orUndefined(value: string | null): string | undefined {
  return value ?? undefined;
}

function EnTeteComposer({ step }: { step: Step }) {
  const redaction = step === 'redaction';

  return (
    <DialogHeader>
      <DialogTitle>{redaction ? 'Nouvelle notification' : 'Confirmer l’envoi'}</DialogTitle>
      <DialogDescription>
        {redaction
          ? 'Remise par courriel et dans la boîte de réception des destinataires choisis.'
          : 'L’envoi est irréversible.'}
      </DialogDescription>
    </DialogHeader>
  );
}

function PiedComposer({
  step,
  blocking,
  when,
  envoiPossible,
  envoiEnCours,
  onAnnuler,
  onEtape,
  onEnvoyer,
}: {
  step: Step;
  blocking: string | null;
  when: When;
  envoiPossible: boolean;
  envoiEnCours: boolean;
  onAnnuler: () => void;
  onEtape: (step: Step) => void;
  onEnvoyer: () => void;
}) {
  if (step === 'redaction') {
    return (
      <>
        <Button type="button" variant="ghost" onClick={onAnnuler}>
          Annuler
        </Button>
        <Button
          type="button"
          disabled={blocking !== null}
          title={blocking ?? undefined}
          onClick={() => {
            onEtape('confirmation');
          }}
        >
          <SendIcon aria-hidden="true" />
          Voir les destinataires
        </Button>
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          onEtape('redaction');
        }}
      >
        Modifier
      </Button>
      <Button type="button" disabled={!envoiPossible} onClick={onEnvoyer}>
        {envoiEnCours ? (
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CheckIcon aria-hidden="true" />
        )}
        {when === 'later' ? 'Programmer' : 'Envoyer maintenant'}
      </Button>
    </>
  );
}

function ChampsAudience({
  selection,
  onChange,
}: {
  selection: AudienceSelection;
  onChange: Dispatch<SetStateAction<AudienceSelection>>;
}) {
  if (selection.audience === 'ROLE') {
    return (
      <Field label="Rôle" required>
        {(props) => (
          <Select
            items={ROLE_ITEMS}
            value={selection.audienceRole ?? ''}
            onValueChange={(value) => {
              if (value === null) return;
              onChange((current) => ({ ...current, audienceRole: value as Role }));
            }}
          >
            <SelectTrigger id={props.id}>
              <SelectValue placeholder="Choisir un rôle" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    );
  }

  if (selection.audience === 'USERS') {
    return (
      <Field label="Identifiants des comptes" required description="Un identifiant par ligne.">
        {(props) => (
          <Textarea
            {...props}
            value={selection.audienceUserIds.join('\n')}
            onChange={(event) => {
              onChange((current) => ({
                ...current,
                audienceUserIds: event.target.value
                  .split(/[\s,]+/)
                  .map((value) => value.trim())
                  .filter((value) => value !== ''),
              }));
            }}
          />
        )}
      </Field>
    );
  }

  return null;
}

function ChampQuand({
  when,
  onWhen,
  scheduledFor,
  onScheduledFor,
  scheduleIssue,
}: {
  when: When;
  onWhen: (when: When) => void;
  scheduledFor: string;
  onScheduledFor: (value: string) => void;
  scheduleIssue: string | null;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[0.8125rem] font-[600]">Quand</legend>
      <div className="flex flex-wrap gap-4">
        {(['now', 'later'] as const).map((value) => (
          <label
            key={value}
            className="flex min-h-11 cursor-pointer items-center gap-2 text-[0.9375rem]"
          >
            <input
              type="radio"
              name="cpi-notification-when"
              className="size-4 accent-[var(--primary)]"
              checked={when === value}
              onChange={() => {
                onWhen(value);
              }}
            />
            {value === 'now' ? 'Envoyer maintenant' : 'Programmer'}
          </label>
        ))}
      </div>
      {when === 'later' ? (
        <Field label="Date et heure" required error={scheduleIssue ?? undefined}>
          {(props) => (
            <>
              <Input
                {...props}
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => {
                  onScheduledFor(event.target.value);
                }}
              />
              {/* Le fuseau du CHAMP, dit une fois, sous le champ : l'entrée
                  `datetime-local` n'en porte aucun, et le navigateur affiche
                  l'heure du poste sans l'annoncer. */}
              <p className="mt-1 text-[0.75rem] text-muted-foreground">
                Heure de Dakar (UTC+0), quel que soit le fuseau de ce poste.
              </p>
            </>
          )}
        </Field>
      ) : null}
    </fieldset>
  );
}

export function NotificationComposer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const titleId = useId();

  const [step, setStep] = useState<Step>('redaction');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('ANNONCE');
  const [route, setRoute] = useState('');
  const [selection, setSelection] = useState<AudienceSelection>(EMPTY_AUDIENCE);
  const [when, setWhen] = useState<When>('now');
  const [scheduledFor, setScheduledFor] = useState('');

  useEffect(() => {
    if (open) return;
    // oxlint-disable-next-line react/set-state-in-effect -- remise à zéro à la fermeture
    setStep('redaction');
  }, [open]);

  const rendered = useMemo(() => ({ title: title.trim(), body: body.trim() }), [title, body]);

  const audienceIssue = audienceProblem(selection);
  const routeIssue = routeProblem(route);
  const { iso: scheduledIso, issue: scheduleIssue } = echeanceDe(when, scheduledFor);

  const titleIssue = problemeDeTexte(title, TITLE_MAX, 'Le titre');
  const bodyIssue = problemeDeTexte(body, BODY_MAX, 'Le message');

  const blocking = premierBlocage([
    titleIssue,
    bodyIssue,
    audienceIssue,
    routeIssue,
    scheduleIssue,
  ]);

  const previewQuery = audienceQuery(selection);
  const preview = useQuery({
    queryKey: notificationKeys.preview(previewQuery),
    queryFn: () => fetchAudiencePreview(previewQuery),
    enabled: previewEnabled(open, step, audienceIssue),
    staleTime: 15_000,
  });

  const send = useMutation({
    mutationFn: () =>
      createNotification({
        title: rendered.title,
        body: rendered.body,
        category,
        audience: selection.audience,
        ...(route.trim() === '' ? {} : { route: route.trim() }),
        ...(selection.audienceRole === null ? {} : { audienceRole: selection.audienceRole }),
        ...(selection.audienceUserIds.length === 0
          ? {}
          : { audienceUserIds: selection.audienceUserIds }),
        ...(when === 'later' && scheduledIso !== null ? { scheduledFor: scheduledIso } : {}),
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.root });

      if (created.status === 'SCHEDULED') {
        toast.success('Notification programmée. Annulable jusqu’au départ.');
      } else if (created.transportStatus === 'NOT_CONFIGURED') {
        toast.warning(
          `Enregistrée pour ${String(created.counts.total)} destinataire(s), lisible dans leur boîte de réception. Aucun courriel remis : le service d’envoi n’est pas configuré.`,
          { duration: 12_000 },
        );
      } else if (created.counts.failed > 0) {
        toast.warning(
          `Envoyée à ${String(created.counts.sent)} destinataire(s), ${String(created.counts.failed)} échec(s).`,
        );
      } else {
        toast.success(`Envoyée à ${String(created.counts.sent)} destinataire(s).`);
      }

      onOpenChange(false);
      setTitle('');
      setBody('');
      setRoute('');
      setSelection(EMPTY_AUDIENCE);
      setWhen('now');
      setScheduledFor('');
    },
    onError: (error) => {
      toastApiError(error, 'L’envoi a échoué.');
      setStep('redaction');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <EnTeteComposer step={step} />

        {step === 'redaction' ? (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <Field
                label="Titre"
                required
                description={`${String(title.length)} / ${String(TITLE_MAX)} caractères`}
                error={requiredFieldIssue(title, titleIssue)}
              >
                {(props) => (
                  <Input
                    {...props}
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                    }}
                  />
                )}
              </Field>

              <Field
                label="Message"
                required
                description={`${String(body.length)} / ${String(BODY_MAX)} caractères`}
                error={requiredFieldIssue(body, bodyIssue)}
              >
                {(props) => (
                  <Textarea
                    {...props}
                    value={body}
                    onChange={(event) => {
                      setBody(event.target.value);
                    }}
                  />
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Catégorie">
                  {(props) => (
                    <Select
                      items={CATEGORY_ITEMS}
                      value={category}
                      onValueChange={(value) => {
                        if (value === null) return;
                        setCategory(value);
                      }}
                    >
                      <SelectTrigger id={props.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                <Field
                  label="Lien profond"
                  description="Route interne ouverte au tap."
                  error={orUndefined(routeIssue)}
                >
                  {(props) => (
                    <Input
                      {...props}
                      list="cpi-routes"
                      value={route}
                      placeholder="/phase2"
                      onChange={(event) => {
                        setRoute(event.target.value);
                      }}
                    />
                  )}
                </Field>
              </div>
              <datalist id="cpi-routes">
                {KNOWN_ROUTES.map((known) => (
                  <option key={known.path} value={known.path}>
                    {known.label}
                  </option>
                ))}
              </datalist>

              <Field label="Destinataires" required error={orUndefined(audienceIssue)}>
                {(props) => (
                  <Select
                    items={AUDIENCE_ITEMS}
                    value={selection.audience}
                    onValueChange={(value) => {
                      if (value === null) return;
                      setSelection({
                        ...EMPTY_AUDIENCE,
                        audience: value,
                      });
                    }}
                  >
                    <SelectTrigger id={props.id} aria-invalid={props['aria-invalid']}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <ChampsAudience selection={selection} onChange={setSelection} />

              <ChampQuand
                when={when}
                onWhen={setWhen}
                scheduledFor={scheduledFor}
                onScheduledFor={setScheduledFor}
                scheduleIssue={scheduleIssue}
              />
            </div>

            {/* L'aperçu est collant : il reste visible pendant qu'on fait
                défiler un formulaire plus haut que l'écran. Un aperçu qu'il
                faut aller chercher n'est pas relu. */}
            <div className="md:sticky md:top-0 md:self-start">
              <ApercuNotification title={rendered.title} body={rendered.body} route={route} />
            </div>
          </div>
        ) : (
          <ConfirmationStep
            title={rendered.title}
            body={rendered.body}
            route={route}
            when={when}
            scheduledFor={scheduledFor}
            preview={preview.data}
            isPending={preview.isPending}
            isError={preview.isError}
          />
        )}

        <DialogFooter>
          <PiedComposer
            step={step}
            blocking={blocking}
            when={when}
            envoiPossible={canSend(send.isPending, preview)}
            envoiEnCours={send.isPending}
            onAnnuler={() => {
              onOpenChange(false);
            }}
            onEtape={setStep}
            onEnvoyer={() => {
              send.mutate();
            }}
          />
        </DialogFooter>

        <span id={titleId} className="sr-only">
          Compositeur de notification
        </span>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmationStep({
  title,
  body,
  route,
  when,
  scheduledFor,
  preview,
  isPending,
  isError,
}: {
  title: string;
  body: string;
  route: string;
  when: When;
  scheduledFor: string;
  preview: { recipientCount: number } | undefined;
  isPending: boolean;
  isError: boolean;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <div
          role="status"
          className={cn(
            'rounded-[var(--radius-md)] border p-4',
            preview && preview.recipientCount > 0
              ? 'border-border bg-secondary'
              : 'border-destructive/30 bg-destructive-surface',
          )}
        >
          {(() => {
            if (isPending)
              return (
                <p className="flex items-center gap-2 text-[0.9375rem] text-muted-foreground">
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Calcul du nombre de destinataires…
                </p>
              );
            return (() => {
              if (isError)
                return (
                  <p className="text-[0.9375rem] text-destructive">
                    Le nombre de destinataires n’a pas pu être calculé. Envoi bloqué.
                  </p>
                );
              return (() => {
                if (preview)
                  return (
                    <>
                      <p className="font-display text-[1.5rem] font-[700] tracking-[-0.02em]">
                        {preview.recipientCount === 1
                          ? '1 destinataire'
                          : `${String(preview.recipientCount)} destinataires`}
                      </p>
                      <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                        {confirmationSentence(preview.recipientCount)}
                      </p>
                    </>
                  );
                return null;
              })();
            })();
          })()}
        </div>

        <dl className="grid gap-2 text-[0.875rem]">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">Titre</dt>
            <dd className="min-w-0 font-[600] break-words">{title}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">Message</dt>
            <dd className="min-w-0 break-words">{body}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">Lien</dt>
            <dd className="min-w-0 break-words">
              {route.trim() === '' ? (
                <span className="text-muted-foreground">Aucun</span>
              ) : (
                <code className="font-mono">{route.trim()}</code>
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">Départ</dt>
            <dd className="min-w-0">
              {when === 'now' ? (
                <Badge variant="destructive">
                  <AlertTriangleIcon aria-hidden="true" />
                  Immédiat et irréversible
                </Badge>
              ) : (
                <Badge variant="info">Programmé, annulable jusqu’au départ</Badge>
              )}
              {/* Le fuseau est ÉCRIT, pas déduit : c'est la dernière ligne lue
                  avant d'engager un envoi, et « 09:00 » ne veut rien dire pour
                  quelqu'un qui n'est pas à Dakar ce jour-là. */}
              {when === 'later' && formatDakarDateTime(scheduledFor) !== null ? (
                <span className="ml-2 text-muted-foreground">
                  {formatDakarDateTime(scheduledFor)}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </div>

      <div className="md:sticky md:top-0 md:self-start">
        <ApercuNotification title={title} body={body} route={route} />
      </div>
    </div>
  );
}
