'use client';

import { useId, type ReactNode } from 'react';

import { InfoBulle } from '@/components/forms/info-bulle';
import { Label } from '@/components/ui/label';

export function Field({
  label,
  error,
  description,
  info,
  required = false,
  children,
}: {
  label: string;
  error?: string | undefined;
  description?: string | undefined;
  /** Une phrase derrière un « i » : ce que le réglage fait. */
  info?: string | undefined;
  required?: boolean | undefined;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  const describedBy =
    [error !== undefined ? errorId : null, description !== undefined ? descriptionId : null]
      .filter((value) => value !== null)
      .join(' ') || undefined;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span className="text-[0.8125rem] font-[500] text-destructive">Obligatoire</span>
          ) : null}
        </Label>
        {info === undefined ? null : <InfoBulle sujet={label} texte={info} />}
      </div>
      {children({ id, 'aria-invalid': error !== undefined, 'aria-describedby': describedBy })}
      {description !== undefined ? (
        <p id={descriptionId} className="text-[0.75rem] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={errorId} role="alert" className="text-[0.75rem] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
