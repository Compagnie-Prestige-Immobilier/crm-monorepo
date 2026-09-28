import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSessionAssistant } from '@/components/assistant/fournisseur-assistant';
import { chargerClient, URL_KAIROS } from '@/lib/data/kairos';
import { apiErrorText } from '@/lib/mutation-feedback';

export function Historique({ fermer }: { fermer: () => void }) {
  const session = useSessionAssistant();
  const [avant, setAvant] = useState(0);
  const [suppression, setSuppression] = useState('');
  const [erreur, setErreur] = useState('');
  const [attente, setAttente] = useState(false);
  const liste = useQuery({
    queryKey: ['assistant', 'conversations', avant],
    queryFn: async () =>
      (await chargerClient()).listerConversations(URL_KAIROS, '', undefined, avant),
  });
  const ouvrir = async (id: string) => {
    setAttente(true);
    setErreur('');
    try {
      await session.ouvrir(id);
      fermer();
    } catch (e) {
      setErreur(apiErrorText(e, 'La conversation n’a pas pu être ouverte.'));
    } finally {
      setAttente(false);
    }
  };
  const supprimer = async (id: string) => {
    if (suppression !== id) {
      setSuppression(id);
      return;
    }
    setAttente(true);
    setErreur('');
    try {
      await (await chargerClient()).supprimerConversation(URL_KAIROS, '', id);
      if (session.conversation === id) session.nouvelle();
      setSuppression('');
      await liste.refetch();
    } catch (e) {
      setErreur(apiErrorText(e, 'La conversation n’a pas pu être supprimée.'));
    } finally {
      setAttente(false);
    }
  };
  return (
    <section aria-label="Historique des conversations" className="space-y-2">
      {liste.isPending ? <p role="status">Chargement…</p> : null}
      {liste.error ? (
        <p role="alert">
          {apiErrorText(liste.error, 'Historique indisponible.')}{' '}
          <Button variant="link" onClick={() => void liste.refetch()}>
            Réessayer
          </Button>
        </p>
      ) : null}
      {liste.data?.length === 0 ? <p>Aucune conversation. Posez votre première question.</p> : null}
      {liste.data?.map((c) => (
        <div key={c.id} className="flex items-center gap-1 border-b py-1">
          <Button
            variant="ghost"
            disabled={attente}
            className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left"
            onClick={() => void ouvrir(c.id)}
          >
            {c.titre || 'Conversation'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={attente}
            aria-label={`Supprimer ${c.titre || 'la conversation'}`}
            onClick={() => void supprimer(c.id)}
          >
            {suppression === c.id ? 'Confirmer' : 'Supprimer'}
          </Button>
        </div>
      ))}
      {erreur ? (
        <p role="alert" className="text-destructive">
          {erreur}
        </p>
      ) : null}
      <div className="flex gap-2">
        {avant > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setAvant(0)}>
            Récentes
          </Button>
        ) : null}
        {liste.data?.length === 20 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAvant(liste.data?.at(-1)?.curseur ?? 0)}
          >
            Plus anciennes
          </Button>
        ) : null}
      </div>
    </section>
  );
}
