'use client';

import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { useState } from 'react';

import {
  ContexteConstructeur,
  EtapeApercu,
  EtapeComprendre,
  EtapeForme,
  type ArgsApercu,
  type ArgsComprendre,
  type ArgsForme,
  type ContexteEtapes,
} from '@/components/accueil/tableau-de-bord/etapes-constructeur';
import type { Catalogue, DonneesSource } from '@/components/accueil/tableau-de-bord/sources';
import { Conversation } from '@/components/assistant/conversation';
import { PUCE } from '@/components/assistant/questions';
import { marqueTexte } from '@/components/dashboard/chart-visual';
import {
  construireIndicateur,
  SOURCE_CALCUL,
  type DashboardEcran,
  type DashboardWidget,
  type Proposition,
} from '@/lib/data/disposition';
import { apiErrorText } from '@/lib/mutation-feedback';

type Message = ThreadMessageLike & { id: string };
type Contenu = Exclude<ThreadMessageLike['content'], string>;

const OUTILS = { comprendre: EtapeComprendre, forme: EtapeForme, apercu: EtapeApercu };
const CATALOGUE_MAX = 200;
const EXEMPLES = 3;

let dernierId = 0;
function message(role: 'user' | 'assistant', content: Contenu): Message {
  dernierId += 1;
  return { id: `constructeur-${String(dernierId)}`, role, content };
}

const texte = (role: 'user' | 'assistant', text: string): Message =>
  message(role, [{ type: 'text', text }]);

function etape(
  toolName: keyof typeof OUTILS,
  args: ArgsComprendre | ArgsForme | ArgsApercu,
): Message {
  const vide = message('assistant', []);
  return { ...vide, content: [{ type: 'tool-call', toolCallId: vide.id, toolName, args }] };
}

function erreur(text: string): Message {
  return {
    ...message('assistant', []),
    status: { type: 'incomplete', reason: 'error', error: text },
  };
}

function avecResultat(messages: Message[], toolCallId: string, result: string): Message[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') return m;
    const content = m.content.map((part) =>
      part.type === 'tool-call' && part.toolCallId === toolCallId ? { ...part, result } : part,
    );
    return { ...m, content };
  });
}

function catalogueApi(catalogue: Catalogue) {
  return Object.entries(catalogue)
    .slice(0, CATALOGUE_MAX)
    .map(([id, entree]) => ({
      id,
      libelle: entree.label,
      forme: entree.forme,
      ...(entree.description === undefined ? {} : { description: entree.description }),
      ...(entree.groupe === undefined ? {} : { groupe: entree.groupe }),
    }));
}

function widgetDe(
  { proposition, marque }: ArgsApercu,
  catalogue: Catalogue,
): Omit<DashboardWidget, 'id'> {
  if (proposition.calcul !== undefined)
    return { source: SOURCE_CALCUL, calcul: proposition.calcul, titre: proposition.titre, marque };
  const source = proposition.source ?? '';
  const titre = catalogue[source]?.label === proposition.titre ? {} : { titre: proposition.titre };
  return { source, marque, ...titre };
}

function texteDe(nouveau: AppendMessage): string {
  const partie = nouveau.content.find((p) => p.type === 'text');
  return partie?.type === 'text' ? partie.text.trim() : '';
}

function Accueil({ catalogue }: { catalogue: Catalogue }) {
  const exemples = Object.values(catalogue)
    .slice(0, EXEMPLES)
    .map((entree) => entree.label);
  return (
    <div className="flex flex-col gap-3 py-2 animate-in fade-in duration-300 motion-reduce:animate-none">
      <p className="font-display text-[1.0625rem] font-[700]">Quel chiffre voulez-vous suivre ?</p>
      <div className="flex flex-wrap gap-2">
        {exemples.map((exemple) => (
          <ThreadPrimitive.Suggestion key={exemple} prompt={exemple} send className={PUCE}>
            {exemple}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

export default function Constructeur({
  ecran,
  catalogue,
  plage,
  cleDonnees,
  chargerSource,
  onAjouter,
}: {
  ecran: DashboardEcran;
  catalogue: Catalogue;
  plage: { du: string; au: string };
  cleDonnees: readonly unknown[];
  chargerSource: (source: string) => Promise<DonneesSource | null>;
  onAjouter: (widget: Omit<DashboardWidget, 'id'>) => Promise<unknown>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [proposition, setProposition] = useState<Proposition | undefined>();
  const ajouterMessages = (...suivants: Message[]) => setMessages((m) => [...m, ...suivants]);
  const repondre = (id: string, result: string, ...suivants: Message[]) =>
    setMessages((m) => [...avecResultat(m, id, result), ...suivants]);

  const demander = async (demande: string): Promise<void> => {
    ajouterMessages(texte('user', demande));
    setEnCours(true);
    try {
      const { parIA: _parIA, ...reponse } = await construireIndicateur(
        ecran,
        demande,
        catalogueApi(catalogue),
        proposition,
      );
      if (reponse.proposition !== undefined) setProposition(reponse.proposition);
      ajouterMessages(etape('comprendre', reponse));
    } catch (error) {
      ajouterMessages(erreur(apiErrorText(error, 'Le constructeur n’a pas répondu. Réessayez.')));
    } finally {
      setEnCours(false);
    }
  };

  const etapes: ContexteEtapes = {
    catalogue,
    plage,
    cleDonnees,
    chargerSource,
    confirmer: (id, choisie) => {
      setProposition(choisie);
      repondre(
        id,
        choisie.titre,
        texte('user', choisie.titre),
        etape('forme', { proposition: choisie }),
      );
    },
    ajuster: (id) => {
      repondre(
        id,
        'ajuster',
        texte(
          'assistant',
          'Que faut-il changer ? La période, le projet, le découpage ou la forme.',
        ),
      );
    },
    choisirForme: (id, args) => {
      repondre(id, args.marque, texte('user', marqueTexte(args.marque).nom), etape('apercu', args));
    },
    ajouter: (id, args) => {
      if (enCours) return;
      setEnCours(true);
      onAjouter(widgetDe(args, catalogue))
        .then(() => {
          setProposition(undefined);
          repondre(
            id,
            'ajouter',
            texte(
              'assistant',
              `« ${args.proposition.titre} » est sur le tableau de bord. Quel autre chiffre voulez-vous suivre ?`,
            ),
          );
        })
        .catch((error: unknown) => {
          ajouterMessages(
            erreur(apiErrorText(error, 'L’indicateur n’a pas été ajouté. Réessayez.')),
          );
        })
        .finally(() => setEnCours(false));
    },
    recommencer: () => {
      setProposition(undefined);
      setMessages([]);
    },
  };

  const runtime = useExternalStoreRuntime<Message>({
    messages,
    isRunning: enCours,
    convertMessage: (m) => m,
    onNew: async (nouveau) => {
      const demande = texteDe(nouveau);
      if (demande !== '') await demander(demande);
    },
  });

  return (
    <ContexteConstructeur value={etapes}>
      <AssistantRuntimeProvider runtime={runtime}>
        <Conversation
          accueil={<Accueil catalogue={catalogue} />}
          outils={OUTILS}
          consigne="Votre demande"
          exemple={Object.values(catalogue)[0]?.label ?? ''}
        />
      </AssistantRuntimeProvider>
    </ContexteConstructeur>
  );
}
