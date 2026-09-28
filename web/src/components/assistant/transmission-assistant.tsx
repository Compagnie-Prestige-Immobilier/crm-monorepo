import { useAuiState } from '@assistant-ui/react';
import { useRef, useState } from 'react';
import ReactCrop, { type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { messagesKairos, useSessionAssistant } from '@/components/assistant/fournisseur-assistant';
import { LienTransmission } from '@/components/assistant/evenements-assistant';
import {
  chargerClient,
  chargerNavigateur,
  URL_KAIROS,
  type Transmission,
  type Visibilite,
} from '@/lib/data/kairos';
import { apiErrorText } from '@/lib/mutation-feedback';

export function TransmissionAssistant() {
  const session = useSessionAssistant();
  const messages = useAuiState((s) => s.thread.messages);
  const captureAutorisee = capturePermise(session.capacites);
  const [capture, setCapture] = useState<string | null>(null);
  const [accord, setAccord] = useState(false);
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState('');
  const [ticket, setTicket] = useState<Transmission>();
  const source = useRef<HTMLImageElement>(null);
  const [zone, setZone] = useState<PercentCrop>({ unit: '%', x: 0, y: 0, width: 25, height: 25 });
  const operation = async (action: () => Promise<void>) => {
    setAttente(true);
    setErreur('');
    try {
      await action();
    } catch (e) {
      setErreur(apiErrorText(e, 'Le transfert n’a pas abouti.'));
    } finally {
      setAttente(false);
    }
  };
  const prendre = () =>
    operation(async () => {
      const navigateur = await chargerNavigateur();
      if (!navigateur.captureDisponible())
        throw new Error('La capture n’est pas disponible dans ce navigateur.');
      setCapture(await navigateur.capturerEcran());
      setAccord(false);
    });
  const masquer = () =>
    operation(async () => {
      if (!capture) return;
      const image = source.current;
      if (!image) return;
      const rectangle = {
        x: (zone.x * image.naturalWidth) / 100,
        y: (zone.y * image.naturalHeight) / 100,
        largeur: (zone.width * image.naturalWidth) / 100,
        hauteur: (zone.height * image.naturalHeight) / 100,
      };
      setCapture(await (await chargerNavigateur()).masquerCapture(capture, [rectangle]));
      setAccord(false);
    });
  const transmettre = () =>
    operation(async () => {
      const [client, navigateur] = await Promise.all([chargerClient(), chargerNavigateur()]);
      setTicket(
        await client.transmettre(
          URL_KAIROS,
          '',
          session.conversation,
          messagesKairos(messages),
          navigateur.contexteCourant(),
          undefined,
          capture,
        ),
      );
      setCapture(null);
    });
  if (ticket) return <LienTransmission lien={ticket.lien} id={ticket.id} />;
  return (
    <section className="space-y-3" aria-label="Transfert au support">
      <p>
        Le support recevra l’historique récent de cette conversation et l’adresse de l’écran actuel.
        Des messages précédents peuvent aussi être transmis. Vérifiez les informations avant
        l’envoi.
      </p>
      <details>
        <summary>Voir les messages actuellement affichés</summary>
        <div className="max-h-40 overflow-auto whitespace-pre-wrap">
          {messagesKairos(messages).map((m, i) => (
            <p key={`${String(i)}-${m.role}`} className="my-2">
              <strong>{m.role === 'user' ? 'Vous' : 'Assistant'} : </strong>
              {m.texte}
            </p>
          ))}
        </div>
      </details>
      {captureAutorisee ? (
        <Button size="sm" variant="outline" disabled={attente} onClick={() => void prendre()}>
          Ajouter une capture
        </Button>
      ) : null}
      {capture ? (
        <div className="space-y-2">
          <p>Sélectionnez les informations sensibles à masquer.</p>
          <ReactCrop
            crop={zone}
            onChange={(_, pourcentage) => setZone(pourcentage)}
            disabled={attente}
          >
            <img
              ref={source}
              src={`data:image/png;base64,${capture}`}
              alt="Capture à vérifier avant envoi au support"
              className="max-h-56 max-w-full object-contain"
            />
          </ReactCrop>
          <Button size="sm" variant="outline" disabled={attente} onClick={() => void masquer()}>
            Masquer la zone
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={attente}
            onClick={() => {
              setCapture(null);
              setAccord(false);
            }}
          >
            Retirer la capture
          </Button>
        </div>
      ) : null}
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={accord}
          disabled={attente}
          onChange={(e) => setAccord(e.target.checked)}
        />
        J’ai vérifié les informations et j’accepte de les transmettre au support.
      </label>
      <Button
        size="sm"
        disabled={!accord || attente || messages.length === 0}
        onClick={() => void transmettre()}
      >
        {attente ? 'En cours…' : 'Envoyer au support'}
      </Button>
      {erreur ? (
        <p role="alert" className="text-destructive">
          {erreur}
        </p>
      ) : null}
    </section>
  );
}

function capturePermise(capacites: Visibilite | undefined) {
  return capacites?.capacites?.capture?.disponible === true;
}
