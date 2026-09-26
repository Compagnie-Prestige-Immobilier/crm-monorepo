'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkIcon, Loader2Icon, SendIcon, SparklesIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ReponseCard } from '@/components/assistant/reponse-assistant';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CLE_QUESTIONS,
  EXEMPLES,
  enregistrerQuestion,
  lireQuestions,
  poserQuestion,
  supprimerQuestion,
  type QuestionEnregistree,
  type ReponseAssistant,
} from '@/lib/data/assistant';
import { toastApiError } from '@/lib/mutation-feedback';

function Puce({ texte, onClick }: { texte: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-[0.8125rem] text-foreground hover:bg-secondary"
    >
      {texte}
    </button>
  );
}

function QuestionsEnregistrees({
  questions,
  onPoser,
}: {
  questions: QuestionEnregistree[];
  onPoser: (question: string) => void;
}) {
  const client = useQueryClient();
  const retirer = useMutation({
    mutationFn: supprimerQuestion,
    onSuccess: () => client.invalidateQueries({ queryKey: CLE_QUESTIONS }),
    onError: (error) => toastApiError(error, 'La question n’a pas été supprimée.'),
  });
  if (questions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Questions enregistrées
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <span
            key={q.id}
            className="group inline-flex items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 py-1"
          >
            <button
              type="button"
              className="text-[0.8125rem]"
              title={q.question}
              onClick={() => {
                onPoser(q.question);
              }}
            >
              {q.libelle}
              {q.miennes ? '' : ` · ${q.auteur}`}
            </button>
            {q.miennes ? (
              <button
                type="button"
                aria-label={`Supprimer ${q.libelle}`}
                className="rounded-full p-1 text-muted-foreground hover:text-destructive"
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
  const [libelle, setLibelle] = useState('');
  const [partagee, setPartagee] = useState(false);
  const enregistrer = useMutation({
    mutationFn: enregistrerQuestion,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CLE_QUESTIONS });
      onOuvert(false);
      setLibelle('');
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
            maxLength={80}
            placeholder="Nom du raccourci"
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

export function PanneauAssistant() {
  const [question, setQuestion] = useState('');
  const [posee, setPosee] = useState('');
  const [reponse, setReponse] = useState<ReponseAssistant | null>(null);
  const [aEnregistrer, setAEnregistrer] = useState(false);
  const questions = useQuery({ queryKey: CLE_QUESTIONS, queryFn: lireQuestions });

  const demander = useMutation({
    mutationFn: poserQuestion,
    onSuccess: (r) => {
      setReponse(r);
    },
    onError: (error) => toastApiError(error, 'L’assistant n’a pas répondu.'),
  });

  const poser = (texte: string) => {
    const propre = texte.trim();
    if (propre.length < 3 || demander.isPending) return;
    setQuestion(propre);
    setPosee(propre);
    demander.mutate(propre);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <p className="flex items-start gap-2 text-[0.8125rem] text-muted-foreground">
            <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            Posez une question sur les chiffres de la base.
          </p>
          <Textarea
            value={question}
            rows={3}
            maxLength={500}
            placeholder="Combien d’appels la semaine dernière ?"
            aria-label="Votre question"
            onChange={(e) => {
              setQuestion(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                poser(question);
              }
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">Ctrl + Entrée pour envoyer</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={question.trim().length < 3}
                onClick={() => {
                  setPosee(question.trim());
                  setAEnregistrer(true);
                }}
                className="gap-2"
              >
                <BookmarkIcon className="size-4" aria-hidden="true" />
                Enregistrer la question
              </Button>
              <Button
                disabled={question.trim().length < 3 || demander.isPending}
                onClick={() => {
                  poser(question);
                }}
                className="gap-2"
              >
                {demander.isPending ? (
                  <Loader2Icon className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <SendIcon className="size-4" aria-hidden="true" />
                )}
                Demander
              </Button>
            </div>
          </div>
          {reponse === null && !demander.isPending ? (
            <div className="flex flex-wrap gap-2">
              {EXEMPLES.map((exemple) => (
                <Puce
                  key={exemple}
                  texte={exemple}
                  onClick={() => {
                    poser(exemple);
                  }}
                />
              ))}
            </div>
          ) : null}
          <QuestionsEnregistrees questions={questions.data ?? []} onPoser={poser} />
        </CardContent>
      </Card>

      {demander.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          L’assistant lit la base…
        </p>
      ) : null}
      {reponse === null ? null : <ReponseCard reponse={reponse} />}
      <DialogueEnregistrer question={posee} ouvert={aEnregistrer} onOuvert={setAEnregistrer} />
    </div>
  );
}
