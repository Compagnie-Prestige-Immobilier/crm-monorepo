import type { ApiClient } from '@crm/api-client';
import { describe, expect, it, vi } from 'vitest';

import { PANEL_ROLES, authenticate } from '@/lib/data/auth';
import type { Role } from '@/lib/types';

const clientFor = (role: Role): ApiClient =>
  ({
    POST: vi.fn().mockResolvedValue({
      response: { status: 200, ok: true },
      data: {
        accessToken: 'a',
        refreshToken: 'r',
        expiresIn: 900,
        user: { id: 'u-1', username: 'awa', fullName: 'Awa Sy', role },
      },
    }),
  }) as unknown as ApiClient;

describe('qui entre dans le panneau', () => {
  it('un SUPERVISEUR se connecte : sans lui, le rôle n’a aucun écran', async () => {
    const result = await authenticate('awa', 'secret', clientFor('SUPERVISEUR'));

    expect(result?.user.role).toBe('SUPERVISEUR');
  });

  it('un rôle hors panneau est refusé après authentification', async () => {
    const inconnu = 'DIRECTEUR' as Role;

    expect(PANEL_ROLES).not.toContain(inconnu);
    await expect(authenticate('x', 'y', clientFor(inconnu))).resolves.toBeNull();
  });
});
