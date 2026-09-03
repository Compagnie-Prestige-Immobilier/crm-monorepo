import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScoreBadge, byScoreDesc, callsPerActiveHour } from '@/components/supervision/score';
import type { PerformanceScore } from '@/lib/data/admin';

function score(value: number | null, reason: PerformanceScore['reason'] = null): PerformanceScore {
  return { value, reason, parts: [] };
}

function badgeOf(value: number): string {
  const { container } = render(<ScoreBadge score={score(value)} />);
  return container.firstElementChild?.className ?? '';
}

describe('note de rendement', () => {
  it('change de couleur à 75 et à 50, bornes comprises', () => {
    expect(badgeOf(75)).toContain('bg-success-surface');
    expect(badgeOf(74)).toContain('bg-warning-surface');
    expect(badgeOf(50)).toContain('bg-warning-surface');
    expect(badgeOf(49)).toContain('bg-destructive-surface');
  });

  it('dit le motif plutôt qu’un zéro quand la note n’existe pas', () => {
    render(<ScoreBadge score={score(null, 'journee_non_commencee')} />);
    expect(screen.getByText('Journée pas commencée')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('range une note absente derrière un zéro', () => {
    const rows = [
      { id: 'sans', score: score(null, 'aucun_appel') },
      { id: 'zero', score: score(0) },
      { id: 'haut', score: score(80) },
    ];
    expect(byScoreDesc(rows).map((row) => row.id)).toEqual(['haut', 'zero', 'sans']);
  });

  it('ne divise pas par une présence nulle', () => {
    expect(callsPerActiveHour(24, 10_800)).toBe('8,0');
    expect(callsPerActiveHour(24, 0)).toBe('Sans objet');
  });
});
