import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '@/test/render-query';
import type { UserRow } from '@/lib/types';

const fetchReferenceData = vi.fn();
const updateUser = vi.fn();

vi.mock('@/lib/data/reference', () => ({
  fetchReferenceData: () => fetchReferenceData() as unknown,
}));

vi.mock('@/lib/data/users', () => ({
  createUser: vi.fn(),
  updateUser: (id: string, body: unknown) => updateUser(id, body) as unknown,
}));

const { UserFormDialog } = await import('@/components/commerciaux/user-form-dialog');

const account = {
  id: 'u-1',
  email: 'awa@cpi.sn',
  username: 'awa',
  fullName: 'Awa Diop',
  role: 'COMMERCIAL',
  isActive: true,
  departementId: 'd-1',
  departementName: 'Dakar',
  phoneE164: '+221771234567',
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  prospectCount: 0,
} as UserRow;

describe('UserFormDialog', () => {
  beforeEach(() => {
    fetchReferenceData.mockResolvedValue({
      departements: [{ id: 'd-1', name: 'Dakar', isActive: true }],
    });
    updateUser.mockResolvedValue({ ...account, departementId: null, phoneE164: null });
  });

  it('efface réellement le téléphone et le département', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserFormDialog open onOpenChange={vi.fn()} user={account} />);

    await user.clear(await screen.findByRole('textbox', { name: 'Téléphone' }));
    await user.click(screen.getByRole('combobox', { name: 'Département' }));
    await user.click(await screen.findByRole('option', { name: 'Aucun' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        'u-1',
        expect.objectContaining({ phone: '', departementId: '' }),
      );
    });
  });
});
