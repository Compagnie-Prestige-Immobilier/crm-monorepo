import { ApiError } from '@crm/api-client/query';
import { describe, expect, it } from 'vitest';

import { ApiConfigurationError } from '@/lib/api/config';
import { apiErrorText } from '@/lib/mutation-feedback';

/**
 * Le message d'erreur d'une mutation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le défaut : trois statuts JETAIENT la raison donnée par le serveur.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 400, 409 et 422 laissaient passer `error.message` ; 401, 403 et 404 le
 * remplaçaient par une phrase fixe. Deux politiques opposées dans le même
 * `switch`, et c'est la mauvaise qui gagnait là où l'API en dit le plus : un
 * 403 « Ce dossier appartient à une autre banque » s'affichait « Cette action
 * est réservée à un administrateur », c'est-à-dire une explication fausse, qui
 * envoie l'utilisateur réclamer des droits dont il dispose déjà.
 */

const fail = (status: number, body: unknown): ApiError =>
  new ApiError(body, new Response(null, { status }));

/** Réponse SANS corps : le cas d'un proxy, d'un 502 nu ou d'un délai dépassé. */
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
    // Sans corps, `ApiError` pose « Request failed with status 403 » : de
    // l'anglais de journal, qui ne dit aucun geste à faire.
    for (const status of [400, 403, 404, 409, 422]) {
      expect(apiErrorText(bare(status), 'Échec.')).not.toMatch(/Request failed/u);
    }
  });

  it('nomme le rôle plutôt que d’affirmer « administrateur »', () => {
    // Un 403 peut venir d'un COMMERCIAL comme d'un BANQUE_FINANCE : la phrase
    // ne doit pas désigner un rôle au hasard.
    expect(apiErrorText(bare(403), 'Échec.')).toBe('Cette action est réservée à un autre rôle.');
  });

  it('retombe sur le message d’appel pour un 400 muet', () => {
    expect(apiErrorText(bare(400), 'Enregistrement impossible.')).toBe(
      'Enregistrement impossible.',
    );
  });

  it('garde les phrases qui décrivent un GESTE, pas une cause', () => {
    // 401 et 429 ne sont pas des refus métier : la seule chose utile à dire est
    // quoi faire ensuite, et le serveur ne le dit pas mieux.
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
    // Une configuration absente n'est pas une coupure réseau : « Vérifiez la
    // connexion » enverrait chercher un câble là où il manque une variable.
    const error = new ApiConfigurationError('API_URL');
    expect(apiErrorText(error, 'Échec.')).toContain('API_URL');
  });

  it('parle de connexion quand ce n’est pas une réponse de l’API', () => {
    expect(apiErrorText(new TypeError('fetch failed'), 'Échec.')).toMatch(/injoignable/u);
  });
});
