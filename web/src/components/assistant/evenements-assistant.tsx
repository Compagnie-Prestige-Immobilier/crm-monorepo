import { type DataMessagePartComponent } from '@assistant-ui/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  chargerClient,
  chargerNavigateur,
  URL_KAIROS,
  type EtatAction,
  type EvenementKairos,
  type Proposition,
  type Geste,
  type Etape,
} from '@/lib/data/kairos';
import { apiErrorText } from '@/lib/mutation-feedback';
import { useSessionAssistant } from '@/components/assistant/fournisseur-assistant';

const ETATS: Record<string, string> = {
  en_attente: 'À confirmer',
  en_cours: 'Action en cours',
  incertaine: 'Résultat à vérifier',
  proposed: 'À confirmer',
  executee: 'Action effectuée',
  succeeded: 'Action effectuée',
  refusee: 'Action refusée',
  rejected: 'Action refusée',
  annulee: 'Action annulée',
  cancelled: 'Action annulée',
  echouee: 'Action échouée',
  failed: 'Action échouée',
  dispatching: 'Action en cours',
  outcome_unknown: 'Résultat à vérifier',
  expiree: 'Proposition expirée',
  expired: 'Proposition expirée',
};

type ProprietesAction = {
  proposition?: Proposition | undefined;
  initial?: EtatAction;
  annulable: boolean;
};
function titreAction({ proposition, initial }: ProprietesAction) {
  return proposition?.description || proposition?.nom || initial?.nom || 'Action';
}
function DetailsAction({
  proposition,
  etat,
}: {
  proposition?: Proposition | undefined;
  etat?: EtatAction | undefined;
}) {
  return (
    <>
      {proposition ? (
        <details>
          <summary>Voir les valeurs</summary>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(proposition.arguments, null, 2)}
          </pre>
        </details>
      ) : null}
      {etat ? <p role="status">{ETATS[etat.statut] ?? 'Résultat à vérifier'}</p> : null}
      {etat?.resultat ? <p className="whitespace-pre-wrap">{etat.resultat}</p> : null}
    </>
  );
}
function CommandesAction({
  etat,
  annulable,
  attente,
  executer,
}: {
  etat?: EtatAction | undefined;
  annulable: boolean;
  attente: boolean;
  executer: (verbe: 'confirmer' | 'refuser' | 'annuler') => Promise<void>;
}) {
  const disponible = useSessionAssistant().capacites?.capacites?.actions?.disponible === true;
  if (!disponible)
    return <p className="text-muted-foreground">Actions indisponibles pour cette application.</p>;
  if (!etat || ['en_attente', 'proposed'].includes(etat.statut))
    return (
      <div className="flex gap-2">
        <Button size="sm" disabled={attente} onClick={() => void executer('confirmer')}>
          Confirmer
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={attente}
          onClick={() => void executer('refuser')}
        >
          Refuser
        </Button>
      </div>
    );
  if (annulable && ['executee', 'succeeded'].includes(etat.statut))
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={attente}
        onClick={() => void executer('annuler')}
      >
        Annuler l’action
      </Button>
    );
  return null;
}
function Action(props: ProprietesAction) {
  const [modification, setModification] = useState<EtatAction>();
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState('');
  const etat = modification ?? props.initial ?? props.proposition?.etat;
  const id = props.proposition?.id ?? props.initial?.id ?? '';
  const executer = async (verbe: 'confirmer' | 'refuser' | 'annuler') => {
    setAttente(true);
    setErreur('');
    try {
      setModification(await (await chargerClient()).agirSur(URL_KAIROS, '', verbe, id));
    } catch (e) {
      setErreur(apiErrorText(e, 'L’action n’a pas abouti. Réessayez.'));
    } finally {
      setAttente(false);
    }
  };
  return (
    <section className="mt-3 space-y-2 rounded-md border p-3" aria-label="Action proposée">
      <p className="font-semibold">{titreAction(props)}</p>
      <DetailsAction proposition={props.proposition} etat={etat} />
      <CommandesAction
        etat={etat}
        annulable={props.annulable}
        attente={attente}
        executer={executer}
      />
      {erreur ? (
        <p role="alert" className="text-destructive">
          {erreur}
        </p>
      ) : null}
    </section>
  );
}

function Guidance({ geste, etapes }: { geste?: Geste; etapes?: Etape[] }) {
  const router = useRouter();
  const [erreur, setErreur] = useState('');
  const [effectue, setEffectue] = useState(false);
  const executer = async () => {
    try {
      const navigateur = await chargerNavigateur();
      if (geste) navigateur.executerGeste(geste, (url) => router.push(url));
      if (etapes) navigateur.demarrerVisite(etapes);
      setEffectue(true);
    } catch (e) {
      setErreur(apiErrorText(e, 'Cette étape n’est pas disponible sur cet écran.'));
    }
  };
  return (
    <div className="mt-3 space-y-2">
      <p>{geste?.message ?? 'Suivez les étapes sur cet écran.'}</p>
      <Button variant="outline" size="sm" onClick={() => void executer()}>
        {etapes ? 'Commencer la visite' : 'Afficher cette étape'}
      </Button>
      {effectue ? (
        <span role="status" className="sr-only">
          Étape affichée
        </span>
      ) : null}
      {erreur ? <p role="alert">{erreur}</p> : null}
    </div>
  );
}

export function LienTransmission({ lien, id }: { lien: string; id: number }) {
  let sur = false;
  try {
    sur = ['https:', 'http:'].includes(new URL(lien, location.origin).protocol);
  } catch {
    sur = false;
  }
  return (
    <p role="status">
      Ticket n° {id} créé.
      {sur ? (
        <>
          {' '}
          <a className="underline" href={lien} target="_blank" rel="noopener noreferrer">
            Suivre le ticket
          </a>
        </>
      ) : null}
    </p>
  );
}

export const EvenementAssistant: DataMessagePartComponent<{
  evenement: EvenementKairos;
  annulable: boolean;
}> = ({ data }) => {
  const e = data.evenement;
  switch (e.type) {
    case 'confirmation':
      return <Action proposition={e.proposition} annulable={e.proposition.annulable} />;
    case 'action':
      return <Action initial={e.etat} annulable={data.annulable} />;
    case 'geste':
      return <Guidance geste={e.geste} />;
    case 'visite':
      return <Guidance etapes={e.etapes} />;
    case 'erreur':
      return (
        <p role="alert" className="text-destructive">
          {e.message}
        </p>
      );
    case 'fin':
      return <FinReponse issue={e.issue} />;
    case 'transmission':
      return <LienTransmission lien={e.transmission.lien} id={e.transmission.id} />;
    case 'resultat':
      return (
        <details className="mt-2">
          <summary>Afficher le résultat</summary>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(e.resultat, null, 2).slice(0, 12_000)}
          </pre>
        </details>
      );
    default:
      return null;
  }
};

function FinReponse({ issue }: { issue: 'termine' | 'annule' | 'echoue' }) {
  if (issue === 'termine') return null;
  return (
    <p role="status" className="text-muted-foreground">
      {issue === 'annule'
        ? 'Réponse arrêtée.'
        : 'La réponse a échoué. Vous pouvez poser une nouvelle question.'}
    </p>
  );
}
