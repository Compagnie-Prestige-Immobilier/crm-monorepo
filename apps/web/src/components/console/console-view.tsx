'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, CopyIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { copyPhone, Kbd } from '@/components/console/console-ui';
import { ConversionFields } from '@/components/console/conversion-fields';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  ALREADY_COMPLETED,
  AttemptRefused,
  callbackKeys,
  callbackSlots,
  conversionErrorFor,
  conversionFrom,
  formatCallbackAt,
  newAttemptInput,
  pushCallAttempt,
  validateAttempt,
  validateConversion,
  type AttemptDraft,
  type CallbackSlot,
  type ConversionDraft,
  type ConversionErrors,
} from '@/lib/data/console';
import { fetchProspect, fetchProspects } from '@/lib/data/prospects';
import { EMPTY_FILTERS } from '@/lib/filters';
import { dakarLocalToIso, formatDateTime, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  CALL_OUTCOME_LABELS,
  ENROLLMENT_METHOD_LABELS,
  PHASE2_STATUS_LABELS,
  type CallOutcome,
  type EnrollmentMethod,
  type ProspectFilters,
  type ProspectRow,
} from '@/lib/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

type Projet = 'CHUES' | 'GRAND_PUBLIC';

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
  ['1 2 3 9', 'Il accepte : ouvre les renseignements d’adhésion'],
  ['4', 'Injoignable'],
  ['5', 'À rappeler, puis échéance'],
  ['6', 'Refus'],
  ['7', 'Mauvais numéro'],
  ['8', 'Autre, puis commentaire'],
  ['1 … 6', 'Échéance proposée, après 5'],
  ['0', 'Saisir une autre échéance, après 5'],
  ['Entrée', 'Valider'],
  ['Échap', 'Annuler la saisie, ou revenir à la liste'],
  ['C', 'Copier le numéro'],
  ['N', 'Ajouter un prospect sur ce représentant'],
  ['R', 'Fiche du représentant'],
  ['?', 'Afficher cette carte'],
];

const REVELE = 'animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none';

/** Sans recherche : les vingt dernières fiches ajoutées au projet. */
const annuaireFilters = (projet: Projet, search: string): ProspectFilters => ({
  ...EMPTY_FILTERS,
  projet,
  search,
  pageSize: 20,
  sortBy: 'clientCreatedAt',
  sortDir: 'desc',
});

const nouveauHref = (projet: Projet): string =>
  projet === 'GRAND_PUBLIC' ? '/grand-public/nouveau' : '/chues/prospects/nouveau';

/**
 * Étape 3 : convertir un prospect. L'écran ouvre sur la recherche, la fiche
 * choisie reçoit l'appel, puis on revient à la liste. `?fiche=<id>` (depuis
 * les rappels) ouvre directement la fiche visée.
 */
export function ConsoleView({ projet = 'CHUES' }: { projet?: Projet }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [choisi, setChoisi] = useState<ProspectRow | null>(null);
  const [demandee, setDemandee] = useState<string | null>(searchParams.get('fiche'));
  const [search, setSearch] = useState('');
  const [confirme, setConfirme] = useState<string | null>(null);
  const cherche = useDebouncedValue(search).trim();

  const parLien = useQuery({
    queryKey: queryKeys.prospect(demandee ?? ''),
    queryFn: () => fetchProspect(demandee ?? ''),
    enabled: demandee !== null,
    retry: false,
  });

  const courante = choisi ?? (demandee === null ? null : (parLien.data ?? null));

  const annuaire = useQuery({
    queryKey: queryKeys.prospects(annuaireFilters(projet, cherche)),
    queryFn: () => fetchProspects(annuaireFilters(projet, cherche)),
    enabled: courante === null,
    placeholderData: (previous) => previous,
  });

  const revenir = useCallback(() => {
    setChoisi(null);
    setDemandee(null);
  }, []);

  if (courante !== null) {
    return (
      <Consignation
        key={courante.id}
        prospect={courante}
        projet={projet}
        onAbandon={revenir}
        onEnregistre={(nom) => {
          setConfirme(nom);
          revenir();
          void queryClient.invalidateQueries({ queryKey: ['prospects'] });
          void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
        }}
      />
    );
  }

  if (demandee !== null && parLien.isPending) return <ListeSkeleton />;

  return (
    <div className="flex w-full flex-col gap-5">
      {demandee !== null && parLien.isError ? (
        <p
          role="alert"
          className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
        >
          La fiche ouverte depuis les rappels n’a pas pu être chargée. Cherchez-la ci-dessous.
        </p>
      ) : null}

      {confirme === null ? null : (
        <p role="status" className={cn('text-[0.875rem] font-[600] text-accent-text', REVELE)}>
          Appel enregistré pour {confirme}.
        </p>
      )}

      <ChampAnnuaire value={search} onChange={setSearch} />

      <p className="text-[0.8125rem] text-muted-foreground">
        {cherche === ''
          ? 'Les vingt dernières fiches ajoutées. Cherchez un nom ou un numéro pour en voir d’autres.'
          : 'Choisissez qui vous venez d’appeler.'}
      </p>

      {annuaire.isError ? (
        <QueryErrorState
          error={annuaire.error}
          fallback="L’annuaire n’a pas pu être lu."
          onRetry={() => {
            void annuaire.refetch();
          }}
        />
      ) : annuaire.isPending ? (
        <ListeSkeleton />
      ) : annuaire.data.items.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-[0.9375rem]">
            {cherche === ''
              ? 'Aucun prospect pour l’instant.'
              : 'Aucun résultat. Vérifiez le nom ou le numéro.'}
          </p>
          <Link href={nouveauHref(projet)} className={cn(buttonVariants(), 'self-start')}>
            Ajouter un prospect
          </Link>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {annuaire.data.items.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  setConfirme(null);
                  setChoisi(row);
                }}
                className={cn(
                  'flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-border px-3 py-3 text-left',
                  'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[0.9375rem] font-[600]">
                    {row.nom} {row.prenom}
                  </span>
                  <span className="text-[0.8125rem] text-muted-foreground">
                    <span className="tabular-nums">{formatPhone(row.phoneE164)}</span>
                    {row.banqueName === null ? '' : ` · ${row.banqueName}`}
                    {row.lastAttemptAt === null
                      ? ' · jamais appelé'
                      : ` · dernier appel ${formatDateTime(row.lastAttemptAt)}`}
                  </span>
                </span>
                {row.phase2Status === 'PENDING' ? null : (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[0.75rem] text-muted-foreground">
                    {PHASE2_STATUS_LABELS[row.phase2Status]}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ChampAnnuaire({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="console-annuaire" className="text-[0.875rem] font-[600]">
        Quel prospect avez-vous appelé ?
      </label>
      <Input
        id="console-annuaire"
        ref={champ}
        type="search"
        autoComplete="off"
        placeholder="Chercher un prospect : nom ou numéro"
        className="h-12 text-[1rem]"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

function ListeSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}

/** La consignation d'un appel : issues au clavier, échéance, renseignements d'adhésion. */
function Consignation({
  prospect,
  projet,
  onAbandon,
  onEnregistre,
}: {
  prospect: ProspectRow;
  projet: Projet;
  onAbandon: () => void;
  onEnregistre: (nom: string) => void;
}) {
  const router = useRouter();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const callbackRef = useRef<HTMLInputElement>(null);

  const [comment, setComment] = useState('');
  const [draftOutcome, setDraftOutcome] = useState<CallOutcome | null>(null);
  const [conversion, setConversion] = useState<ConversionDraft | null>(null);
  const [conversionErrors, setConversionErrors] = useState<ConversionErrors>({});
  const [slots, setSlots] = useState<readonly CallbackSlot[] | null>(null);
  const [freeCallback, setFreeCallback] = useState('');
  const [refusee, setRefusee] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const nomComplet = `${prospect.nom} ${prospect.prenom}`;
  const closed = prospect.phase2Status !== 'PENDING' || refusee;
  const now = Date.now();

  const send = useMutation({
    mutationFn: (draft: AttemptDraft) => pushCallAttempt(newAttemptInput(prospect.id, draft)),
    onSuccess: () => {
      onEnregistre(nomComplet);
    },
    onError: (error) => {
      if (error instanceof AttemptRefused && error.code === ALREADY_COMPLETED) {
        setRefusee(true);
        toast.error(error.message);
        return;
      }
      if (error instanceof AttemptRefused) {
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
      if (closed || send.isPending) return;
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
      send.mutate(draft);
    },
    [closed, send, comment],
  );

  const startConversion = useCallback(
    (method: EnrollmentMethod) => {
      if (closed || send.isPending) return;
      setDraftOutcome(null);
      setSlots(null);
      setConversionErrors({});
      setConversion(conversionFrom(prospect, method));
    },
    [closed, send.isPending, prospect],
  );

  const submitConversion = useCallback(() => {
    if (conversion === null) return;
    const problems = validateConversion(conversion);
    setConversionErrors(problems);
    if (Object.keys(problems).length > 0) return;
    record('METHOD_OBTAINED', conversion.method, null, conversion);
  }, [conversion, record]);

  const startOther = useCallback(() => {
    if (closed) return;
    setDraftOutcome('OTHER');
    commentRef.current?.focus();
  }, [closed]);

  const startCallback = useCallback(() => {
    if (closed) return;
    setDraftOutcome(null);
    setFreeCallback('');
    setSlots(callbackSlots(Date.now()));
  }, [closed]);

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
    if (draftOutcome !== null) record(draftOutcome, null);
  }, [conversion, submitConversion, slots, freeCallback, draftOutcome, record]);

  const saisieEnCours =
    conversion !== null || slots !== null || draftOutcome !== null || comment !== '';

  const annuler = useCallback(() => {
    if (!saisieEnCours) {
      onAbandon();
      return;
    }
    setDraftOutcome(null);
    setComment('');
    setSlots(null);
    setConversion(null);
    setConversionErrors({});
    commentRef.current?.blur();
  }, [saisieEnCours, onAbandon]);

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

  let digitShortcuts = outcomeShortcuts;
  if (slots !== null) digitShortcuts = slotShortcuts;
  if (conversion !== null) digitShortcuts = {};

  useShortcuts({
    ...digitShortcuts,
    Enter: validate,
    Escape: annuler,
    c: () => {
      copyPhone(prospect.phoneE164);
    },
    n: () => {
      const rep = prospect.representantId;
      if (rep) router.push(`/chues/prospects/nouveau?rep=${encodeURIComponent(rep)}`);
    },
    r: () => {
      const rep = prospect.representantId;
      if (rep) router.push(`/chues/representants/${encodeURIComponent(rep)}`);
    },
    '?': () => {
      setHelpOpen((open) => !open);
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Button variant="ghost" className="self-start px-0" onClick={onAbandon}>
        <ArrowLeftIcon aria-hidden="true" />
        Revenir à la liste
      </Button>

      <section aria-label="Fiche courante" className="flex flex-col gap-4">
        <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{nomComplet}</h2>

        <div className="flex items-center gap-3">
          <span className="select-all font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
            {formatPhone(prospect.phoneE164)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              copyPhone(prospect.phoneE164);
            }}
          >
            <CopyIcon aria-hidden="true" />
            Copier
            <Kbd>C</Kbd>
          </Button>
        </div>

        <p className="text-[0.8125rem] text-muted-foreground">
          {[prospect.banqueName, prospect.syndicatSigle, prospect.departementName]
            .filter((part) => part !== null && part !== '')
            .join(' · ')}
          {projet === 'CHUES' ? ` · Représentant ${prospect.representantName ?? 'aucun'}` : ''}
        </p>
        <p className="text-[0.8125rem] text-muted-foreground">
          {prospect.lastAttemptAt === null
            ? 'Jamais appelée.'
            : `Dernier appel : ${formatDateTime(prospect.lastAttemptAt)}${
                prospect.lastOutcome === null
                  ? ''
                  : ` · ${CALL_OUTCOME_LABELS[prospect.lastOutcome]}`
              }`}
          {prospect.lastComment === null ? '' : ` · « ${prospect.lastComment} »`}
        </p>

        {closed ? (
          <div
            role="status"
            className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
          >
            Fiche déjà close ({PHASE2_STATUS_LABELS[prospect.phase2Status].toLowerCase()}). Rien à
            consigner ici.
          </div>
        ) : (
          <>
            {conversion === null || slots !== null ? null : (
              <ConversionFields
                draft={conversion}
                errors={conversionErrors}
                phoneE164={prospect.phoneE164}
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
          {KEYBOARD_MAP.filter(
            ([keys]) => projet === 'CHUES' || (keys !== 'N' && keys !== 'R'),
          ).map(([keys, what]) => (
            <div key={keys} className="flex items-baseline gap-2">
              <dt className="w-24 shrink-0">
                <Kbd>{keys}</Kbd>
              </dt>
              <dd className="text-muted-foreground">{what}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
