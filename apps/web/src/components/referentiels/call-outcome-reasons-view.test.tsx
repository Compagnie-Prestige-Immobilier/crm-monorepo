import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CallOutcomeReason } from '@/lib/data/call-outcome-reasons';
import { renderWithQuery } from '@/test/render-query';
import type * as CallOutcomeReasonsModule from '@/lib/data/call-outcome-reasons';

const fetchCallOutcomeReasons = vi.fn();
const setCallOutcomeReasonActive = vi.fn();
const updateCallOutcomeReason = vi.fn();

vi.mock('@/lib/data/call-outcome-reasons', async () => {
  const actual = await vi.importActual<typeof CallOutcomeReasonsModule>(
    '@/lib/data/call-outcome-reasons',
  );
  return {
    ...actual,
    fetchCallOutcomeReasons: () => fetchCallOutcomeReasons() as unknown,
    setCallOutcomeReasonActive: (id: string, isActive: boolean) =>
      setCallOutcomeReasonActive(id, isActive) as unknown,
    updateCallOutcomeReason: (id: string, patch: unknown) =>
      updateCallOutcomeReason(id, patch) as unknown,
  };
});

const { CallOutcomeReasonsView } =
  await import('@/components/referentiels/call-outcome-reasons-view');

const reason = (patch: Partial<CallOutcomeReason>): CallOutcomeReason => ({
  id: 'r-1',
  code: 'UNREACHABLE',
  label: 'Injoignable',
  effect: 'KEEP_OPEN',
  requiresComment: false,
  requiresCallback: false,
  countsAsReached: false,
  isActive: true,
  isSystem: true,
  sortOrder: 30,
  color: 'warning',
  minPayloadVersion: 1,
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...patch,
});

const SYSTEME = reason({});
const NEUF = reason({
  id: 'r-2',
  code: 'NRP',
  label: 'Ne répond pas',
  isSystem: false,
  minPayloadVersion: 2,
  sortOrder: 35,
});

describe('référentiel des issues d’appel', () => {
  beforeEach(() => {
    fetchCallOutcomeReasons.mockReturnValue(Promise.resolve([SYSTEME, NEUF]));
    setCallOutcomeReasonActive.mockReturnValue(Promise.resolve({ ...NEUF, isActive: false }));
    updateCallOutcomeReason.mockReset();
    updateCallOutcomeReason.mockReturnValue(Promise.resolve(NEUF));
  });

  it('dit en clair, sans qu’on ait à cliquer, qu’un motif neuf n’atteint pas les téléphones', async () => {
    renderWithQuery(<CallOutcomeReasonsView />);

    expect(await screen.findByText(/ne descend pas sur les téléphones/i)).toBeTruthy();
    expect(
      screen.getByText(/qu’après la mise à jour de l’application et le renouvellement du parc/i),
    ).toBeTruthy();
  });

  it('distingue ligne par ligne ce que le parc reçoit de ce qu’il ne reçoit pas', async () => {
    renderWithQuery(<CallOutcomeReasonsView />);

    const neuf = (await screen.findByText('Ne répond pas')).closest('tr');
    const systeme = screen.getByText('Injoignable').closest('tr');

    expect(neuf).not.toBeNull();
    expect(systeme).not.toBeNull();
    expect(neuf?.textContent).toContain('Après mise à jour de l’application');
    expect(systeme?.textContent).not.toContain('Après mise à jour de l’application');
  });

  it('redit la contrainte dans la boîte de création, avant d’enregistrer', async () => {
    renderWithQuery(<CallOutcomeReasonsView />);

    await userEvent.click(await screen.findByRole('button', { name: /Nouveau motif/ }));

    expect(
      await screen.findByText(/Les téléphones en service continueront de ne proposer/i),
    ).toBeTruthy();
  });

  it('n’offre pas de retirer un motif système', async () => {
    renderWithQuery(<CallOutcomeReasonsView />);

    await screen.findByText('Injoignable');
    expect(screen.queryByRole('button', { name: /Retirer Injoignable/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Retirer Ne répond pas/ })).toBeTruthy();
  });

  it('retire un motif du panneau sans le supprimer', async () => {
    renderWithQuery(<CallOutcomeReasonsView />);

    await userEvent.click(await screen.findByRole('button', { name: /Retirer Ne répond pas/ }));

    expect(setCallOutcomeReasonActive).toHaveBeenCalledWith('r-2', false);
  });

  // Le champ existe dans les DTO serveur depuis toujours ; l'interface écrite à
  // la main l'omettait, et aucune couleur n'était modifiable depuis le panneau.
  it('montre la couleur du motif et la rend modifiable', async () => {
    renderWithQuery(<CallOutcomeReasonsView />);

    const ligne = (await screen.findByText('Injoignable')).closest('tr');
    expect(ligne?.textContent).toContain('Orange · vigilance');

    await userEvent.click(screen.getByRole('button', { name: /Modifier Ne répond pas/ }));
    expect(await screen.findByRole('combobox', { name: /Couleur/ })).toBeTruthy();
  });

  // Champ vidé : `valueAsNumber` rendait `NaN`, donc `null` dans le JSON, que la
  // colonne refuse. L'admin ne lisait qu'un « Enregistrement impossible ».
  it('refuse un ordre d’affichage vide EN NOMMANT le champ, sans appeler l’API', async () => {
    renderWithQuery(<CallOutcomeReasonsView />);

    await userEvent.click(await screen.findByRole('button', { name: /Modifier Ne répond pas/ }));

    const ordre = await screen.findByLabelText(/Ordre d’affichage/);
    await userEvent.clear(ordre);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Indiquez un entier positif, 0 compris.')).toBeTruthy();
    expect(updateCallOutcomeReason).not.toHaveBeenCalled();
  });

  it('laisse passer zéro, qui est un ordre valable', async () => {
    renderWithQuery(<CallOutcomeReasonsView />);

    await userEvent.click(await screen.findByRole('button', { name: /Modifier Ne répond pas/ }));

    const ordre = await screen.findByLabelText(/Ordre d’affichage/);
    await userEvent.clear(ordre);
    await userEvent.type(ordre, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await vi.waitFor(() => {
      expect(updateCallOutcomeReason).toHaveBeenCalledWith(
        'r-2',
        expect.objectContaining({ sortOrder: 0 }),
      );
    });
  });
});
