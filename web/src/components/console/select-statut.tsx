'use client';

import { Field } from '@/components/forms/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MotifAppel } from '@/lib/data/call-outcome-reasons';

/**
 * Le vocabulaire du référentiel en un seul geste, à la place des deux questions
 * de la console. Le statut choisi commande la suite de l'écran.
 */
export function SelectStatut({
  catalogue,
  motif,
  disabled,
  obligatoire = true,
  placeholder = 'Choisir un statut',
  onChange,
  onFerme,
}: {
  catalogue: readonly MotifAppel[];
  motif: MotifAppel | null;
  disabled: boolean;
  /** Faux à l'ajout : sans statut, la fiche se crée sans appel. */
  obligatoire?: boolean;
  placeholder?: string;
  onChange: (motif: MotifAppel) => void;
  /**
   * Une fois la liste refermée. Avant, le focus qu'on poserait ailleurs serait
   * aussitôt rendu au déclencheur par le select.
   */
  onFerme?: (() => void) | undefined;
}) {
  // `items` n'est pas décoratif : sans lui, le déclencheur affiche la VALEUR,
  // donc le code du motif, au lieu du libellé de la ligne choisie.
  const items = catalogue.map((item) => ({ value: item.code, label: item.label }));

  return (
    <Field label="Statut de qualification" required={obligatoire}>
      {(props) => (
        <Select
          items={items}
          value={motif === null ? null : motif.code}
          disabled={disabled}
          onValueChange={(code) => {
            const choisi = catalogue.find((item) => item.code === code);
            if (choisi !== undefined) onChange(choisi);
          }}
          onOpenChangeComplete={(ouvert) => {
            if (!ouvert) onFerme?.();
          }}
        >
          <SelectTrigger {...props} className="max-w-md">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}
