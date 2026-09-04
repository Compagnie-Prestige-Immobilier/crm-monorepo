import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnimatedNumber } from '@/components/live/animated-number';
import { formatRate } from '@/lib/format';

const chiffres = (texte: string | null): string => (texte ?? '').replace(/\D/gu, '');

function fauxMouvementReduit(reduit: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: reduit,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('AnimatedNumber', () => {
  it('affiche la valeur initiale mise en forme, sans passer par le zéro', () => {
    const { container } = render(<AnimatedNumber value={12.5} format={formatRate} />);
    expect(container.textContent).toBe('12,5 %');
  });

  it('roule de l’ancienne valeur vers la nouvelle', () => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
    });
    fauxMouvementReduit(false);

    const { container, rerender } = render(<AnimatedNumber value={0} />);
    rerender(<AnimatedNumber value={1000} />);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    const milieu = Number(chiffres(container.textContent));
    expect(milieu).toBeGreaterThan(0);
    expect(milieu).toBeLessThan(1000);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(chiffres(container.textContent)).toBe('1000');
  });

  it('atteint la nouvelle valeur d’un coup quand le mouvement est réduit', () => {
    fauxMouvementReduit(true);

    const { container, rerender } = render(<AnimatedNumber value={0} />);
    act(() => {
      rerender(<AnimatedNumber value={1000} />);
    });

    expect(chiffres(container.textContent)).toBe('1000');
  });
});
