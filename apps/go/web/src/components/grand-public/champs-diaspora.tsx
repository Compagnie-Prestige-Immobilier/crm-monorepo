import { INDICATIF_SENEGAL } from '@/components/grand-public/telephone';
import type { Situation } from '@/components/grand-public/situation';
import { Field } from '@/components/ui/field';
import { FilterCombobox, type OptionFiltre } from '@/components/ui/filter-combobox';
import { Input } from '@/components/ui/input';
import { actifs, type Referentiels } from '@/lib/data/referentiels';

export function Pays({
  valeurs,
  referentiels,
  options,
  onIndicatifResidence,
  onPatch,
}: {
  valeurs: Situation;
  referentiels: Referentiels | undefined;
  options: readonly OptionFiltre[];
  onIndicatifResidence: (indicatif: string) => void;
  onPatch: (patch: Partial<Situation>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FilterCombobox
        label="Pays de résidence"
        placeholder="Choisir un pays"
        value={valeurs.paysResidenceId}
        options={options}
        onChange={(paysResidenceId) => {
          onPatch({ paysResidenceId });
          const indicatif = actifs(referentiels?.pays).find(
            (item) => item.id === paysResidenceId,
          )?.indicatif;
          if (indicatif !== null && indicatif !== undefined && indicatif !== '') {
            onIndicatifResidence(indicatif);
          }
        }}
      />
      <Field label="Ville de résidence">
        {(props) => (
          <Input
            {...props}
            value={valeurs.villeResidence}
            maxLength={120}
            onChange={(event) => {
              onPatch({ villeResidence: event.target.value });
            }}
          />
        )}
      </Field>
    </div>
  );
}

export function Relais({
  valeurs,
  onPatch,
}: {
  valeurs: Situation;
  onPatch: (patch: Partial<Situation>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Personne relais au Sénégal">
        {(props) => (
          <Input
            {...props}
            value={valeurs.relaisNom}
            maxLength={160}
            onChange={(event) => {
              onPatch({ relaisNom: event.target.value });
            }}
          />
        )}
      </Field>
      <Field label="Téléphone du relais" description={`Au Sénégal (+${INDICATIF_SENEGAL}).`}>
        {(props) => (
          <Input
            {...props}
            value={valeurs.relaisPhone}
            maxLength={40}
            inputMode="tel"
            placeholder="77 123 45 67"
            onChange={(event) => {
              onPatch({ relaisPhone: event.target.value });
            }}
          />
        )}
      </Field>
    </div>
  );
}
