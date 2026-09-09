import { Kbd } from '@/components/chues/console-ui';
import { ISSUES, RAPPEL_KEY } from '@/components/chues/console-repere';
import { Button } from '@/components/ui/button';
import type { CallOutcome } from '@/lib/data/console';

const PIED = 'sticky bottom-0 border-t border-border bg-background py-3';

/** La rangée d'issues reste sous le pouce : au téléphone, elle sortait de l'écran. */
export function BarreIssues({
  issuePosee,
  disabled,
  onChoisir,
}: {
  issuePosee: CallOutcome | null;
  disabled: boolean;
  onChoisir: (outcome: CallOutcome | 'JOIGNABLE') => void;
}) {
  return (
    <fieldset className={`${PIED} flex flex-col gap-2`} disabled={disabled}>
      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
        Comment s’est passé l’appel ?
      </legend>
      <div className="flex flex-wrap gap-2">
        {ISSUES.map((issue) => (
          <Button
            key={issue.key}
            variant={issue.outcome === 'OTHER' && issuePosee === 'OTHER' ? 'default' : 'outline'}
            onClick={() => {
              onChoisir(issue.outcome);
            }}
          >
            <Kbd>{issue.key}</Kbd>
            {issue.label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

export function BarreDossier({
  disabled,
  onEnregistrer,
  onRefus,
  onRappeler,
  onAnnuler,
}: {
  disabled: boolean;
  onEnregistrer: () => void;
  onRefus: () => void;
  onRappeler: () => void;
  onAnnuler: () => void;
}) {
  return (
    <div className={`${PIED} flex flex-wrap gap-2`}>
      <Button onClick={onEnregistrer} disabled={disabled}>
        Enregistrer l’adhésion
        <Kbd>Entrée</Kbd>
      </Button>
      <Button variant="outline" disabled={disabled} onClick={onRefus}>
        Il refuse
      </Button>
      <Button variant="outline" disabled={disabled} onClick={onRappeler}>
        À rappeler
        <Kbd>{RAPPEL_KEY}</Kbd>
      </Button>
      <Button variant="ghost" disabled={disabled} onClick={onAnnuler}>
        Annuler
        <Kbd>Échap</Kbd>
      </Button>
    </div>
  );
}
