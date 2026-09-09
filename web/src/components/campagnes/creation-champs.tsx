import { useId } from 'react';

import {
  choixInitial,
  SEGMENT_LABELS,
  SEGMENTS,
  surRepresentants,
  TOUS,
  TYPE_LABELS,
  TYPES,
  type CIBLES,
  type Choix,
} from '@/components/campagnes/cibles';
import { Field } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ReferentielItem } from '@/lib/data/referentiels';
import { cn } from '@/lib/utils';

function Liste({
  id,
  valeur,
  items,
  onChange,
}: {
  id?: string | undefined;
  valeur: string;
  items: readonly { value: string; label: string }[];
  onChange: (valeur: string) => void;
}) {
  return (
    <Select
      items={[...items]}
      value={valeur}
      onValueChange={(value) => {
        if (value !== null) onChange(value);
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue />
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

export function ChoixCible({
  cibles,
  choix,
  onChange,
}: {
  cibles: readonly (typeof CIBLES)[number][];
  choix: Choix;
  onChange: (choix: Choix) => void;
}) {
  const groupe = useId();
  // Une seule cible possible (Grand Public) : rien à choisir, on saute l'étape.
  if (cibles.length < 2) return null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-[600]">Que voulez-vous exporter&nbsp;?</legend>
      {cibles.map((cible) => (
        <label
          key={cible.cle}
          className={cn(
            'grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 rounded-md border p-3',
            'transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
            choix.cle === cible.cle
              ? 'border-primary bg-secondary'
              : 'border-border hover:bg-secondary/60',
          )}
        >
          <input
            type="radio"
            name={groupe}
            value={cible.cle}
            checked={choix.cle === cible.cle}
            onChange={() => {
              onChange(choixInitial(cible.cle));
            }}
            className="row-span-2 mt-1 size-4 shrink-0 accent-primary"
          />
          <span className="font-[600]">{cible.titre}</span>
          <span className="col-start-2 text-[0.75rem] text-muted-foreground">{cible.aide}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function ChampsCritere({
  choix,
  onChange,
  departements,
  iefs,
}: {
  choix: Choix;
  onChange: (choix: Choix) => void;
  departements: readonly ReferentielItem[];
  iefs: readonly ReferentielItem[];
}) {
  if (choix.cle === 'chues-segment') {
    return (
      <Field label="Segment">
        {(props) => (
          <Liste
            id={props.id}
            valeur={choix.segment}
            items={SEGMENTS.map((segment) => ({ value: segment, label: SEGMENT_LABELS[segment] }))}
            onChange={(value) => {
              onChange({ ...choix, segment: value as Choix['segment'] });
            }}
          />
        )}
      </Field>
    );
  }

  if (choix.cle === 'grand-public') {
    return (
      <Field label="Type de prospect">
        {(props) => (
          <Liste
            id={props.id}
            valeur={choix.type}
            items={[
              { value: TOUS, label: 'Tous les types' },
              ...TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] })),
            ]}
            onChange={(value) => {
              onChange({ ...choix, type: value as Choix['type'] });
            }}
          />
        )}
      </Field>
    );
  }

  if (!surRepresentants(choix.cle)) return null;

  const iefsDuDepartement = iefs.filter(
    (ief) => choix.departementId === TOUS || ief.departementId === choix.departementId,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Département">
          {(props) => (
            <Liste
              id={props.id}
              valeur={choix.departementId}
              items={[
                { value: TOUS, label: 'Tous les départements' },
                ...departements.map((row) => ({ value: row.id, label: row.name ?? row.id })),
              ]}
              onChange={(value) => {
                onChange({ ...choix, departementId: value, iefId: TOUS });
              }}
            />
          )}
        </Field>
        <Field label="IEF">
          {(props) => (
            <Liste
              id={props.id}
              valeur={choix.iefId}
              items={[
                { value: TOUS, label: 'Toutes les IEF' },
                ...iefsDuDepartement.map((row) => ({ value: row.id, label: row.name ?? row.id })),
              ]}
              onChange={(value) => {
                onChange({ ...choix, iefId: value });
              }}
            />
          )}
        </Field>
      </div>

      {choix.cle !== 'representants' ? null : (
        <label className="flex cursor-pointer items-start gap-3 text-[0.875rem]">
          <input
            type="checkbox"
            checked={choix.nonQualifies}
            className="mt-0.5 size-4 shrink-0 accent-primary"
            onChange={(event) => {
              onChange({ ...choix, nonQualifies: event.target.checked });
            }}
          />
          Exclure les représentants déjà qualifiés (ambassadeur ou refus)
        </label>
      )}
    </div>
  );
}
