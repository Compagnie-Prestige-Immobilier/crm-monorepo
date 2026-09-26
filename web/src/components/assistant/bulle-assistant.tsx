'use client';

import { AssistantModalPrimitive, useAuiEvent } from '@assistant-ui/react';
import { ChevronDownIcon, MessageCircleIcon, XIcon } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Conversation } from '@/components/assistant/conversation';
import { Button } from '@/components/ui/button';

const CHEMIN_ASSISTANT = '/admin/assistant';

const ICONE =
  'absolute size-6 transition-[scale,opacity] duration-200 motion-reduce:transition-none data-[etat=cache]:scale-50 data-[etat=cache]:opacity-0';

function libelleBulle(ouverte: boolean, nonLue: boolean): string {
  if (ouverte) return 'Réduire l’assistant';
  return nonLue ? 'Ouvrir l’assistant, nouvelle réponse' : 'Ouvrir l’assistant';
}

// Ouverte pour une adresse : naviguer, dont « Ouvrir dans l'écran », la referme.
export function BulleAssistant() {
  const pathname = usePathname();
  const recherche = useSearchParams();
  const adresse = `${pathname}?${recherche.toString()}`;
  const pleinePage = pathname === CHEMIN_ASSISTANT;
  const masquee = pleinePage || recherche.has('fiche');
  const [ouverteSur, setOuverteSur] = useState<string | null>(null);
  const [nonLue, setNonLue] = useState(false);
  const [conteneur, setConteneur] = useState<HTMLDivElement | null>(null);
  const ouverte = ouverteSur === adresse;

  const changer = (valeur: boolean) => {
    setOuverteSur(valeur ? adresse : null);
    if (valeur) setNonLue(false);
  };

  useAuiEvent('thread.runEnd', () => {
    if (!ouverte && !pleinePage) setNonLue(true);
  });

  useEffect(() => {
    if (masquee) return;
    const raccourci = (event: KeyboardEvent) => {
      // Le panneau de signalement garde Ctrl+K pour ses captures d'écran.
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      if (document.querySelector('[data-masque]') !== null) return;
      event.preventDefault();
      setOuverteSur((courant) => (courant === adresse ? null : adresse));
      setNonLue(false);
    };
    window.addEventListener('keydown', raccourci);
    return () => window.removeEventListener('keydown', raccourci);
  }, [masquee, adresse]);

  if (masquee) return null;

  return (
    <AssistantModalPrimitive.Root open={ouverte} onOpenChange={changer}>
      <AssistantModalPrimitive.Anchor className="fixed right-4 bottom-20 z-40 size-14 md:right-6 md:bottom-6">
        <AssistantModalPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={libelleBulle(ouverte, nonLue)}
            title="Assistant (Ctrl+K)"
            className="relative flex size-full items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elev-lg transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 active:scale-95 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MessageCircleIcon
              aria-hidden="true"
              data-etat={ouverte ? 'cache' : ''}
              className={ICONE}
            />
            <ChevronDownIcon
              aria-hidden="true"
              data-etat={ouverte ? '' : 'cache'}
              className={ICONE}
            />
            {nonLue ? (
              <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full border-2 border-background bg-destructive motion-safe:animate-in motion-safe:zoom-in-0" />
            ) : null}
          </button>
        </AssistantModalPrimitive.Trigger>
      </AssistantModalPrimitive.Anchor>
      <div
        ref={setConteneur}
        className="max-md:[&>[data-radix-popper-content-wrapper]]:inset-0! max-md:[&>[data-radix-popper-content-wrapper]]:transform-none!"
      />
      <AssistantModalPrimitive.Content
        portalProps={{ container: conteneur }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          conteneur?.querySelector('textarea')?.focus();
        }}
        sideOffset={12}
        aria-label="Assistant"
        className="z-50 flex h-[36rem] max-h-(--radix-popover-content-available-height) w-[26rem] max-w-[calc(100vw-2rem)] origin-(--radix-popover-content-transform-origin) flex-col overflow-hidden rounded-xl border border-border bg-background shadow-elev-lg outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-90 data-[state=closed]:duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-75 data-[state=open]:duration-300 data-[state=open]:ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:animate-none max-md:h-dvh max-md:max-h-none max-md:w-screen max-md:max-w-none max-md:rounded-none max-md:border-0 max-md:data-[state=open]:zoom-in-100 max-md:data-[state=open]:slide-in-from-bottom-full max-md:data-[state=closed]:slide-out-to-bottom-full"
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="font-display text-[1rem] font-[700]">Assistant</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fermer l’assistant"
            onClick={() => {
              changer(false);
            }}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </header>
        <div className="min-h-0 flex-1">
          <Conversation />
        </div>
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  );
}
