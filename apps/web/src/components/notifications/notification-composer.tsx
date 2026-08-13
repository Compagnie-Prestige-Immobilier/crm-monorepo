'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, CheckIcon, LoaderIcon, SendIcon, WifiOffIcon } from 'lucide-react';
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
} from './api';
import { renderNotification } from './template';
import {
  AUDIENCE_LABELS,
  CATEGORY_LABELS,
  ROLE_LABELS,
  type NotificationAudience,
  type NotificationCategory,
  type Role,
} from './types';

/**
 * Compositeur.
 *
 * DEUX ÉTAPES, ET LA SECONDE N'EST PAS DÉCORATIVE. Envoyer à 400 personnes ne
 * s'annule pas : la notification est sur les téléphones. L'étape de
 * confirmation existe pour qu'un nombre de destinataires — calculé par le
 * SERVEUR, avec exactement le filtre de l'envoi — soit lu avant que le geste
 * ne devienne irréversible. Le bouton d'envoi reste bloqué tant que ce nombre
 * n'a pas abouti : confirmer sans l'avoir vu annulerait tout l'intérêt de
 * l'étape.
 *
 * L'aperçu Android, lui, vit dans la PREMIÈRE étape, à côté du texte : c'est là
 * qu'on corrige une phrase, pas au moment de confirmer.
 */

type Step = 'redaction' | 'confirmation';
type When = 'now' | 'later';

const CATEGORIES: NotificationCategory[] = ['ANNONCE', 'RAPPEL', 'CAMPAGNE', 'DOSSIER', 'SYSTEME'];
const AUDIENCES: NotificationAudience[] = ['ALL', 'ROLE', 'DEPARTEMENT', 'USERS'];
const ROLES: Role[] = ['ADMIN', 'COMMERCIAL', 'BANQUE_FINANCE'];

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
    // Remise à zéro à la FERMETURE et non à l'ouverture : rouvrir après une
    // erreur réseau doit retrouver le texte, pas un formulaire vide.
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
    queryFn: fetchDepartements,
    enabled: open && selection.audience === 'DEPARTEMENT',
    staleTime: 300_000,
  });

  const template = templates.data?.items.find((item) => item.id === templateId);

  // Le texte affiché — et envoyé — est le texte SUBSTITUÉ. L'aperçu montre donc
  // exactement ce qui partira, gabarit compris.
  const rendered = useMemo(
    () => renderNotification(title, body, variables),
    [title, body, variables],
  );

  const audienceIssue = audienceProblem(selection);
  const routeIssue = routeProblem(route);
  const scheduleIssue =
    when === 'later' && (scheduledFor === '' || new Date(scheduledFor).getTime() <= Date.now())
      ? 'Choisissez une date et une heure à venir.'
      : null;

  const textIssue =
    title.trim() === '' || body.trim() === '' ? 'Le titre et le corps sont obligatoires.' : null;

  const blocking = textIssue ?? audienceIssue ?? routeIssue ?? scheduleIssue;

  const previewQuery = audienceQuery(selection);
  const preview = useQuery({
    queryKey: notificationKeys.preview(previewQuery),
    queryFn: () => fetchAudiencePreview(previewQuery),
    // Le nombre n'est demandé qu'à l'étape de confirmation : le calculer à
    // chaque frappe interrogerait le serveur pour rien.
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
        ...(when === 'later' ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
        ...(templateId === '' ? {} : { templateId }),
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.root });

      if (created.status === 'SCHEDULED') {
        toast.success('Notification programmée. Annulable jusqu’au départ.');
      } else if (created.transportStatus === 'NOT_CONFIGURED') {
        // Le pire message possible serait « Envoyée » alors que rien n'est
        // parti. On le dit, et on dit pourquoi.
        toast.warning(
          `Enregistrée pour ${String(created.counts.total)} destinataire(s). Aucun push remis : Firebase n’est pas configuré.`,
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
                      value={templateId}
                      onValueChange={(value) => {
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
                      value={category}
                      onValueChange={(value) => {
                        setCategory(value as NotificationCategory);
                      }}
                    >
                      <SelectTrigger id={props.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {CATEGORY_LABELS[item]}
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
                    value={selection.audience}
                    onValueChange={(value) => {
                      setSelection({
                        ...EMPTY_AUDIENCE,
                        audience: value as NotificationAudience,
                      });
                    }}
                  >
                    <SelectTrigger id={props.id} aria-invalid={props['aria-invalid']}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {AUDIENCE_LABELS[item]}
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
                      value={selection.audienceRole ?? ''}
                      onValueChange={(value) => {
                        setSelection((current) => ({ ...current, audienceRole: value as Role }));
                      }}
                    >
                      <SelectTrigger id={props.id}>
                        <SelectValue placeholder="Choisir un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {ROLE_LABELS[item]}
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
                      value={selection.audienceDepartementId ?? ''}
                      onValueChange={(value) => {
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
                      <Input
                        {...props}
                        type="datetime-local"
                        value={scheduledFor}
                        onChange={(event) => {
                          setScheduledFor(event.target.value);
                        }}
                      />
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
                // Bloqué tant que le nombre n'a pas abouti : confirmer sans
                // l'avoir lu viderait l'étape de son seul contenu utile.
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
  preview:
    | {
        recipientCount: number;
        reachableCount: number;
        transportConfigured: boolean;
        transportReason: string | null;
      }
    | undefined;
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
                {confirmationSentence(preview.recipientCount, preview.reachableCount)}
              </p>
            </>
          ) : null}
        </div>

        {preview && !preview.transportConfigured ? (
          <div className="flex gap-3 rounded-[var(--radius-md)] border border-accent-border/30 bg-warning-surface p-3">
            <WifiOffIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="text-[0.8125rem]">
              <p className="font-[600] text-warning">Aucun push ne sera remis</p>
              <p className="mt-0.5 text-muted-foreground">
                {preview.transportReason ?? 'Firebase n’est pas configuré.'} Notification
                enregistrée, visible dans l’application.
              </p>
            </div>
          </div>
        ) : null}

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
              {when === 'later' && scheduledFor !== '' ? (
                <span className="ml-2 text-muted-foreground">
                  {new Date(scheduledFor).toLocaleString('fr-SN')}
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
