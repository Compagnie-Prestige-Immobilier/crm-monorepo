import { texteErreurAssistant, type ReponseAssistant } from '@/lib/data/assistant';

export const URL_KAIROS = '/api/v1/assistant/kairos/conversation';
const URL_MODULES = '/api/v1/assistant/kairos/';
let tentativeChargement = 0;
export const CAPACITES_ASSISTANT = { voix: false } as const;
export type MessageKairos = { role: 'user' | 'assistant'; texte: string };
type Contexte = {
  page: string;
  titre: string;
  erreurs: string[];
  reperes: { id: string; libelle: string; final?: boolean }[];
};
export type Proposition = {
  id: string;
  nom: string;
  description: string;
  arguments: Record<string, unknown>;
  annulable: boolean;
  etat?: EtatAction;
};
export type EtatAction = {
  id: string;
  nom?: string;
  statut: string;
  resultat?: string;
  annulable?: boolean;
};
export type Geste = {
  geste: 'montrer' | 'aller' | 'remplir' | 'cliquer';
  repere?: string;
  message?: string;
  valeur?: string;
  url?: string;
};
export type Etape = { selecteur: string; texte: string };
export type Transmission = { id: number; lien: string; captureJointe: boolean };
export type EvenementKairos = {
  sequence?: number;
  eventId?: string;
  turnId?: string;
  conversationId?: string;
} & (
  | { type: 'texte'; texte: string }
  | { type: 'erreur'; message: string; trace?: string }
  | { type: 'resultat'; nom: string; resultat: ReponseAssistant }
  | { type: 'confirmation'; proposition: Proposition }
  | { type: 'action'; etat: EtatAction }
  | { type: 'geste'; geste: Geste }
  | { type: 'visite'; etapes: Etape[] }
  | { type: 'transmission'; transmission: Transmission }
  | { type: 'debut' | 'etat'; donnees: Record<string, unknown> }
  | { type: 'fin'; issue: 'termine' | 'annule' | 'echoue' }
);
export type Capacite = { disponible: boolean; motif?: string };
export type Visibilite = {
  visible: boolean;
  nom: string;
  protocole?: number;
  capacites?: Record<string, Capacite>;
  limites?: Record<string, number>;
};
export type ConversationPersonnelle = { id: string; curseur: number; titre: string; date: string };
export type TourPersonnel = {
  id: string;
  statut: string;
  messages: ({ sequence: number; trace?: string } & MessageKairos)[];
  evenements: { sequence: number; type: string; data: Record<string, unknown> }[];
};
export type Regle = { action: string; active: boolean; maxParJour: number };
export type NouveauTraitement = {
  nom: string;
  genre: string;
  entrees: Record<string, unknown>;
  frequence: 'quotidien' | 'hebdomadaire' | 'mensuel';
  budgetMensuelCredits: number;
};
export type Traitement = NouveauTraitement & { id: number; actif: boolean; prochainLe: string };
export type Execution = {
  id: number;
  traitementId: number;
  startedAt: string;
  finishedAt: string;
  statut: string;
  erreur?: string;
  resultat?: string;
};

type Client = {
  normaliserEvenement: (type: string, data: Record<string, unknown>) => EvenementKairos | undefined;
  converser: (
    url: string,
    identite: string,
    conversation: string,
    messages: MessageKairos[],
    contexte: Contexte,
    signal?: AbortSignal,
    application?: string,
    requestID?: string,
  ) => AsyncGenerator<EvenementKairos>;
  envoyerRetour: (
    url: string,
    identite: string,
    conversation: string,
    resolu: boolean,
  ) => Promise<void>;
  lireVisibilite: (url: string, identite: string) => Promise<Visibilite>;
  listerConversations: (
    url: string,
    identite: string,
    application?: string,
    avant?: number,
  ) => Promise<ConversationPersonnelle[]>;
  lireConversation: (
    url: string,
    identite: string,
    conversation: string,
    application?: string,
    avant?: string,
  ) => Promise<TourPersonnel[]>;
  supprimerConversation: (url: string, identite: string, conversation: string) => Promise<void>;
  agirSur: (
    url: string,
    identite: string,
    verbe: 'confirmer' | 'refuser' | 'annuler',
    id: string,
  ) => Promise<EtatAction>;
  transmettre: (
    url: string,
    identite: string,
    conversation: string,
    messages: MessageKairos[],
    contexte: Contexte,
    application?: string,
    capture?: string | null,
  ) => Promise<Transmission>;
  lireRegles: (url: string, identite: string) => Promise<Regle[]>;
  definirRegle: (url: string, identite: string, regle: Regle) => Promise<Regle>;
  lireTraitements: (url: string, identite: string) => Promise<Traitement[]>;
  creerTraitement: (
    url: string,
    identite: string,
    traitement: NouveauTraitement,
  ) => Promise<Traitement>;
  supprimerTraitement: (url: string, identite: string, id: number) => Promise<void>;
  lireExecutions: (url: string, identite: string, id: number) => Promise<Execution[]>;
};
type NavigateurKairos = {
  contexteCourant: () => Contexte;
  executerGeste: (geste: Geste, naviguer: (url: string) => void) => void;
  demarrerVisite: (etapes: Etape[]) => void;
  captureDisponible: () => boolean;
  capturerEcran: () => Promise<string | null>;
  masquerCapture: (
    capture: string,
    rectangles: { x: number; y: number; largeur: number; hauteur: number }[],
  ) => Promise<string>;
};

async function chargerModule<T>(nom: string): Promise<T> {
  try {
    const url = `${URL_MODULES}${nom}.js?tentative=${String(tentativeChargement)}`;
    return await import(/* @vite-ignore */ url);
  } catch (error) {
    tentativeChargement += 1;
    throw new Error('Kairos ne répond pas pour le moment. Réessayez.', { cause: error });
  }
}
export const chargerClient = () => chargerModule<Client>('client');
export const chargerNavigateur = () => chargerModule<NavigateurKairos>('browser');

export async function* converser(
  conversation: string,
  messages: MessageKairos[],
  signal: AbortSignal,
  requestID?: string,
): AsyncGenerator<EvenementKairos> {
  const [client, navigateur] = await Promise.all([chargerClient(), chargerNavigateur()]);
  try {
    yield* client.converser(
      URL_KAIROS,
      '',
      conversation,
      messages,
      navigateur.contexteCourant(),
      signal,
      undefined,
      requestID,
    );
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(texteErreurAssistant(error), { cause: error });
  }
}
export async function envoyerRetour(conversation: string, resolu: boolean): Promise<void> {
  const client = await chargerClient();
  await client.envoyerRetour(URL_KAIROS, '', conversation, resolu);
}
export async function lireCapacites(): Promise<Visibilite> {
  const client = await chargerClient();
  const etat = await client.lireVisibilite(URL_KAIROS, '');
  const navigateur = await chargerNavigateur();
  const capture = navigateur.captureDisponible()
    ? etat.capacites?.capture
    : { disponible: false, motif: 'non_supportee' };
  return {
    ...etat,
    capacites: {
      ...etat.capacites,
      ...(capture ? { capture } : {}),
      voix: { disponible: CAPACITES_ASSISTANT.voix, motif: 'desactivee_application' },
    },
  };
}
