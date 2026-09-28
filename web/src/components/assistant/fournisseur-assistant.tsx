import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type FeedbackAdapter,
  type ThreadMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  chargerClient,
  converser,
  envoyerRetour,
  lireCapacites,
  URL_KAIROS,
  type EvenementKairos,
  type TourPersonnel,
  type Visibilite,
} from '@/lib/data/kairos';

export function messagesKairos(messages: readonly ThreadMessage[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-40)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      texte: m.content
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('\n'),
    }));
}

function contenu(texte: string, evenements: EvenementKairos[], question: string) {
  const actions = new Set(evenements.filter((e) => e.type === 'action').map((e) => e.etat.id));
  const parties = evenements
    .filter((e) => e.type !== 'confirmation' || !actions.has(e.proposition.id))
    .map((e) => {
      if (e.type === 'resultat' && e.nom === 'crm_interroger')
        return { type: 'data' as const, name: 'reponse', data: { question, reponse: e.resultat } };
      const annulable =
        e.type === 'action' &&
        (e.etat.annulable === true ||
          evenements.some(
            (p) =>
              p.type === 'confirmation' &&
              p.proposition.id === e.etat.id &&
              p.proposition.annulable,
          ));
      return { type: 'data' as const, name: 'kairos', data: { evenement: e, annulable } };
    });
  return [{ type: 'text' as const, text: texte }, ...parties];
}

function adaptateur(
  conversation: string,
  terminer: (id: string | undefined) => void,
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal, runConfig }) {
      const historique = messagesKairos(messages);
      const question = historique.at(-1)?.texte ?? '';
      let texte = '';
      const evenements: EvenementKairos[] = [];
      const requestID =
        typeof runConfig.custom?.reprise === 'string' ? runConfig.custom.reprise : undefined;
      for await (const e of converser(conversation, historique, abortSignal, requestID)) {
        if (e.type === 'fin') terminer(e.turnId);
        if (e.type === 'texte') texte += e.texte;
        else if (!['debut', 'etat'].includes(e.type)) {
          evenements.push(e);
        }
        if (evenements.length >= 100)
          throw new Error('La réponse contient trop de résultats. Précisez votre question.');
        yield { content: contenu(texte, evenements, question) };
      }
    },
  };
}

async function messagesHistorique(tours: TourPersonnel[]): Promise<ThreadMessageLike[]> {
  const client = await chargerClient();
  return [...tours].reverse().flatMap((tour) => {
    const question = tour.messages.find((m) => m.role === 'user')?.texte ?? '';
    const evenements = tour.evenements
      .map((e) => client.normaliserEvenement(e.type, e.data))
      .filter(
        (e): e is EvenementKairos =>
          e !== undefined && !['texte', 'debut', 'etat', 'fin'].includes(e.type),
      );
    if (tour.statut === 'interrupted') evenements.push({ type: 'fin', issue: 'annule' });
    if (tour.statut === 'failed') evenements.push({ type: 'fin', issue: 'echoue' });
    return tour.messages.map((m) => ({
      id: `${tour.id}-${String(m.sequence)}`,
      role: m.role,
      content:
        m.role === 'assistant'
          ? contenu(m.texte.replace(/\[action:[a-zA-Z0-9-]+\]/g, '').trim(), evenements, question)
          : [{ type: 'text' as const, text: m.texte }],
    }));
  });
}

type Session = {
  conversation: string;
  capacites: Visibilite | undefined;
  erreur: Error | null;
  nouvelle: () => void;
  reprendre: () => void;
  repriseDisponible: boolean;
  ouvrir: (id: string) => Promise<void>;
  chargerAnciens: () => Promise<void>;
  anciensDisponibles: boolean;
  chargerCapacites: () => void;
};
const SessionAssistant = createContext<Session | null>(null);
export function useSessionAssistant() {
  const session = useContext(SessionAssistant);
  if (session === null) throw new Error('Assistant absent.');
  return session;
}

export function FournisseurAssistant({ children }: { children: ReactNode }) {
  const [conversation, setConversation] = useState<string>(() => crypto.randomUUID());
  const identifiant = useRef(conversation);
  const ouverture = useRef(0);
  const [tours, setTours] = useState<TourPersonnel[]>([]);
  const [anciensDisponibles, setAnciensDisponibles] = useState(false);
  const capacites = useQuery({
    queryKey: ['assistant', 'capacites'],
    queryFn: lireCapacites,
    staleTime: 60_000,
    retry: false,
  });
  const modele = useMemo(
    () =>
      adaptateur(conversation, (id) =>
        setTours((actuels) =>
          actuels.map((tour) => (tour.id === id ? { ...tour, statut: 'termine' } : tour)),
        ),
      ),
    [conversation],
  );
  const feedback = useMemo<FeedbackAdapter>(
    () => ({
      async submit({ type }) {
        await envoyerRetour(conversation, type === 'positive');
      },
    }),
    [conversation],
  );
  const runtime = useLocalRuntime(modele, { adapters: { feedback } });
  const garderRepos = () => {
    if (runtime.thread.getState().isRunning)
      throw new Error('Arrêtez la réponse avant de changer de conversation.');
  };
  const nouvelle = () => {
    garderRepos();
    ouverture.current += 1;
    const id = crypto.randomUUID();
    identifiant.current = id;
    setConversation(id);
    setTours([]);
    setAnciensDisponibles(false);
    runtime.thread.reset();
  };
  const ouvrir = async (id: string) => {
    garderRepos();
    const version = ++ouverture.current;
    const client = await chargerClient();
    const liste = await client.lireConversation(URL_KAIROS, '', id);
    const messages = await messagesHistorique(liste);
    if (version !== ouverture.current) return;
    garderRepos();
    identifiant.current = id;
    setConversation(id);
    setTours(liste);
    setAnciensDisponibles(liste.length === 20);
    runtime.thread.reset(messages);
  };
  const chargerAnciens = async () => {
    garderRepos();
    const client = await chargerClient();
    const suite = await client.lireConversation(
      URL_KAIROS,
      '',
      conversation,
      undefined,
      tours.at(-1)?.id,
    );
    const liste = [...tours, ...suite].slice(0, 100);
    const precedents = await messagesHistorique(suite);
    garderRepos();
    if (identifiant.current !== conversation) return;
    const messages = [...precedents, ...runtime.thread.getState().messages];
    setTours(liste);
    setAnciensDisponibles(suite.length === 20 && liste.length < 100);
    runtime.thread.reset(messages);
  };
  const reprendre = () => {
    garderRepos();
    const tour = tours[0];
    if (!tour || tour.statut !== 'pending') return;
    const utilisateur = tour.messages.find((m) => m.role === 'user');
    if (!utilisateur) return;
    runtime.thread.startRun({
      parentId: `${tour.id}-${String(utilisateur.sequence)}`,
      runConfig: { custom: { reprise: tour.id } },
    });
  };
  return (
    <SessionAssistant.Provider
      value={{
        conversation,
        capacites: capacites.data,
        erreur: capacites.error,
        nouvelle,
        reprendre,
        repriseDisponible: tours[0]?.statut === 'pending',
        ouvrir,
        chargerAnciens,
        anciensDisponibles,
        chargerCapacites: () => {
          void capacites.refetch();
        },
      }}
    >
      <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
    </SessionAssistant.Provider>
  );
}
