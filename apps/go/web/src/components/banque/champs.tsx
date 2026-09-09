import { LoaderIcon } from 'lucide-react';
import { useId } from 'react';

import { formatMontant, saisieMontant } from '@/components/banque/montant';
import { ChampObligatoire } from '@/components/banque/pieces';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { MotifBanque } from '@/lib/data/bank-cases';

export function Attente({ enCours, libelle }: { enCours: boolean; libelle: string }) {
  if (!enCours) return libelle;
  return (
    <>
      <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
      Enregistrement…
    </>
  );
}

export function ChampCommentaire({
  valeur,
  onChange,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Commentaire (facultatif)</Label>
      <Textarea
        id={id}
        value={valeur}
        maxLength={2000}
        onChange={(evenement) => {
          onChange(evenement.target.value);
        }}
      />
    </div>
  );
}

export function ChampTexte({
  label,
  valeur,
  obligatoire = false,
  aide,
  taille,
  onChange,
}: {
  label: string;
  valeur: string;
  obligatoire?: boolean | undefined;
  aide?: string | undefined;
  taille?: number | undefined;
  onChange: (valeur: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {obligatoire ? <ChampObligatoire /> : null}
      </Label>
      <Textarea
        id={id}
        value={valeur}
        rows={taille ?? 3}
        maxLength={2000}
        aria-describedby={aide === undefined ? undefined : `${id}-aide`}
        onChange={(evenement) => {
          onChange(evenement.target.value);
        }}
      />
      {aide === undefined ? null : (
        <p id={`${id}-aide`} className="text-[0.75rem] text-muted-foreground">
          {aide}
        </p>
      )}
    </div>
  );
}

export function ChampMontantEncaisse({
  valeur,
  onChange,
}: {
  valeur: string | null;
  onChange: (valeur: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        Montant encaissé
        <ChampObligatoire />
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={valeur ?? ''}
        placeholder="1200000"
        aria-describedby={`${id}-apercu`}
        onChange={(evenement) => {
          onChange(saisieMontant(evenement.target.value));
        }}
      />
      {/* Aperçu formaté en direct : « 1200000 » et « 12000000 » se distinguent
          mal à la lecture, et un zéro de trop ne se rattrape pas après coup. */}
      <p id={`${id}-apercu`} role="status" className="text-[0.9375rem] font-[600]">
        {valeur === null ? (
          <span className="font-[400] text-muted-foreground">Montant strictement positif.</span>
        ) : (
          formatMontant(valeur)
        )}
      </p>
    </div>
  );
}

export function ChampMontant({
  label,
  gabarit,
  valeur,
  onChange,
}: {
  label: string;
  gabarit: string;
  valeur: string | null;
  onChange: (valeur: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {/* `inputMode` et non `type="number"` : un champ numérique HTML rendrait le
          montant en `number` et perdrait la précision que la chaîne préserve. */}
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder={gabarit}
        value={valeur ?? ''}
        onChange={(evenement) => {
          onChange(saisieMontant(evenement.target.value));
        }}
      />
    </div>
  );
}

export function ChampMotif({
  motifs,
  valeur,
  onChange,
}: {
  motifs: readonly MotifBanque[];
  valeur: string | null;
  onChange: (valeur: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        Motif de rejet
        <ChampObligatoire />
      </Label>
      {/* `items` : `Select.Value` de Base UI affiche la valeur choisie, pas le texte. */}
      <Select
        items={motifs.map((motif) => ({ value: motif.id, label: motif.label }))}
        value={valeur ?? ''}
        onValueChange={(choix) => {
          if (typeof choix === 'string' && choix !== '') onChange(choix);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Choisir un motif" />
        </SelectTrigger>
        <SelectContent>
          {motifs.map((motif) => (
            <SelectItem key={motif.id} value={motif.id}>
              {motif.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ChampSelect({
  label,
  placeholder,
  options,
  valeur,
  obligatoire = false,
  aide,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  valeur: string | null;
  obligatoire?: boolean | undefined;
  aide?: string | undefined;
  onChange: (valeur: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {obligatoire ? <ChampObligatoire /> : null}
      </Label>
      <Select
        items={options}
        value={valeur ?? ''}
        onValueChange={(choix) => {
          if (typeof choix === 'string' && choix !== '') onChange(choix);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {aide === undefined ? null : <p className="text-[0.75rem] text-muted-foreground">{aide}</p>}
    </div>
  );
}
