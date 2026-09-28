import { Historique } from '@/components/assistant/historique-assistant';
import { useAuiState } from '@assistant-ui/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSessionAssistant } from '@/components/assistant/fournisseur-assistant';
import { TransmissionAssistant } from '@/components/assistant/transmission-assistant';
import { AutomatisationsAssistant } from '@/components/assistant/automatisations-assistant';
import { apiErrorText } from '@/lib/mutation-feedback';

const LIBELLES: Record<string, string> = {
  conversation: 'Conversation',
  streaming: 'Réponse progressive',
  historique: 'Historique',
  reprise: 'Reprise après coupure',
  arret: 'Arrêt',
  resultats: 'Résultats',
  actions: 'Actions',
  gestes: 'Aide sur l’écran',
  visites: 'Visites guidées',
  voix: 'Voix',
  capture: 'Capture d’écran',
  transmission: 'Transfert au support',
  retours: 'Évaluation des réponses',
  regles: 'Règles',
  traitements: 'Tâches planifiées',
};
const MOTIFS: Record<string, string> = {
  non_configuree: 'Non configuré',
  interdite: 'Non autorisé',
  non_supportee: 'Non pris en charge',
  indisponible: 'Indisponible',
  desactivee_application: 'Désactivé dans le CRM',
};

export function MenuAssistant() {
  const session = useSessionAssistant();
  const enCours = useAuiState((s) => s.thread.isRunning);
  const [vue, setVue] = useState<
    'historique' | 'options' | 'transmission' | 'automatisations' | null
  >(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const disponibles = session.capacites?.capacites;
  const chargerAnciens = async () => {
    setChargement(true);
    try {
      await session.chargerAnciens();
    } catch (e) {
      setErreur(apiErrorText(e, 'Messages indisponibles.'));
    } finally {
      setChargement(false);
    }
  };
  return (
    <div className="shrink-0 border-b text-xs">
      <div className="flex flex-wrap gap-1 px-3 py-1.5">
        <Button
          size="sm"
          variant="ghost"
          disabled={enCours}
          onClick={() => {
            session.nouvelle();
            setVue(null);
          }}
        >
          Nouvelle
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={enCours || !disponibles?.historique?.disponible}
          aria-expanded={vue === 'historique'}
          onClick={() => setVue(vue === 'historique' ? null : 'historique')}
        >
          Historique
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={vue === 'options'}
          onClick={() => setVue(vue === 'options' ? null : 'options')}
        >
          Options
        </Button>
        {session.anciensDisponibles ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={enCours || chargement}
            onClick={() => void chargerAnciens()}
          >
            Messages précédents
          </Button>
        ) : null}
      </div>
      <RepriseAssistant />
      {erreur ? (
        <p role="alert" className="px-3 text-destructive">
          {erreur}
        </p>
      ) : null}
      {vue ? (
        <div
          className="max-h-72 overflow-y-auto border-t px-3 py-2"
          aria-label="Options de l’assistant"
        >
          <div className="mb-2 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setVue(null)}>
              Fermer les options
            </Button>
          </div>
          <PanneauAssistant vue={vue} setVue={setVue} />
        </div>
      ) : null}
    </div>
  );
}

function OptionsAssistant({
  setVue,
}: {
  setVue: (vue: 'transmission' | 'automatisations') => void;
}) {
  const session = useSessionAssistant();
  const enCours = useAuiState((s) => s.thread.isRunning);
  const disponibles = session.capacites?.capacites;
  return (
    <div className="space-y-3">
      {session.erreur ? (
        <p role="alert">
          {apiErrorText(session.erreur, 'Options indisponibles.')}{' '}
          <Button variant="link" onClick={session.chargerCapacites}>
            Réessayer
          </Button>
        </p>
      ) : null}
      {disponibles?.transmission?.disponible ? (
        <Button
          size="sm"
          variant="outline"
          disabled={enCours}
          onClick={() => setVue('transmission')}
        >
          Transférer au support
        </Button>
      ) : null}
      {['regles', 'traitements'].some((nom) => disponibles?.[nom]?.disponible) ? (
        <Button size="sm" variant="outline" onClick={() => setVue('automatisations')}>
          Règles et tâches
        </Button>
      ) : null}
      <ListeCapacites />
    </div>
  );
}

function PanneauAssistant({
  vue,
  setVue,
}: {
  vue: string;
  setVue: (vue: 'transmission' | 'automatisations' | null) => void;
}) {
  switch (vue) {
    case 'historique':
      return <Historique fermer={() => setVue(null)} />;
    case 'transmission':
      return <TransmissionAssistant />;
    case 'automatisations':
      return <AutomatisationsAssistant />;
    default:
      return <OptionsAssistant setVue={setVue} />;
  }
}

function ListeCapacites() {
  const disponibles = useSessionAssistant().capacites?.capacites;
  return (
    <dl className="space-y-1">
      {Object.entries(LIBELLES).map(([nom, libelle]) => {
        const c = disponibles?.[nom];
        return (
          <div key={nom} className="flex justify-between gap-3">
            <dt>{libelle}</dt>
            <dd>
              {c?.disponible
                ? 'Disponible'
                : (MOTIFS[c?.motif ?? 'indisponible'] ?? 'Indisponible')}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function RepriseAssistant() {
  const session = useSessionAssistant();
  const enCours = useAuiState((s) => s.thread.isRunning);
  if (!session.repriseDisponible || enCours) return null;
  return (
    <Button size="sm" variant="outline" onClick={session.reprendre}>
      Reprendre la réponse
    </Button>
  );
}
