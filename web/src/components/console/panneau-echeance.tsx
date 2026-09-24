import { Kbd } from '@/components/console/console-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCallbackAt, type CallbackSlot } from '@/lib/data/console';
import { cn } from '@/lib/utils';

/** L'échéance d'EB-10 : elle s'ouvre aussi PAR-DESSUS un dossier déjà rempli. */
export function PanneauEcheance({
  slots,
  now,
  freeCallback,
  choisi,
  surDossier,
  titre,
  contenu = null,
  disabled,
  inputRef,
  onChoisir,
  onFreeCallback,
  onValidate,
}: {
  slots: readonly CallbackSlot[];
  now: number;
  freeCallback: string;
  /** Le créneau retenu, en attente de validation. */
  choisi?: string | null;
  surDossier: boolean;
  titre?: string;
  /** Remplace créneaux et saisie libre : le calendrier d'un RV site. */
  contenu?: React.ReactNode;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChoisir: (at: string) => void;
  onFreeCallback: (value: string) => void;
  onValidate: () => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="pb-1 font-display text-[1.0625rem] font-[700]">
        {titre ?? 'Quand rappeler ?'}
      </legend>
      {surDossier ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          Vous retrouverez le dossier déjà rempli au prochain appel.
        </p>
      ) : null}
      {contenu}
      <div className={cn('flex flex-wrap gap-2', contenu !== null && 'hidden')}>
        {slots.map((slot) => (
          <Button
            key={slot.key}
            variant={slot.at === choisi ? 'default' : 'outline'}
            aria-pressed={slot.at === choisi}
            className="h-auto flex-col items-start gap-0.5 py-2"
            onClick={() => {
              onChoisir(slot.at);
            }}
          >
            <span className="flex items-center gap-2">
              <Kbd>{slot.key}</Kbd>
              {slot.label}
            </span>
            <span
              className={cn(
                'pl-7 text-[0.75rem] font-[400]',
                slot.at === choisi ? 'opacity-80' : 'text-muted-foreground',
              )}
            >
              {formatCallbackAt(slot.at, now)}
            </span>
          </Button>
        ))}
      </div>

      <div className={cn('flex flex-col gap-1.5', contenu !== null && 'hidden')}>
        <label
          htmlFor="console-callback-at"
          className="flex items-center gap-2 text-[0.875rem] font-[600]"
        >
          <Kbd>0</Kbd>
          Autre échéance
        </label>
        <Input
          id="console-callback-at"
          ref={inputRef}
          type="datetime-local"
          className="max-w-64"
          value={freeCallback}
          onChange={(event) => {
            onFreeCallback(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            onValidate();
          }}
        />
        <p className="text-[0.75rem] text-muted-foreground">
          Heure de Dakar (UTC+0), quel que soit le fuseau de ce poste. Échap revient en arrière.
        </p>
      </div>
    </fieldset>
  );
}
