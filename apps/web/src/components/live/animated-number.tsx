'use client';

import { useEffect, useRef, useState } from 'react';

import { formatNumber } from '@/lib/format';
import { interpolateCount } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

/** Assez long pour qu'on voie le nombre rouler, assez court pour ne pas mentir sur la fraîcheur. */
const COMPTAGE_MS = 700;

export function AnimatedNumber({
  value,
  format = formatNumber,
  className,
}: {
  value: number;
  format?: (valeur: number) => string;
  className?: string | undefined;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;

    if (reduced) {
      shownRef.current = value;
      // oxlint-disable-next-line react/set-state-in-effect -- animation pilotée hors React
      setShown(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / COMPTAGE_MS);
      const next = interpolateCount(from, value, progress);
      shownRef.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [value, reduced]);

  return <span className={className}>{format(shown)}</span>;
}
