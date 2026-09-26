'use client';

import { ThreadPrimitive, useAui } from '@assistant-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkCheckIcon, BookmarkIcon, PinIcon, SparklesIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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
  CLE_QUESTIONS,
  enregistrerQuestion,
  epinglerQuestion,
  lireQuestions,
  supprimerQuestion,
} from '@/lib/data/assistant';
import { toastApiError } from '@/lib/mutation-feedback';

const EPINGLEES_MAX = 8;
const LIBELLE_MAX = 80;

function useQuestions() {
  return useQuery({ queryKey: CLE_QUESTIONS, queryFn: lireQuestions });
}

function DialogueEnregistrer({
  question,
  ouvert,
  onOuvert,
}: {
  question: string;
  ouvert: boolean;
  onOuvert: (ouvert: boolean) => void;
}) {
  const client = useQueryClient();
  const [libelle, setLibelle] = useState(question.slice(0, LIBELLE_MAX));
  const [partagee, setPartagee] = useState(false);
  const enregistrer = useMutation({
    mutationFn: enregistrerQuestion,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CLE_QUESTIONS });
      onOuvert(false);
      toast.success('Question enregistrée.');
    },
    onError: (error) => toastApiError(error, 'La question n’a pas été enregistrée.'),
  });
  return (
    <Dialog open={ouvert} onOpenChange={onOuvert}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer cette question</DialogTitle>
          <DialogDescription>{question}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input
            value={libelle}
            maxLength={LIBELLE_MAX}
            aria-label="Nom du raccourci"
            onChange={(e) => {
              setLibelle(e.target.value);
            }}
          />
          <label className="flex min-h-11 items-center gap-3 rounded-md border border-border p-3 text-[0.8125rem]">
            <input
              type="checkbox"
              checked={partagee}
              className="size-4 accent-[var(--primary)]"
              onChange={() => {
                setPartagee(!partagee);
              }}
            />
            Visible par les autres utilisateurs de l’assistant
          </label>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOuvert(false);
            }}
          >
            Annuler
          </Button>
          <Button
            disabled={libelle.trim() === '' || enregistrer.isPending}
            onClick={() => {
              enregistrer.mutate({ libelle: libelle.trim(), question, partagee });
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ActionsQuestion({ question }: { question: string }) {
  const client = useQueryClient();
  const questions = useQuestions();
  const [dialogue, setDialogue] = useState(false);
  const mienne = questions.data?.find((q) => q.miennes && q.question === question);
  const epinglee = mienne?.epinglee ?? false;
  const epingler = useMutation({
    mutationFn: async () => {
      const liste =
        mienne === undefined
          ? await enregistrerQuestion({
              libelle: question.slice(0, LIBELLE_MAX),
              question,
              partagee: false,
            })
          : [mienne];
      const cible = liste.find((q) => q.miennes && q.question === question);
      if (cible !== undefined) await epinglerQuestion(cible.id, !epinglee);
    },
    onSettled: () => client.invalidateQueries({ queryKey: CLE_QUESTIONS }),
    onError: (error) => toastApiError(error, 'La question n’a pas été épinglée.'),
  });
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={mienne !== undefined}
        onClick={() => {
          setDialogue(true);
        }}
      >
        {mienne === undefined ? (
          <BookmarkIcon aria-hidden="true" />
        ) : (
          <BookmarkCheckIcon aria-hidden="true" />
        )}
        {mienne === undefined ? 'Enregistrer' : 'Enregistrée'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={epinglee}
        disabled={epingler.isPending}
        onClick={() => {
          epingler.mutate();
        }}
      >
        <PinIcon aria-hidden="true" className={epinglee ? 'fill-current' : undefined} />
        {epinglee ? 'Épinglée' : 'Épingler'}
      </Button>
      {dialogue ? (
        <DialogueEnregistrer question={question} ouvert={dialogue} onOuvert={setDialogue} />
      ) : null}
    </>
  );
}

const PUCE =
  'rounded-full border border-border bg-card px-3 py-1.5 text-left text-[0.8125rem] text-foreground transition-colors hover:border-primary/40 hover:bg-secondary motion-reduce:transition-none';

export function PucesQuestions({ suggestions }: { suggestions: string[] }) {
  const client = useQueryClient();
  const enregistrees = useQuestions().data ?? [];
  const retirer = useMutation({
    mutationFn: supprimerQuestion,
    onSuccess: () => client.invalidateQueries({ queryKey: CLE_QUESTIONS }),
    onError: (error) => toastApiError(error, 'La question n’a pas été supprimée.'),
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((question) => (
          <ThreadPrimitive.Suggestion key={question} prompt={question} send className={PUCE}>
            {question}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
      {enregistrees.length === 0 ? null : (
        <p className="eyebrow text-muted-foreground">Questions enregistrées</p>
      )}
      <div className="flex flex-wrap gap-2 empty:hidden">
        {enregistrees.map((q) => (
          <span key={q.id} className="inline-flex items-center">
            <ThreadPrimitive.Suggestion
              prompt={q.question}
              send
              title={q.question}
              className={PUCE}
            >
              {q.epinglee ? <PinIcon aria-hidden="true" className="mr-1 inline size-3" /> : null}
              {q.libelle}
              {q.miennes ? '' : ` · ${q.auteur}`}
            </ThreadPrimitive.Suggestion>
            {q.miennes ? (
              <button
                type="button"
                aria-label={`Supprimer ${q.libelle}`}
                className="rounded-full p-2 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  retirer.mutate(q.id);
                }}
              >
                <TrashIcon className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

export function QuestionsEpinglees() {
  const aui = useAui();
  const epinglees = (useQuestions().data ?? [])
    .filter((q) => q.miennes && q.epinglee)
    .slice(0, EPINGLEES_MAX);
  if (epinglees.length === 0) return null;
  return (
    <section aria-label="Questions épinglées" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {epinglees.map((q) => (
        <button
          key={q.id}
          type="button"
          title={q.question}
          onClick={() => {
            aui.thread().append(q.question);
          }}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-[0.8125rem] shadow-elev-xs transition-colors hover:border-primary/40 hover:bg-secondary motion-reduce:transition-none"
        >
          <SparklesIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 truncate font-[600]">{q.libelle}</span>
        </button>
      ))}
    </section>
  );
}
