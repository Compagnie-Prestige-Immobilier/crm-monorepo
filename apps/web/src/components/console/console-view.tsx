'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ConversionFields } from '@/components/console/conversion-fields';
import { copyPhone, Kbd } from '@/components/console/console-ui';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useLive } from '@/components/live/use-live';
import {
  AttemptRefused,
  ALREADY_COMPLETED,
  buildQueue,
  callbackKeys,
  callbackSlots,
  consoleKeys,
  conversionErrorFor,
  conversionFrom,
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
  validateConversion,
  type AttemptDraft,
  type CallbackSlot,
  type CallbackSchedules,
  type ConversionDraft,
  type ConversionErrors,
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
  { key: '9', method: 'APPOINTMENT' },
];

const OUTCOME_KEYS: readonly { key: string; outcome: CallOutcome }[] = [
  { key: '4', outcome: 'UNREACHABLE' },
  { key: '6', outcome: 'REFUSED' },
  { key: '7', outcome: 'WRONG_NUMBER' },
];

const KEYBOARD_MAP: readonly (readonly [string, string])[] = [
  ['1 2 3 9', 'Méthode obtenue, ouvre la conversion'],
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
  ['N', 'Ajouter un prospect sur ce représentant'],
  ['R', 'Fiche du représentant'],
  ['Ctrl/Cmd K', 'Palette'],
  ['?', 'Afficher cette carte'],
];

/**
 * UNE file, UN écran : les prospects. Les représentants ont désormais le leur
 * (`/chues/appels-representants`), qui est l'étape 1 du projet ; les empiler
 * derrière un onglet et une touche cachée faisait de deux étapes du parcours
 * un seul écran, que personne ne savait nommer.
 */
export function ConsoleView() {
  const router = useRouter();
  const pathname = usePathname();
  const projet = pathname.startsWith('/grand-public') ? 'GRAND_PUBLIC' : 'CHUES';
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
  const [conversion, setConversion] = useState<ConversionDraft | null>(null);
  const [conversionErrors, setConversionErrors] = useState<ConversionErrors>({});
  const [slots, setSlots] = useState<readonly CallbackSlot[] | null>(null);
  const [freeCallback, setFreeCallback] = useState('');
  const [done, setDone] = useState<readonly string[]>([]);
  // L'écran passe seul à la fiche suivante ; cette ligne est la seule trace de
  // ce qui vient d'être enregistré.
  const [enchaine, setEnchaine] = useState(false);
  const [refusedIds, setRefusedIds] = useState<readonly string[]>([]);
  const [rawOrder, setRawOrder] = useState(false);
  const [palette, setPalette] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const campaigns = useQuery({
    queryKey: [...consoleKeys.campaigns, projet],
    queryFn: () => fetchConsoleCampaigns(undefined, projet),
    retry: false,
    staleTime: 300_000,
  });

  const queue = useQuery({
    queryKey: [...consoleKeys.queue(campaignId), projet],
    queryFn: () => fetchConsoleQueue(campaignId, undefined, projet),
    refetchInterval: live.refetchInterval,
  });

  const callbacks = useQuery({
    queryKey: [...callbackKeys.list('week', null), projet],
    queryFn: () => fetchCallbacks('week', null, undefined, projet),
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
      setEnchaine(true);
      setDone((ids) => [...ids, input.prospect.id]);
      const next = nextAfter(items, input.prospect.id);
      setOpenedId(next);
      setSelectedId(next);
      setComment('');
      setDraftOutcome(null);
      setSlots(null);
      setConversion(null);
      setConversionErrors({});
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
        // Le verdict du serveur revient SOUS le champ qu'il refuse ; un simple
        // bandeau ferait relire onze champs pour en corriger un.
        const refused = conversionErrorFor(error.code);
        if (refused !== null) setConversionErrors({ [refused.field]: refused.message });
        toast.error(error.message);
        return;
      }
      toastApiError(error, 'L’appel n’a pas été enregistré.');
    },
  });

  const record = useCallback(
    (
      outcome: CallOutcome,
      method: EnrollmentMethod | null,
      callbackAt: string | null = null,
      renseignements?: ConversionDraft,
    ) => {
      if (current === undefined || closed || send.isPending) return;

      const draft: AttemptDraft = {
        outcome,
        method,
        comment,
        callbackAt,
        ...(renseignements === undefined ? {} : { conversion: renseignements }),
      };
      const problem = validateAttempt(draft);
      if (problem !== null) {
        toast.error(problem);
        return;
      }
      send.mutate({ prospect: current, draft });
    },
    [current, closed, send, comment],
  );

  /**
   * La méthode n'envoie plus rien à elle seule : elle ouvre les renseignements
   * de conversion, que l'adhésion exige désormais.
   */
  const startConversion = useCallback(
    (method: EnrollmentMethod) => {
      if (current === undefined || closed || send.isPending) return;
      setDraftOutcome(null);
      setSlots(null);
      setConversionErrors({});
      setConversion(conversionFrom(current, method));
    },
    [current, closed, send.isPending],
  );

  const submitConversion = useCallback(() => {
    if (conversion === null) return;

    const problems = validateConversion(conversion);
    setConversionErrors(problems);
    if (Object.keys(problems).length > 0) return;

    record('METHOD_OBTAINED', conversion.method, null, conversion);
  }, [conversion, record]);

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
    setConversion(null);
    setConversionErrors({});
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
    if (conversion !== null) {
      submitConversion();
      return;
    }
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
  }, [conversion, submitConversion, slots, freeCallback, draftOutcome, record, skip]);

  const outcomeShortcuts: Record<string, () => void> = {
    '1': () => {
      startConversion('PLATFORM');
    },
    '2': () => {
      startConversion('PHYSICAL');
    },
    '3': () => {
      startConversion('VOICE_OR_ELECTRONIC_MESSAGING');
    },
    '9': () => {
      startConversion('APPOINTMENT');
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

  // Le formulaire de conversion rend les chiffres inertes : ils y sont de la
  // saisie, pas des issues.
  let digitShortcuts = outcomeShortcuts;
  if (slots !== null) digitShortcuts = slotShortcuts;
  if (conversion !== null) digitShortcuts = {};

  useShortcuts(
    {
      ...digitShortcuts,
      Enter: validate,
      Escape: () => {
        setDraftOutcome(null);
        setComment('');
        setSlots(null);
        setConversion(null);
        setConversionErrors({});
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
        if (rep) router.push(`/chues/prospects/nouveau?rep=${encodeURIComponent(rep)}`);
      },
      r: () => {
        const rep = current?.representantId;
        if (rep) router.push(`/chues/representants/${encodeURIComponent(rep)}`);
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
    setConversion(null);
    setConversionErrors({});
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

  /*
    File vide : une seule colonne. Le compteur, le rail de droite et
    l'explication du tri décrivent une fiche et une file qui n'existent pas ;
    les rendre étalait trois colonnes de vide autour de deux boutons.
  */
  if (current === undefined) {
    return (
      <div className="flex w-full max-w-3xl flex-col gap-5">
        {requestedId !== null && !loaded.some((row) => row.id === requestedId) ? (
          <p
            role="alert"
            className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
          >
            La fiche ouverte depuis les rappels n’est pas dans cette file. Retirez le filtre de
            campagne, ou ouvrez-la depuis les prospects.
          </p>
        ) : null}

        <p className="text-[0.9375rem]">
          {campaignId === null
            ? 'Aucun prospect à appeler pour l’instant.'
            : 'Aucun prospect à appeler dans cette campagne.'}
        </p>

        <div className="flex flex-wrap gap-2">
          {campaignId === null ? null : (
            <Button
              variant="outline"
              onClick={() => {
                setCampaignId(null);
                setOpenedId(null);
                setSelectedId(null);
              }}
            >
              Voir toutes mes fiches
            </Button>
          )}
          <Link
            href={projet === 'CHUES' ? '/chues/prospects/nouveau' : '/grand-public/nouveau'}
            className={buttonVariants()}
          >
            Ajouter un prospect
          </Link>
          {/* L'étape 1 est propre à CHUES : le Grand Public n'a pas de
              représentant à qualifier avant d'ajouter un prospect. */}
          {projet === 'CHUES' ? (
            <Link
              href="/chues/appels-representants"
              className={buttonVariants({ variant: 'outline' })}
            >
              Qualifier un représentant
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const total = queue.data.total;
  const suivants = items.filter((row) => row.id !== current.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <section aria-label="Fiche courante" className="flex flex-col gap-4">
        {requestedId !== null && !loaded.some((row) => row.id === requestedId) ? (
          <p
            role="alert"
            className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
          >
            La fiche ouverte depuis les rappels n’est pas dans cette file. Retirez le filtre de
            campagne, ou ouvrez-la depuis les prospects.
          </p>
        ) : null}

        {enchaine ? (
          <p role="status" className="text-[0.875rem] font-[600] text-accent-text">
            Enregistré. Personne suivante.
          </p>
        ) : null}

        <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
          {current.nom} {current.prenom}
        </h2>

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

        {/* Le contexte de l'appel tient sous le numéro, en deux lignes grises :
            un rail d'expert n'a pas sa place pendant deux heures d'appels. */}
        <p className="text-[0.8125rem] text-muted-foreground">
          {current.banqueName} · {current.syndicatSigle} · {current.departementName} · Représentant{' '}
          {current.representantName ?? 'aucun'}
        </p>
        <p className="text-[0.8125rem] text-muted-foreground">
          {current.lastAttemptAt === null
            ? 'Jamais appelée.'
            : `Dernier appel : ${formatDateTime(current.lastAttemptAt)}${
                current.lastOutcome === null ? '' : ` · ${CALL_OUTCOME_LABELS[current.lastOutcome]}`
              }`}
          {current.lastComment === null ? '' : ` · « ${current.lastComment} »`}
        </p>

        {closed ? (
          <div
            role="status"
            className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
          >
            Fiche déjà close ({PHASE2_STATUS_LABELS[current.phase2Status].toLowerCase()}). Rien à
            consigner ici. Entrée passe à la suivante.
          </div>
        ) : (
          <>
            {conversion === null || slots !== null ? null : (
              <ConversionFields
                draft={conversion}
                errors={conversionErrors}
                phoneE164={current.phoneE164}
                disabled={send.isPending}
                onChange={(patch) => {
                  setConversion((draft) => (draft === null ? null : { ...draft, ...patch }));
                }}
              />
            )}

            {conversion !== null || slots !== null ? null : (
              <>
                <fieldset className="flex flex-col gap-2" disabled={send.isPending}>
                  <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
                    Il accepte : de quelle manière ?
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {METHOD_KEYS.map(({ key, method }) => (
                      <Button
                        key={key}
                        variant="outline"
                        onClick={() => {
                          startConversion(method);
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
                    Il n’accepte pas (pas encore)
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
            )}

            {slots === null ? null : (
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
                    Heure de Dakar (UTC+0), quel que soit le fuseau de ce poste. Échap revient aux
                    issues.
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

            {conversion === null ? null : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={submitConversion} disabled={send.isPending}>
                  Enregistrer l’adhésion
                  <Kbd>Entrée</Kbd>
                </Button>
                <Button
                  variant="ghost"
                  disabled={send.isPending}
                  onClick={() => {
                    setConversion(null);
                    setConversionErrors({});
                  }}
                >
                  Annuler
                  <Kbd>Échap</Kbd>
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* La file ne s'impose plus en colonne : une ligne qu'on déroule si on
          veut choisir soi-même, filtrer par campagne ou comprendre l'ordre. */}
      {suivants.length === 0 ? null : (
        <details className="rounded-lg border border-border bg-card px-3 py-2">
          <summary className="cursor-pointer list-none text-[0.875rem] font-[600] text-muted-foreground">
            Suivants à appeler · {formatNumber(suivants.length)}
          </summary>

          <div className="mt-2 flex flex-col gap-3">
            {campaigns.data !== undefined && campaigns.data.length > 1 ? (
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

            <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto scrollbar-thin">
              {suivants.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    data-highlighted={row.id === selected?.id ? '' : undefined}
                    onClick={() => {
                      setSelectedId(row.id);
                      setOpenedId(row.id);
                    }}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left',
                      'hover:bg-secondary',
                      'data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-ring',
                    )}
                  >
                    <span className="min-w-0 truncate text-[0.875rem] font-[600]">
                      {row.nom} {row.prenom}
                    </span>
                    <span className="text-[0.75rem] text-muted-foreground">
                      {queueLabel(row, now, schedules)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            {total > loaded.length ? (
              <p className="text-[0.75rem] text-muted-foreground">
                {formatNumber(loaded.length)} fiches affichées sur {formatNumber(total)}. Choisissez
                une campagne pour en voir moins.
              </p>
            ) : null}
          </div>
        </details>
      )}

      <details
        open={helpOpen}
        onToggle={(event) => {
          setHelpOpen(event.currentTarget.open);
        }}
      >
        <summary className="cursor-pointer list-none text-[0.8125rem] text-muted-foreground">
          Carte clavier <Kbd>?</Kbd>
        </summary>
        <dl className="mt-2 flex flex-col gap-1 text-[0.8125rem]">
          {KEYBOARD_MAP.map(([keys, what]) => (
            <div key={keys} className="flex items-baseline gap-2">
              <dt className="w-24 shrink-0">
                <Kbd>{keys}</Kbd>
              </dt>
              <dd className="text-muted-foreground">{what}</dd>
            </div>
          ))}
        </dl>
      </details>

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
      {/* Un LIEN, pas un bouton d'action : la question qu'on se pose devant la
          file (« pourquoi celle-là en tête ? ») n'est pas un geste de travail,
          et « 4 règles de tri » n'était pas une réponse. */}
      <PopoverTrigger render={<Button variant="link" size="sm" />}>
        {rawOrder ? 'Tri désactivé, pourquoi ?' : 'Pourquoi cet ordre ?'}
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
          {rawOrder ? 'Rétablir le tri' : 'Voir dans l’ordre du fichier'}
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
