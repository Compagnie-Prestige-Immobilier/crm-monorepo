'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@crm/api-client/query';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LoaderIcon,
  LockIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
} from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { StageBadge } from '@/components/bank/stage-badge';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  allOpenStages,
  createBankStage,
  fetchBankStages,
  reorderBankStages,
  setBankStageActive,
  updateBankStage,
} from '@/lib/data/bank-cases';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { BANK_STAGE_TYPE_LABELS, type BankCaseStage } from '@/lib/types';

const COLOR_ROLES: readonly { value: string; label: string }[] = [
  { value: 'info', label: 'Information (rose CPI)' },
  { value: 'warning', label: 'Attention (or)' },
  { value: 'success', label: 'Succès (vert)' },
  { value: 'destructive', label: 'Alerte (rouge)' },
  { value: 'secondary', label: 'Neutre' },
];

function motifDeVerrou(stage: BankCaseStage): string | null {
  if (stage.isSystem) return 'Étape système : sa désactivation casserait le flux.';
  if (stage.isInitial) return 'Étape initiale : tout nouveau dossier y entre.';
  return null;
}

interface ActionsEtapeProps {
  stage: BankCaseStage;
  canMoveUp: boolean;
  canMoveDown: boolean;
  locked: boolean;
  lockedLabel: string | null;
  reorderPending: boolean;
  togglePending: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onToggle: () => void;
}

/**
 * Les mêmes quatre actions deux fois : alignées au-delà de 1024 px, repliées
 * dans un menu en dessous, où quatre cibles de 44 px ne tiennent pas.
 */
function ActionsEtape(props: ActionsEtapeProps) {
  const { stage, canMoveUp, canMoveDown, locked, lockedLabel } = props;
  const toggleLabel = stage.isActive ? 'Désactiver' : 'Réactiver';
  const monterOff = !canMoveUp || props.reorderPending;
  const descendreOff = !canMoveDown || props.reorderPending;
  const bascculeOff = locked || props.togglePending;

  return (
    <>
      <div className="ml-auto hidden shrink-0 items-center gap-1 lg:flex">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Monter « ${stage.label} »`}
          disabled={monterOff}
          onClick={() => {
            props.onMove(-1);
          }}
        >
          <ChevronUpIcon className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Descendre « ${stage.label} »`}
          disabled={descendreOff}
          onClick={() => {
            props.onMove(1);
          }}
        >
          <ChevronDownIcon className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Renommer « ${stage.label} »`}
          onClick={props.onEdit}
        >
          <PencilIcon className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant={stage.isActive ? 'ghost' : 'secondary'}
          size="sm"
          className="tap-target"
          disabled={bascculeOff}
          onClick={props.onToggle}
        >
          {toggleLabel}
        </Button>
        {lockedLabel === null ? null : (
          <span className="max-w-56 text-[0.75rem] leading-tight text-muted-foreground">
            {lockedLabel}
          </span>
        )}
      </div>

      <div className="ml-auto shrink-0 lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Actions pour « ${stage.label} »`}
              />
            }
          >
            <MoreHorizontalIcon className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              className="min-h-11"
              disabled={monterOff}
              onClick={() => {
                props.onMove(-1);
              }}
            >
              <ChevronUpIcon aria-hidden="true" />
              Monter
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11"
              disabled={descendreOff}
              onClick={() => {
                props.onMove(1);
              }}
            >
              <ChevronDownIcon aria-hidden="true" />
              Descendre
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onEdit}>
              <PencilIcon aria-hidden="true" />
              Renommer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={bascculeOff}
              variant={stage.isActive ? 'destructive' : 'default'}
              onClick={props.onToggle}
            >
              {stage.isActive ? (
                <PowerOffIcon aria-hidden="true" />
              ) : (
                <PowerIcon aria-hidden="true" />
              )}
              {toggleLabel}
            </DropdownMenuItem>
            {lockedLabel === null ? null : (
              <p className="px-2 py-1.5 text-[0.75rem] leading-tight text-muted-foreground">
                {lockedLabel}
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

export function BankStagesView() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BankCaseStage | null>(null);
  const [deactivating, setDeactivating] = useState<BankCaseStage | null>(null);

  const stages = useQuery({
    queryKey: queryKeys.bankStages(true),
    queryFn: () => fetchBankStages(true),
  });

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankStagesRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.bankCasesRoot });
  }

  const reorder = useMutation({
    mutationFn: (stageIds: string[]) => reorderBankStages(stageIds),
    onSuccess: () => {
      invalidate();
      toast.success('Ordre du flux mis à jour.');
    },
    onError: (error) => {
      toastApiError(error, 'Le réordonnancement a échoué.');
    },
  });

  const toggleActive = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      setBankStageActive(input.id, input.isActive),
    onSuccess: (stage) => {
      invalidate();
      setDeactivating(null);
      toast.success(
        stage.isActive ? `« ${stage.label} » réactivée.` : `« ${stage.label} » désactivée.`,
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        const code = (error.body as { code?: string }).code;
        if (code === 'BANK_STAGE_HAS_OPEN_CASES') {
          toast.error(
            'Des dossiers occupent cette étape. Faites-les avancer ou rejetez-les avant de la désactiver.',
          );
          return;
        }
      }
      toastApiError(error, 'Le changement d’état a échoué.');
    },
  });

  if (stages.isPending) return <BankStagesSkeleton />;

  if (stages.isError) {
    return (
      <QueryErrorState
        error={stages.error}
        onRetry={() => {
          void stages.refetch();
        }}
        fallback="Le flux de traitement n’a pas pu être chargé."
      />
    );
  }

  const open = allOpenStages(stages.data);
  const systemStages = stages.data
    .filter((stage) => stage.type !== 'OPEN')
    .sort((a, b) => a.position - b.position);

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= open.length) return;
    if (open[0]?.isInitial === true && (index === 0 || target === 0)) return;

    const next = [...open];
    const moved = next[index];
    const swapped = next[target];
    if (moved === undefined || swapped === undefined) return;
    next[index] = swapped;
    next[target] = moved;
    reorder.mutate(next.map((stage) => stage.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Les dossiers parcourent ces étapes dans l’ordre. Une étape désactivée est sautée.
          L’encaissement se déclare à la dernière étape ouverte.
        </p>
        <Button
          type="button"
          onClick={() => {
            setCreating(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Nouvelle étape
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Étapes ouvertes</CardTitle>
          <CardDescription>Ordre du flux, de la première à la dernière.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ol className="divide-y divide-border">
            {open.map((stage, index) => {
              const initialLocked = open[0]?.isInitial === true;
              const canMoveUp = index > 0 && !(initialLocked && (index === 1 || index === 0));
              const canMoveDown = index < open.length - 1 && !(initialLocked && index === 0);

              const locked = stage.isSystem || stage.isInitial;
              const toggle = (): void => {
                if (stage.isActive) {
                  setDeactivating(stage);
                } else {
                  toggleActive.mutate({ id: stage.id, isActive: true });
                }
              };

              return (
                <li key={stage.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  {/*
                    `basis-full lg:basis-auto` sur la colonne libellé, et c'est
                    le cœur du correctif.

                    Elle était en `min-w-0 flex-1`, donc `flex-basis: 0` : elle
                    ne déclenchait JAMAIS le retour à la ligne de la ligne
                    flexible, et se faisait écraser par le groupe d'actions
                    (`shrink-0`, quatre contrôles, environ 200 px). Sous 360 px,
                    le libellé passait sous les boutons. En base 100 %, la
                    colonne prend sa ligne et les actions descendent sur la
                    leur ; au-delà de `lg`, tout revient sur une seule ligne.
                  */}
                  <div className="flex min-w-0 basis-full items-center gap-3 lg:basis-auto lg:flex-1">
                    <span className="w-6 shrink-0 text-[0.8125rem] text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StageBadge stage={stage} />
                        {stage.isInitial ? <Badge variant="outline">Étape initiale</Badge> : null}
                        {stage.isSystem ? (
                          <Badge variant="secondary" className="gap-1">
                            <LockIcon aria-hidden="true" />
                            Système
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[0.75rem] text-muted-foreground">
                        Code {stage.code}
                      </p>
                    </div>
                  </div>

                  {/* ─── Actions, à partir de 1024 px ─────────────────────── */}
                  <ActionsEtape
                    stage={stage}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    locked={locked}
                    lockedLabel={motifDeVerrou(stage)}
                    reorderPending={reorder.isPending}
                    togglePending={toggleActive.isPending}
                    onMove={(direction) => {
                      move(index, direction);
                    }}
                    onEdit={() => {
                      setEditing(stage);
                    }}
                    onToggle={toggle}
                  />
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Étapes terminales</CardTitle>
          <CardDescription>
            Non configurables. Encaissement : montant strictement positif. Rejet : motif
            obligatoire, montant à zéro.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {systemStages.map((stage) => (
              <li key={stage.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <StageBadge stage={stage} />
                <span className="min-w-0 truncate text-[0.8125rem] text-muted-foreground">
                  {BANK_STAGE_TYPE_LABELS[stage.type]} · code {stage.code}
                </span>
                <Badge variant="secondary" className="gap-1">
                  <LockIcon aria-hidden="true" />
                  Non modifiable
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <StageFormDialog
        mode="create"
        stage={null}
        open={creating}
        onOpenChange={setCreating}
        onDone={invalidate}
      />
      <StageFormDialog
        mode="edit"
        stage={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onDone={invalidate}
      />

      <Dialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Désactiver « {deactivating?.label ?? ''} » ?</DialogTitle>
            <DialogDescription>
              L’étape est retirée du flux et l’historique reste intact. Refusé si des dossiers
              occupent encore cette étape.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={toggleActive.isPending}
              onClick={() => {
                setDeactivating(null);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={toggleActive.isPending}
              onClick={() => {
                if (deactivating !== null) {
                  toggleActive.mutate({ id: deactivating.id, isActive: false });
                }
              }}
            >
              {toggleActive.isPending ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Désactivation…
                </>
              ) : (
                'Désactiver'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function codeAcceptable(mode: 'create' | 'edit', code: string): boolean {
  return mode === 'edit' || /^[A-Z][A-Z0-9_]{1,39}$/u.test(code.trim().toUpperCase());
}

function libelleAcceptable(label: string): boolean {
  const taille = label.trim().length;
  return taille >= 2 && taille <= 80;
}

function ChampCode({
  codeId,
  code,
  valide,
  onChange,
}: {
  codeId: string;
  code: string;
  valide: boolean;
  onChange: (code: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={codeId}>
        Code
        <span className="text-destructive" aria-label="obligatoire">
          *
        </span>
      </Label>
      <Input
        id={codeId}
        value={code}
        maxLength={40}
        autoComplete="off"
        spellCheck={false}
        placeholder="VALIDATION_DIRECTION"
        aria-describedby={`${codeId}-aide`}
        aria-invalid={code !== '' && !valide}
        onChange={(event) => {
          onChange(event.target.value.toUpperCase());
        }}
      />
      <p id={`${codeId}-aide`} className="text-[0.75rem] text-muted-foreground">
        Majuscules, chiffres et tirets bas. Définitif.
      </p>
    </div>
  );
}

function StageFormDialog({
  mode,
  stage,
  open,
  onOpenChange,
  onDone,
}: {
  mode: 'create' | 'edit';
  stage: BankCaseStage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const codeId = useId();
  const labelId = useId();
  const colorId = useId();

  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('info');
  const [initialised, setInitialised] = useState<string | null>(null);

  const key = stage?.id ?? (mode === 'create' ? 'nouveau' : null);
  if (open && key !== null && initialised !== key) {
    setInitialised(key);
    setCode('');
    setLabel(stage?.label ?? '');
    setColor(stage?.color ?? 'info');
  }

  const save = useMutation({
    mutationFn: () =>
      mode === 'create'
        ? createBankStage({ code: code.trim().toUpperCase(), label: label.trim(), color })
        : updateBankStage(stage?.id ?? '', { label: label.trim(), color }),
    onSuccess: (result) => {
      onDone();
      toast.success(
        mode === 'create'
          ? `Étape « ${result.label} » créée.`
          : `Étape renommée en « ${result.label} ».`,
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'L’étape n’a pas pu être enregistrée.');
    },
  });

  const codeValid = codeAcceptable(mode, code);
  const labelValid = libelleAcceptable(label);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && save.isPending) return;
        if (!next) setInitialised(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nouvelle étape du flux' : `Renommer « ${stage?.label ?? ''} »`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Ajoutée à la fin du flux ouvert, déplaçable ensuite.'
              : 'Le code reste inchangé.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {mode === 'create' ? (
            <ChampCode codeId={codeId} code={code} valide={codeValid} onChange={setCode} />
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={labelId}>
              Libellé affiché
              <span className="text-destructive" aria-label="obligatoire">
                *
              </span>
            </Label>
            <Input
              id={labelId}
              value={label}
              maxLength={80}
              autoComplete="off"
              placeholder="Validation direction"
              aria-invalid={label !== '' && !labelValid}
              onChange={(event) => {
                setLabel(event.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={colorId}>Couleur de la pastille</Label>
            {/* `items` : `Select.Value` de Base UI affiche la VALEUR choisie,
                pas le texte de l'item. */}
            <Select
              items={COLOR_ROLES}
              value={color}
              onValueChange={(value) => {
                if (value === null) return;
                setColor(value);
              }}
            >
              <SelectTrigger id={colorId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={save.isPending || !codeValid || !labelValid}
            onClick={() => {
              save.mutate();
            }}
          >
            {save.isPending ? (
              <>
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BankStagesSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="h-4 w-96" />
      <Card>
        <CardContent className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
