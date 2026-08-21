'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyIcon, PencilIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { copyPhone, Kbd } from '@/components/console/console-ui';
import { useShortcuts } from '@/components/console/use-shortcuts';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
import { RelationBadge } from '@/components/representants/relation-badge';
import { RepresentantFormDialog } from '@/components/representants/representant-form-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  buildRepAttempt,
  buildRepQueue,
  callbackSlots,
  formatCallbackAt,
  nextAfter,
  pushRepCallAttempt,
  repRelationSettled,
  repScriptKeys,
  fetchRepScriptQueue,
  type RepAnswer,
} from '@/lib/data/console';
import { PROFESSIONS, scriptOf, whatsappLabel } from '@/lib/data/representants';
import { formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { REPRESENTANT_RELATION_LABELS } from '@/lib/representant-filters';
import { cn } from '@/lib/utils';

type Step =
  'identite' | 'ambassadeur' | 'whatsapp' | 'profession' | 'echeance' | 'suggestion' | 'fin';

const QUESTIONS: Record<Step, string> = {
  identite: '',
  ambassadeur: 'Souhaitez-vous être ambassadeur CPI ?',
  whatsapp: 'Son WhatsApp ?',
  profession: 'Sa profession ?',
  echeance: 'Quand rappeler ?',
  suggestion: 'Connaissez-vous quelqu’un qui pourrait l’être ?',
  fin: 'Appel consigné.',
};

const KEYBOARD_MAP: readonly (readonly [string, string])[] = [
  ['1 … 8', 'La réponse qui porte ce chiffre'],
  ['Entrée', 'Passer la question, ou la fiche'],
  ['Échap', 'Revenir à la question précédente'],
  ['↑ ↓', 'Parcourir la file'],
  ['Espace', 'Ouvrir la fiche sélectionnée'],
  ['C', 'Copier le numéro'],
  ['E', 'Corriger la fiche'],
  ['R', 'Ouvrir la fiche du représentant'],
  ['M', 'Changer de volet'],
  ['?', 'Afficher cette carte'],
];

interface Choice {
  readonly key: string;
  readonly label: string;
  readonly hint?: string;
  readonly run: () => void;
}

const digitsOf = (value: string): number => value.replace(/\D/gu, '').length;

export function RepScript() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const live = useLive();
  const freeRef = useRef<HTMLInputElement>(null);

  const [openedId, setOpenedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [done, setDone] = useState<readonly string[]>([]);
  const [step, setStep] = useState<Step>('identite');
  const [freeEntry, setFreeEntry] = useState(false);
  const [text, setText] = useState('');
  const [sugName, setSugName] = useState('');
  const [sugPhone, setSugPhone] = useState('');
  const [sugNote, setSugNote] = useState('');
  const [edit, setEdit] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sent, setSent] = useState(0);
  const [ambassadeurs, setAmbassadeurs] = useState(0);

  const queue = useQuery({
    queryKey: repScriptKeys.queue,
    queryFn: () => fetchRepScriptQueue(),
    refetchInterval: live.refetchInterval,
  });

  const loaded = useMemo(() => queue.data?.items ?? [], [queue.data]);
  const items = useMemo(
    () => buildRepQueue(loaded).filter((row) => !done.includes(row.id)),
    [loaded, done],
  );

  const current = useMemo(
    () => items.find((row) => row.id === openedId) ?? items[0],
    [items, openedId],
  );
  const selected = useMemo(
    () => items.find((row) => row.id === selectedId) ?? current,
    [items, selectedId, current],
  );

  const send = useMutation({
    mutationFn: (input: { representantId: string; answer: RepAnswer }) =>
      pushRepCallAttempt(buildRepAttempt(input.representantId, input.answer)),
    onSuccess: (_result, input) => {
      setSent((count) => count + 1);
      if (input.answer.relationStatus === 'AMBASSADEUR') setAmbassadeurs((count) => count + 1);
      void queryClient.invalidateQueries({ queryKey: repScriptKeys.root });
    },
    onError: (error) => {
      toastApiError(error, 'La réponse n’a pas été enregistrée.');
    },
  });

  /**
   * Une réponse tapée mais pas encore validée. Elle part au changement de fiche
   * ou à la fermeture du volet : aucun écran ne doit exiger un bouton final.
   */
  const pending = useRef<{ representantId: string; answer: RepAnswer } | null>(null);
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  useEffect(() => {
    return () => {
      const draft = pending.current;
      pending.current = null;
      if (draft !== null) sendRef.current.mutate(draft);
    };
  }, [current?.id]);

  const answer = useCallback(
    (value: RepAnswer) => {
      if (current === undefined) return;
      pending.current = null;
      send.mutate({ representantId: current.id, answer: value });
    },
    [current, send],
  );

  const stage = useCallback(
    (value: RepAnswer | null) => {
      pending.current =
        current === undefined || value === null
          ? null
          : { representantId: current.id, answer: value };
    },
    [current],
  );

  const nextFiche = useCallback(() => {
    if (current === undefined) return;
    const at = current.id;
    setDone((ids) => (ids.includes(at) ? ids : [...ids, at]));
    const next = nextAfter(items, at);
    setOpenedId(next);
    setSelectedId(next);
  }, [current, items]);

  const move = useCallback(
    (stepBy: number) => {
      if (items.length === 0) return;
      const at = items.findIndex((row) => row.id === selected?.id);
      const next = items[Math.min(items.length - 1, Math.max(0, at + stepBy))];
      if (next !== undefined) setSelectedId(next.id);
    },
    [items, selected],
  );

  useEffect(() => {
    setStep('identite');
    setFreeEntry(false);
    setText('');
    setSugName('');
    setSugPhone('');
    setSugNote('');
  }, [current?.id]);

  useEffect(() => {
    if (freeEntry) freeRef.current?.focus();
  }, [freeEntry, step]);

  const settled = current !== undefined && repRelationSettled(current);
  const now = queue.dataUpdatedAt === 0 ? Date.now() : queue.dataUpdatedAt;

  const openFree = useCallback(() => {
    setText('');
    stage(null);
    setFreeEntry(true);
  }, [stage]);

  const choices = useMemo<readonly Choice[]>(() => {
    if (current === undefined || settled) return [];

    if (step === 'identite') {
      return [
        {
          key: '1',
          label: 'Oui',
          run: () => {
            setStep('ambassadeur');
          },
        },
        {
          key: '2',
          label: 'Injoignable',
          run: () => {
            answer({ outcome: 'UNREACHABLE' });
            setStep('fin');
          },
        },
        {
          key: '3',
          label: 'Mauvais numéro',
          run: () => {
            answer({ outcome: 'WRONG_NUMBER' });
            setStep('fin');
          },
        },
        {
          key: '4',
          label: 'Corriger la fiche',
          run: () => {
            setEdit(true);
          },
        },
      ];
    }

    if (step === 'ambassadeur') {
      return [
        {
          key: '1',
          label: 'Oui',
          run: () => {
            answer({ outcome: 'REACHED', relationStatus: 'AMBASSADEUR' });
            setStep('whatsapp');
          },
        },
        {
          key: '2',
          label: 'Non',
          run: () => {
            answer({ outcome: 'REFUSED', relationStatus: 'REFUS' });
            setStep('suggestion');
          },
        },
        {
          key: '3',
          label: 'Pas maintenant',
          run: () => {
            answer({ outcome: 'CALLBACK', relationStatus: 'CONTACTE' });
            setStep('echeance');
          },
        },
      ];
    }

    if (step === 'whatsapp') {
      return [
        {
          key: '1',
          label: 'Le même que son téléphone',
          run: () => {
            answer({ outcome: 'REACHED', whatsappStatus: 'MEME_NUMERO' });
            setStep('profession');
          },
        },
        { key: '2', label: 'Un autre numéro', run: openFree },
        {
          key: '3',
          label: 'Pas de WhatsApp',
          run: () => {
            answer({ outcome: 'REACHED', whatsappStatus: 'AUCUN' });
            setStep('profession');
          },
        },
      ];
    }

    if (step === 'profession') {
      return [
        ...PROFESSIONS.map((profession, index) => ({
          key: String(index + 1),
          label: profession,
          run: () => {
            answer({ outcome: 'REACHED', profession });
            setStep('fin');
          },
        })),
        { key: String(PROFESSIONS.length + 1), label: 'Autre', run: openFree },
      ];
    }

    if (step === 'echeance') {
      return callbackSlots(Date.now()).map((slot) => ({
        key: slot.key,
        label: slot.label,
        hint: formatCallbackAt(slot.at, now),
        run: () => {
          answer({ outcome: 'CALLBACK', comment: `Rappeler ${formatCallbackAt(slot.at, now)}` });
          setStep('fin');
        },
      }));
    }

    if (step === 'suggestion') {
      return [
        { key: '1', label: 'Oui', run: openFree },
        {
          key: '2',
          label: 'Non',
          run: () => {
            setStep('fin');
          },
        },
      ];
    }

    return [];
  }, [current, settled, step, answer, openFree, now]);

  const commitWhatsapp = useCallback(() => {
    if (digitsOf(text) < 9) return;
    answer({ outcome: 'REACHED', whatsappStatus: 'AUTRE_NUMERO', whatsappE164: text.trim() });
    setStep('profession');
  }, [answer, text]);

  const commitProfession = useCallback(() => {
    const value = text.trim();
    if (value === '') return;
    answer({ outcome: 'REACHED', profession: value });
    setStep('fin');
  }, [answer, text]);

  const suggestionAnswer = useCallback(
    (phone: string, name: string, note: string): RepAnswer | null => {
      if (digitsOf(phone) < 9) return null;
      return {
        outcome: 'REFUSED',
        suggestedPhone: phone.trim(),
        ...(name.trim() === '' ? {} : { suggestedName: name.trim() }),
        ...(note.trim() === '' ? {} : { suggestedNote: note.trim() }),
      };
    },
    [],
  );

  const commitSuggestion = useCallback(() => {
    const value = suggestionAnswer(sugPhone, sugName, sugNote);
    if (value === null) return;
    answer(value);
    setStep('fin');
  }, [answer, suggestionAnswer, sugPhone, sugName, sugNote]);

  const back = useCallback(() => {
    stage(null);
    setText('');
    if (freeEntry) {
      setFreeEntry(false);
      return;
    }
    if (step === 'ambassadeur') setStep('identite');
    if (step === 'whatsapp') setStep('ambassadeur');
    if (step === 'profession') setStep('whatsapp');
    if (step === 'echeance' || step === 'suggestion') setStep('ambassadeur');
  }, [freeEntry, step, stage]);

  const onEnter = useCallback(() => {
    if (step === 'whatsapp') {
      setStep('profession');
      return;
    }
    if (step === 'profession') {
      setStep('fin');
      return;
    }
    nextFiche();
  }, [step, nextFiche]);

  useShortcuts(
    {
      ...Object.fromEntries(choices.map((choice) => [choice.key, choice.run])),
      Enter: onEnter,
      Escape: back,
      ArrowDown: () => {
        move(1);
      },
      ArrowUp: () => {
        move(-1);
      },
      Space: () => {
        if (selected !== undefined) setOpenedId(selected.id);
      },
      c: () => {
        if (current !== undefined) copyPhone(current.phoneE164);
      },
      e: () => {
        if (current !== undefined) setEdit(true);
      },
      r: () => {
        if (current !== undefined) {
          router.push(`/chues/representants/${encodeURIComponent(current.id)}`);
        }
      },
      '?': () => {
        setHelpOpen((open) => !open);
      },
    },
    !edit,
  );

  if (queue.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)_22.5rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (queue.isError) {
    return (
      <QueryErrorState
        error={queue.error}
        fallback="La file des représentants n’a pas pu être chargée."
        onRetry={() => {
          void queue.refetch();
        }}
      />
    );
  }

  const script = current === undefined ? null : scriptOf(current);
  const total = queue.data.total;

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)_22.5rem]">
      <section aria-label="File des représentants" className="flex flex-col gap-3">
        <p className="text-[0.875rem] font-[600]">{formatNumber(items.length)} à appeler</p>

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
                    {row.fullName}
                  </span>
                </span>
                <span className="pl-5 text-[0.75rem] text-muted-foreground">
                  {REPRESENTANT_RELATION_LABELS[row.relationStatus].toLowerCase()}
                </span>
              </button>
            </li>
          ))}
        </ol>

        {total > loaded.length ? (
          <p className="text-[0.75rem] text-muted-foreground">
            {formatNumber(loaded.length)} fiches chargées sur {formatNumber(total)}. La suite arrive
            au fur et à mesure que celles-ci sont traitées.
          </p>
        ) : null}
      </section>

      <section aria-label="Appel en cours" className="flex flex-col gap-5">
        {current === undefined || script === null ? (
          <p className="text-[0.9375rem]">
            Plus aucun représentant à appeler dans cette file. Revenez quand une nouvelle campagne
            d’appels représentants aura été tirée.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="select-all font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
                {formatPhone(current.phoneE164)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  copyPhone(current.phoneE164);
                }}
              >
                <CopyIcon aria-hidden="true" />
                Copier
                <Kbd>C</Kbd>
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
                  {current.fullName}
                </h2>
                <p className="text-[0.875rem] text-muted-foreground">
                  {current.departementName}
                  {current.iefName === null ? '' : ` · ${current.iefName}`}
                </p>
              </div>
              <RelationBadge status={current.relationStatus} />
            </div>

            {settled ? (
              <div
                role="status"
                className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
              >
                Relation déjà tranchée (
                {REPRESENTANT_RELATION_LABELS[current.relationStatus].toLowerCase()}). Rien à
                consigner ici. Entrée passe à la suivante.
              </div>
            ) : (
              <fieldset className="flex flex-col gap-3">
                <legend className="pb-2 text-[1rem] font-[600]">
                  {step === 'identite' ? `C’est bien ${current.fullName} ?` : QUESTIONS[step]}
                </legend>

                <div className="flex flex-wrap gap-2">
                  {choices.map((choice) => (
                    <Button
                      key={choice.key}
                      variant="outline"
                      className={
                        choice.hint === undefined ? '' : 'h-auto flex-col items-start py-2'
                      }
                      onClick={choice.run}
                    >
                      <span className="flex items-center gap-2">
                        <Kbd>{choice.key}</Kbd>
                        {choice.label}
                      </span>
                      {choice.hint === undefined ? null : (
                        <span className="pl-7 text-[0.75rem] font-[400] text-muted-foreground">
                          {choice.hint}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>

                {step === 'echeance' ? (
                  <p className="text-[0.75rem] text-muted-foreground">
                    L’heure convenue part dans le commentaire de l’appel : une campagne d’appels
                    représentants ne porte pas encore d’échéance datée.
                  </p>
                ) : null}

                {freeEntry && step === 'whatsapp' ? (
                  <div className="flex max-w-80 flex-col gap-1.5">
                    <label htmlFor="rep-whatsapp" className="text-[0.875rem] font-[600]">
                      Numéro WhatsApp
                    </label>
                    <Input
                      id="rep-whatsapp"
                      ref={freeRef}
                      inputMode="tel"
                      autoComplete="off"
                      placeholder="77 123 45 67"
                      value={text}
                      onChange={(event) => {
                        const value = event.target.value;
                        setText(value);
                        stage(
                          digitsOf(value) < 9
                            ? null
                            : {
                                outcome: 'REACHED',
                                whatsappStatus: 'AUTRE_NUMERO',
                                whatsappE164: value.trim(),
                              },
                        );
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        commitWhatsapp();
                      }}
                    />
                    <p className="text-[0.75rem] text-muted-foreground">
                      Le serveur remet le numéro en forme. Un numéro illisible fait refuser l’appel
                      entier.
                    </p>
                  </div>
                ) : null}

                {freeEntry && step === 'profession' ? (
                  <div className="flex max-w-80 flex-col gap-1.5">
                    <label htmlFor="rep-profession" className="text-[0.875rem] font-[600]">
                      Autre profession
                    </label>
                    <Input
                      id="rep-profession"
                      ref={freeRef}
                      autoComplete="off"
                      maxLength={120}
                      value={text}
                      onChange={(event) => {
                        const value = event.target.value;
                        setText(value);
                        stage(
                          value.trim() === ''
                            ? null
                            : { outcome: 'REACHED', profession: value.trim() },
                        );
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        commitProfession();
                      }}
                    />
                  </div>
                ) : null}

                {freeEntry && step === 'suggestion' ? (
                  <div className="flex max-w-96 flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="rep-sug-phone" className="text-[0.875rem] font-[600]">
                        Numéro du contact
                      </label>
                      <Input
                        id="rep-sug-phone"
                        ref={freeRef}
                        inputMode="tel"
                        autoComplete="off"
                        placeholder="77 123 45 67"
                        value={sugPhone}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSugPhone(value);
                          stage(suggestionAnswer(value, sugName, sugNote));
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          event.preventDefault();
                          commitSuggestion();
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="rep-sug-name" className="text-[0.875rem] font-[600]">
                        Nom du contact
                      </label>
                      <Input
                        id="rep-sug-name"
                        autoComplete="off"
                        maxLength={160}
                        value={sugName}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSugName(value);
                          stage(suggestionAnswer(sugPhone, value, sugNote));
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          event.preventDefault();
                          commitSuggestion();
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="rep-sug-note" className="text-[0.875rem] font-[600]">
                        Ce qu’il en dit
                      </label>
                      <Textarea
                        id="rep-sug-note"
                        rows={2}
                        maxLength={2000}
                        value={sugNote}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSugNote(value);
                          stage(suggestionAnswer(sugPhone, sugName, value));
                        }}
                      />
                    </div>
                    <Button className="self-start" onClick={commitSuggestion}>
                      Enregistrer le contact
                    </Button>
                  </div>
                ) : null}

                {step === 'fin' ? (
                  <p className="text-[0.875rem] text-muted-foreground">
                    Entrée passe au représentant suivant.
                  </p>
                ) : null}
              </fieldset>
            )}
          </>
        )}
      </section>

      <section aria-label="Contexte" className="flex flex-col gap-5 text-[0.875rem]">
        {script === null ? null : (
          <div className="flex flex-col gap-1">
            <h3 className="text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
              Ce que la fiche sait
            </h3>
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">WhatsApp</dt>
                <dd
                  className={cn(
                    'text-right',
                    script.whatsappStatus === 'NON_DEMANDE' && 'text-muted-foreground italic',
                  )}
                >
                  {whatsappLabel(script)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Profession</dt>
                <dd
                  className={cn(
                    'text-right',
                    script.profession === null && 'text-muted-foreground italic',
                  )}
                >
                  {script.profession ?? 'Non demandée'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Prospects apportés</dt>
                <dd>{formatNumber(current?.prospectCount ?? 0)}</dd>
              </div>
            </dl>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 self-start"
              onClick={() => {
                setEdit(true);
              }}
            >
              <PencilIcon aria-hidden="true" />
              Corriger la fiche
              <Kbd>E</Kbd>
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <h3 className="text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
            Session
          </h3>
          <p>
            {formatNumber(sent)} réponse{sent > 1 ? 's' : ''} consignée{sent > 1 ? 's' : ''} ·{' '}
            {formatNumber(ambassadeurs)} ambassadeur{ambassadeurs > 1 ? 's' : ''}
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

      {edit && current !== undefined ? (
        <RepresentantFormDialog open onOpenChange={setEdit} representant={current} />
      ) : null}
    </div>
  );
}
