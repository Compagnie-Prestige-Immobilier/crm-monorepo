import { texteErreurAssistant, type ReponseAssistant } from '@/lib/data/assistant';

const URL_CONVERSATION = '/api/v1/assistant/kairos/conversation';
const URL_CLIENT = '/api/v1/assistant/kairos/client.js';

export const CAPACITES_ASSISTANT = { voix: false } as const;

type Message = { role: 'user' | 'assistant'; texte: string };
type Evenement =
  { type: 'texte'; texte: string } | { type: 'resultat'; nom: string; resultat: ReponseAssistant };
type Client = {
  envoyerRetour: (
    url: string,
    identite: string,
    conversation: string,
    resolu: boolean,
  ) => Promise<void>;
  converser: (
    url: string,
    identite: string,
    conversation: string,
    messages: Message[],
    contexte: { page: string; titre: string; erreurs: string[]; reperes: never[] },
    signal: AbortSignal,
  ) => AsyncGenerator<Evenement>;
};

export async function* converser(
  conversation: string,
  messages: Message[],
  signal: AbortSignal,
): AsyncGenerator<Evenement> {
  const client = await chargerClient();
  try {
    yield* client.converser(
      URL_CONVERSATION,
      '',
      conversation,
      messages,
      { page: location.pathname, titre: document.title, erreurs: [], reperes: [] },
      signal,
    );
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(texteErreurAssistant(error), { cause: error });
  }
}

export async function envoyerRetour(conversation: string, resolu: boolean): Promise<void> {
  const client = await chargerClient();
  await client.envoyerRetour(URL_CONVERSATION, '', conversation, resolu);
}

async function chargerClient(): Promise<Client> {
  try {
    return await import(/* @vite-ignore */ URL_CLIENT);
  } catch (error) {
    throw new Error('Kairos ne répond pas pour le moment. Réessayez.', { cause: error });
  }
}
