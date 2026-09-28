'use client';

import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  type ToolCallMessagePartComponent,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpIcon, SquareIcon, ThumbsUpIcon, ThumbsDownIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { PucesQuestions } from '@/components/assistant/questions';
import { ReponseRiche } from '@/components/assistant/reponse-assistant';
import { buttonVariants } from '@/components/ui/button';
import { CLE_SUGGESTIONS, lireSuggestions } from '@/lib/data/assistant';

import { CAPACITES_ASSISTANT } from '@/lib/data/kairos';
import { EvenementAssistant } from '@/components/assistant/evenements-assistant';
import { MenuAssistant } from '@/components/assistant/menu-assistant';

const APPARITION =
  'animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none';

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

function TexteAssistant() {
  return (
    <MarkdownTextPrimitive
      className="space-y-2 break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto"
      components={{ img: () => null }}
    />
  );
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
            Text: TexteAssistant,
            data: { by_name: { reponse: ReponseRiche, kairos: EvenementAssistant } },
            tools: { by_name: outils ?? {} },
          }}
        />
        <AuiIf condition={(s) => s.message.status?.type === 'running'}>
          <Ecrit />
        </AuiIf>
        <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="mt-2 flex gap-1">
          <ActionBarPrimitive.FeedbackPositive
            aria-label="Réponse utile"
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          >
            <ThumbsUpIcon aria-hidden="true" />
          </ActionBarPrimitive.FeedbackPositive>
          <ActionBarPrimitive.FeedbackNegative
            aria-label="Réponse inutile"
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
          >
            <ThumbsDownIcon aria-hidden="true" />
          </ActionBarPrimitive.FeedbackNegative>
        </ActionBarPrimitive.Root>
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
    <ThreadPrimitive.Root
      data-voix={CAPACITES_ASSISTANT.voix ? 'active' : 'desactivee'}
      className="flex h-full min-h-0 flex-col bg-background"
    >
      {outils === undefined ? <MenuAssistant /> : null}
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
            <AuiIf condition={(s) => !s.thread.isRunning}>
              <ComposerPrimitive.Send
                aria-label="Envoyer"
                className={buttonVariants({ size: 'icon-sm', className: 'rounded-full' })}
              >
                <ArrowUpIcon aria-hidden="true" />
              </ComposerPrimitive.Send>
            </AuiIf>
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel
                aria-label="Arrêter la réponse"
                className={buttonVariants({ size: 'icon-sm', className: 'rounded-full' })}
              >
                <SquareIcon aria-hidden="true" className="size-3 fill-current" />
              </ComposerPrimitive.Cancel>
            </AuiIf>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
