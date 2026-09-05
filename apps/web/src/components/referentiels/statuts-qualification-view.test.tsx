import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StatutQualification } from '@/lib/data/statuts-qualification';
import type * as StatutsModule from '@/lib/data/statuts-qualification';
import { renderWithQuery } from '@/test/render-query';

const fetchAllStatutsQualification = vi.fn();
const createStatutQualification = vi.fn();
const updateStatutQualification = vi.fn();
const setStatutQualificationActive = vi.fn();

vi.mock('@/lib/data/statuts-qualification', async () => {
  const actual = await vi.importActual<typeof StatutsModule>('@/lib/data/statuts-qualification');
  return {
    ...actual,
    fetchAllStatutsQualification: () => fetchAllStatutsQualification() as unknown,
    createStatutQualification: (input: unknown) => createStatutQualification(input) as unknown,
    updateStatutQualification: (id: string, patch: unknown) =>
      updateStatutQualification(id, patch) as unknown,
    setStatutQualificationActive: (id: string, isActive: boolean) =>
      setStatutQualificationActive(id, isActive) as unknown,
  };
});

const { StatutsQualificationView } =
  await import('@/components/referentiels/statuts-qualification-view');

const statut = (
  patch: Partial<StatutQualification> & { requiresComment?: boolean },
): StatutQualification => ({
  id: 's-1',
  code: 'TRES_INTERESSE',
  label: 'Très intéressé',
  effect: 'REACHED',
  requiresCallback: false,
  retryAfterMinutes: null,
  priorite: 'HAUTE',
  relationStatus: 'AMBASSADEUR',
  isActive: true,
  isSystem: true,
  minPayloadVersion: 6,
  updatedAt: '2026-09-03T00:00:00.000Z',
  ...patch,
});

const SYSTEME = statut({});
const BASSE = statut({
  id: 's-2',
  code: 'NON_ELIGIBLE',
  label: 'Non éligible',
  effect: 'REFUSED',
  priorite: 'BASSE',
  relationStatus: null,
});

describe('référentiel des statuts de qualification', () => {
  beforeEach(() => {
    fetchAllStatutsQualification.mockReturnValue(Promise.resolve([SYSTEME, BASSE]));
    createStatutQualification.mockReset();
    createStatutQualification.mockReturnValue(Promise.resolve(SYSTEME));
    updateStatutQualification.mockReset();
    updateStatutQualification.mockReturnValue(Promise.resolve(SYSTEME));
    setStatutQualificationActive.mockReturnValue(Promise.resolve(SYSTEME));
  });

  it('dit ligne par ligne dans quel ordre le plateau reprend les fiches', async () => {
    renderWithQuery(<StatutsQualificationView />);

    const haute = (await screen.findByText('Très intéressé')).closest('tr');
    const basse = screen.getByText('Non éligible').closest('tr');

    expect(haute?.textContent).toContain('Haute');
    expect(basse?.textContent).toContain('Basse');
  });

  // La règle de rappel est celle du script et se verrouille sur une ligne
  // système ; la priorité, elle, est un arbitrage de plateau qui se change.
  it('dit ligne par ligne la relation que le statut pose, et son absence', async () => {
    renderWithQuery(<StatutsQualificationView />);

    const pose = (await screen.findByText('Très intéressé')).closest('tr');
    const rien = screen.getByText('Non éligible').closest('tr');

    expect(pose?.textContent).toContain('A accepté');
    expect(rien?.textContent).toContain('Ne tranche pas');
  });

  it('pose la relation depuis un statut SYSTÈME, et la retire', async () => {
    renderWithQuery(<StatutsQualificationView />);

    await userEvent.click(await screen.findByRole('button', { name: /Modifier Très intéressé/ }));

    const relation = await screen.findByRole('combobox', { name: /Décision/ });
    expect(relation.textContent).toContain('A accepté');

    await userEvent.click(relation);
    await userEvent.click(await screen.findByRole('option', { name: 'Ne tranche pas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await vi.waitFor(() => {
      expect(updateStatutQualification).toHaveBeenCalledWith(
        's-1',
        expect.objectContaining({ relationStatus: null }),
      );
    });
  });

  // Le code se déduit du libellé côté serveur : le saisir en donnerait deux
  // sources, et rien ne garantirait qu'elles parlent du même statut.
  it('ne demande plus le code, et ne l’envoie pas à la création', async () => {
    renderWithQuery(<StatutsQualificationView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Nouveau statut' }));
    expect(screen.queryByRole('textbox', { name: /Code/ })).toBeNull();

    await userEvent.type(await screen.findByRole('textbox', { name: /Libellé/ }), 'Hors cible');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await vi.waitFor(() => {
      expect(createStatutQualification).toHaveBeenCalledTimes(1);
    });
    expect(createStatutQualification.mock.calls[0]?.[0]).not.toHaveProperty('code');
  });

  it('signale sur la ligne le statut qui réclame un motif', async () => {
    fetchAllStatutsQualification.mockReturnValue(
      Promise.resolve([statut({ id: 's-3', label: 'Autre joint', requiresComment: true }), BASSE]),
    );
    renderWithQuery(<StatutsQualificationView />);

    const autre = (await screen.findByText('Autre joint')).closest('tr');

    expect(autre?.textContent).toContain('motif exigé');
    expect(screen.getByText('Non éligible').closest('tr')?.textContent).not.toContain(
      'motif exigé',
    );
  });

  it('laisse changer la priorité d’un statut SYSTÈME', async () => {
    renderWithQuery(<StatutsQualificationView />);

    await userEvent.click(await screen.findByRole('button', { name: /Modifier Très intéressé/ }));

    const priorite = await screen.findByRole('combobox', { name: /Priorité/ });
    expect(priorite.hasAttribute('disabled')).toBe(false);

    await userEvent.click(priorite);
    await userEvent.click(await screen.findByRole('option', { name: 'Basse' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await vi.waitFor(() => {
      expect(updateStatutQualification).toHaveBeenCalledWith(
        's-1',
        expect.objectContaining({ priorite: 'BASSE' }),
      );
    });
  });
});
