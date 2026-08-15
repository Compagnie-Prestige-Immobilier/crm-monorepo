import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeactivateUserDialog } from '@/components/commerciaux/deactivate-user-dialog';
import type { UserRow } from '@/lib/types';

/**
 * Ce qu'on éprouve ici, c'est la RAISON D'ÊTRE du dialogue.
 *
 * La désactivation partait auparavant d'un `onSelect` de menu, sans confirmation.
 * Le correctif ne vaut que si trois choses tiennent : le compte visé est nommé,
 * son poids en prospects est sous les yeux, et « Annuler » n'appelle PAS la
 * mutation. La troisième est la plus facile à casser sans s'en apercevoir : un
 * `onClick={onConfirm}` recopié sur le mauvais bouton passerait la revue.
 */
const user = (over: Partial<UserRow> = {}): UserRow =>
  ({
    id: 'u-1',
    fullName: 'Aminata Diallo',
    username: 'adiallo',
    email: 'aminata.diallo@example.sn',
    role: 'COMMERCIAL',
    isActive: true,
    prospectCount: 128,
    departementId: null,
    departementName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as UserRow;

describe('DeactivateUserDialog', () => {
  it('nomme le compte visé et son nombre de prospects', () => {
    render(
      <DeactivateUserDialog
        user={user()}
        onOpenChange={vi.fn()}
        pending={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Désactiver le compte de Aminata Diallo/ }),
    ).toBeTruthy();
    // `128` formaté par `formatNumber` : espace insécable étroit en fr-FR.
    expect(screen.getByText('128')).toBeTruthy();
    expect(screen.getByText(/prospects sont rattachés/)).toBeTruthy();
  });

  it('accorde le décompte au singulier', () => {
    render(
      <DeactivateUserDialog
        user={user({ prospectCount: 1 })}
        onOpenChange={vi.fn()}
        pending={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/prospect est rattaché/)).toBeTruthy();
  });

  it('n’appelle pas la mutation quand on annule', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DeactivateUserDialog
        user={user()}
        onOpenChange={onOpenChange}
        pending={false}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('appelle la mutation, et elle seule, sur la confirmation', async () => {
    const onConfirm = vi.fn();
    render(
      <DeactivateUserDialog
        user={user()}
        onOpenChange={vi.fn()}
        pending={false}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Désactiver le compte/ }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('ne rend rien tant qu’aucun compte n’est visé', () => {
    render(
      <DeactivateUserDialog user={null} onOpenChange={vi.fn()} pending={false} onConfirm={vi.fn()} />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
