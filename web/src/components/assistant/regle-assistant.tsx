import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { chargerClient, URL_KAIROS, type Regle } from '@/lib/data/kairos';
import { apiErrorText } from '@/lib/mutation-feedback';

export function RegleAssistant({
  regle,
  actualiser,
}: {
  regle: Regle;
  actualiser: () => Promise<unknown>;
}) {
  const [maximum, setMaximum] = useState(regle.maxParJour);
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState('');
  const enregistrer = async (active: boolean) => {
    setAttente(true);
    setErreur('');
    try {
      await (
        await chargerClient()
      ).definirRegle(URL_KAIROS, '', { ...regle, active, maxParJour: maximum });
      await actualiser();
    } catch (e) {
      setErreur(apiErrorText(e, 'Règle non enregistrée.'));
    } finally {
      setAttente(false);
    }
  };
  return (
    <div className="space-y-2 rounded border p-2">
      <p>
        {regle.action} · {regle.active ? 'Active' : 'Inactive'}
      </p>
      <label>
        Maximum par jour
        <input
          className="ml-2 w-20 rounded border p-1"
          type="number"
          min={1}
          max={1000}
          value={maximum}
          onChange={(e) => setMaximum(Number(e.target.value))}
        />
      </label>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={attente || maximum < 1 || !Number.isInteger(maximum)}
          onClick={() => void enregistrer(true)}
        >
          Activer / enregistrer
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={attente || !regle.active}
          onClick={() => void enregistrer(false)}
        >
          Désactiver
        </Button>
      </div>
      {erreur ? <p role="alert">{erreur}</p> : null}
    </div>
  );
}
