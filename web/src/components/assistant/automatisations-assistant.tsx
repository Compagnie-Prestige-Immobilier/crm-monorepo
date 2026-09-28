import { RegleAssistant } from '@/components/assistant/regle-assistant';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSessionAssistant } from '@/components/assistant/fournisseur-assistant';
import {
  chargerClient,
  URL_KAIROS,
  type NouveauTraitement,
  type Visibilite,
  type Traitement,
} from '@/lib/data/kairos';
import { apiErrorText } from '@/lib/mutation-feedback';

function Executions({ id }: { id: number }) {
  const query = useQuery({
    queryKey: ['assistant', 'executions', id],
    queryFn: async () => (await chargerClient()).lireExecutions(URL_KAIROS, '', id),
  });
  return (
    <div aria-label="Exécutions de la tâche">
      {query.isPending ? <p>Chargement…</p> : null}
      {query.error ? (
        <p role="alert">{apiErrorText(query.error, 'Journal indisponible.')}</p>
      ) : null}
      {query.data?.length === 0 ? <p>Aucune exécution.</p> : null}
      {query.data?.map((e) => (
        <p key={e.id} className="my-1">
          {new Date(e.startedAt).toLocaleString('fr-FR')} · {e.statut}
          {e.erreur ? ` · ${e.erreur}` : ''}
          {e.resultat ? <span className="block whitespace-pre-wrap">{e.resultat}</span> : null}
        </p>
      ))}
    </div>
  );
}

export function AutomatisationsAssistant() {
  const capacites = capacitesAutomatisation(useSessionAssistant().capacites);
  const traitements = useQuery({
    queryKey: ['assistant', 'traitements'],
    queryFn: async () => (await chargerClient()).lireTraitements(URL_KAIROS, ''),
    enabled: capacites.traitements === true,
  });
  const [nom, setNom] = useState('');
  const [consigne, setConsigne] = useState('');
  const [frequence, setFrequence] = useState<NouveauTraitement['frequence']>('quotidien');
  const [budget, setBudget] = useState(10);
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState('');
  const [suppression, setSuppression] = useState<number>();
  const [journal, setJournal] = useState<number>();
  const operation = async (action: () => Promise<void>) => {
    setAttente(true);
    setErreur('');
    try {
      await action();
      await traitements.refetch();
    } catch (e) {
      setErreur(apiErrorText(e, 'La modification n’a pas abouti.'));
    } finally {
      setAttente(false);
    }
  };
  const creer = () =>
    operation(async () => {
      await (
        await chargerClient()
      ).creerTraitement(URL_KAIROS, '', {
        nom,
        genre: 'resume',
        entrees: { texte: consigne },
        frequence,
        budgetMensuelCredits: budget,
      });
      setNom('');
      setConsigne('');
    });
  const supprimer = (id: number) => {
    if (suppression !== id) {
      setSuppression(id);
      return;
    }
    void operation(async () => {
      await (await chargerClient()).supprimerTraitement(URL_KAIROS, '', id);
      setSuppression(undefined);
      if (journal === id) setJournal(undefined);
    });
  };
  return (
    <section className="space-y-3" aria-label="Règles et tâches planifiées">
      {capacites.regles ? <ReglesAssistant /> : null}
      {capacites.traitements ? (
        <div className="space-y-3">
          <h3 className="font-semibold">Tâches planifiées</h3>
          {traitements.isPending ? <p>Chargement…</p> : null}
          {traitements.error ? (
            <p role="alert">{apiErrorText(traitements.error, 'Tâches indisponibles.')}</p>
          ) : null}
          {traitements.data?.length === 0 ? <p>Aucune tâche planifiée.</p> : null}
          <ListeTraitements
            traitements={traitements.data ?? []}
            journal={journal}
            setJournal={setJournal}
            suppression={suppression}
            supprimer={supprimer}
            attente={attente}
          />
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void creer();
            }}
          >
            <h4 className="font-semibold">Planifier un résumé</h4>
            <label className="block">
              Nom
              <input
                className="w-full rounded border p-2"
                required
                maxLength={120}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
              />
            </label>
            <label className="block">
              Texte à résumer
              <textarea
                className="w-full rounded border p-2"
                required
                maxLength={20000}
                value={consigne}
                onChange={(e) => setConsigne(e.target.value)}
              />
            </label>
            <label className="block">
              Fréquence
              <select
                className="ml-2 rounded border p-1"
                value={frequence}
                onChange={(e) => setFrequence(e.target.value as NouveauTraitement['frequence'])}
              >
                <option value="quotidien">Tous les jours</option>
                <option value="hebdomadaire">Chaque semaine</option>
                <option value="mensuel">Chaque mois</option>
              </select>
            </label>
            <label className="block">
              Budget mensuel en crédits
              <input
                className="ml-2 w-24 rounded border p-1"
                required
                type="number"
                min={1}
                max={100000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
            </label>
            <Button size="sm" type="submit" disabled={attente}>
              Créer la tâche
            </Button>
          </form>
        </div>
      ) : null}
      {erreur ? (
        <p role="alert" className="text-destructive">
          {erreur}
        </p>
      ) : null}
    </section>
  );
}

function ReglesAssistant() {
  const capacites = capacitesAutomatisation(useSessionAssistant().capacites);
  const regles = useQuery({
    queryKey: ['assistant', 'regles'],
    queryFn: async () => (await chargerClient()).lireRegles(URL_KAIROS, ''),
    enabled: capacites.regles === true,
  });
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Règles personnelles</h3>
      {regles.isPending ? <p>Chargement…</p> : null}
      {regles.error ? (
        <p role="alert">{apiErrorText(regles.error, 'Règles indisponibles.')}</p>
      ) : null}
      {regles.data?.length === 0 ? (
        <p>Aucune action automatique disponible pour votre rôle.</p>
      ) : null}
      {regles.data?.map((r) => (
        <RegleAssistant key={r.action} regle={r} actualiser={regles.refetch} />
      ))}
    </div>
  );
}

function ListeTraitements({
  traitements,
  journal,
  setJournal,
  suppression,
  supprimer,
  attente,
}: {
  traitements: Traitement[];
  journal: number | undefined;
  setJournal: (id: number | undefined) => void;
  suppression: number | undefined;
  supprimer: (id: number) => void;
  attente: boolean;
}) {
  return (
    <>
      {' '}
      {traitements.map((t) => (
        <div key={t.id} className="space-y-1 rounded border p-2">
          <p className="font-semibold">{t.nom}</p>
          <p>
            {t.actif ? 'Active' : 'Inactive'} · {t.frequence} · {t.budgetMensuelCredits} crédits /
            mois
          </p>
          <p>Prochaine exécution : {new Date(t.prochainLe).toLocaleString('fr-FR')}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setJournal(journal === t.id ? undefined : t.id)}
            >
              Exécutions
            </Button>
            <Button size="sm" variant="ghost" disabled={attente} onClick={() => supprimer(t.id)}>
              {suppression === t.id ? 'Confirmer la suppression' : 'Supprimer'}
            </Button>
          </div>
          {journal === t.id ? <Executions id={t.id} /> : null}
        </div>
      ))}
    </>
  );
}

function capacitesAutomatisation(v: Visibilite | undefined) {
  return {
    regles: v?.capacites?.regles?.disponible === true,
    traitements: v?.capacites?.traitements?.disponible === true,
  };
}
