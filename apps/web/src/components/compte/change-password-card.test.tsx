import { ApiError } from '@crm/api-client/query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChangePasswordCard } from '@/components/compte/change-password-card';
import type * as AuthModule from '@/lib/data/auth';
import { renderWithQuery } from '@/test/render-query';

const changeMyPassword = vi.hoisted(() =>
  vi.fn<(currentPassword: string, newPassword: string) => Promise<void>>(),
);

vi.mock('@/lib/data/auth', async () => {
  const actual = await vi.importActual<typeof AuthModule>('@/lib/data/auth');
  return { ...actual, changeMyPassword };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn<(message: string) => void>(), error: vi.fn<(message: string) => void>() },
}));

beforeEach(() => {
  changeMyPassword.mockReset();
});

function mount() {
  return renderWithQuery(<ChangePasswordCard />);
}

async function fill(current: string, next: string, confirmation: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Mot de passe actuel/u), current);
  await user.type(screen.getByLabelText(/^Nouveau mot de passe/u), next);
  await user.type(screen.getByLabelText(/^Confirmation/u), confirmation);
}

describe('changement du mot de passe', () => {
  it('envoie les valeurs saisies puis vide les champs', async () => {
    const user = userEvent.setup();
    changeMyPassword.mockResolvedValue(undefined);
    mount();

    await fill('ancien-mdp', 'nouveau-mdp', 'nouveau-mdp');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

    await waitFor(() => {
      expect(changeMyPassword).toHaveBeenCalledWith('ancien-mdp', 'nouveau-mdp');
    });

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>(/^Mot de passe actuel/u).value).toBe('');
    });
    expect(screen.getByLabelText<HTMLInputElement>(/^Nouveau mot de passe/u).value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>(/^Confirmation/u).value).toBe('');
  });

  it('affiche le mot de passe actuel incorrect sous le bon champ', async () => {
    const user = userEvent.setup();
    changeMyPassword.mockRejectedValue(
      new ApiError(
        { statusCode: 401, code: 'INVALID_CURRENT_PASSWORD', message: 'Non autorisé.' },
        { status: 401 } as Response,
      ),
    );
    mount();

    await fill('mauvais-mdp', 'nouveau-mdp', 'nouveau-mdp');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

    const error = await screen.findByText('Le mot de passe actuel est incorrect.');
    expect(screen.getByLabelText(/^Mot de passe actuel/u).getAttribute('aria-describedby')).toBe(
      error.id,
    );
  });

  it('bloque l’envoi quand la confirmation diffère du nouveau mot de passe', async () => {
    const user = userEvent.setup();
    mount();

    await fill('ancien-mdp', 'nouveau-mdp', 'autre-mdp');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

    expect(await screen.findByText('Les deux mots de passe diffèrent.')).toBeTruthy();
    expect(changeMyPassword).not.toHaveBeenCalled();
  });

  it('bloque l’envoi quand le nouveau mot de passe compte moins de 8 caractères', async () => {
    const user = userEvent.setup();
    mount();

    await fill('ancien-mdp', 'court', 'court');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

    expect(
      await screen.findByText('Le nouveau mot de passe compte au moins 8 caractères.'),
    ).toBeTruthy();
    expect(changeMyPassword).not.toHaveBeenCalled();
  });
});
