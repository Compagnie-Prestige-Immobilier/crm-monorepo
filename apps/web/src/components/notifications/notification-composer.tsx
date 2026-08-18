'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, CheckIcon, LoaderIcon, SendIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
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
import { AndroidPreview } from './android-preview';
import {
  EMPTY_AUDIENCE,
  KNOWN_ROUTES,
  audienceProblem,
  audienceQuery,
  confirmationSentence,
  routeProblem,
  type AudienceSelection,
} from './audience';
import {
  createNotification,
  fetchAudiencePreview,
  fetchDepartements,
  fetchTemplates,
  notificationKeys,
} from '@/lib/data/notifications';
import { renderNotification } from './template';
import {
  AUDIENCE_LABELS,
  CATEGORY_LABELS,
  ROLE_LABELS,
  type NotificationAudience,
  type NotificationCategory,
  type Role,
} from './types';

type Step = 'redaction' | 'confirmation';
type When = 'now' | 'later';

const CATEGORIES: NotificationCategory[] = ['ANNONCE', 'RAPPEL', 'CAMPAGNE', 'DOSSIER', 'SYSTEME'];
const AUDIENCES: NotificationAudience[] = ['ALL', 'ROLE', 'DEPARTEMENT', 'USERS'];
const ROLES: Role[] = ['ADMIN', 'COMMERCIAL', 'BANQUE_FINANCE', 'SUPERVISEUR'];

const CATEGORY_ITEMS = CATEGORIES.map((item) => ({ value: item, label: CATEGORY_LABELS[item] }));
const AUDIENCE_ITEMS = AUDIENCES.map((item) => ({ value: item, label: AUDIENCE_LABELS[item] }));
const ROLE_ITEMS = ROLES.map((item) => ({ value: item, label: ROLE_LABELS[item] }));

const TITLE_MAX = 120;
const BODY_MAX = 500;

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
  const [templateId, setTemplateId] = useState<string>('');
  const [variables, setVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) return;
    setStep('redaction');
  }, [open]);

  const templates = useQuery({
    queryKey: notificationKeys.templates,
    queryFn: () => fetchTemplates(),
    enabled: open,
    staleTime: 60_000,
  });

  const departements = useQuery({
    queryKey: notificationKeys.departements,
    queryFn: () => fetchDepartements(),
    enabled: open && selection.audience === 'DEPARTEMENT',
    staleTime: 300_000,
  });

  const template = templates.data?.items.find((item) => item.id === templateId);

  const rendered = useMemo(
    () => renderNotification(title, body, variables),
    [title, body, variables],
  );

  const audienceIssue = audienceProblem(selection);
  const routeIssue = routeProblem(route);
  const scheduledIso = when === 'later' ? dakarLocalToIso(scheduledFor) : null;
  const scheduleIssue =
    when === 'later' && (scheduledIso === null || Date.parse(scheduledIso) <= Date.now())
      ? 'Choisissez une date et une heure à venir.'
      : null;

  const textIssue =
    title.trim() === '' || body.trim() === '' ? 'Le titre et le corps sont obligatoires.' : null;

  const blocking = textIssue ?? audienceIssue ?? routeIssue ?? scheduleIssue;

  const previewQuery = audienceQuery(selection);
  const preview = useQuery({
    queryKey: notificationKeys.preview(previewQuery),
    queryFn: () => fetchAudiencePreview(previewQuery),
    enabled: open && step === 'confirmation' && audienceIssue === null,
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
        ...(selection.audienceDepartementId === null
          ? {}
          : { audienceDepartementId: selection.audienceDepartementId }),
        ...(selection.audienceUserIds.length === 0
          ? {}
          : { audienceUserIds: selection.audienceUserIds }),
        ...(when === 'later' && scheduledIso !== null ? { scheduledFor: scheduledIso } : {}),
        ...(templateId === '' ? {} : { templateId }),
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.root });

      if (created.status === 'SCHEDULED') {
        toast.success('Notification programmée. Annulable jusqu’au départ.');
      } else if (created.transportStatus === 'NOT_CONFIGURED') {
        toast.warning(
          `Enregistrée pour ${String(created.counts.total)} destinataire(s), et lisible dans l’application. Aucun e-mail remis : le service d’envoi n’est pas configuré.`,
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
      setTemplateId('');
      setVariables({});
    },
    onError: (error) => {
      toastApiError(error, 'L’envoi a échoué.');
      setStep('redaction');
    },
  });

  const applyTemplate = (id: string): void => {
    setTemplateId(id);
    const chosen = templates.data?.items.find((item) => item.id === id);
    if (!chosen) return;
    setTitle(chosen.titleTemplate);
    setBody(chosen.bodyTemplate);
    setCategory(chosen.category);
    setRoute(chosen.route ?? '');
    setVariables(Object.fromEntries(chosen.variables.map((name) => [name, ''])));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'redaction' ? 'Nouvelle notification' : 'Confirmer l’envoi'}
          </DialogTitle>
          <DialogDescription>
            {step === 'redaction'
              ? 'Envoi push aux destinataires choisis.'
              : 'L’envoi est irréversible.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'redaction' ? (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-4">
              {templates.data && templates.data.items.length > 0 ? (
                <Field label="Gabarit" description="Facultatif.">
                  {(props) => (
                    <Select
                      items={templates.data.items.map((item) => ({
                        value: item.id,
                        label: item.name,
                      }))}
                      value={templateId}
                      onValueChange={(value) => {
                        if (value === null) return;
                        applyTemplate(value);
                      }}
                    >
                      <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
                        <SelectValue placeholder="Aucun gabarit" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.data.items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              ) : null}

              {template && template.variables.length > 0 ? (
                <fieldset className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-secondary/40 p-3">
                  <legend className="px-1 text-[0.75rem] font-[600]">Variables</legend>
                  {template.variables.map((name) => (
                    <Field key={name} label={name}>
                      {(props) => (
                        <Input
                          {...props}
                          value={variables[name] ?? ''}
                          onChange={(event) => {
                            setVariables((current) => ({
                              ...current,
                              [name]: event.target.value,
                            }));
                          }}
                        />
                      )}
                    </Field>
                  ))}
                  {rendered.missing.length > 0 ? (
                    <p role="status" className="text-[0.75rem] text-warning">
                      Non renseignée(s) : {rendered.missing.join(', ')}.
                    </p>
                  ) : null}
                </fieldset>
              ) : null}

              <Field
                label="Titre"
                required
                description={`${String(title.length)} / ${String(TITLE_MAX)} caractères`}
              >
                {(props) => (
                  <Input
                    {...props}
                    maxLength={TITLE_MAX}
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
              >
                {(props) => (
                  <Textarea
                    {...props}
                    maxLength={BODY_MAX}
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
                  error={routeIssue ?? undefined}
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

              <Field label="Destinataires" required error={audienceIssue ?? undefined}>
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

              {selection.audience === 'ROLE' ? (
                <Field label="Rôle" required>
                  {(props) => (
                    <Select
                      items={ROLE_ITEMS}
                      value={selection.audienceRole ?? ''}
                      onValueChange={(value) => {
                        if (value === null) return;
                        setSelection((current) => ({ ...current, audienceRole: value as Role }));
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
              ) : null}

              {selection.audience === 'DEPARTEMENT' ? (
                <Field label="Département" required>
                  {(props) => (
                    <Select
                      items={(departements.data ?? []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      }))}
                      value={selection.audienceDepartementId ?? ''}
                      onValueChange={(value) => {
                        if (value === null) return;
                        setSelection((current) => ({
                          ...current,
                          audienceDepartementId: value,
                        }));
                      }}
                    >
                      <SelectTrigger id={props.id}>
                        <SelectValue
                          placeholder={
                            departements.isPending ? 'Chargement…' : 'Choisir un département'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(departements.data ?? []).map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              ) : null}

              {selection.audience === 'USERS' ? (
                <Field
                  label="Identifiants des comptes"
                  required
                  description="Un identifiant par ligne."
                >
                  {(props) => (
                    <Textarea
                      {...props}
                      value={selection.audienceUserIds.join('\n')}
                      onChange={(event) => {
                        setSelection((current) => ({
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
              ) : null}

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
                          setWhen(value);
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
                            setScheduledFor(event.target.value);
                          }}
                        />
                        {/* Le fuseau du CHAMP, dit une fois, sous le champ :
                            l'entrée `datetime-local` n'en porte aucun, et le
                            navigateur affiche l'heure du poste sans l'annoncer. */}
                        <p className="mt-1 text-[0.75rem] text-muted-foreground">
                          Heure de Dakar (UTC+0), quel que soit le fuseau de ce poste.
                        </p>
                      </>
                    )}
                  </Field>
                ) : null}
              </fieldset>
            </div>

            {/* L'aperçu est collant : il reste visible pendant qu'on fait
                défiler un formulaire plus haut que l'écran. Un aperçu qu'il
                faut aller chercher n'est pas relu. */}
            <div className="md:sticky md:top-0 md:self-start">
              <AndroidPreview title={rendered.title} body={rendered.body} route={route} />
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
          {step === 'redaction' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={blocking !== null}
                title={blocking ?? undefined}
                onClick={() => {
                  setStep('confirmation');
                }}
              >
                <SendIcon aria-hidden="true" />
                Voir les destinataires
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep('redaction');
                }}
              >
                Modifier
              </Button>
              <Button
                type="button"
                disabled={
                  send.isPending ||
                  preview.isPending ||
                  preview.isError ||
                  preview.data.recipientCount === 0
                }
                onClick={() => {
                  send.mutate();
                }}
              >
                {send.isPending ? (
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckIcon aria-hidden="true" />
                )}
                {when === 'later' ? 'Programmer' : 'Envoyer maintenant'}
              </Button>
            </>
          )}
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
          {isPending ? (
            <p className="flex items-center gap-2 text-[0.9375rem] text-muted-foreground">
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              Calcul du nombre de destinataires…
            </p>
          ) : isError ? (
            <p className="text-[0.9375rem] text-destructive">
              Le nombre de destinataires n’a pas pu être calculé. Envoi bloqué.
            </p>
          ) : preview ? (
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
          ) : null}
        </div>

        {/* L'avertissement « Aucun push ne sera remis » a disparu avec le push
            lui-même : `AudiencePreviewDto` ne porte plus ni `transportConfigured`
            ni `transportReason`, et tout compte visé lit la notification dans
            l'application. Le bloc ne testait donc plus que des `undefined`, et
            s'affichait à chaque envoi. */}

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
        <AndroidPreview title={title} body={body} route={route} />
      </div>
    </div>
  );
}
