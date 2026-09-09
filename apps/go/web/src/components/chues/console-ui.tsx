import { CalendarIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  callbackHalfHours,
  callbackSlots,
  formatCallbackAt,
  type CreneauRappel,
} from '@/lib/data/callbacks';
import { formatChrono, secondesEcoulees } from '@/lib/data/ouvertures';
import { cn } from '@/lib/utils';

/** Apparition d'une question qui n'était pas là : douce, et coupée si l'on préfère. */
export const REVELE =
  'animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none';

/** Masqué au tactile : sur téléphone la touche ne se tape pas, elle encombre. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.75rem] font-[600] text-muted-foreground max-md:hidden">
      {children}
    </kbd>
  );
}

export function copyPhone(phoneE164: string): void {
  if (!('clipboard' in navigator)) {
    toast.error('Copie indisponible dans ce navigateur.');
    return;
  }
  navigator.clipboard.writeText(phoneE164).then(
    () => {
      toast.success('Numéro copié.');
    },
    () => {
      toast.error('Copie refusée par le navigateur.');
    },
  );
}

/**
 * Le temps de traitement : de la première saisie au statut, la lecture de la
 * fiche exclue. Rien saisi, rien à montrer.
 */
export function Chrono({ firstInputAt }: { firstInputAt: string }) {
  const [secondes, setSecondes] = useState(() => secondesEcoulees(firstInputAt, Date.now()));

  useEffect(() => {
    const battement = setInterval(() => {
      setSecondes(secondesEcoulees(firstInputAt, Date.now()));
    }, 1000);
    return () => {
      clearInterval(battement);
    };
  }, [firstInputAt]);

  return (
    <p className="text-[0.8125rem] text-muted-foreground">
      En saisie depuis{' '}
      <span className="font-[600] tabular-nums text-foreground">{formatChrono(secondes)}</span>
    </p>
  );
}

/** Une question posée, et qui LE RESTE une fois répondue. */
export function Question({
  titre,
  anime = false,
  children,
}: {
  titre: string;
  anime?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn('flex flex-col gap-2', anime && REVELE)}>
      <legend className="pb-2 text-[1rem] font-[600]">{titre}</legend>
      {children}
    </fieldset>
  );
}

/** Tuiles à réponse unique. Retoucher une réponse déjà prise reste possible. */
export function Choix<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: readonly { valeur: T; label: string }[];
  value: T | null;
  onChange: (valeur: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const actif = value === option.valeur;
        return (
          <Button
            key={String(option.valeur)}
            type="button"
            variant={actif ? 'default' : 'outline'}
            aria-pressed={actif}
            onClick={() => {
              onChange(option.valeur);
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

export const OUI_NON = [
  { valeur: true, label: 'Oui' },
  { valeur: false, label: 'Non' },
];

export interface OptionListe {
  readonly value: string;
  readonly label: string;
}

/** `items` n'est pas décoratif : sans lui, le déclencheur affiche la VALEUR. */
export function Liste({
  id,
  describedBy,
  items,
  value,
  placeholder,
  onChange,
}: {
  id?: string | undefined;
  describedBy?: string | undefined;
  items: readonly OptionListe[];
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(suivant) => {
        if (suivant === null || suivant === '') return;
        onChange(String(suivant));
      }}
    >
      <SelectTrigger id={id} aria-describedby={describedBy}>
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
  );
}

export function EtatVide({ titre, description }: { titre: string; description: string }) {
  return (
    <Card className="animate-rise items-center gap-2 border-dashed px-6 py-16 text-center">
      <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{titre}</h2>
      <p className="max-w-md text-[0.9375rem] text-muted-foreground">{description}</p>
    </Card>
  );
}

/**
 * Les créneaux d'un clic, puis « Choisir une date » : calendrier natif du
 * navigateur, puis les demi-heures ouvrées du jour retenu.
 */
export function ChoixEcheance({
  now,
  value,
  onChange,
}: {
  now: number;
  value: string | null;
  onChange: (at: string | null) => void;
}) {
  const [jour, setJour] = useState('');
  const [ouvert, setOuvert] = useState(false);

  const creneaux = useMemo(() => callbackSlots(now), [now]);
  const heures = useMemo(() => (jour === '' ? [] : callbackHalfHours(now, jour)), [now, jour]);
  const surMesure = value !== null && !creneaux.some((creneau) => creneau.at === value);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {creneaux.map((creneau: CreneauRappel) => (
          <Button
            key={creneau.key}
            type="button"
            variant={value === creneau.at ? 'default' : 'outline'}
            aria-pressed={value === creneau.at}
            onClick={() => {
              setOuvert(false);
              onChange(value === creneau.at ? null : creneau.at);
            }}
          >
            {creneau.label}
          </Button>
        ))}
        <Button
          type="button"
          variant={surMesure ? 'default' : 'outline'}
          aria-pressed={surMesure}
          onClick={() => {
            setOuvert((precedent) => !precedent);
          }}
        >
          <CalendarIcon aria-hidden="true" />
          {surMesure ? formatCallbackAt(value, now) : 'Choisir une date'}
        </Button>
      </div>

      {ouvert ? (
        <div className={cn('flex flex-col gap-3 rounded-lg border border-border p-3', REVELE)}>
          <div className="flex max-w-64 flex-col gap-1.5">
            <label htmlFor="rep-rappel-jour" className="text-[0.875rem] font-[600]">
              Quel jour ?
            </label>
            <Input
              id="rep-rappel-jour"
              type="date"
              min={new Date(now).toISOString().slice(0, 10)}
              value={jour}
              onChange={(evenement) => {
                setJour(evenement.target.value);
                onChange(null);
              }}
            />
          </div>

          {jour === '' || heures.length > 0 ? null : (
            <p className="text-[0.875rem]">
              Plus d’heure disponible ce jour-là. Choisissez un autre jour.
            </p>
          )}

          {jour === '' || heures.length === 0 ? null : (
            <div className="flex flex-col gap-1.5">
              <p className="text-[0.875rem] font-[600]">À quelle heure ?</p>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
                {heures.map((heure) => (
                  <Button
                    key={heure.key}
                    type="button"
                    size="sm"
                    variant={value === heure.at ? 'default' : 'outline'}
                    aria-pressed={value === heure.at}
                    onClick={() => {
                      onChange(heure.at);
                    }}
                  >
                    {heure.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
