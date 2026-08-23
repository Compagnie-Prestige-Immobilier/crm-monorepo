import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedSearch } from '@/lib/use-debounced-search';

/** Un mini écran filtré : le champ publie dans `search`, « Tout effacer » le vide. */
function Ecran({ onCommit }: { onCommit: (value: string) => void }) {
  const [search, setSearch] = useState('');
  const commit = (next: string) => {
    setSearch(next);
    onCommit(next);
  };
  const { draft, setDraft } = useDebouncedSearch(search, commit);

  return (
    <>
      <input
        aria-label="Rechercher"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
      <button
        type="button"
        onClick={() => {
          commit('');
        }}
      >
        Tout effacer
      </button>
      <p data-testid="publie">{search}</p>
    </>
  );
}

const saisir = (text: string): void => {
  fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: text } });
};

const attendre = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publie la frappe une seule fois, après la temporisation', () => {
    const commits = vi.fn();
    render(<Ecran onCommit={commits} />);

    saisir('a');
    saisir('ab');
    saisir('abc');
    attendre(200);
    expect(commits).not.toHaveBeenCalled();

    attendre(400);
    expect(commits.mock.calls).toEqual([['abc']]);
  });

  it('une remise à zéro n’est PAS réécrite par le report en cours', () => {
    const commits = vi.fn();
    render(<Ecran onCommit={commits} />);

    saisir('abc');
    attendre(400);
    commits.mockClear();

    saisir('abcd');
    // La remise à zéro tombe pendant que « abcd » attend encore.
    attendre(100);
    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }));
    attendre(1000);

    expect(commits.mock.calls).toEqual([['']]);
    expect(screen.getByTestId('publie').textContent).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Rechercher').value).toBe('');
  });
});
