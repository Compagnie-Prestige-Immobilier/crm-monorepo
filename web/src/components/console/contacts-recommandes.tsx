'use client';

import { PlusIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ContactRecommandeLigne {
  id: string;
  nom: string;
  phone: string;
}

const MAX_CONTACTS = 5;

export const contactsPourEnvoi = (
  lignes: readonly ContactRecommandeLigne[],
): { nom?: string; phone: string }[] =>
  lignes
    .filter((ligne) => ligne.phone.trim() !== '')
    .map((ligne) => ({
      phone: ligne.phone.trim(),
      ...(ligne.nom.trim() === '' ? {} : { nom: ligne.nom.trim() }),
    }));

/**
 * Un prospect Grand Public qui recommande un proche pendant l'appel : nom
 * facultatif, numéro obligatoire, jusqu'à cinq d'un coup.
 */
export function ContactsRecommandes({
  valeurs,
  onChange,
  disabled,
}: {
  valeurs: readonly ContactRecommandeLigne[];
  onChange: (valeurs: ContactRecommandeLigne[]) => void;
  disabled: boolean;
}) {
  const majLigne = (id: string, patch: Partial<ContactRecommandeLigne>) => {
    onChange(valeurs.map((ligne) => (ligne.id === id ? { ...ligne, ...patch } : ligne)));
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Contacts recommandés, facultatif</span>
      {valeurs.map((ligne) => (
        <div key={ligne.id} className="flex gap-2">
          <Input
            placeholder="Nom (facultatif)"
            value={ligne.nom}
            disabled={disabled}
            onChange={(event) => {
              majLigne(ligne.id, { nom: event.target.value });
            }}
          />
          <Input
            placeholder="Téléphone"
            value={ligne.phone}
            disabled={disabled}
            onChange={(event) => {
              majLigne(ligne.id, { phone: event.target.value });
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => {
              onChange(valeurs.filter((autre) => autre.id !== ligne.id));
            }}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      ))}
      {valeurs.length < MAX_CONTACTS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onChange([...valeurs, { id: crypto.randomUUID(), nom: '', phone: '' }]);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Ajouter un contact
        </Button>
      )}
    </div>
  );
}
