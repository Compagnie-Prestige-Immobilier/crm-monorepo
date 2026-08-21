import { expect, request, type APIRequestContext } from '@playwright/test';

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const ADMIN_STORAGE_STATE = 'e2e/.auth/admin.json';

/** Assez long pour la règle de l'API (12 caractères minimum). */
export const FIXTURE_PASSWORD = 'Fixture1-CPI-Sunugal';

/**
 * BDD1 = syndicat CHUES × banque CBAO (`packages/database/src/segment.ts`).
 * Le parcours de création de campagne tire sur ce segment ; les prospects
 * doivent donc porter exactement ce couple.
 */
const SYNDICAT_SIGLE = 'CHUES';
const BANQUE_SHORT_NAME = 'CBAO';

/**
 * Deux téléconseillers, parce que le tourniquet doit avoir quelque chose à
 * répartir : un seul destinataire ne prouverait pas que la distribution
 * distribue.
 */
export const TELECONSEILLERS = [
  { email: 'fixture.awa@cpi.sn', username: 'fixture.awa', fullName: 'Awa Fixture' },
  { email: 'fixture.fatou@cpi.sn', username: 'fixture.fatou', fullName: 'Fatou Fixture' },
] as const;

/**
 * Le compte BANQUE_FINANCE des parcours. Exporté : `workspaces.spec.ts` s'y
 * connecte pour déposer une demande de création de client, et il visait
 * auparavant un compte du JEU DE DÉMONSTRATION — qui n'existe plus une fois
 * celui-ci purgé.
 */
export const BANQUIER = {
  email: 'fixture.banque@cpi.sn',
  username: 'fixture.banque',
  fullName: 'Moussa Fixture',
} as const;

/**
 * Exporté : `workspaces.spec.ts` le désigne NOMMÉMENT dans le sélecteur de
 * rattachement du dialogue d'approbation, dont la première entrée est une
 * remise à zéro.
 */
export const REPRESENTANT = { fullName: 'Ibrahima Fixture', phone: '+221781000001' } as const;

/**
 * Trente prospects : le tirage en retire, et plusieurs parcours tirent à la
 * suite. Une réserve trop courte ferait échouer le troisième pour une raison
 * qui n'a rien à voir avec ce qu'il éprouve.
 */
const PROSPECT_COUNT = 30;

/** La fiche que le parcours bancaire ouvre en dossier: la première de la plage. */
export const BANK_CLIENT_PHONE = '+221781001000';

/**
 * Exige la présence, et NOMME ce qui manque.
 *
 * `expect(x).toBeDefined()` ne restreint pas le type pour TypeScript : la
 * ligne suivante lit `x.id` sur un `T | undefined` et ne compile pas. Cette
 * fonction fait les deux à la fois.
 */
function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} — la base est-elle amorcée ?`);
  return value;
}

export async function adminApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: WEB_URL, storageState: ADMIN_STORAGE_STATE });
}

/**
 * Lit une réponse en exigeant qu'elle ait abouti, et NOMME l'échec.
 *
 * Sans ce message, un 403 sur un référentiel se manifeste vingt lignes plus
 * loin par un `undefined` dans une liste, et le parcours accuse l'écran.
 */
async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

async function ensureUser(
  api: APIRequestContext,
  account: { email: string; username: string; fullName: string },
  role: 'COMMERCIAL' | 'BANQUE_FINANCE',
): Promise<string> {
  const existing = await json<{ items: { id: string; email: string }[] }>(
    await api.get('/api/v1/users', { params: { search: account.email, pageSize: '50' } }),
  );
  const found = existing.items.find((user) => user.email === account.email);
  if (found !== undefined) return found.id;

  const created = await api.post('/api/v1/users', {
    data: { ...account, password: FIXTURE_PASSWORD, role },
  });
  // 409 : une exécution concurrente a gagné la course. La fiche existe, c'est
  // tout ce qui compte ici.
  if (created.status() === 409) {
    const again = await json<{ items: { id: string; email: string }[] }>(
      await api.get('/api/v1/users', { params: { search: account.email, pageSize: '50' } }),
    );
    return required(
      again.items.find((user) => user.email === account.email),
      `Compte ${account.email} introuvable après un 409`,
    ).id;
  }
  const body = await json<{ id: string }>(created);
  return body.id;
}

async function ensureRepresentant(api: APIRequestContext, departementId: string): Promise<string> {
  const existing = await json<{ items: { id: string; phoneE164: string }[] }>(
    await api.get('/api/v1/representants', {
      params: { search: REPRESENTANT.phone, pageSize: '50' },
    }),
  );
  const found = existing.items.find((row) => row.phoneE164 === REPRESENTANT.phone);
  if (found !== undefined) return found.id;

  const created = await api.post('/api/v1/representants', {
    data: { fullName: REPRESENTANT.fullName, phone: REPRESENTANT.phone, departementId },
  });
  if (created.status() === 409) {
    const again = await json<{ items: { id: string; phoneE164: string }[] }>(
      await api.get('/api/v1/representants', {
        params: { search: REPRESENTANT.phone, pageSize: '50' },
      }),
    );
    return required(
      again.items.find((row) => row.phoneE164 === REPRESENTANT.phone),
      'Représentant introuvable après un 409',
    ).id;
  }
  const body = await json<{ id: string }>(created);
  return body.id;
}

/**
 * Rend à la plage ses PROSPECT_COUNT fiches EN ATTENTE.
 *
 * Compter les fiches ne suffit pas : chaque exécution en clôt quelques-unes, et
 * une fiche close ne se rappelle plus. La suite ne passait donc qu'un nombre
 * limité de fois avant de manquer de matière, et l'échec accusait le tirage.
 * Une fiche close de la plage est retirée puis recréée — la suppression est
 * douce et l'index d'unicité du téléphone est PARTIEL, donc le numéro se libère.
 *
 * Le compte est fait sur le SEGMENT, pas sur le total : une base qui contient
 * déjà des prospects BDD3 n'en fournit aucun au tirage BDD1.
 */
async function ensureProspects(
  api: APIRequestContext,
  ids: { banqueId: string; syndicatId: string; representantId: string },
): Promise<void> {
  for (let index = 0; index < PROSPECT_COUNT; index += 1) {
    const phone = `+22178100${String(1000 + index)}`;
    if (phone === BANK_CLIENT_PHONE) continue;
    const found = await json<{ items: { id: string; phoneE164: string; phase2Status: string }[] }>(
      await api.get('/api/v1/prospects', { params: { search: phone, pageSize: '5' } }),
    );
    for (const row of found.items) {
      if (row.phoneE164 === phone && row.phase2Status !== 'PENDING') {
        await api.delete(`/api/v1/prospects/${row.id}`);
      }
    }
  }

  // `{ items, meta: { total } }` : le total vit sous `meta`, pas à la racine.
  // Le lire au mauvais endroit rendait `undefined`, la boucle ne partait pas,
  // et l'amorçage se terminait sans avoir rien créé — en silence.
  const existing = await json<{ meta: { total: number } }>(
    await api.get('/api/v1/prospects', {
      params: { segment: 'BDD1', phase2Status: 'PENDING', pageSize: '1' },
    }),
  );
  if (existing.meta.total >= PROSPECT_COUNT - 1) return;

  // On repart de zéro et on laisse les 409 absorber ce qui existe déjà : compter
  // à partir du total supposerait que les fiches présentes portent justement les
  // numéros du début de la plage, ce que rien ne garantit après un tirage.
  for (let index = 0; index < PROSPECT_COUNT; index += 1) {
    // +221 78 100 1xxx : hors de la plage du jeu de démonstration.
    const phone = `+22178100${String(1000 + index)}`;
    const created = await api.post('/api/v1/prospects', {
      data: {
        nom: `Fixture${String(index).padStart(3, '0')}`,
        prenom: 'Parcours',
        phone,
        ...ids,
      },
    });
    // 409 : le numéro existe déjà, donc la population est là. On continue.
    if (created.status() === 409) continue;
    await json<{ id: string }>(created);
  }
}

/**
 * Pose tout ce dont `workspaces.spec.ts` a besoin, et rend les identifiants
 * aux parcours qui veulent viser une ligne précise.
 */
export async function ensureWorkspaceFixtures(): Promise<{
  teleconseillerIds: string[];
  banquierId: string;
  representantId: string;
}> {
  const api = await adminApi();
  try {
    const banques = await json<{ id: string; shortName: string }[]>(
      await api.get('/api/v1/referentiels/banques', { params: { activeOnly: 'false' } }),
    );
    const syndicats = await json<{ id: string; sigle: string }[]>(
      await api.get('/api/v1/referentiels/syndicats', { params: { activeOnly: 'false' } }),
    );
    const departements = await json<{ id: string }[]>(
      await api.get('/api/v1/referentiels/departements', { params: { activeOnly: 'false' } }),
    );

    const banque = required(
      banques.find((row) => row.shortName === BANQUE_SHORT_NAME),
      `Banque ${BANQUE_SHORT_NAME} absente du référentiel`,
    );
    const syndicat = required(
      syndicats.find((row) => row.sigle === SYNDICAT_SIGLE),
      `Syndicat ${SYNDICAT_SIGLE} absent du référentiel`,
    );
    const departement = required(departements[0], 'Aucun département dans le référentiel');

    const teleconseillerIds: string[] = [];
    for (const account of TELECONSEILLERS) {
      teleconseillerIds.push(await ensureUser(api, account, 'COMMERCIAL'));
    }
    const banquierId = await ensureUser(api, BANQUIER, 'BANQUE_FINANCE');
    const representantId = await ensureRepresentant(api, departement.id);

    await ensureProspects(api, {
      banqueId: banque.id,
      syndicatId: syndicat.id,
      representantId,
    });
    await ensureBankEligibleClient(api);

    return { teleconseillerIds, banquierId, representantId };
  } finally {
    await api.dispose();
  }
}

/**
 * Un client réellement ouvrable en dossier bancaire.
 *
 * Le formulaire d'ouverture ne cherche QUE des fiches en « méthode obtenue », et
 * aucune fixture n'en produisait : le parcours d'encaissement ne tenait que sur
 * les restes d'une exécution précédente ou sur le jeu de démonstration.
 *
 * Le seul chemin qui pose ce statut est une tentative d'appel : une contrainte
 * lie le statut à la méthode d'enrôlement, et `PATCH /prospects` ne l'accepte
 * pas. On emprunte donc le même canal que la console.
 */
async function ensureBankEligibleClient(api: APIRequestContext): Promise<void> {
  const found = await json<{ items: { id: string; phase2Status: string }[] }>(
    await api.get('/api/v1/prospects', {
      params: { search: BANK_CLIENT_PHONE, pageSize: '5' },
    }),
  );
  const cible = found.items[0];
  if (cible === undefined) return;
  if (cible.phase2Status === 'METHOD_OBTAINED') return;

  const at = new Date().toISOString();
  const attemptId = crypto.randomUUID();
  await api.post('/api/v1/sync/push', {
    headers: { 'Idempotency-Key': attemptId },
    data: {
      clientBatchId: attemptId,
      payloadVersion: 1,
      operations: [
        {
          opId: attemptId,
          seq: 0,
          entity: 'call_attempt',
          op: 'create',
          entityId: attemptId,
          clientUpdatedAt: at,
          data: {
            prospectId: cible.id,
            outcome: 'METHOD_OBTAINED',
            method: 'PLATFORM',
            clientCreatedAt: at,
          },
        },
      ],
    },
  });
}
