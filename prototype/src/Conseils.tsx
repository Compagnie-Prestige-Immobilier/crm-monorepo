import { CheckCircle2, ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button as AriaButton, Disclosure, DisclosurePanel, Heading } from 'react-aria-components';

import { argumentaire, diasporaProtocol, type Fiche, missingFields } from './bant';
import { Card } from './ui';

const VISIBLE_ACTIONS = 5;

export function Conseils({ fiche, recos }: { fiche: Fiche; recos: string[] }) {
  const missing = missingFields(fiche);
  const actions = missing.length
    ? [...recos, `Champs obligatoires manquants : ${missing.map((m) => m.label).join(', ')}`]
    : recos;
  const args = argumentaire(fiche);
  const protocol = diasporaProtocol(fiche);
  return (
    <>
      <Actions recos={actions} />
      {args.length > 0 && (
        <Fold title="Argumentaire selon la motivation">
          {args.map((x) => (
            <li key={x.text} className={x.main ? 'font-medium text-ink' : ''}>
              {x.main && <span className="mr-1 text-gold-text">★ Principal :</span>}
              {x.text}
            </li>
          ))}
        </Fold>
      )}
      {protocol.length > 0 && (
        <Fold title="Protocole de suivi à distance">
          {protocol.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </Fold>
      )}
    </>
  );
}

function Actions({ recos }: { recos: string[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? recos : recos.slice(0, VISIBLE_ACTIONS);
  return (
    <Card
      title="Actions conseillées"
      aside={<span className="text-xs font-semibold text-muted">{recos.length}</span>}
    >
      {recos.length === 0 && (
        <p className="flex items-center gap-2 text-sm font-medium text-ok">
          <CheckCircle2 size={16} />
          Bien qualifié
        </p>
      )}
      <ol className="space-y-2.5">
        {shown.map((r, i) => (
          <li key={r} className="flex gap-3 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">
              {i + 1}
            </span>
            <span className="pt-0.5">{r}</span>
          </li>
        ))}
      </ol>
      {recos.length > VISIBLE_ACTIONS && (
        <AriaButton
          onPress={() => setAll(!all)}
          className="focus-ring mt-3 min-h-11 cursor-pointer rounded text-sm font-semibold text-brand"
        >
          {all ? 'Réduire' : `Voir les ${recos.length - VISIBLE_ACTIONS} autres`}
        </AriaButton>
      )}
    </Card>
  );
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Disclosure className="group rounded-2xl border border-line bg-paper">
      <Heading>
        <AriaButton
          slot="trigger"
          className="focus-ring flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 text-left font-display font-semibold sm:px-5"
        >
          {title}
          <ChevronDown
            size={18}
            className="text-muted transition group-data-[expanded]:rotate-180"
            aria-hidden
          />
        </AriaButton>
      </Heading>
      <DisclosurePanel>
        <ul className="space-y-2 px-4 pb-4 text-sm text-muted sm:px-5">{children}</ul>
      </DisclosurePanel>
    </Disclosure>
  );
}
