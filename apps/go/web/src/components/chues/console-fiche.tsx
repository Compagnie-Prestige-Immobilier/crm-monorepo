import { CopyIcon } from 'lucide-react';

import { copyPhone, Kbd } from '@/components/chues/console-ui';
import { CARTE_CLAVIER, resumeDernierAppel } from '@/components/chues/console-repere';
import { Button } from '@/components/ui/button';
import { PHASE2_STATUS_LABELS, type Prospect } from '@/lib/data/console';
import { formatPhone } from '@/lib/format';
import type { Projet } from '@/lib/types';

function rattachements(prospect: Prospect, projet: Projet): string {
  const parts: (string | null)[] = [
    prospect.banqueName,
    prospect.syndicatSigle,
    prospect.departementName,
  ];
  if (projet === 'chues') parts.push(`Représentant ${prospect.representantName ?? 'aucun'}`);
  return parts.filter((part) => part !== null && part !== '').join(' · ');
}

export function EnTeteProspect({
  prospect,
  projet,
  close,
}: {
  prospect: Prospect;
  projet: Projet;
  close: boolean;
}) {
  return (
    <>
      <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
        {prospect.nom} {prospect.prenom}
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <span className="select-all font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
          {formatPhone(prospect.phoneE164)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            copyPhone(prospect.phoneE164);
          }}
        >
          <CopyIcon aria-hidden="true" />
          Copier
          <Kbd>C</Kbd>
        </Button>
      </div>

      <p className="text-[0.8125rem] text-muted-foreground">{rattachements(prospect, projet)}</p>
      <p className="text-[0.8125rem] text-muted-foreground">{resumeDernierAppel(prospect)}</p>

      {close ? (
        <div
          role="status"
          className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
        >
          Fiche déjà close ({PHASE2_STATUS_LABELS[prospect.phase2Status].toLowerCase()}). Rien à
          consigner ici.
        </div>
      ) : null}
    </>
  );
}

export function CarteClavier({
  avecNavigation,
  ouverte,
  onOuverte,
}: {
  avecNavigation: boolean;
  ouverte: boolean;
  onOuverte: (ouverte: boolean) => void;
}) {
  return (
    <details
      open={ouverte}
      className="max-md:hidden"
      onToggle={(evenement) => {
        onOuverte(evenement.currentTarget.open);
      }}
    >
      <summary className="cursor-pointer list-none text-[0.8125rem] text-muted-foreground">
        Carte clavier <Kbd>?</Kbd>
      </summary>
      <dl className="mt-2 flex flex-col gap-1 text-[0.8125rem]">
        {CARTE_CLAVIER.filter(
          ([touches]) => avecNavigation || (touches !== 'N' && touches !== 'R'),
        ).map(([touches, quoi]) => (
          <div key={touches} className="flex items-baseline gap-2">
            <dt className="w-24 shrink-0 font-[600]">{touches}</dt>
            <dd className="text-muted-foreground">{quoi}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
