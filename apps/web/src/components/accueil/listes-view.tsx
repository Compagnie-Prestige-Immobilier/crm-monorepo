'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  InboxIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { SearchField } from '@/components/filters/search-field';
import { ListeFormDialog } from '@/components/accueil/listes-form-dialog';
import { DeactivateReferentielDialog } from '@/components/referentiels/deactivate-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QueryErrorState } from '@/components/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchVisiteReferentielList,
  fetchVisiteReferentielUsage,
  reorderVisiteReferentiel,
  setVisiteReferentielActive,
  type VisiteReferentielEntry,
  type VisiteReferentielKind,
  type VisiteReferentielUsage,
} from '@/lib/data/visites-referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface KindConfig {
  kind: VisiteReferentielKind;
  tabLabel: string;
  title: string;
  description: string;
  /** Genre pour la boîte de désactivation : « ce » ou « cette », « cet » devant une voyelle. */
  deactivateKind: 'entreprise' | 'direction' | 'destinataire' | 'objet de visite';
  createLabel: string;
  emptyLabel: string;
  searchPlaceholder: string;
}

const KINDS: readonly KindConfig[] = [
  {
    kind: 'entreprises',
    tabLabel: 'Entreprises',
    title: 'Entreprises',
    description: 'La société ou l’organisme visité.',
    deactivateKind: 'entreprise',
    createLabel: 'Nouvelle entreprise',
    emptyLabel: 'Aucune entreprise enregistrée.',
    searchPlaceholder: 'Nom ou code…',
  },
  {
    kind: 'directions',
    tabLabel: 'Directions',
    title: 'Directions',
    description: 'Le service concerné par la visite, quand il est connu.',
    deactivateKind: 'direction',
    createLabel: 'Nouvelle direction',
    emptyLabel: 'Aucune direction enregistrée.',
    searchPlaceholder: 'Nom ou code…',
  },
  {
    kind: 'destinataires',
    tabLabel: 'Destinataires',
    title: 'Destinataires',
    description: 'La personne demandée par le visiteur.',
    deactivateKind: 'destinataire',
    createLabel: 'Nouveau destinataire',
    emptyLabel: 'Aucun destinataire enregistré.',
    searchPlaceholder: 'Nom ou code…',
  },
  {
    kind: 'objets',
    tabLabel: 'Objets de visite',
    title: 'Objets de visite',
    description: 'Le motif de la visite.',
    deactivateKind: 'objet de visite',
    createLabel: 'Nouvel objet',
    emptyLabel: 'Aucun objet de visite enregistré.',
    searchPlaceholder: 'Libellé ou code…',
  },
];

const DEFAULT_KIND: VisiteReferentielKind = 'entreprises';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function matches(search: string, ...fields: readonly string[]): boolean {
  const needle = normalize(search.trim());
  if (needle === '') return true;
  return fields.some((field) => normalize(field).includes(needle));
}

export function ListesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const kind: VisiteReferentielKind = useMemo(() => {
    const raw = searchParams.get('onglet');
    return KINDS.some((entry) => entry.kind === raw)
      ? (raw as VisiteReferentielKind)
      : DEFAULT_KIND;
  }, [searchParams]);

  const search = searchParams.get('recherche') ?? '';

  const write = useCallback(
    (nextKind: VisiteReferentielKind, nextSearch: string) => {
      const params = new URLSearchParams();
      if (nextKind !== DEFAULT_KIND) params.set('onglet', nextKind);
      if (nextSearch.trim() !== '') params.set('recherche', nextSearch.trim());
      const query = params.toString();
      router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
    },
    [pathname, router],
  );

  const usage = useUsage();

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-[0.9375rem] text-muted-foreground">
        Les quatre listes proposées à la saisie du registre. Une entrée retirée reste lisible sur
        les visites déjà enregistrées, et disparaît de la saisie.
      </p>

      <Tabs
        value={kind}
        onValueChange={(value) => {
          write(value as VisiteReferentielKind, '');
        }}
      >
        <TabsList>
          {KINDS.map((entry) => (
            <TabsTrigger key={entry.kind} value={entry.kind}>
              {entry.tabLabel}
            </TabsTrigger>
          ))}
        </TabsList>

        {KINDS.map((entry) => (
          <TabsContent key={entry.kind} value={entry.kind}>
            <KindPanel
              config={entry}
              search={search}
              usage={usage}
              onSearch={(value) => {
                write(entry.kind, value);
              }}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface Usage {
  counts: VisiteReferentielUsage;
  /** Faux tant que le décompte n'est pas revenu. Il ne vaut alors PAS zéro. */
  known: boolean;
  retry: () => void;
}

function useUsage(): Usage {
  const { data, refetch } = useQuery({
    queryKey: queryKeys.visiteReferentielUsage,
    queryFn: () => fetchVisiteReferentielUsage(),
    staleTime: 60_000,
  });

  return {
    counts: data ?? { entreprises: {}, directions: {}, destinataires: {}, objets: {} },
    known: data !== undefined,
    retry: () => {
      void refetch();
    },
  };
}

const usageOf = (usage: Usage, kind: VisiteReferentielKind, id: string): number | null =>
  usage.known ? (usage.counts[kind][id] ?? 0) : null;

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'Pour déplacer cette entrée, appuyez sur la barre d’espace ou sur Entrée. Utilisez les ' +
    'flèches haut et bas pour la déplacer, puis appuyez de nouveau sur la barre d’espace ou sur ' +
    'Entrée pour la déposer. Appuyez sur Échap pour annuler.',
};

function frenchAnnouncements(labelOf: (id: string) => string): Announcements {
  return {
    onDragStart: ({ active }) => `${labelOf(String(active.id))} saisie.`,
    onDragOver: ({ active, over }) =>
      over === null
        ? `${labelOf(String(active.id))} n’est plus au-dessus d’une position valide.`
        : `${labelOf(String(active.id))} déplacée au-dessus de ${labelOf(String(over.id))}.`,
    onDragEnd: ({ active, over }) =>
      over === null
        ? `${labelOf(String(active.id))} déposée : ordre inchangé.`
        : `${labelOf(String(active.id))} déposée à la position de ${labelOf(String(over.id))}.`,
    onDragCancel: ({ active }) => `Déplacement de ${labelOf(String(active.id))} annulé.`,
  };
}

function KindPanel({
  config,
  search,
  onSearch,
  usage,
}: {
  config: KindConfig;
  search: string;
  onSearch: (value: string) => void;
  usage: Usage;
}) {
  const queryClient = useQueryClient();
  const { kind } = config;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VisiteReferentielEntry | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<VisiteReferentielEntry | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.visiteReferentiel(kind),
    queryFn: () => fetchVisiteReferentielList(kind),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.visiteReferentielsRoot });
  };

  const setActive = useMutation({
    mutationFn: ({ entry, isActive }: { entry: VisiteReferentielEntry; isActive: boolean }) =>
      setVisiteReferentielActive(kind, entry.id, isActive),
    onSuccess: (saved) => {
      invalidate();
      setDeactivating(null);
      toast.success(saved.isActive ? `${saved.label} réactivé.` : `${saved.label} désactivé.`);
    },
    onError: (mutationError) => {
      toastApiError(mutationError, "Changement d'état impossible. Réessayez.");
    },
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderVisiteReferentiel(kind, ids),
    onSuccess: invalidate,
    onError: (mutationError) => {
      toastApiError(mutationError, 'Réordonnancement impossible. Réessayez.');
    },
  });

  const allRows = data ?? [];
  const rows = allRows.filter((entry) => matches(search, entry.label, entry.code));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = useCallback(
    (id: string) => allRows.find((entry) => entry.id === id)?.label ?? id,
    [allRows],
  );
  const announcements = useMemo(() => frenchAnnouncements(labelOf), [labelOf]);

  function move(id: string, direction: -1 | 1): void {
    const index = allRows.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= allRows.length) return;
    reorder.mutate(arrayMove(allRows, index, target).map((entry) => entry.id));
  }

  function onDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    const from = allRows.findIndex((entry) => entry.id === active.id);
    const to = allRows.findIndex((entry) => entry.id === over.id);
    if (from === -1 || to === -1) return;
    reorder.mutate(arrayMove(allRows, from, to).map((entry) => entry.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
            {config.title}
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">{config.description}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          {config.createLabel}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
        <SearchField
          label="Rechercher"
          value={search}
          onChange={onSearch}
          placeholder={config.searchPlaceholder}
        />
      </div>

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Liste non chargée."
        />
      ) : rows.length === 0 ? (
        <EmptyState searchActive={search.trim() !== ''} emptyLabel={config.emptyLabel} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{ announcements, screenReaderInstructions }}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={rows.map((entry) => entry.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="divide-y divide-border">
                {rows.map((entry) => {
                  const index = allRows.findIndex((row) => row.id === entry.id);
                  return (
                    <SortableRow
                      key={entry.id}
                      entry={entry}
                      disabled={search.trim() !== ''}
                      canMoveUp={index > 0}
                      canMoveDown={index < allRows.length - 1}
                      reordering={reorder.isPending}
                      usageCount={usageOf(usage, kind, entry.id)}
                      onMoveUp={() => {
                        move(entry.id, -1);
                      }}
                      onMoveDown={() => {
                        move(entry.id, 1);
                      }}
                      onEdit={() => {
                        setEditing(entry);
                        setFormOpen(true);
                      }}
                      onToggleActive={() => {
                        if (entry.isActive) {
                          setDeactivating(entry);
                        } else {
                          setActive.mutate({ entry, isActive: true });
                        }
                      }}
                      togglePending={setActive.isPending}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <ListeFormDialog
        kind={kind}
        createTitle={config.createLabel}
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editing}
      />
      <DeactivateReferentielDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        label={deactivating?.label ?? ''}
        kind={config.deactivateKind}
        subject="visite"
        usageCount={deactivating === null ? null : usageOf(usage, kind, deactivating.id)}
        onRetryUsage={usage.retry}
        pending={setActive.isPending}
        onConfirm={() => {
          if (deactivating !== null) setActive.mutate({ entry: deactivating, isActive: false });
        }}
      />
    </div>
  );
}

function SortableRow({
  entry,
  disabled,
  canMoveUp,
  canMoveDown,
  reordering,
  usageCount,
  onMoveUp,
  onMoveDown,
  onEdit,
  onToggleActive,
  togglePending,
}: {
  entry: VisiteReferentielEntry;
  /** Le glisser-déposer perd son sens quand la recherche a déjà réordonné l'affichage. */
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  reordering: boolean;
  usageCount: number | null;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  togglePending: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id: entry.id, disabled });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex flex-wrap items-center gap-3 px-4 py-3',
        !entry.isActive && 'bg-muted/50',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`Réordonner ${entry.label} par glisser-déposer`}
        className="tap-target -ml-1 flex shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <GripVerticalIcon className="size-4" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('font-[600]', !entry.isActive && 'text-muted-foreground')}>
            {entry.label}
          </span>
          {entry.isActive ? null : <Badge variant="outline">Retirée</Badge>}
          {entry.isSystem ? <Badge variant="secondary">Classeur d’origine</Badge> : null}
        </div>
        <p className="mt-0.5 truncate text-[0.75rem] text-muted-foreground">
          Code {entry.code}
          {usageCount === null
            ? ''
            : ` · ${String(usageCount)} visite${usageCount === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Monter ${entry.label}`}
          disabled={!canMoveUp || reordering}
          onClick={onMoveUp}
        >
          <ChevronUpIcon className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Descendre ${entry.label}`}
          disabled={!canMoveDown || reordering}
          onClick={onMoveDown}
        >
          <ChevronDownIcon className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Modifier ${entry.label}`}
          onClick={onEdit}
        >
          <PencilIcon className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={entry.isActive ? `Désactiver ${entry.label}` : `Réactiver ${entry.label}`}
          disabled={togglePending}
          onClick={onToggleActive}
        >
          {entry.isActive ? (
            <PowerOffIcon className="size-4" aria-hidden="true" />
          ) : (
            <PowerIcon className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-4 py-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  searchActive,
  emptyLabel,
}: {
  searchActive: boolean;
  emptyLabel: string;
}): ReactNode {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center shadow-elev-sm">
      <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-[600]">
        {searchActive ? 'Aucune entrée ne correspond à cette recherche.' : emptyLabel}
      </p>
    </div>
  );
}
