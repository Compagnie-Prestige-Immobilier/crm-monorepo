import { AlertTriangle, CalendarCheck, Star } from 'lucide-react';
import { useState } from 'react';
import { Checkbox, Radio, RadioGroup, ToggleButton } from 'react-aria-components';

import { calendarAlerts, criteria, fcfa, type Fiche, frDate, MOTIVATIONS, missingFields, today, budgetHint, type Capacite } from './bant';
import { type Field, FIELDS, fieldLabel, isVisible, SECTIONS, withoutHiddenValues } from './fields';
import { lots } from './store';
import { NumberInput, SelectField, TextInput } from './ui';

export type Update = (change: (f: Fiche) => Fiche) => void;

export function setValue(f: Fiche, id: string, value: string): Fiche {
  const values = { ...f.values, [id]: value };
  if (!value) delete values[id];
  return withoutHiddenValues({ ...f, values });
}

export function PhaseForm({ fiche, phase, update, invalid }: { fiche: Fiche; phase: 1 | 2 | 3; update: Update; invalid: Set<string> }) {
  const required = new Set(missingFields({ ...fiche, values: { etape: fiche.values.etape ?? '' }, motivations: [] }).map((m) => m.id));
  const sections = SECTIONS.filter((s) => s.phase === phase && (s.show?.(fiche) ?? true));
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section key={s.id} className="rounded-2xl border border-line bg-paper p-4 sm:p-6" aria-labelledby={`section-${s.id}`}>
          <h3 id={`section-${s.id}`} className="font-display text-lg font-semibold">
            {s.title}
            {s.id === 'motivations' && <span className="ml-0.5 text-ko" aria-hidden>*</span>}
          </h3>
          {s.hint && <p className="mt-1 max-w-prose text-sm text-muted">{s.hint}</p>}
          <div className="mt-4">
            {s.id === 'motivations' ? (
              <Motivations fiche={fiche} update={update} invalid={invalid.has('motivations')} />
            ) : s.id === 'consent' ? (
              <Consent fiche={fiche} update={update} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {s.id === 'lot' && <LotPicker update={update} />}
                {FIELDS.filter((field) => field.section === s.id && isVisible(fiche, field.id)).map((field) => (
                  <FieldControl key={field.id} fiche={fiche} field={field} update={update} isRequired={required.has(field.id)} isInvalid={invalid.has(field.id)} />
                ))}
              </div>
            )}
          </div>
          {s.id === 'suivi' && <Suivi fiche={fiche} />}
        </section>
      ))}
    </div>
  );
}

function FieldControl({ fiche, field, update, isRequired, isInvalid }: { fiche: Fiche; field: Field; update: Update; isRequired: boolean; isInvalid: boolean }) {
  const props = {
    label: fieldLabel(fiche, field),
    value: fiche.values[field.id] ?? (field.id === 'devise' ? 'XOF' : ''),
    onChange: (value: string) => update((f) => setValue(f, field.id, value)),
    isRequired,
    isInvalid,
  };
  if (field.kind === 'select') return <SelectField {...props} options={field.options ?? []} />;
  if (field.kind === 'number') return <NumberInput {...props} />;
  if (field.kind === 'textarea') return <TextInput {...props} multiline placeholder={field.placeholder} className="sm:col-span-2" />;
  return <TextInput {...props} type={field.kind} placeholder={field.placeholder} />;
}

function Motivations({ fiche, update, invalid }: { fiche: Fiche; update: Update; invalid: boolean }) {
  return (
    <div role="group" aria-label="Motivations d'achat" className={`flex flex-wrap gap-2 rounded-xl ${invalid ? 'ring-2 ring-ko ring-offset-4 ring-offset-paper' : ''}`}>
      {MOTIVATIONS.map((m) => {
        const rank = fiche.motivations.indexOf(m.id);
        const toggle = () => update((f) => ({ ...f, motivations: rank >= 0 ? f.motivations.filter((x) => x !== m.id) : [...f.motivations, m.id] }));
        return (
          <ToggleButton
            key={m.id}
            isSelected={rank >= 0}
            onChange={toggle}
            className="focus-ring inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 text-sm transition data-[hovered]:border-brand/40 data-[pressed]:scale-[0.97] data-[selected]:border-brand data-[selected]:bg-brand data-[selected]:text-white"
          >
            {rank === 0 && <Star size={14} fill="currentColor" aria-label="Principale" />}
            {m.label}
          </ToggleButton>
        );
      })}
    </div>
  );
}

function Consent({ fiche, update }: { fiche: Fiche; update: Update }) {
  const date = fiche.values['consent-date'] ?? '';
  return (
    <Checkbox
      isSelected={!!date}
      onChange={(on) => update((f) => setValue(f, 'consent-date', on ? today() : ''))}
      className="group flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 data-[selected]:border-ok/40 data-[selected]:bg-ok-soft"
    >
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 border-line-strong/60 bg-paper text-white group-data-[selected]:border-ok group-data-[selected]:bg-ok group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-brand">
        <svg viewBox="0 0 16 16" className="size-4 opacity-0 group-data-[selected]:opacity-100" aria-hidden><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>
      </span>
      <span className="text-sm leading-relaxed">
        Le prospect accepte que CPI conserve ses informations personnelles et financières pour le suivi de son projet immobilier, et sait qu'il peut demander leur suppression à tout moment.
        <span className="mt-1 block text-xs font-semibold text-muted">{date ? `Recueilli le ${frDate(date)}` : 'À demander avant les questions sur les revenus et les crédits.'}</span>
      </span>
    </Checkbox>
  );
}

function LotPicker({ update }: { update: Update }) {
  const catalogue = lots.use();
  const [picked, setPicked] = useState('');
  const pick = (id: string) => {
    setPicked(id);
    const lot = catalogue.find((l) => l.id === id);
    if (!lot) return;
    update((f) => ({ ...f, values: { ...f.values, 'lot-localite': lot.localite, 'lot-superficie': lot.superficie, 'nature-foncier': lot.papiers, 'etat-site': lot.etat, 'prix-lot': String(lot.prix) } }));
  };
  const options = catalogue.map((l) => [l.id, `${l.programme} · ${l.localite}, ${l.superficie} · ${fcfa(l.prix)}`] as const);
  return <SelectField label="Choisir dans le catalogue" value={picked} onChange={pick} options={options} className="sm:col-span-2" />;
}

function Suivi({ fiche }: { fiche: Fiche }) {
  const alerts = calendarAlerts(fiche);
  return (
    <>
      {alerts.map((a) => (
        <p key={a.text} className={`mt-3 flex gap-2 rounded-lg px-3 py-2 text-sm font-medium ${a.type === 'warn' ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'}`}>
          {a.type === 'warn' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CalendarCheck size={16} className="mt-0.5 shrink-0" />}
          {a.text}
        </p>
      ))}
      {fiche.history.length > 0 && (
        <ol className="mt-5 space-y-3 border-l-2 border-line pl-4" aria-label="Historique des échanges">
          {fiche.history.toReversed().map((h) => (
            <li key={h.date} className="relative text-sm">
              <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-gold" aria-hidden />
              <p className="text-xs font-semibold text-muted">
                {frDate(h.date)} · {[h.etape, h.action, h.commercial].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-0.5">{h.note}</p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function Notation({ fiche, update, cap }: { fiche: Fiche; update: Update; cap: Capacite }) {
  const hint = budgetHint(fiche, cap);
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-gold-soft px-4 py-3 text-sm text-gold-text">
        Noter sur des faits, pas sur ce que le prospect affirme. En cas de doute entre deux notes, prendre la plus basse.
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
              <span className="text-sm text-muted">{c.max} pts · {c.desc}</span>
            </div>
            {c.options.map((o) => (
              <Radio
                key={o.value}
                value={String(o.value)}
                className="focus-ring flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm transition data-[hovered]:border-brand/30 data-[selected]:border-brand data-[selected]:bg-brand-soft data-[selected]:font-medium"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-canvas font-display text-base font-bold text-muted in-data-[selected]:bg-brand in-data-[selected]:text-white">{o.value}</span>
                {o.label}
              </Radio>
            ))}
          </RadioGroup>
          {c.key === 'budget' && hint && <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${hint.warn ? 'bg-ko-soft text-ko' : 'bg-canvas text-muted'}`}>{hint.text}</p>}
        </section>
      ))}
    </div>
  );
}
