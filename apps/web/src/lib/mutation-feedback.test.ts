import { ApiError } from '@crm/api-client/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiConfigurationError } from '@/lib/api/config';
import { apiErrorText, toastApiError } from '@/lib/mutation-feedback';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const fail = (status: number, body: unknown): ApiError =>
  new ApiError(body, new Response(null, { status }));

const bare = (status: number): ApiError => fail(status, null);

describe('la raison du serveur atteint l’utilisateur', () => {
  it('rend le motif d’un 403, au lieu d’accuser un manque de droits', () => {
    expect(
      apiErrorText(fail(403, { message: 'Ce dossier appartient à une autre banque.' }), 'Échec.'),
    ).toBe('Ce dossier appartient à une autre banque.');
  });

  it('rend le motif d’un 404, au lieu de renvoyer rafraîchir la liste', () => {
    expect(
      apiErrorText(fail(404, { message: 'Ce représentant a déjà été supprimé.' }), 'Échec.'),
    ).toBe('Ce représentant a déjà été supprimé.');
  });

  it('rend le motif d’un 409 et d’un 400, comme avant', () => {
    expect(apiErrorText(fail(409, { message: 'Numéro déjà enregistré.' }), 'Échec.')).toBe(
      'Numéro déjà enregistré.',
    );
    expect(apiErrorText(fail(400, { message: 'Le nom est obligatoire.' }), 'Échec.')).toBe(
      'Le nom est obligatoire.',
    );
  });

  it('aplatit la liste de champs de class-validator', () => {
    expect(
      apiErrorText(fail(422, { message: ['nom : obligatoire', 'phone : invalide'] }), 'Échec.'),
    ).toBe('nom : obligatoire, phone : invalide');
  });
});

describe('les phrases de repli, quand le serveur ne dit rien', () => {
  it('ne laisse JAMAIS passer le message technique d’`ApiError`', () => {
    for (const status of [400, 403, 404, 409, 422]) {
      expect(apiErrorText(bare(status), 'Échec.')).not.toMatch(/Request failed/u);
    }
  });

  it('nomme le rôle plutôt que d’affirmer « administrateur »', () => {
    expect(apiErrorText(bare(403), 'Échec.')).toBe('Cette action est réservée à un autre rôle.');
  });

  it('retombe sur le message d’appel pour un 400 muet', () => {
    expect(apiErrorText(bare(400), 'Enregistrement impossible.')).toBe(
      'Enregistrement impossible.',
    );
  });

  it('garde les phrases qui décrivent un GESTE, pas une cause', () => {
    expect(apiErrorText(fail(401, { message: 'jwt expired' }), 'Échec.')).toBe(
      'Session expirée. Rechargez la page.',
    );
    expect(apiErrorText(fail(429, { message: 'ThrottlerException' }), 'Échec.')).toBe(
      'Trop de requêtes. Patientez quelques secondes.',
    );
  });

  it('ne relaie pas la trace d’un 500 : elle ne s’adresse pas à l’utilisateur', () => {
    expect(apiErrorText(fail(500, { message: 'PrismaClientKnownRequestError' }), 'Échec.')).toBe(
      'Erreur serveur (500). Réessayez.',
    );
  });

  it('nomme la variable manquante pour une configuration incomplète', () => {
    const error = new ApiConfigurationError('API_URL');
    expect(apiErrorText(error, 'Échec.')).toContain('API_URL');
  });

  it('parle de connexion quand ce n’est pas une réponse de l’API', () => {
    expect(apiErrorText(new TypeError('fetch failed'), 'Échec.')).toMatch(/injoignable/u);
  });
});

describe('notification des erreurs', () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it('affiche le message sans options spéciales', () => {
    toastApiError(fail(400, { message: 'Le nom est obligatoire.' }), 'Échec.');

    expect(toastError.mock.calls[0]).toEqual(['Le nom est obligatoire.']);
  });
});
