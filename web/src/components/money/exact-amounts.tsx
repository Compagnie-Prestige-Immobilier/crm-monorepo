'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { formatXof, formatXofCompact } from '@/lib/money';
import { cn } from '@/lib/utils';

const ExactAmountsContext = createContext<{
  exact: boolean;
  toggle: () => void;
}>({ exact: false, toggle: () => undefined });

const STORAGE_KEY = 'cpi.montants-exacts';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function ExactAmountsProvider({ children }: { children: ReactNode }) {
  const [exact, setExact] = useState(readStored);

  const toggle = useCallback(() => {
    setExact((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo(() => ({ exact, toggle }), [exact, toggle]);

  return <ExactAmountsContext.Provider value={value}>{children}</ExactAmountsContext.Provider>;
}

function useExactAmounts(): { exact: boolean; toggle: () => void } {
  return useContext(ExactAmountsContext);
}

export function MoneyText({
  value,
  placeholder = '–',
  className,
}: {
  value: string | null | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
}) {
  const { exact } = useExactAmounts();
  const full = formatXof(value, placeholder);
  const compact = formatXofCompact(value, placeholder);
  const shown = exact ? full : compact;

  const abbreviated = compact !== full;

  return (
    <span className={cn('tabular-nums', className)} title={abbreviated ? full : undefined}>
      <span aria-hidden={abbreviated ? 'true' : undefined}>{shown}</span>
      {abbreviated ? <span className="sr-only">{full}</span> : null}
    </span>
  );
}

export function ExactAmountsToggle({ className }: { className?: string | undefined }) {
  const { exact, toggle } = useExactAmounts();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={exact}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md border border-border px-3',
        'text-[0.75rem] font-[600] transition-colors duration-(--dur-1) ease-(--ease-out-cpi)',
        'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        exact ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative h-4 w-7 shrink-0 rounded-full transition-colors duration-(--dur-1)',
          exact ? 'bg-primary' : 'bg-switch-background',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3 rounded-full bg-primary-foreground transition-[left] duration-(--dur-1) ease-(--ease-out-cpi)',
            exact ? 'left-3.5' : 'left-0.5',
          )}
        />
      </span>
      Chiffres exacts
    </button>
  );
}
