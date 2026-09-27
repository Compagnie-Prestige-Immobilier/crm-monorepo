'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon, PencilIcon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { QueryErrorState } from '@/components/query-error-state';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CALL_OUTCOME_COLORS,
  CALL_OUTCOME_COLOR_LABELS,
  CALL_OUTCOME_EFFECTS,
  CALL_OUTCOME_EFFECT_LABELS,
  createCallOutcomeReason,
  fetchCallOutcomeReasons,
  planifieUneDate,
  setCallOutcomeReasonActive,
  updateCallOutcomeReason,
  type CallOutcomeColor,
  type CallOutcomeEffect,
  type CallOutcomeReason,
} from '@/lib/data/call-outcome-reasons';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { stageBadgeVariant } from '@/lib/types';

const REASONS_KEY = [...queryKeys.referentielsRoot, 'issues-appel'] as const;

const estRacine = (reason: CallOutcomeReason): boolean => reason.parentId == null;

const classeLibelle = (reason: CallOutcomeReason): string =>
  estRacine(reason) ? 'font-[600]' : 'pl-8';

/** Le parent choisi impose son effet ; sans parent, l'effet est celui du formulaire. */
function deriverParent(racines: CallOutcomeReason[], parent: string, effect: CallOutcomeEffect) {
  const parentChoisi = racines.find((racine) => racine.id === parent) ?? null;
  return {
    parentChoisi,
    effetRetenu: parentChoisi === null ? effect : parentChoisi.effect,
    descriptionEffet: parentChoisi === null ? undefined : `Hérité de « ${parentChoisi.label} ».`,
    parents: [
      { value: AUCUN_PARENT, label: 'Aucun, motif de premier niveau' },
      ...racines.map((racine) => ({ value: racine.id, label: racine.label })),
    ],
  };
}

/** Chaque motif racine, suivi de ses précisions. */
const parBranche = (reasons: CallOutcomeReason[]): CallOutcomeReason[] =>
  reasons
    .filter(estRacine)
    .flatMap((racine) => [racine, ...reasons.filter((r) => r.parentId === racine.id)]);

export function CallOutcomeReasonsView() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CallOutcomeReason | null>(null);

  const query = useQuery({ queryKey: REASONS_KEY, queryFn: () => fetchCallOutcomeReasons() });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Issues proposées au téléconseiller à la fin d’un appel.
        </p>
        <Button
          type="button"
          onClick={() => {
            setCreating(true);
          }}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Nouveau motif
        </Button>
      </div>

      {query.isPending ? <Skeleton className="h-64 w-full" /> : null}

      {query.isError ? (
        <QueryErrorState
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : null}

      {query.data ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Effet sur le prospect</TableHead>
              <TableHead>Couleur</TableHead>
              <TableHead>Saisie exigée</TableHead>
              <TableHead>État</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Aucun motif d’issue. Ajoutez-en un pour qualifier les appels.
                </TableCell>
              </TableRow>
            ) : null}
            {parBranche(query.data).map((reason) => (
              <ReasonRow
                key={reason.id}
                reason={reason}
                onEdit={() => {
                  setEditing(reason);
                }}
              />
            ))}
          </TableBody>
        </Table>
      ) : null}

      <ReasonFormDialog
        open={creating}
        onOpenChange={setCreating}
        reason={undefined}
        racines={(query.data ?? []).filter((r) => estRacine(r) && r.isActive)}
        queryKey={REASONS_KEY}
      />
      <ReasonFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        reason={editing ?? undefined}
        racines={[]}
        queryKey={REASONS_KEY}
      />
    </div>
  );
}

function EtatMotif({ actif }: { actif: boolean }) {
  if (actif) return <Badge variant="success">En service</Badge>;
  return <Badge variant="secondary">Retiré des listes</Badge>;
}

function ReasonRow({ reason, onEdit }: { reason: CallOutcomeReason; onEdit: () => void }) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: () => setCallOutcomeReasonActive(reason.id, !reason.isActive),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      toast.success(saved.isActive ? `${saved.label} remis en service.` : `${saved.label} retiré.`);
    },
    onError: (error) => {
      toastApiError(error, 'Changement impossible. Réessayez.');
    },
  });

  const required = [
    reason.requiresComment ? 'commentaire' : null,
    reason.requiresCallback ? 'date de rappel' : null,
  ].filter((value) => value !== null);

  return (
    <TableRow data-inactive={!reason.isActive}>
      <TableCell className="font-mono text-[0.8125rem]">{reason.code}</TableCell>
      <TableCell className={classeLibelle(reason)}>
        {reason.label}
        {reason.isSystem ? (
          <Badge variant="secondary" className="ml-2">
            Système
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {CALL_OUTCOME_EFFECT_LABELS[reason.effect]}
      </TableCell>
      <TableCell>
        {reason.color === null ? (
          <span className="text-muted-foreground">Aucune</span>
        ) : (
          <Badge variant={stageBadgeVariant(reason.color)}>{colorLabel(reason.color)}</Badge>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {required.length === 0 ? 'Rien' : required.join(', ')}
      </TableCell>
      <TableCell>
        <EtatMotif actif={reason.isActive} />
      </TableCell>
      <TableCell className="text-right">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <PencilIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Modifier {reason.label}</span>
        </Button>
        {reason.isSystem ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={toggle.isPending}
            onClick={() => {
              toggle.mutate();
            }}
          >
            {reason.isActive ? (
              <PowerOffIcon className="size-4" aria-hidden="true" />
            ) : (
              <PowerIcon className="size-4" aria-hidden="true" />
            )}
            <span className="sr-only">
              {reason.isActive ? 'Retirer' : 'Remettre'} {reason.label}
            </span>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

interface ReasonFormValues {
  code: string;
  label: string;
  effect: CallOutcomeEffect;
  color: CallOutcomeColor | '';
  requiresComment: boolean;
  requiresCallback: boolean;
  countsAsReached: boolean;
  sortOrder: number;
  /** Identifiant du motif parent, ou la sentinelle `AUCUN_PARENT`. */
  parent: string;
}

/** La valeur d'un `Select` est une chaîne : la sentinelle devient `null` à l'enregistrement. */
const AUCUN_PARENT = 'AUCUN';

const EMPTY: ReasonFormValues = {
  code: '',
  label: '',
  effect: 'KEEP_OPEN',
  color: '',
  requiresComment: false,
  requiresCallback: false,
  countsAsReached: true,
  sortOrder: 100,
  parent: AUCUN_PARENT,
};

const AUCUNE_COULEUR = '';

const COLOR_ITEMS = [
  { value: AUCUNE_COULEUR, label: 'Aucune' },
  ...CALL_OUTCOME_COLORS.map((value) => ({ value, label: CALL_OUTCOME_COLOR_LABELS[value] })),
];

/** Un rôle hors liste vient d'ailleurs : on le montre tel quel plutôt que de le taire. */
const colorLabel = (color: string): string =>
  (CALL_OUTCOME_COLOR_LABELS as Record<string, string | undefined>)[color] ?? color;

const isKnownColor = (color: string | null): color is CallOutcomeColor =>
  color !== null && (CALL_OUTCOME_COLORS as readonly string[]).includes(color);

/** « Ne répond pas » propose NE_REPOND_PAS : le code suit le libellé tant qu'on ne l'a pas touché. */
const codeDepuis = (libelle: string): string =>
  libelle
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/gu, '_')
    .replace(/^[^A-Z]+/u, '')
    .replace(/_+$/u, '')
    .slice(0, 40);

const isLocked = (reason: CallOutcomeReason | undefined): boolean => reason?.isSystem ?? false;

function errorMessage(error?: { message?: string }): string | undefined {
  return error?.message;
}

function ReasonFormDialog({
  open,
  onOpenChange,
  reason,
  racines,
  queryKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: CallOutcomeReason | undefined;
  /** Les motifs de premier niveau qu'un nouveau motif peut préciser. */
  racines: CallOutcomeReason[];
  queryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();
  const isEdit = reason !== undefined;
  const locked = isLocked(reason);

  const { register, handleSubmit, reset, control, setValue, formState } = useForm<ReasonFormValues>(
    {
      defaultValues: EMPTY,
    },
  );

  const codeSaisi = useRef(false);

  useEffect(() => {
    if (!open) return;
    codeSaisi.current = false;
    reset(
      reason === undefined
        ? EMPTY
        : {
            code: reason.code,
            label: reason.label,
            effect: reason.effect,
            color: isKnownColor(reason.color) ? reason.color : AUCUNE_COULEUR,
            requiresComment: reason.requiresComment,
            requiresCallback: reason.requiresCallback,
            countsAsReached: reason.countsAsReached,
            sortOrder: reason.sortOrder,
            parent: reason.parentId ?? AUCUN_PARENT,
          },
    );
  }, [open, reason, reset]);

  const [effect, color, parent] = useWatch({ control, name: ['effect', 'color', 'parent'] });
  const { parentChoisi, effetRetenu, descriptionEffet, parents } = deriverParent(
    racines,
    parent,
    effect,
  );

  const mutation = useMutation({
    mutationFn: (values: ReasonFormValues) =>
      isEdit
        ? updateCallOutcomeReason(reason.id, {
            label: values.label,
            sortOrder: values.sortOrder,
            ...(values.color === AUCUNE_COULEUR ? {} : { color: values.color }),
            ...(locked
              ? {}
              : {
                  requiresComment: values.requiresComment,
                  requiresCallback: values.requiresCallback,
                  countsAsReached: values.countsAsReached,
                }),
          })
        : createCallOutcomeReason({
            code: values.code.trim().toUpperCase(),
            label: values.label.trim(),
            ...(values.parent === AUCUN_PARENT
              ? { effect: values.effect }
              : { parentId: values.parent }),
            ...(values.color === AUCUNE_COULEUR ? {} : { color: values.color }),
            requiresComment: values.requiresComment,
            requiresCallback: values.requiresCallback,
            countsAsReached: values.countsAsReached,
            sortOrder: values.sortOrder,
          }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      toast.success(isEdit ? `${saved.label} enregistré.` : `${saved.label} ajouté.`);
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'Enregistrement impossible. Réessayez.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le motif' : 'Nouveau motif d’issue'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Le code et l’effet ne changent pas : les appels déjà enregistrés les utilisent.'
              : 'Le code est définitif. L’effet décide de ce que devient le prospect après l’appel.'}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void handleSubmit((values) => {
              mutation.mutate(values);
            })(event);
          }}
        >
          <Field label="Libellé" required error={errorMessage(formState.errors.label)}>
            {(props) => (
              <Input
                {...props}
                placeholder="Ne répond pas"
                {...register('label', {
                  required: 'Le libellé est obligatoire.',
                  onChange: (event: { target: { value: string } }) => {
                    if (!isEdit && !codeSaisi.current) {
                      setValue('code', codeDepuis(event.target.value));
                    }
                  },
                })}
              />
            )}
          </Field>

          {isEdit ? null : (
            <Field
              label="Code"
              required
              description="Proposé depuis le libellé."
              error={errorMessage(formState.errors.code)}
            >
              {(props) => (
                <Input
                  {...props}
                  placeholder="NE_REPOND_PAS"
                  {...register('code', {
                    onChange: () => {
                      codeSaisi.current = true;
                    },
                    required: 'Le code est obligatoire.',
                    pattern: {
                      value: /^[A-Za-z][A-Za-z0-9_]*$/u,
                      message: 'Lettres, chiffres et tirets bas seulement.',
                    },
                  })}
                />
              )}
            </Field>
          )}

          {isEdit ? null : (
            <Field
              label="Précise le motif"
              description="Une précision hérite de l’effet de son motif."
            >
              {(props) => (
                <Select
                  items={parents}
                  value={parentChoisi === null ? AUCUN_PARENT : parentChoisi.id}
                  onValueChange={(value) => {
                    if (value !== null) setValue('parent', value);
                  }}
                >
                  <SelectTrigger id={props.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parents.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}

          {isEdit ? null : (
            <Field label="Effet sur le prospect" required description={descriptionEffet}>
              {(props) => (
                <Select
                  value={effetRetenu}
                  disabled={parentChoisi !== null}
                  onValueChange={(value) => {
                    setValue('effect', value as CallOutcomeEffect);
                    if (!planifieUneDate(value as CallOutcomeEffect))
                      setValue('requiresCallback', false);
                  }}
                >
                  <SelectTrigger id={props.id}>
                    <SelectValue>
                      {(value: CallOutcomeEffect) => CALL_OUTCOME_EFFECT_LABELS[value]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CALL_OUTCOME_EFFECTS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CALL_OUTCOME_EFFECT_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}

          <fieldset className="flex flex-col gap-2" disabled={locked}>
            <legend className="mb-1 text-[0.8125rem] font-medium">
              Ce que le téléconseiller doit saisir
            </legend>
            <CheckboxRow label="Un commentaire" {...register('requiresComment')} />
            <CheckboxRow
              label="Une date de rappel"
              disabled={!planifieUneDate(effect)}
              {...register('requiresCallback')}
            />
            <CheckboxRow
              label="L’appel compte comme joignable dans les statistiques"
              {...register('countsAsReached')}
            />
            {locked ? (
              <p className="text-[0.75rem] text-muted-foreground">
                Motif système : ces règles ne se changent pas.
              </p>
            ) : null}
          </fieldset>

          {/* L'API n'accepte pas de retirer une couleur : « Aucune » laisse en
              place celle déjà enregistrée. */}
          <Field label="Couleur de la pastille">
            {(props) => (
              <Select
                items={COLOR_ITEMS}
                value={color}
                onValueChange={(value) => {
                  if (value === null) return;
                  setValue('color', value);
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field
            label="Ordre d’affichage"
            required
            error={errorMessage(formState.errors.sortOrder)}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                {...register('sortOrder', {
                  // Champ vidé : `valueAsNumber` rend `NaN`, qui part en `null`
                  // dans le JSON et que la colonne refuse. Le message nomme le
                  // champ, là où l'API ne rendait qu'un 400 muet.
                  setValueAs: (raw: unknown) =>
                    String(raw).trim() === '' ? Number.NaN : Number(raw),
                  validate: (value: number) =>
                    Number.isInteger(value) && value >= 0
                      ? true
                      : 'Indiquez un entier positif, 0 compris.',
                })}
              />
            )}
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {isEdit ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckboxRow({
  label,
  disabled = false,
  ...props
}: { label: string; disabled?: boolean } & React.ComponentProps<'input'>) {
  return (
    <label className="flex items-center gap-2 text-[0.875rem]">
      <input type="checkbox" className="size-4" disabled={disabled} {...props} />
      {label}
    </label>
  );
}
