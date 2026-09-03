import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeleteUsersDialog } from '@/components/commerciaux/delete-users-dialog';
import type { UserRow } from '@/lib/types';

const user = (over: Partial<UserRow> = {}): UserRow =>
  ({
    id: 'u-1',
    fullName: 'Aminata Diallo',
    username: 'adiallo',
    email: 'aminata.diallo@example.sn',
    role: 'COMMERCIAL',
    isActive: true,
    prospectCount: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as UserRow;

describe('DeleteUsersDialog', () => {
  it('ne rend rien tant qu’aucun compte n’est visé', () => {
    render(
      <DeleteUsersDialog
        users={[]}
        repreneurs={[]}
        onOpenChange={vi.fn()}
        pending={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('nomme le compte unique visé', () => {
    render(
      <DeleteUsersDialog
        users={[user({ prospectCount: 0 })]}
        repreneurs={[]}
        onOpenChange={vi.fn()}
        pending={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Supprimer le compte de Aminata Diallo/ }),
    ).toBeTruthy();
  });

  it('compte les comptes et cumule leurs prospects en suppression groupée', () => {
    render(
      <DeleteUsersDialog
        users={[user({ prospectCount: 12 }), user({ id: 'u-2', fullName: 'Modou Fall' })]}
        repreneurs={[]}
        onOpenChange={vi.fn()}
        pending={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: /Supprimer 2 comptes/ })).toBeTruthy();
    expect(screen.getByText('24')).toBeTruthy();
  });

  /// Sans repreneur, l'API refuse la suppression et le portefeuille reste sur
  /// un compte que plus personne ne peut lire.
  it('refuse de confirmer un portefeuille non repris', async () => {
    const onConfirm = vi.fn();
    render(
      <DeleteUsersDialog
        users={[user()]}
        repreneurs={[user({ id: 'u-2', fullName: 'Modou Fall' })]}
        onOpenChange={vi.fn()}
        pending={false}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le compte' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/reprend le portefeuille/);
  });

  it('confirme sans repreneur quand aucune fiche n’est rattachée', async () => {
    const onConfirm = vi.fn();
    render(
      <DeleteUsersDialog
        users={[user({ prospectCount: 0 })]}
        repreneurs={[]}
        onOpenChange={vi.fn()}
        pending={false}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le compte' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  /// Un repreneur supprimé dans la même fournée emporterait le portefeuille
  /// qu'il vient de recevoir ; un non-téléconseiller est refusé par l'API.
  it('écarte les repreneurs sélectionnés et ceux qui ne sont pas téléconseillers', async () => {
    render(
      <DeleteUsersDialog
        users={[user(), user({ id: 'u-2', fullName: 'Modou Fall' })]}
        repreneurs={[
          user({ id: 'u-2', fullName: 'Modou Fall' }),
          user({ id: 'u-3', fullName: 'Awa Sow', role: 'ADMIN' }),
          user({ id: 'u-4', fullName: 'Ibrahima Ba', isActive: false }),
          user({ id: 'u-5', fullName: 'Fatou Ndiaye' }),
        ]}
        onOpenChange={vi.fn()}
        pending={false}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));

    expect(await screen.findByRole('option', { name: 'Fatou Ndiaye' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Awa Sow' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Ibrahima Ba' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Modou Fall' })).toBeNull();
  });
});
