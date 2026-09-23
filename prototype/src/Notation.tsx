import { Radio, RadioGroup } from 'react-aria-components';

import { budgetHint, type Capacite, criteria, type Fiche } from './bant';
import type { Update } from './Form';

export function Notation({ fiche, update, cap }: { fiche: Fiche; update: Update; cap: Capacite }) {
  const hint = budgetHint(fiche, cap);
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-gold-soft px-4 py-3 text-sm text-gold-text">
        Noter sur des faits, pas sur ce que le prospect affirme. En cas de doute entre deux notes,
        prendre la plus basse.
      </p>
      {criteria(fiche).map((c) => (
        <section key={c.key} className="rounded-2xl border border-line bg-paper p-4 sm:p-6">
          <RadioGroup
            aria-label={c.name}
            value={fiche.scores[c.key] ? String(fiche.scores[c.key]) : null}
            onChange={(v) => update((f) => ({ ...f, scores: { ...f.scores, [c.key]: Number(v) } }))}
            className="space-y-2"
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-lg font-semibold">{c.name}</h3>
              <span className="text-sm text-muted">
                {c.max} pts · {c.desc}
              </span>
            </div>
            {c.options.map((o) => (
              <Radio
                key={o.value}
                value={String(o.value)}
                className="focus-ring flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm transition data-[hovered]:border-brand/30 data-[selected]:border-brand data-[selected]:bg-brand-soft data-[selected]:font-medium"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-canvas font-display text-base font-bold text-muted in-data-[selected]:bg-brand in-data-[selected]:text-white">
                  {o.value}
                </span>
                {o.label}
              </Radio>
            ))}
          </RadioGroup>
          {c.key === 'budget' && hint && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${hint.warn ? 'bg-ko-soft text-ko' : 'bg-canvas text-muted'}`}
            >
              {hint.text}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
