'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyIcon, SparklesIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { copyPhone, Kbd } from '@/components/console/console-ui';
import { RepScript } from '@/components/console/rep-script';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLive } from '@/components/live/use-live';
import {
  AttemptRefused,
  ALREADY_COMPLETED,
  buildQueue,
  callbackKeys,
  callbackSlots,
  consoleKeys,
  fetchCallbacks,
  fetchConsoleCampaigns,
  fetchConsoleQueue,
  formatCallbackAt,
  nextAfter,
  newAttemptInput,
  pushCallAttempt,
  queueLabel,
  QUEUE_BUCKET_LABELS,
  schedulesOf,
  undatedCallbacks,
  validateAttempt,
  type AttemptDraft,
  type CallbackSlot,
  type CallbackSchedules,
} from '@/lib/data/console';
import { dakarLocalToIso, formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { matchesSearch } from '@/lib/search';
import {
  CALL_OUTCOME_LABELS,
  ENROLLMENT_METHOD_LABELS,
  PHASE2_STATUS_LABELS,
  type CallOutcome,
  type EnrollmentMethod,
  type ProspectRow,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const METHOD_KEYS: readonly { key: string; method: EnrollmentMethod }[] = [
  { key: '1', method: 'PLATFORM' },
  { key: '2', method: 'PHYSICAL' },
  { key: '3', method: 'VOICE_OR_ELECTRONIC_MESSAGING' },
];

const OUTCOME_KEYS: readonly { key: string; outcome: CallOutcome }[] = [
  { key: '4', outcome: 'UNREACHABLE' },
  { key: '6', outcome: 'REFUSED' },
  { key: '7', outcome: 'WRONG_NUMBER' },
];

const KEYBOARD_MAP: readonly (readonly [string, string])[] = [
  ['1 2 3', 'Méthode obtenue, envoi immédiat'],
  ['4', 'Injoignable'],
  ['5', 'À rappeler, puis échéance'],
  ['6', 'Refus'],
  ['7', 'Mauvais numéro'],
  ['8', 'Autre, puis commentaire'],
  ['1 … 6', 'Échéance proposée, après 5'],
  ['0', 'Saisir une autre échéance, après 5'],
  ['Entrée', 'Valider, ou passer à la suivante'],
  ['Échap', 'Annuler la saisie en cours'],
  ['↑ ↓', 'Parcourir la file'],
  ['Espace', 'Ouvrir la fiche sélectionnée'],
  ['C', 'Copier le numéro'],
  ['N', 'Nouveau prospect sur ce représentant'],
  ['R', 'Fiche du représentant'],
  ['Ctrl/Cmd K', 'Palette'],
  ['M', 'Changer de volet'],
  ['?', 'Afficher cette carte'],
];

const VOLETS = [
  { value: 'prospects', label: 'Prospects' },
  { value: 'representants', label: 'Représentants' },
] as const;

type Volet = (typeof VOLETS)[number]['value'];

/**
 * Deux files, un seul poste : la téléconseillère appelle des prospects et des
 * représentants dans la même session, avec le même clavier.
 */
export function ConsoleView() {
  const [volet, setVolet] = useState<Volet>('prospects');

  useShortcuts({
    m: () => {
      setVolet((current) => (current === 'prospects' ? 'representants' : 'prospects'));
    },
  });

  return (
    <Tabs
      value={volet}
      onValueChange={(value) => {
        setVolet(value as Volet);
      }}
    >
      <TabsList>
        {VOLETS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
            {tab.value === 'prospects' ? <Kbd>M</Kbd> : null}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="prospects">
        {volet === 'prospects' ? <ProspectConsole /> : null}
      </TabsContent>
      <TabsContent value="representants">
        {volet === 'representants' ? <RepScript /> : null}
      </TabsContent>
    </Tabs>
  );
}

function ProspectConsole() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const live = useLive();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const callbackRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestedId = searchParams.get('fiche');
  const [openedId, setOpenedId] = useState<string | null>(requestedId);
  const [comment, setComment] = useState('');
  const [draftOutcome, setDraftOutcome] = useState<CallOutcome | null>(null);
  const [slots, setSlots] = useState<readonly CallbackSlot[] | null>(null);
  const [freeCallback, setFreeCallback] = useState('');
  const [done, setDone] = useState<readonly string[]>([]);
  const [log, setLog] = useState<readonly AttemptDraft[]>([]);
  const [refusedIds, setRefusedIds] = useState<readonly string[]>([]);
  const [rawOrder, setRawOrder] = useState(false);
  const [palette, setPalette] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const campaigns = useQuery({
    queryKey: consoleKeys.campaigns,
    queryFn: () => fetchConsoleCampaigns(),
    retry: false,
    staleTime: 300_000,
  });

  const queue = useQuery({
    queryKey: consoleKeys.queue(campaignId),
    queryFn: () => fetchConsoleQueue(campaignId),
    refetchInterval: live.refetchInterval,
  });

  const callbacks = useQuery({
    queryKey: callbackKeys.list('week', null),
    queryFn: () => fetchCallbacks('week'),
    refetchInterval: live.refetchInterval,
    retry: false,
  });

  const now = queue.dataUpdatedAt === 0 ? Date.now() : queue.dataUpdatedAt;
  const schedules: CallbackSchedules = useMemo(
    () => schedulesOf(callbacks.data?.items ?? []),
    [callbacks.data],
  );

  const loaded = useMemo(() => queue.data?.items ?? [], [queue.data]);
  const sorted = useMemo(() => buildQueue(loaded, schedules, now), [loaded, schedules, now]);
  const items = useMemo(
    () => (rawOrder ? loaded : sorted.items).filter((row) => !done.includes(row.id)),
    [rawOrder, loaded, sorted.items, done],
  );

  const current = useMemo(
    () => items.find((row) => row.id === openedId) ?? items[0],
    [items, openedId],
  );
  const selected = useMemo(
    () => items.find((row) => row.id === selectedId) ?? current,
    [items, selectedId, current],
  );

  const closed =
    current !== undefined &&
    (current.phase2Status !== 'PENDING' || refusedIds.includes(current.id));

  const send = useMutation({
    mutationFn: (input: { prospect: ProspectRow; draft: AttemptDraft }) =>
      pushCallAttempt(newAttemptInput(input.prospect.id, input.draft)),
    onSuccess: (_result, input) => {
      setLog((entries) => [...entries, input.draft]);
      setDone((ids) => [...ids, input.prospect.id]);
      const next = nextAfter(items, input.prospect.id);
      setOpenedId(next);
      setSelectedId(next);
      setComment('');
      setDraftOutcome(null);
      setSlots(null);
      void queryClient.invalidateQueries({ queryKey: consoleKeys.root });
      void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
    },
    onError: (error, input) => {
      if (error instanceof AttemptRefused && error.code === ALREADY_COMPLETED) {
        setRefusedIds((ids) => [...ids, input.prospect.id]);
        toast.error(error.message);
        return;
      }
      if (error instanceof AttemptRefused) {
        toast.error(error.message);
        return;
      }
      toastApiError(error, 'L’appel n’a pas été enregistré.');
    },
  });

  const record = useCallback(
    (outcome: CallOutcome, method: EnrollmentMethod | null, callbackAt: string | null = null) => {
      if (current === undefined || closed || send.isPending) return;

      const draft: AttemptDraft = { outcome, method, comment, callbackAt };
      const problem = validateAttempt(draft);
      if (problem !== null) {
        toast.error(problem);
        return;
      }
      send.mutate({ prospect: current, draft });
    },
    [current, closed, send, comment],
  );

  const move = useCallback(
    (step: number) => {
      if (items.length === 0) return;
      const at = items.findIndex((row) => row.id === selected?.id);
      const next = items[Math.min(items.length - 1, Math.max(0, at + step))];
      if (next !== undefined) setSelectedId(next.id);
    },
    [items, selected],
  );

  const skip = useCallback(() => {
    if (current === undefined) return;
    const next = nextAfter(items, current.id);
    if (next === null || next === current.id) return;
    setOpenedId(next);
    setSelectedId(next);
    setComment('');
    setDraftOutcome(null);
    setSlots(null);
  }, [current, items]);

  const copyCurrentPhone = useCallback(() => {
    if (current !== undefined) copyPhone(current.phoneE164);
  }, [current]);

  const startOther = useCallback(() => {
    if (current === undefined || closed) return;
    setDraftOutcome('OTHER');
    commentRef.current?.focus();
  }, [current, closed]);

  const startCallback = useCallback(() => {
    if (current === undefined || closed) return;
    setDraftOutcome(null);
    setFreeCallback('');
    setSlots(callbackSlots(Date.now()));
  }, [current, closed]);

  const validate = useCallback(() => {
    if (slots !== null) {
      const iso = dakarLocalToIso(freeCallback);
      if (iso === null) {
        toast.error('Choisissez une échéance, ou saisissez sa date et son heure.');
        return;
      }
      record('CALLBACK', null, iso);
      return;
    }
    if (draftOutcome !== null) {
      record(draftOutcome, null);
      return;
    }
    skip();
  }, [slots, freeCallback, draftOutcome, record, skip]);

  const outcomeShortcuts: Record<string, () => void> = {
    '1': () => {
      record('METHOD_OBTAINED', 'PLATFORM');
    },
    '2': () => {
      record('METHOD_OBTAINED', 'PHYSICAL');
    },
    '3': () => {
      record('METHOD_OBTAINED', 'VOICE_OR_ELECTRONIC_MESSAGING');
    },
    '4': () => {
      record('UNREACHABLE', null);
    },
    '5': startCallback,
    '6': () => {
      record('REFUSED', null);
    },
    '7': () => {
      record('WRONG_NUMBER', null);
    },
    '8': startOther,
  };

  const slotShortcuts: Record<string, () => void> = Object.fromEntries(
    (slots ?? []).map((slot) => [
      slot.key,
      () => {
        record('CALLBACK', null, slot.at);
      },
    ]),
  );
  slotShortcuts['0'] = () => {
    callbackRef.current?.focus();
  };

  useShortcuts(
    {
      ...(slots === null ? outcomeShortcuts : slotShortcuts),
      Enter: validate,
      Escape: () => {
        setDraftOutcome(null);
        setComment('');
        setSlots(null);
        commentRef.current?.blur();
      },
      ArrowDown: () => {
        move(1);
      },
      ArrowUp: () => {
        move(-1);
      },
      Space: () => {
        if (selected !== undefined) setOpenedId(selected.id);
      },
      c: copyCurrentPhone,
      // Une fiche Grand Public n'a pas de representant : le raccourci ne mene
      // nulle part plutot que vers une adresse construite sur du vide.
      n: () => {
        const rep = current?.representantId;
        if (rep) router.push(`/prospects/nouveau?rep=${encodeURIComponent(rep)}`);
      },
      r: () => {
        const rep = current?.representantId;
        if (rep) router.push(`/representants/${encodeURIComponent(rep)}`);
      },
      'mod+k': () => {
        setPalette(true);
      },
      '?': () => {
        setHelpOpen((open) => !open);
      },
    },
    !palette,
  );

  useEffect(() => {
    setComment('');
    setDraftOutcome(null);
    setSlots(null);
  }, [current?.id]);

  if (queue.isPending) return <ConsoleSkeleton />;

  if (queue.isError) {
    return (
      <QueryErrorState
        error={queue.error}
        fallback="La file d’appel n’a pas pu être chargée."
        onRetry={() => {
          void queue.refetch();
        }}
      />
    );
  }

  const total = queue.data.total;
  const methodCount = log.filter((entry) => entry.outcome === 'METHOD_OBTAINED').length;
  const repFiches =
    current === undefined
      ? 0
      : loaded.filter((row) => row.representantId === current.representantId).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)_22.5rem]">
      <section aria-label="File d’appel" className="flex flex-col gap-3">
        {campaigns.data !== undefined && campaigns.data.length > 0 ? (
          <FilterCombobox
            label="Campagne"
            placeholder="Toutes mes fiches"
            options={campaigns.data}
            value={campaignId}
            onChange={(value) => {
              setCampaignId(value);
              setOpenedId(null);
              setSelectedId(null);
            }}
          />
        ) : null}

        <p className="text-[0.875rem] font-[600]">
          {formatNumber(sorted.pendingCount - done.length)} à traiter
        </p>

        <ol className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin">
          {items.map((row, index) => (
            <li key={row.id}>
              <button
                type="button"
                data-highlighted={row.id === selected?.id ? '' : undefined}
                aria-current={row.id === current?.id ? 'true' : undefined}
                onClick={() => {
                  setSelectedId(row.id);
                  setOpenedId(row.id);
                }}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 rounded-md border border-transparent px-2 py-2 text-left',
                  'hover:bg-secondary',
                  'data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-ring',
                  row.id === current?.id && 'border-border bg-secondary',
                )}
              >
                <span className="flex w-full items-baseline gap-2">
                  <span className="text-[0.75rem] text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[0.875rem] font-[600]">
                    {row.nom} {row.prenom}
                  </span>
                </span>
                <span className="pl-5 text-[0.75rem] text-muted-foreground">
                  {queueLabel(row, now, schedules)}
                </span>
              </button>
            </li>
          ))}
        </ol>

        {total > loaded.length ? (
          <p className="text-[0.75rem] text-muted-foreground">
            {formatNumber(loaded.length)} fiches chargées sur {formatNumber(total)}. Choisissez une
            campagne pour resserrer la file.
          </p>
        ) : null}
      </section>

      <section aria-label="Fiche courante" className="flex flex-col gap-5">
        {requestedId !== null && !loaded.some((row) => row.id === requestedId) ? (
          <p
            role="alert"
            className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
          >
            La fiche ouverte depuis les rappels n’est pas dans cette file. Retirez le filtre de
            campagne, ou ouvrez-la depuis les prospects.
          </p>
        ) : null}

        <div className="flex items-start justify-between gap-4">
          {current === undefined ? (
            <p className="text-[0.9375rem]">
              Plus aucune fiche à traiter. Choisissez une autre campagne, ou revenez quand une
              nouvelle campagne aura été tirée.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <span className="select-all font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
                {formatPhone(current.phoneE164)}
              </span>
              <Button variant="outline" size="sm" onClick={copyCurrentPhone}>
                <CopyIcon aria-hidden="true" />
                Copier
                <Kbd>C</Kbd>
              </Button>
            </div>
          )}

          <SortExplainer
            counts={sorted.counts}
            head={items[0]}
            now={now}
            schedules={schedules}
            undated={undatedCallbacks(loaded, schedules)}
            rawOrder={rawOrder}
            onToggleOrder={() => {
              setRawOrder((raw) => !raw);
            }}
          />
        </div>

        {current === undefined ? null : (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
                {current.nom} {current.prenom}
              </h2>
              <p className="text-[0.875rem] text-muted-foreground">
                {current.banqueName} · {current.syndicatSigle} · {current.departementName}
              </p>
              <p className="text-[0.875rem] text-muted-foreground">
                Représentant {current.representantName}
              </p>
            </div>

            {closed ? (
              <div
                role="status"
                className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
              >
                Fiche déjà close ({PHASE2_STATUS_LABELS[current.phase2Status].toLowerCase()}). Rien
                à consigner ici. Entrée passe à la suivante.
              </div>
            ) : (
              <>
                {slots === null ? (
                  <>
                    <fieldset className="flex flex-col gap-2" disabled={send.isPending}>
                      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
                        Méthode obtenue
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {METHOD_KEYS.map(({ key, method }) => (
                          <Button
                            key={key}
                            variant="outline"
                            onClick={() => {
                              record('METHOD_OBTAINED', method);
                            }}
                          >
                            <Kbd>{key}</Kbd>
                            {ENROLLMENT_METHOD_LABELS[method]}
                          </Button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="flex flex-col gap-2" disabled={send.isPending}>
                      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
                        Non obtenue
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={startCallback}>
                          <Kbd>5</Kbd>
                          {CALL_OUTCOME_LABELS.CALLBACK}
                        </Button>
                        {OUTCOME_KEYS.map(({ key, outcome }) => (
                          <Button
                            key={key}
                            variant="outline"
                            onClick={() => {
                              record(outcome, null);
                            }}
                          >
                            <Kbd>{key}</Kbd>
                            {CALL_OUTCOME_LABELS[outcome]}
                          </Button>
                        ))}
                        <Button
                          variant={draftOutcome === 'OTHER' ? 'default' : 'outline'}
                          onClick={startOther}
                        >
                          <Kbd>8</Kbd>
                          Autre
                        </Button>
                      </div>
                    </fieldset>
                  </>
                ) : (
                  <fieldset className="flex flex-col gap-3" disabled={send.isPending}>
                    <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
                      Quand rappeler
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot) => (
                        <Button
                          key={slot.key}
                          variant="outline"
                          className="h-auto flex-col items-start gap-0.5 py-2"
                          onClick={() => {
                            record('CALLBACK', null, slot.at);
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <Kbd>{slot.key}</Kbd>
                            {slot.label}
                          </span>
                          <span className="pl-7 text-[0.75rem] font-[400] text-muted-foreground">
                            {formatCallbackAt(slot.at, now)}
                          </span>
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="console-callback-at"
                        className="flex items-center gap-2 text-[0.875rem] font-[600]"
                      >
                        <Kbd>0</Kbd>
                        Autre échéance
                      </label>
                      <Input
                        id="console-callback-at"
                        ref={callbackRef}
                        type="datetime-local"
                        className="max-w-64"
                        value={freeCallback}
                        onChange={(event) => {
                          setFreeCallback(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          event.preventDefault();
                          validate();
                        }}
                      />
                      <p className="text-[0.75rem] text-muted-foreground">
                        Heure de Dakar (UTC+0), quel que soit le fuseau de ce poste. Échap revient
                        aux issues.
                      </p>
                    </div>
                  </fieldset>
                )}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="console-comment" className="text-[0.875rem] font-[600]">
                    Commentaire
                    {draftOutcome === 'OTHER' ? ' (obligatoire pour Autre)' : ''}
                  </label>
                  <Textarea
                    id="console-comment"
                    ref={commentRef}
                    value={comment}
                    onChange={(event) => {
                      setComment(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.shiftKey) return;
                      event.preventDefault();
                      validate();
                    }}
                    placeholder="Entrée valide, Maj+Entrée passe à la ligne."
                  />
                </div>
              </>
            )}
          </>
        )}
      </section>

      <section aria-label="Contexte" className="flex flex-col gap-5 text-[0.875rem]">
        <div className="flex flex-col gap-1">
          <h3 className="text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
            Dernier appel
          </h3>
          {current === undefined || current.lastAttemptAt === null ? (
            <p className="text-muted-foreground">Jamais appelée.</p>
          ) : (
            <>
              <p>
                {formatDateTime(current.lastAttemptAt)}
                {current.lastOutcome === null
                  ? ''
                  : ` · ${CALL_OUTCOME_LABELS[current.lastOutcome]}`}
              </p>
              {current.lastComment === null ? null : (
                <p className="text-muted-foreground">« {current.lastComment} »</p>
              )}
            </>
          )}
          <p className="text-[0.75rem] text-muted-foreground">
            L’API ne renvoie que la dernière tentative : les appels antérieurs ne sont pas
            consultables ici.
          </p>
        </div>

        {current === undefined ? null : (
          <div className="flex flex-col gap-1">
            <h3 className="text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
              Représentant
            </h3>
            <p className="font-[600]">{current.representantName ?? 'Aucun'}</p>
            <p className="text-muted-foreground">
              {current.representantPhoneE164 === null
                ? '–'
                : formatPhone(current.representantPhoneE164)}
            </p>
            <p className="text-muted-foreground">
              {formatNumber(repFiches)} fiche{repFiches > 1 ? 's' : ''} dans cette file
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <h3 className="text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
            Session
          </h3>
          <p>
            {formatNumber(log.length)} appel{log.length > 1 ? 's' : ''} consigné
            {log.length > 1 ? 's' : ''} · {formatNumber(methodCount)} méthode
            {methodCount > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start px-0"
            onClick={() => {
              setHelpOpen((open) => !open);
            }}
          >
            Carte clavier
            <Kbd>?</Kbd>
          </Button>
          {helpOpen ? (
            <dl className="flex flex-col gap-1">
              {KEYBOARD_MAP.map(([keys, what]) => (
                <div key={keys} className="flex items-baseline gap-2">
                  <dt className="w-24 shrink-0">
                    <Kbd>{keys}</Kbd>
                  </dt>
                  <dd className="text-muted-foreground">{what}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      <Dialog open={palette} onOpenChange={setPalette}>
        <DialogContent className="overflow-hidden p-0">
          <DialogTitle className="sr-only">Aller à une fiche</DialogTitle>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Nom ou numéro…"
              value={paletteSearch}
              onValueChange={setPaletteSearch}
            />
            <CommandList>
              <CommandEmpty>Aucune fiche.</CommandEmpty>
              <CommandGroup>
                {items
                  .filter((row) =>
                    matchesSearch(`${row.nom} ${row.prenom} ${row.phoneE164}`, paletteSearch),
                  )
                  .slice(0, 30)
                  .map((row) => (
                    <CommandItem
                      key={row.id}
                      value={row.id}
                      onSelect={() => {
                        setSelectedId(row.id);
                        setOpenedId(row.id);
                        setPalette(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {row.nom} {row.prenom}
                      </span>
                      <span className="shrink-0 text-[0.75rem] text-muted-foreground">
                        {queueLabel(row, now, schedules)}
                      </span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Le témoin n'annonce aucun calcul : il montre le tri appliqué, la raison de la
 * fiche de tête, et se défait.
 */
function SortExplainer({
  counts,
  head,
  now,
  schedules,
  undated,
  rawOrder,
  onToggleOrder,
}: {
  counts: Record<string, number>;
  head: ProspectRow | undefined;
  now: number;
  schedules: CallbackSchedules;
  undated: number;
  rawOrder: boolean;
  onToggleOrder: () => void;
}) {
  const rules = (['due', 'never', 'callback', 'unreachable', 'other'] as const).filter(
    (bucket) => (counts[bucket] ?? 0) > 0,
  );

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" aria-label="Pourquoi cet ordre" />}>
        <SparklesIcon aria-hidden="true" />
        {rawOrder ? 'Tri désactivé' : `${String(rules.length)} règles de tri`}
      </PopoverTrigger>
      <PopoverContent className="w-80 text-[0.8125rem]">
        <ul className="flex flex-col gap-1">
          {rules.map((bucket) => (
            <li key={bucket} className="flex justify-between gap-2">
              <span>{QUEUE_BUCKET_LABELS[bucket]}</span>
              <span className="text-muted-foreground">{formatNumber(counts[bucket] ?? 0)}</span>
            </li>
          ))}
        </ul>

        {head === undefined ? null : (
          <p className="pt-2 text-muted-foreground">
            En tête : {head.nom} {head.prenom}, {queueLabel(head, now, schedules)}.
          </p>
        )}

        <p className="pt-2 text-muted-foreground">
          Un rappel daté remonte à l’heure promise, retards en tête. Une échéance à venir attend son
          heure.
        </p>

        {undated > 0 ? (
          <p className="pt-2 text-muted-foreground">
            {formatNumber(undated)} fiche{undated > 1 ? 's' : ''} « à rappeler » sans échéance :
            l’ordre y suit l’ancienneté du dernier appel, ce n’est pas une date promise.
          </p>
        ) : null}

        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onToggleOrder}>
          {rawOrder ? 'Rétablir le tri' : 'Tout défaire'}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ConsoleSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)_22.5rem]">
      <Skeleton className="h-96" />
      <Skeleton className="h-96" />
      <Skeleton className="h-96" />
    </div>
  );
}
