import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as VisitesModule from '@/lib/data/visites';
import { EMPTY_VISITE_FILTERS, type ImpressionColonne, type Visite } from '@/lib/data/visites';

const fetchVisites = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/visites', async () => {
  const actual = await vi.importActual<typeof VisitesModule>('@/lib/data/visites');
  return { ...actual, fetchVisites: (...args: unknown[]) => fetchVisites(...args) as unknown };
});

const { ImpressionDialog } = await import('@/components/accueil/impression-dialog');

const ref = (id: string, code: string, label: string) => ({ id, code, label });

const visite = (id: string): Visite => ({
  id,
  reference: `V-2026-${id}`,
  date: '2026-08-19',
  time: '09:35',
  visitorName: 'Awa Ndiaye',
  phone: null,
  phoneE164: null,
  entreprise: ref('e-cpi', 'CPI', 'CPI'),
  objet: ref('o-achat', 'ACHAT_TERRAIN', 'ACHAT TERRAIN'),
  direction: null,
  destinataire: null,
  comment: null,
  createdById: 'u-1',
  createdAt: '2026-08-19T09:35:00.000Z',
});

function props(over: Partial<React.ComponentProps<typeof ImpressionDialog>> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    orientation: 'landscape' as const,
    onOrientationChange: vi.fn(),
    colonnesImprimees: new Set<ImpressionColonne>(),
    onColonnesImpriméesChange: vi.fn(),
    filters: EMPTY_VISITE_FILTERS,
    today: '2026-08-19',
    total: 100,
    pageItemsCount: 20,
    ...over,
  };
}

beforeEach(() => {
  fetchVisites.mockReset();
});

describe('quoi imprimer', () => {
  it('propose la page affichée et tout le résultat filtré, avec leur compte', () => {
    render(<ImpressionDialog {...props({ total: 2431, pageItemsCount: 100 })} />);

    expect(screen.getByText(/100 visites, environ/u)).toBeTruthy();
    expect(screen.getByText(/2\s?431 visites, environ/u)).toBeTruthy();
  });

  it('désactive « tout le résultat filtré » au-delà de 3 000 visites, en disant pourquoi', () => {
    render(<ImpressionDialog {...props({ total: 12480 })} />);

    expect(screen.getByRole('radio', { name: /Tout le résultat filtré/u })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByText(/12\s?480 visites : trop pour une impression/u)).toBeTruthy();
  });

  it('imprime la page affichée sans recharger de données', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const onOpenChange = vi.fn();
    render(<ImpressionDialog {...props({ onOpenChange })} />);

    await userEvent.setup().click(screen.getByRole('button', { name: /Ouvrir l’impression/u }));

    expect(fetchVisites).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it('charge tout le résultat filtré, page par page, avant d’imprimer', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    fetchVisites
      .mockResolvedValueOnce({
        items: [visite('1')],
        total: 250,
        page: 1,
        pageSize: 200,
        pageCount: 2,
      })
      .mockResolvedValueOnce({
        items: [visite('2')],
        total: 250,
        page: 2,
        pageSize: 200,
        pageCount: 2,
      });

    render(<ImpressionDialog {...props({ total: 250 })} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /Tout le résultat filtré/u }));
    await user.click(screen.getByRole('button', { name: /Ouvrir l’impression/u }));

    await waitFor(() => {
      expect(fetchVisites).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(print).toHaveBeenCalledOnce();
    });
    print.mockRestore();
  });
});

describe('colonnes du registre', () => {
  it('verrouille DATE VISITE et PRENOM ET NOMS, jamais décochables', () => {
    render(
      <ImpressionDialog
        {...props({ colonnesImprimees: new Set(['DATE VISITE', 'PRENOM ET NOMS']) })}
      />,
    );

    const date = screen.getByRole('checkbox', { name: 'DATE VISITE' });
    const nom = screen.getByRole('checkbox', { name: 'PRENOM ET NOMS' });
    expect(date).toHaveProperty('checked', true);
    expect(date).toHaveProperty('disabled', true);
    expect(nom).toHaveProperty('checked', true);
    expect(nom).toHaveProperty('disabled', true);
  });
});
