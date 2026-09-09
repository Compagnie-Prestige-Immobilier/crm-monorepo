import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Une liste déroulante courte, avec son intitulé et son texte d'aide. */
export function ChampSelect({
  id,
  label,
  aide,
  items,
  value,
  className,
  onChange,
}: {
  id: string;
  label: string;
  aide?: string | undefined;
  items: readonly { value: string; label: string }[];
  value: string;
  className?: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value}
        onValueChange={(suivant) => {
          if (suivant === null) return;
          onChange(suivant);
        }}
      >
        <SelectTrigger id={id} className="w-full">
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
      {aide === undefined ? null : <p className="text-[0.75rem] text-muted-foreground">{aide}</p>}
    </div>
  );
}
