import { Field } from '@/components/forms/field';
import { Liste } from '@/components/forms/liste';
import { Input } from '@/components/ui/input';
import { valeursProposees, type ChampLibre } from '@/lib/data/champs-conversion';

/** Un champ que l'administrateur a ajouté au formulaire, rendu selon son type. */
export function ChampAjoute({
  champ,
  value,
  error,
  onChange,
}: {
  champ: ChampLibre;
  value: string;
  error: string | undefined;
  onChange: (valeur: string) => void;
}) {
  if (champ.type === 'TEXTE') {
    return (
      <Field label={champ.libelle} required={champ.obligatoire} error={error}>
        {(props) => (
          <Input
            {...props}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        )}
      </Field>
    );
  }

  const items = valeursProposees(champ).map((option) => ({ value: option, label: option }));
  return (
    <Field label={champ.libelle} required={champ.obligatoire} error={error}>
      {(props) => (
        <Liste
          id={props.id}
          describedBy={props['aria-describedby']}
          items={items}
          value={value}
          placeholder="Choisir une valeur"
          onChange={onChange}
        />
      )}
    </Field>
  );
}
