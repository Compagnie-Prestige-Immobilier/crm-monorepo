'use client';

import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
  type ToolCallMessagePartComponent,
} from '@assistant-ui/react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import { PucesQuestions } from '@/components/assistant/questions';
import { ReponseRiche, type Echange } from '@/components/assistant/reponse-assistant';
import { buttonVariants } from '@/components/ui/button';
import {
  CLE_SUGGESTIONS,
  lireSuggestions,
  poserQuestion,
  texteErreurAssistant,
  type ParametresAssistant,
} from '@/lib/data/assistant';

const APPARITION =
  'animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none';

function derniereQuestion(messages: readonly ThreadMessage[]): string {
  const partie = messages.at(-1)?.content.find((p) => p.type === 'text');
  return partie?.type === 'text' ? partie.text.trim() : '';
}

// Chaque question de suivi renvoie les paramètres de la réponse précédente.
function creerAdaptateur(): ChatModelAdapter {
  let precedent: ParametresAssistant | undefined;
  return {
    async run({ messages, abortSignal }) {
      const question = derniereQuestion(messages);
      try {
        const reponse = await poserQuestion(question, precedent, abortSignal);
        precedent = reponse.parametres;
        const echange: Echange = { question, reponse };
        return {
          content: [
            { type: 'text', text: reponse.texte },
            { type: 'data', name: 'reponse', data: echange },
          ],
        };
      } catch (error) {
        if (abortSignal.aborted) throw error;
        throw new Error(texteErreurAssistant(error), { cause: error });
      }
    },
  };
}

export function FournisseurAssistant({ children }: { children: ReactNode }) {
  const adaptateur = useMemo(() => creerAdaptateur(), []);
  const runtime = useLocalRuntime(adaptateur);
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

function Accueil() {
  const suggestions = useQuery({
    queryKey: CLE_SUGGESTIONS,
    queryFn: lireSuggestions,
    staleTime: Infinity,
  });
  return (
    <div className={`flex flex-col gap-4 py-2 ${APPARITION}`}>
      <p className="font-display text-[1.125rem] font-[700] tracking-[-0.01em]">
        Posez une question sur les chiffres de la base.
      </p>
      <PucesQuestions suggestions={suggestions.data ?? []} />
    </div>
  );
}

function Ecrit() {
  return (
    <span role="status" className="flex h-5 items-center gap-1">
      <span className="sr-only">L’assistant écrit…</span>
      {['0ms', '150ms', '300ms'].map((delai) => (
        <span
          key={delai}
          aria-hidden="true"
          className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce"
          style={{ animationDelay: delai }}
        />
      ))}
    </span>
  );
}

function Texte({ text }: { text: string }) {
  return <p className="whitespace-pre-line">{text}</p>;
}

function MessageUtilisateur() {
  return (
    <MessagePrimitive.Root className={`flex justify-end ${APPARITION}`}>
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[0.875rem] text-primary-foreground">
        <MessagePrimitive.Parts components={{ Text: Texte }} />
      </div>
    </MessagePrimitive.Root>
  );
}

type Outils = Record<string, ToolCallMessagePartComponent | undefined>;

function MessageAssistant({ outils }: { outils: Outils | undefined }) {
  return (
    <MessagePrimitive.Root className={`flex justify-start ${APPARITION}`}>
      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-[0.875rem] text-card-foreground has-[[data-riche]]:w-full">
        <MessagePrimitive.Parts
          components={{
            Text: Texte,
            data: { by_name: { reponse: ReponseRiche } },
            tools: { by_name: outils ?? {} },
          }}
        />
        <AuiIf condition={(s) => s.message.status?.type === 'running'}>
          <Ecrit />
        </AuiIf>
        <MessagePrimitive.Error>
          <ErrorPrimitive.Root role="alert" className="text-destructive">
            <ErrorPrimitive.Message />
          </ErrorPrimitive.Root>
        </MessagePrimitive.Error>
      </div>
    </MessagePrimitive.Root>
  );
}

function Message({ outils }: { outils: Outils | undefined }) {
  const role = useAuiState((s) => s.message.role);
  return role === 'user' ? <MessageUtilisateur /> : <MessageAssistant outils={outils} />;
}

// Le constructeur d'indicateurs reprend ce fil avec son accueil et ses étapes.
export function Conversation({
  accueil = <Accueil />,
  outils,
  consigne = 'Votre question',
  exemple = 'Combien d’appels hier ?',
}: {
  accueil?: ReactNode;
  outils?: Outils;
  consigne?: string;
  exemple?: string;
}) {
  return (
    <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col bg-background">
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        scrollToBottomOnInitialize={false}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pt-4"
      >
        <AuiIf condition={(s) => s.thread.messages.length === 0}>{accueil}</AuiIf>
        <ThreadPrimitive.Messages>{() => <Message outils={outils} />}</ThreadPrimitive.Messages>
        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto bg-background pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ComposerPrimitive.Root className="flex items-end gap-2 rounded-xl border border-border bg-card p-1.5 focus-within:border-ring">
            <ComposerPrimitive.Input
              rows={1}
              maxLength={500}
              placeholder={exemple}
              aria-label={consigne}
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[0.9375rem] outline-none placeholder:text-muted-foreground"
            />
            <ComposerPrimitive.Send
              aria-label="Envoyer"
              className={buttonVariants({ size: 'icon-sm', className: 'rounded-full' })}
            >
              <ArrowUpIcon aria-hidden="true" />
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
