import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Le sélecteur natif : sur Android il ouvre le calendrier du système, que
 * l'utilisateur connaît déjà, et il reste atteignable au clavier sans code.
 */
export function DateField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  min?: string | null | undefined;
  max?: string | null | undefined;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={value ?? ''}
        min={min ?? undefined}
        max={max ?? undefined}
        onChange={(event) => {
          onChange(event.target.value === '' ? null : event.target.value);
        }}
      />
    </div>
  );
}
