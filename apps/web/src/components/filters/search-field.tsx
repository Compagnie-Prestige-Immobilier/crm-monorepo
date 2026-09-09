'use client';

import { SearchIcon, XIcon } from 'lucide-react';
import { useId, useRef } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function SearchField({
  label = 'Recherche',
  placeholder,
  value,
  onChange,
  className,
}: {
  label?: string | undefined;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string | undefined;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('flex min-w-[15rem] flex-1 flex-col gap-1.5', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onFocus={(event) => {
            if (event.target.value !== '') event.target.select();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && value !== '') {
              event.stopPropagation();
              onChange('');
            }
          }}
          placeholder={placeholder}
          className={cn('pl-9', value !== '' && 'pr-10')}
        />
        {value !== '' ? (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors duration-(--dur-1) ease-(--ease-out-cpi) hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
