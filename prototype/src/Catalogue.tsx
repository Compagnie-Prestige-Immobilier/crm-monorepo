import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Form } from 'react-aria-components';
import { toast } from 'sonner';

import { fcfa, type Lot } from './bant';
import {
  ETATS_OPTIONS,
  LOCALITES_OPTIONS,
  optionLabel,
  PAPIERS_OPTIONS,
  SUPERFICIES_OPTIONS,
} from './fields';
import { lots } from './store';
import { Button, Card, NumberInput, SelectField, TextInput } from './ui';

const LIMITE_LOTS = 200;
const EMPTY = {
  programme: '',
  localite: '',
  superficie: '',
  prix: '',
  papiers: 'titre-foncier',
  etat: 'viabilise-complet',
};

export function Catalogue() {
  const list = lots.use();
  const [draft, setDraft] = useState(EMPTY);
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof EMPTY) => (value: string) => setDraft((d) => ({ ...d, [k]: value }));
  const missing = (k: keyof typeof EMPTY) => tried && !draft[k];
  const full = list.length >= LIMITE_LOTS;

  function add() {
    setTried(true);
    if (!draft.programme.trim() || !draft.localite || !draft.superficie || !draft.prix) return;
    lots.set([
      ...list,
      {
        ...draft,
        id: `L${Date.now()}`,
        programme: draft.programme.trim(),
        prix: Number(draft.prix),
      },
    ]);
    setDraft({ ...EMPTY, localite: draft.localite, superficie: draft.superficie });
    setTried(false);
    toast.success(`${draft.programme.trim()} ajouté au catalogue.`);
  }

  function remove(lot: Lot) {
    lots.set(list.filter((l) => l.id !== lot.id));
    toast(`${lot.programme} retiré.`, {
      action: { label: 'Annuler', onClick: () => lots.set(list) },
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Catalogue des lots</h1>
        <p className="mt-1 text-sm text-muted">
          Alimente le lot proposé et les suggestions du bilan envoyé au prospect.
        </p>
      </header>

      <Card title="Ajouter un lot">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <TextInput
            label="Programme"
            value={draft.programme}
            onChange={set('programme')}
            isRequired
            isInvalid={missing('programme')}
          />
          <SelectField
            label="Localité"
            value={draft.localite}
            onChange={set('localite')}
            options={LOCALITES_OPTIONS}
            isRequired
            isInvalid={missing('localite')}
          />
          <SelectField
            label="Superficie"
            value={draft.superficie}
            onChange={set('superficie')}
            options={SUPERFICIES_OPTIONS}
            isRequired
            isInvalid={missing('superficie')}
          />
          <NumberInput
            label="Prix (FCFA)"
            value={draft.prix}
            onChange={set('prix')}
            isRequired
            isInvalid={missing('prix')}
          />
          <SelectField
            label="Papiers"
            value={draft.papiers}
            onChange={set('papiers')}
            options={PAPIERS_OPTIONS}
          />
          <SelectField
            label="État du site"
            value={draft.etat}
            onChange={set('etat')}
            options={ETATS_OPTIONS}
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" variant="primary" isDisabled={full}>
              <Plus size={16} />
              Ajouter le lot
            </Button>
            {full && (
              <span className="ml-3 text-sm text-ko">
                Catalogue plein ({LIMITE_LOTS} lots) : retirez les lots vendus.
              </span>
            )}
          </div>
        </Form>
      </Card>

      <Card
        title={`${list.length} lot${list.length > 1 ? 's' : ''} disponible${list.length > 1 ? 's' : ''}`}
      >
        {list.length === 0 ? (
          <p className="text-sm text-muted">
            Ajoutez les lots disponibles pour les proposer aux prospects.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((l) => (
              <li key={l.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.programme}</p>
                  <p className="text-sm text-muted">
                    {l.localite} · {l.superficie} · {optionLabel('nature-foncier', l.papiers)} ·{' '}
                    {optionLabel('etat-site', l.etat)}
                  </p>
                </div>
                <p className="font-display font-bold tabular-nums">{fcfa(l.prix)}</p>
                <Button
                  variant="ghost"
                  aria-label={`Retirer ${l.programme}`}
                  onPress={() => remove(l)}
                  className="size-11 !px-0"
                >
                  <Trash2 size={18} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
