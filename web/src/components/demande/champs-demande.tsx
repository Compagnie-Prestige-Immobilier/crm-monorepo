import { optionsDe, type OptionListe } from '@/components/demande/options-demande';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  estRequis,
  valeursLibre,
  widgetDe,
  type ChampLibrePublic,
  type FormulairePublic,
  type ReglageChampPublic,
  type Widget,
} from '@/lib/data/formulaire-public-champs';
import { cn } from '@/lib/utils';

function Liste({
  id,
  describedBy,
  invalide,
  items,
  value,
  onChange,
}: {
  id: string;
  describedBy: string | undefined;
  invalide: boolean;
  items: readonly OptionListe[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(suivante) => {
        if (suivante === null || suivante === '') return;
        onChange(suivante);
      }}
    >
      <SelectTrigger id={id} aria-describedby={describedBy} aria-invalid={invalide}>
        <SelectValue placeholder="Choisir" />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const OUI_NON: readonly OptionListe[] = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
];

function ChoixOuiNon({
  label,
  nom,
  requis,
  valeur,
  erreur,
  onChange,
}: {
  label: string;
  nom: string;
  requis: boolean;
  valeur: string;
  erreur: string | undefined;
  onChange: (valeur: string) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">
        {label}
        {requis ? (
          <span className="ps-2 text-[0.8125rem] font-[500] text-destructive">Obligatoire</span>
        ) : null}
      </legend>
      <div className="flex flex-wrap gap-2">
        {OUI_NON.map((choix) => (
          <label
            key={choix.value}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[0.875rem]',
              'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
              valeur === choix.value
                ? 'border-primary bg-secondary text-secondary-foreground'
                : 'border-border hover:bg-secondary/60',
            )}
          >
            <input
              type="radio"
              name={nom}
              value={choix.value}
              checked={valeur === choix.value}
              className="size-4 accent-[var(--primary)]"
              onChange={() => {
                onChange(choix.value);
              }}
            />
            {choix.label}
          </label>
        ))}
      </div>
      {erreur === undefined ? null : (
        <p role="alert" className="text-[0.75rem] text-destructive">
          {erreur}
        </p>
      )}
    </fieldset>
  );
}

function Saisir({
  widget,
  valeur,
  onChange,
  onBlur,
  ...props
}: {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
  widget: Widget;
  valeur: string;
  onChange: (valeur: string) => void;
  onBlur: () => void;
}) {
  return (
    <Input
      {...props}
      onBlur={onBlur}
      type={widget.type ?? 'text'}
      inputMode={widget.type === 'tel' ? 'tel' : undefined}
      autoComplete={widget.autoComplete ?? 'off'}
      maxLength={widget.longueurMax}
      value={valeur}
      onChange={(evenement) => {
        onChange(evenement.target.value);
      }}
    />
  );
}

export function ChampPublic({
  champ,
  formulaire,
  valeur,
  erreur,
  onChange,
  onBlur,
}: {
  champ: ReglageChampPublic;
  formulaire: FormulairePublic;
  valeur: string;
  erreur: string | undefined;
  onChange: (valeur: string) => void;
  onBlur: () => void;
}) {
  const widget = widgetDe(champ.champ);
  if (widget === undefined) return null;

  if (widget.saisie === 'ouinon') {
    return (
      <ChoixOuiNon
        label={champ.libelle}
        nom={champ.champ}
        requis={estRequis(champ)}
        valeur={valeur}
        erreur={erreur}
        onChange={onChange}
      />
    );
  }

  return (
    <Field label={champ.libelle} required={estRequis(champ)} error={erreur}>
      {(props) =>
        widget.saisie === 'liste' ? (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            invalide={props['aria-invalid']}
            items={optionsDe(widget.source, formulaire)}
            value={valeur}
            onChange={onChange}
          />
        ) : (
          <Saisir {...props} widget={widget} valeur={valeur} onChange={onChange} onBlur={onBlur} />
        )
      }
    </Field>
  );
}

export function ChampAjoute({
  champ,
  valeur,
  erreur,
  onChange,
  onBlur,
}: {
  champ: ChampLibrePublic;
  valeur: string;
  erreur: string | undefined;
  onChange: (valeur: string) => void;
  onBlur: () => void;
}) {
  if (champ.type === 'TEXTE') {
    return (
      <Field label={champ.libelle} required={champ.obligatoire} error={erreur}>
        {(props) => (
          <Input
            {...props}
            maxLength={500}
            value={valeur}
            onChange={(evenement) => {
              onChange(evenement.target.value);
            }}
            onBlur={onBlur}
          />
        )}
      </Field>
    );
  }

  return (
    <Field label={champ.libelle} required={champ.obligatoire} error={erreur}>
      {(props) => (
        <Liste
          id={props.id}
          describedBy={props['aria-describedby']}
          invalide={props['aria-invalid']}
          items={valeursLibre(champ).map((option) => ({ value: option, label: option }))}
          value={valeur}
          onChange={onChange}
        />
      )}
    </Field>
  );
}
