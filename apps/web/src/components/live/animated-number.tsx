'use client';

import { useEffect, useRef, useState } from 'react';

import { formatNumber } from '@/lib/format';
import { DUR_2_MS, interpolateCount } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
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
      setShown(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / DUR_2_MS);
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

  return <span className={className}>{formatNumber(shown)}</span>;
}
