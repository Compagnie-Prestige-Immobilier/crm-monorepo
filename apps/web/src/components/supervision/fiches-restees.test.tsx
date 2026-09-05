import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FichesRestees } from '@/components/supervision/fiches-restees';
import type * as OuverturesData from '@/lib/data/ouvertures';
import { renderWithQuery } from '@/test/render-query';

const fetchOuverturesOuvertes = vi.fn();
const libererOuverture = vi.fn();

vi.mock('@/lib/data/ouvertures', async (importOriginal) => {
  const actual = await importOriginal<typeof OuverturesData>();
  return {
    ...actual,
    fetchOuverturesOuvertes: () => fetchOuverturesOuvertes() as unknown,
    libererOuverture: (...args: unknown[]) => libererOuverture(...args) as unknown,
  };
});

const ouverture = (
  over: Partial<OuverturesData.OuvertureFiche> = {},
): OuverturesData.OuvertureFiche => ({
  id: 'ouv-1',
  openedById: 'u-1',
  openedByName: 'Awa Sy',
  representantId: 'r-1',
  prospectId: null,
  ficheNom: 'Aminata Ndiaye',
  openedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  firstInputAt: null,
  closedAt: null,
  dureeSecondes: null,
  closingAttemptId: null,
  draft: null,
  releasedByName: null,
  releasedAt: null,
  ...over,
});

beforeEach(() => {
  fetchOuverturesOuvertes.mockReset();
  fetchOuverturesOuvertes.mockResolvedValue([ouverture()]);
  libererOuverture.mockReset();
});

describe('FichesRestees', () => {
  it('dit qui tient la fiche, et depuis combien de temps', async () => {
    renderWithQuery(<FichesRestees />);

    const ligne = (await screen.findByText('Aminata Ndiaye')).closest('tr') as HTMLElement;
    expect(within(ligne).getByText('Awa Sy')).toBeTruthy();
    expect(within(ligne).getByText('20 min')).toBeTruthy();
  });

  // Aucune libération automatique : elle se demande, et elle coûte une file de rappel.
  it('demande confirmation en disant ce que la libération engage', async () => {
    renderWithQuery(<FichesRestees />);
    await userEvent.click(await screen.findByRole('button', { name: 'Libérer' }));

    const boite = await screen.findByRole('dialog');
    expect(boite.textContent).toContain('Libérer la fiche de Aminata Ndiaye ?');
    expect(boite.textContent).toContain('« À rappeler »');
    expect(libererOuverture).not.toHaveBeenCalled();
  });

  it('libère la fiche et montre qui l’a fait, et quand', async () => {
    libererOuverture.mockResolvedValue(
      ouverture({
        releasedByName: 'Fatou Sow',
        releasedAt: '2026-09-04T10:30:00.000Z',
        closedAt: '2026-09-04T10:30:00.000Z',
      }),
    );
    renderWithQuery(<FichesRestees />);
    await userEvent.click(await screen.findByRole('button', { name: 'Libérer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Libérer' }));

    expect(libererOuverture).toHaveBeenCalledWith('ouv-1');
    const trace = await screen.findByRole('status');
    expect(trace.textContent).toContain('Fatou Sow');
    expect(trace.textContent).toContain('« À rappeler »');
  });

  it('dit qu’il n’y a rien à libérer quand aucune fiche ne traîne', async () => {
    fetchOuverturesOuvertes.mockResolvedValue([]);
    renderWithQuery(<FichesRestees />);

    expect(
      within(await screen.findByRole('table')).getByText(
        'Aucune fiche n’est restée ouverte. Rien à libérer.',
      ),
    ).toBeTruthy();
  });
});
