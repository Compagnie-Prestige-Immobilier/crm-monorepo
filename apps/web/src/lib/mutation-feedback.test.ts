import { ApiError } from '@crm/api-client/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiConfigurationError } from '@/lib/api/config';
import { apiErrorText, demoReadOnlyMessage, toastApiError } from '@/lib/mutation-feedback';

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

const DEMO_MESSAGE =
  'La plateforme est en mode démonstration : les écritures sont suspendues. ' +
  'Vos saisies mobiles hors ligne continuent d’être acceptées. Demandez à un ' +
  'administrateur de désactiver le mode démonstration pour reprendre la saisie.';

const demoRefusal = (body: unknown = { code: 'DEMO_MODE_READ_ONLY', message: DEMO_MESSAGE }) =>
  fail(409, body);

describe('le refus d’écriture du mode démonstration', () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it('rend la phrase du serveur telle quelle : elle est écrite pour l’écran', () => {
    expect(apiErrorText(demoRefusal(), 'Enregistrement impossible.')).toBe(DEMO_MESSAGE);
  });

  it('n’accuse PAS un doublon quand le corps porte le code sans prose', () => {
    const text = apiErrorText(demoRefusal({ code: 'DEMO_MODE_READ_ONLY' }), 'Échec.');

    expect(text).not.toMatch(/existe déjà/u);
    expect(text).toMatch(/mode démonstration/u);
  });

  it('branche sur le code et non sur le statut : un 409 ordinaire reste un conflit', () => {
    expect(demoReadOnlyMessage(fail(409, { message: 'Numéro déjà enregistré.' }))).toBeNull();
    expect(demoReadOnlyMessage(fail(409, { code: 'PROSPECT_DUPLICATE' }))).toBeNull();
    expect(demoReadOnlyMessage(new TypeError('fetch failed'))).toBeNull();
    expect(demoReadOnlyMessage(demoRefusal())).toBe(DEMO_MESSAGE);
  });

  it('laisse au message trois phrases le temps d’être lu', () => {
    toastApiError(demoRefusal(), 'Échec.');

    const [text, options] = toastError.mock.calls[0] as [string, { duration?: number }];
    expect(text).toBe(DEMO_MESSAGE);
    expect(options.duration).toBeGreaterThan(8000);
  });

  it('n’empile pas un pavé identique par mutation partie', () => {
    toastApiError(demoRefusal(), 'Échec.');
    toastApiError(demoRefusal(), 'Échec.');
    toastApiError(demoRefusal(), 'Échec.');

    const ids = toastError.mock.calls.map((call) => (call[1] as { id?: string } | undefined)?.id);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe('DEMO_MODE_READ_ONLY');
  });

  it('ne colle ni identifiant ni durée sur les autres erreurs', () => {
    toastApiError(fail(400, { message: 'Le nom est obligatoire.' }), 'Échec.');

    expect(toastError.mock.calls[0]).toEqual(['Le nom est obligatoire.']);
  });
});

const UNKNOWN_MESSAGE =
  'Impossible de lire l’état du mode démonstration : l’écriture est refusée pour ne pas ' +
  'enregistrer une ligne dont on ne saurait pas dire si elle est réelle. Réessayez.';

const stateUnknown = (
  body: unknown = { code: 'DEMO_MODE_STATE_UNKNOWN', message: UNKNOWN_MESSAGE },
) => fail(409, body);

describe('le refus d’écriture quand l’état du mode est inconnu', () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it('laisse au message le temps d’être lu, comme l’autre refus transverse', () => {
    toastApiError(stateUnknown(), 'Échec.');

    const [text, options] = toastError.mock.calls[0] as [string, { duration?: number } | undefined];
    expect(text).toBe(UNKNOWN_MESSAGE);
    expect(options?.duration).toBeGreaterThan(8000);
  });

  it('n’empile pas un pavé identique par écriture partie', () => {
    toastApiError(stateUnknown(), 'Échec.');
    toastApiError(stateUnknown(), 'Échec.');
    toastApiError(stateUnknown(), 'Échec.');

    const ids = toastError.mock.calls.map((call) => (call[1] as { id?: string } | undefined)?.id);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe('DEMO_MODE_STATE_UNKNOWN');
  });

  it('n’efface PAS le refus de lecture seule : deux états distincts, deux toasts', () => {
    toastApiError(demoRefusal(), 'Échec.');
    toastApiError(stateUnknown(), 'Échec.');

    const ids = toastError.mock.calls.map((call) => (call[1] as { id?: string } | undefined)?.id);
    expect(ids).toEqual(['DEMO_MODE_READ_ONLY', 'DEMO_MODE_STATE_UNKNOWN']);
  });

  it('n’annonce AUCUNE démonstration en cours', () => {
    expect(demoReadOnlyMessage(stateUnknown())).toBeNull();

    const text = apiErrorText(stateUnknown({ code: 'DEMO_MODE_STATE_UNKNOWN' }), 'Échec.');
    expect(text).not.toMatch(/désactiver le mode démonstration/u);
    expect(text).not.toMatch(/écritures sont suspendues/u);
    expect(text).toMatch(/Réessayez/u);
  });

  it('n’accuse PAS un doublon quand le corps porte le code sans prose', () => {
    const text = apiErrorText(stateUnknown({ code: 'DEMO_MODE_STATE_UNKNOWN' }), 'Échec.');

    expect(text).not.toMatch(/existe déjà/u);
  });
});
