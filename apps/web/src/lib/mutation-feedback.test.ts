import { ApiError } from '@crm/api-client/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiConfigurationError } from '@/lib/api/config';
import { apiErrorText, demoReadOnlyMessage, toastApiError } from '@/lib/mutation-feedback';

/**
 * Sonner est remplacé pour pouvoir LIRE les options du toast : la durée et
 * l'identifiant du refus de démonstration ne se voient pas dans le texte, et
 * c'est pourtant là que se joue leur utilité.
 */
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Le refus de démonstration : reconnu au CODE, jamais au statut.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tant que le mode démonstration est actif, l'API rend 409
 * `DEMO_MODE_READ_ONLY` sur TOUTE écriture. Le message du serveur est déjà
 * rédigé pour l'écran, et la branche 409 générique le laissait d'ailleurs
 * passer : la prose atteignait donc déjà l'utilisateur, par accident.
 *
 * Ce qui manquait est ce que ces tests éprouvent, et chacun échoue sans la
 * branche dédiée :
 *
 *  1. un corps qui porte le CODE mais pas de prose retombait sur « Un
 *     enregistrement existe déjà avec ces valeurs », c'est-à-dire sur une cause
 *     fausse, qui envoie chercher un doublon inexistant ;
 *  2. rien ne distinguait ce refus d'un conflit d'unicité, donc rien ne pouvait
 *     le traiter à part ;
 *  3. le toast durait quatre secondes pour trois phrases, et s'empilait autant
 *     de fois qu'il y avait de mutations parties.
 */
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
    // C'est le cas qui échouait : la branche 409 générique répondait « Un
    // enregistrement existe déjà avec ces valeurs », et l'utilisateur partait
    // chercher un doublon pendant qu'un interrupteur était allumé au bureau.
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
    // Quatre secondes, le défaut de Sonner, ne suffisent pas à lire la cause ET
    // le remède : l'utilisateur ne retiendrait que « ça a échoué ».
    expect(options.duration).toBeGreaterThan(8000);
  });

  it('n’empile pas un pavé identique par mutation partie', () => {
    // Une vue à mise à jour optimiste ou une action en lot lance plusieurs
    // écritures : elles sont TOUTES refusées, pour la même raison unique.
    toastApiError(demoRefusal(), 'Échec.');
    toastApiError(demoRefusal(), 'Échec.');
    toastApiError(demoRefusal(), 'Échec.');

    const ids = toastError.mock.calls.map((call) => (call[1] as { id?: string } | undefined)?.id);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe('DEMO_MODE_READ_ONLY');
  });

  it('ne colle ni identifiant ni durée sur les autres erreurs', () => {
    // Sans quoi deux échecs de validation distincts se remplaceraient l'un
    // l'autre, et le second effacerait le premier avant sa lecture.
    toastApiError(fail(400, { message: 'Le nom est obligatoire.' }), 'Échec.');

    expect(toastError.mock.calls[0]).toEqual(['Le nom est obligatoire.']);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Le SECOND refus transverse : « l'état du mode est inconnu ».
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `DEMO_MODE_STATE_UNKNOWN` sort en 409 sur TOUTE écriture non dispensée, comme
 * `DEMO_MODE_READ_ONLY`, quand le serveur n'arrive pas à lire l'interrupteur et
 * refuse d'écrire une ligne dont il ne saurait pas dire si elle est réelle.
 *
 * Il n'était traité NULLE PART. Comme le contrat garantit un `message` non
 * vide, la prose du serveur atteignait bien l'écran par la branche 409
 * générique : le texte n'était donc pas faux. Ce qui manquait est le traitement
 * de forme, qui découle du caractère TRANSVERSE et non du texte :
 *
 *  1. le message fait deux phrases longues et durait quatre secondes, le défaut
 *     de Sonner : il disparaît avant que « Réessayez » ait été lu ;
 *  2. une action en lot lance N écritures, toutes refusées pour la même cause
 *     unique, et empilait N pavés identiques dans le coin de l'écran.
 *
 * Et ce qui ne doit SURTOUT pas arriver : que ce refus soit confondu avec une
 * démonstration en cours. Il n'en annonce aucune.
 */
const UNKNOWN_MESSAGE =
  'Impossible de lire l’état du mode démonstration : l’écriture est refusée pour ne pas ' +
  'enregistrer une ligne dont on ne saurait pas dire si elle est réelle. Réessayez.';

const stateUnknown = (body: unknown = { code: 'DEMO_MODE_STATE_UNKNOWN', message: UNKNOWN_MESSAGE }) =>
  fail(409, body);

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
    // Une bascule pendant une panne de base peut produire les deux. Partager un
    // identifiant ferait disparaître le premier au profit du second, et
    // l'utilisateur ne lirait jamais la cause qui le concerne.
    toastApiError(demoRefusal(), 'Échec.');
    toastApiError(stateUnknown(), 'Échec.');

    const ids = toastError.mock.calls.map((call) => (call[1] as { id?: string } | undefined)?.id);
    // Les identifiants sont nommés un par un, et non seulement comptés : sans
    // traitement du second code, son toast ne porte AUCUN identifiant, ce qui
    // ferait bien deux valeurs distinctes tout en le laissant s'empiler.
    expect(ids).toEqual(['DEMO_MODE_READ_ONLY', 'DEMO_MODE_STATE_UNKNOWN']);
  });

  it('n’annonce AUCUNE démonstration en cours', () => {
    // Le piège serait de le traiter comme un alias de `DEMO_MODE_READ_ONLY` :
    // l'utilisateur partirait faire éteindre un interrupteur qui n'est
    // peut-être pas allumé, pendant que la base est en difficulté.
    expect(demoReadOnlyMessage(stateUnknown())).toBeNull();

    const text = apiErrorText(stateUnknown({ code: 'DEMO_MODE_STATE_UNKNOWN' }), 'Échec.');
    expect(text).not.toMatch(/désactiver le mode démonstration/u);
    expect(text).not.toMatch(/écritures sont suspendues/u);
    expect(text).toMatch(/Réessayez/u);
  });

  it('n’accuse PAS un doublon quand le corps porte le code sans prose', () => {
    // Le contrat garantit un `message`, mais un relais qui tronque le corps
    // ferait retomber ce refus sur la branche 409 générique, c'est-à-dire sur
    // un doublon inexistant.
    const text = apiErrorText(stateUnknown({ code: 'DEMO_MODE_STATE_UNKNOWN' }), 'Échec.');

    expect(text).not.toMatch(/existe déjà/u);
  });
});
