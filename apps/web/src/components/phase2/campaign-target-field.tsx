'use client';

import { useId } from 'react';

import { CAMPAIGN_SCOPES, campaignScopeLabel, type CampaignScope } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Une campagne tire soit dans une base de prospects, soit chez les représentants. */
export type CampaignTarget = CampaignScope | 'REPRESENTANTS';

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export function RadioCardGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: readonly RadioCardOption<T>[];
  onChange: (value: T) => void;
}) {
  const groupName = useId();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-[0.875rem]',
              'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
              value === option.value
                ? 'border-primary bg-secondary text-secondary-foreground'
                : 'border-border hover:bg-secondary/60',
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={value === option.value}
              className="mt-0.5 size-4 accent-[var(--primary)]"
              onChange={() => {
                onChange(option.value);
              }}
            />
            <span className="min-w-0">
              {option.label}
              {option.hint === undefined ? null : (
                <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">
                  {option.hint}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CampaignTargetField({
  value,
  onChange,
  projet,
}: {
  value: CampaignTarget;
  onChange: (value: CampaignTarget) => void;
  projet: 'CHUES' | 'GRAND_PUBLIC';
}) {
  const options: RadioCardOption<CampaignTarget>[] = CAMPAIGN_SCOPES.filter(
    (candidate) =>
      candidate === 'ALL' ||
      (projet === 'GRAND_PUBLIC' ? candidate.startsWith('GP') : candidate.startsWith('BDD')),
  ).map((candidate) => ({
    value: candidate,
    label: campaignScopeLabel(candidate),
    ...(candidate === 'ALL' ? { hint: 'Toutes les bases de prospects.' } : {}),
  }));

  if (projet === 'CHUES') {
    options.push({
      value: 'REPRESENTANTS',
      label: 'Représentants',
      hint: 'Les enseignants relais, pas les prospects.',
    });
  }

  return (
    <RadioCardGroup
      legend="Qui appelle-t-on ?"
      value={value}
      options={options}
      onChange={onChange}
    />
  );
}
