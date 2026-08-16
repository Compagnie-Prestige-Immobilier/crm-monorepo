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

/**
 * Rôles de couleur proposés. Le contrat impose un RÔLE du design system, pas un
 * hex : c'est ce qui garantit qu'une étape créée aujourd'hui reste lisible dans
 * les deux thèmes sans que personne ait à mesurer un contraste. Un sélecteur de
 * couleur libre produirait, tôt ou tard, du gris clair sur blanc.
 */
const COLOR_ROLES: readonly { value: string; label: string }[] = [
  { value: 'info', label: 'Information (rose CPI)' },
  { value: 'warning', label: 'Attention (or)' },
  { value: 'success', label: 'Succès (vert)' },
  { value: 'destructive', label: 'Alerte (rouge)' },
  { value: 'secondary', label: 'Neutre' },
];

/**
 * Configuration du flux bancaire : ADMIN.
 *
 * Le réordonnancement se fait à DEUX BOUTONS, « Monter » et « Descendre », et
 * non par glisser-déposer. Ce n'est pas une économie de bibliothèque : un
 * glisser-déposer est inutilisable au clavier sans une implémentation ARIA
 * complète, illisible pour un lecteur d'écran, et casse-tête au doigt sur une
 * tablette. Deux boutons sont atteignables à la tabulation, annoncés
 * correctement, et fonctionnent partout : pour une opération qu'un
 * administrateur fait trois fois par an.
 *
 * Chaque déplacement envoie la liste COMPLÈTE des étapes ouvertes, l'initiale
 * en tête : c'est ce que `POST /bank-case-stages/reorder` exige, et une liste
 * partielle renverrait `BANK_STAGE_REORDER_INCOMPLETE`.
 */
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
      /**
       * `BANK_STAGE_HAS_OPEN_CASES` : le refus le plus important à EXPLIQUER.
       *
       * Sans message dédié, l'administrateur lirait « Conflit » et croirait à un
       * bug. La vraie réponse est qu'il reste des dossiers arrêtés sur cette
       * étape : les désactiver les rendrait invisibles au flux, sans qu'aucun
       * écran ne dise où ils sont passés.
       */
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
    // L'étape initiale doit rester en tête : l'API le refuse autrement
    // (`BANK_STAGE_INITIAL_MUST_BE_FIRST`), et le dire par un bouton désactivé
    // vaut mieux qu'un message d'erreur après coup.
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

              /**
               * ═════════════════════════════════════════════════════════════
               * La RAISON du verrouillage doit être du TEXTE, dans les deux
               * rendus.
               * ═════════════════════════════════════════════════════════════
               *
               * Elle n'était portée que par un attribut `title` sur le bouton
               * du bureau, et pas du tout sous 1024 px. Or `title` sur un
               * élément DÉSACTIVÉ est le pire des supports : il ne s'ouvre pas
               * au survol dans plusieurs navigateurs, il ne s'atteint jamais au
               * clavier (l'élément n'est pas focalisable), et les lecteurs
               * d'écran l'annoncent rarement. L'administrateur voyait donc
               * « Désactiver » grisé, sans la moindre explication, et concluait
               * à une panne de droits.
               *
               * La phrase est maintenant rendue en toutes lettres à côté du
               * bouton sur le bureau, et dans l'entrée de menu sous 1024 px.
               */
              const locked = stage.isSystem || stage.isInitial;
              const lockedLabel = stage.isSystem
                ? 'Étape système : sa désactivation casserait le flux.'
                : stage.isInitial
                  ? 'Étape initiale : tout nouveau dossier y entre.'
                  : null;
              const toggleLabel = stage.isActive ? 'Désactiver' : 'Réactiver';
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
                  <div className="ml-auto hidden shrink-0 items-center gap-1 lg:flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      // Le nom accessible NOMME l'étape : « Monter » seul, répété
                      // six fois dans la page, ne dit pas quoi on déplace.
                      aria-label={`Monter « ${stage.label} »`}
                      disabled={!canMoveUp || reorder.isPending}
                      onClick={() => {
                        move(index, -1);
                      }}
                    >
                      <ChevronUpIcon className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Descendre « ${stage.label} »`}
                      disabled={!canMoveDown || reorder.isPending}
                      onClick={() => {
                        move(index, 1);
                      }}
                    >
                      <ChevronDownIcon className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Renommer « ${stage.label} »`}
                      onClick={() => {
                        setEditing(stage);
                      }}
                    >
                      <PencilIcon className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant={stage.isActive ? 'ghost' : 'secondary'}
                      size="sm"
                      className="tap-target"
                      disabled={locked || toggleActive.isPending}
                      onClick={toggle}
                    >
                      {toggleLabel}
                    </Button>
                    {lockedLabel === null ? null : (
                      <span className="max-w-56 text-[0.75rem] leading-tight text-muted-foreground">
                        {lockedLabel}
                      </span>
                    )}
                  </div>

                  {/* ─── Actions, sous 1024 px ────────────────────────────────
                      Les quatre contrôles tiennent dans un menu : quatre cibles
                      de 44 px alignées demandent 200 px, largeur que l'écran
                      n'a pas. Les libellés y sont ÉCRITS EN TOUTES LETTRES, ce
                      que quatre pictogrammes ne disaient pas. */}
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
                          disabled={!canMoveUp || reorder.isPending}
                          onSelect={() => {
                            move(index, -1);
                          }}
                        >
                          <ChevronUpIcon aria-hidden="true" />
                          Monter
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canMoveDown || reorder.isPending}
                          onSelect={() => {
                            move(index, 1);
                          }}
                        >
                          <ChevronDownIcon aria-hidden="true" />
                          Descendre
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(stage);
                          }}
                        >
                          <PencilIcon aria-hidden="true" />
                          Renommer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={locked || toggleActive.isPending}
                          variant={stage.isActive ? 'destructive' : 'default'}
                          onSelect={toggle}
                        >
                          {stage.isActive ? (
                            <PowerOffIcon aria-hidden="true" />
                          ) : (
                            <PowerIcon aria-hidden="true" />
                          )}
                          {toggleLabel}
                        </DropdownMenuItem>
                        {lockedLabel === null ? null : (
                          /* Hors du `DropdownMenuItem` : une entrée désactivée
                             n'est pas atteignable au clavier, donc sa
                             description ne serait jamais lue. */
                          <p className="px-2 py-1.5 text-[0.75rem] leading-tight text-muted-foreground">
                            {lockedLabel}
                          </p>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
              /*
                `min-w-0` + `truncate` sur le libellé, et surtout PAS de
                `ml-auto` sur la pastille : poussée à droite, elle sautait à la
                ligne au premier repli et laissait un blanc au milieu de la
                rangée. Sans `min-w-0`, « Encaissé · code CASHED » refusait de
                se couper et débordait de la carte sous 360 px.
              */
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

/** Création et renommage : même dialogue, le mode décide des champs modifiables. */
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

  // Réamorçage à l'ouverture, sans `useEffect` : on compare l'identité de
  // l'étape rendue à celle déjà chargée. Un effet ferait un rendu de plus, et
  // le champ afficherait la valeur précédente pendant une frame.
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

  const codeValid = mode === 'edit' || /^[A-Z][A-Z0-9_]{1,39}$/u.test(code.trim().toUpperCase());
  const labelValid = label.trim().length >= 2 && label.trim().length <= 80;

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
                aria-invalid={code !== '' && !codeValid}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                }}
              />
              <p id={`${codeId}-aide`} className="text-[0.75rem] text-muted-foreground">
                Majuscules, chiffres et tirets bas. Définitif.
              </p>
            </div>
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

export function BankStagesSkeleton() {
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
