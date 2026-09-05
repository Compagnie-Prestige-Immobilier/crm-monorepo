import { Projet } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { EnrolementService, type ConfigEnrolement } from './enrolement.service.js';

interface LigneStockee {
  id: string;
  projet: Projet;
  identifiantDistant: string;
  nom: string;
  prenom: string;
  phoneE164: string | null;
  email: string | null;
  statutDistant: string;
  etapeDistante: number | null;
  inscriteLe: Date | null;
  soumiseLe: Date | null;
  decideeLe: Date | null;
  disparueLe: Date | null;
  prospectId: string | null;
  chargeUtile: unknown;
  dernierTirageAt: Date;
}

interface ProspectStocke {
  id: string;
  projet: Projet;
  phoneE164: string;
  whatsappE164: string | null;
  clientCreatedAt: Date;
  deletedAt: Date | null;
}

/** Le strict nécessaire au tirage : réglages, inscriptions, prospects. */
class FakePrisma {
  readonly inscriptions: LigneStockee[] = [];
  readonly reglages = new Map<string, { key: string; value: string; updatedAt: Date }>();
  prospects: ProspectStocke[] = [];

  readonly appSetting = {
    findUnique: ({ where }: { where: { key: string } }) =>
      Promise.resolve(this.reglages.get(where.key) ?? null),
    upsert: ({
      where,
      create,
      update,
    }: {
      where: { key: string };
      create: { value: string };
      update: { value: string };
    }) => {
      const existant = this.reglages.get(where.key);
      const ligne = {
        key: where.key,
        value: existant === undefined ? create.value : update.value,
        updatedAt: new Date(),
      };
      this.reglages.set(where.key, ligne);
      return Promise.resolve(ligne);
    },
  };

  readonly inscriptionPlateforme = {
    findMany: ({ where }: { where: { projet: Projet } }) =>
      Promise.resolve(this.inscriptions.filter((ligne) => ligne.projet === where.projet)),
    upsert: ({
      where,
      create,
      update,
    }: {
      where: { projet_identifiantDistant: { projet: Projet; identifiantDistant: string } };
      create: Omit<LigneStockee, 'id'>;
      update: Partial<LigneStockee>;
    }) => {
      const cle = where.projet_identifiantDistant;
      const index = this.inscriptions.findIndex(
        (ligne) =>
          ligne.projet === cle.projet && ligne.identifiantDistant === cle.identifiantDistant,
      );
      if (index === -1) {
        const ligne = { id: `ins-${String(this.inscriptions.length + 1)}`, ...create };
        this.inscriptions.push(ligne);
        return Promise.resolve(ligne);
      }
      const fusion = { ...this.inscriptions[index], ...update } as LigneStockee;
      this.inscriptions[index] = fusion;
      return Promise.resolve(fusion);
    },
    updateMany: ({
      where,
      data,
    }: {
      where: { projet: Projet; disparueLe: null; identifiantDistant: { notIn: string[] } };
      data: { disparueLe: Date };
    }) => {
      const absents = new Set(where.identifiantDistant.notIn);
      let count = 0;
      for (const ligne of this.inscriptions) {
        if (ligne.projet !== where.projet) continue;
        if (ligne.disparueLe !== null) continue;
        if (absents.has(ligne.identifiantDistant)) continue;
        ligne.disparueLe = data.disparueLe;
        count += 1;
      }
      return Promise.resolve({ count });
    },
  };

  readonly prospect = {
    findMany: ({
      where,
    }: {
      where: {
        projet: Projet;
        OR: { phoneE164?: { in: string[] }; whatsappE164?: { in: string[] } }[];
      };
    }) => {
      const numeros = new Set(
        where.OR.flatMap((clause) => clause.phoneE164?.in ?? clause.whatsappE164?.in ?? []),
      );
      return Promise.resolve(
        this.prospects.filter(
          (prospect) =>
            prospect.projet === where.projet &&
            prospect.deletedAt === null &&
            (numeros.has(prospect.phoneE164) ||
              (prospect.whatsappE164 !== null && numeros.has(prospect.whatsappE164))),
        ),
      );
    },
  };

  /** Le rapprochement par e-mail passe par `call_attempts` : aucune ici. */
  $queryRaw = (): Promise<unknown[]> => Promise.resolve([]);
}

const CLIENTS_CHUES = [
  {
    id: 'c-1',
    email: 'awa@example.com',
    firstName: 'Awa',
    lastName: 'Sy',
    phone: '+221771000001',
    createdAt: 1_770_000_000,
    approved: true,
    chuesMember: true,
    dossier: { id: 'd-1', status: 'submitted', submittedAt: 1_770_100_000 },
    agent: null,
  },
  {
    id: 'c-2',
    email: 'moussa@example.com',
    firstName: 'Moussa',
    lastName: 'Diop',
    phone: '+221772000002',
    createdAt: 1_770_200_000,
    approved: false,
    chuesMember: false,
    dossier: null,
    agent: null,
  },
];

const ADHESIONS_CHUES = {
  requests: [
    {
      id: 'a-1',
      firstName: 'Awa',
      lastName: 'Sy',
      email: 'awa@example.com',
      phone: '+221771000001',
      profession: 'Enseignante',
      isTeacher: true,
      status: 'released',
      createdAt: 1_770_000_000,
      decidedAt: 1_770_300_000,
      decidedBy: 'staff',
      note: null,
    },
  ],
  counts: { pending: 0, released: 1, rejected: 0 },
};

const json = (corps: unknown, status = 200): Response =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const cheminDe = (input: RequestInfo | URL): string =>
  new URL(input instanceof Request ? input.url : String(input)).pathname;

const rechercheDe = (input: RequestInfo | URL): string =>
  new URL(input instanceof Request ? input.url : String(input)).search;

function configAvec(
  fetchChues: typeof globalThis.fetch,
  fetchGrandPublic: typeof globalThis.fetch = fetchChues,
): ConfigEnrolement {
  return {
    [Projet.CHUES]: {
      url: 'https://chues.test/api',
      token: 'jeton-chues',
      fetch: fetchChues,
      pauseMs: 0,
    },
    [Projet.GRAND_PUBLIC]: {
      url: 'https://gp.test/api',
      token: 'jeton-gp',
      fetch: fetchGrandPublic,
      pauseMs: 0,
    },
  };
}

const fetchChuesNominal: typeof globalThis.fetch = (input) => {
  const chemin = cheminDe(input);
  if (chemin.endsWith('/clients')) return Promise.resolve(json({ clients: CLIENTS_CHUES }));
  if (chemin.endsWith('/chues/adhesions')) return Promise.resolve(json(ADHESIONS_CHUES));
  return Promise.resolve(json({}, 404));
};

const fetchChuesAvec =
  (clients: readonly unknown[]): typeof globalThis.fetch =>
  (input) => {
    const chemin = cheminDe(input);
    if (chemin.endsWith('/clients')) return Promise.resolve(json({ clients }));
    if (chemin.endsWith('/chues/adhesions')) return Promise.resolve(json(ADHESIONS_CHUES));
    return Promise.resolve(json({}, 404));
  };

describe('tirage d’une plateforme d’enrôlement', () => {
  let prisma: FakePrisma;
  let service: EnrolementService;

  beforeEach(() => {
    prisma = new FakePrisma();
    service = new EnrolementService(
      prisma as unknown as PrismaService,
      configAvec(fetchChuesNominal),
    );
  });

  it('DÉPOSE puis MET À JOUR : deux tirages ne font pas quatre lignes', async () => {
    const premier = await service.tirer(Projet.CHUES);

    expect(premier.erreur).toBeNull();
    expect({ lus: premier.lus, crees: premier.crees, misAJour: premier.misAJour }).toEqual({
      lus: 2,
      crees: 2,
      misAJour: 0,
    });
    expect(prisma.inscriptions).toHaveLength(2);

    const second = await service.tirer(Projet.CHUES);

    expect({ lus: second.lus, crees: second.crees, misAJour: second.misAJour }).toEqual({
      lus: 2,
      crees: 0,
      misAJour: 2,
    });
    expect(prisma.inscriptions).toHaveLength(2);
    expect(prisma.inscriptions.map((ligne) => ligne.identifiantDistant).sort()).toEqual([
      'c-1',
      'c-2',
    ]);
  });

  it('lit le statut, l’étape et les trois dates de la plateforme CHUES', async () => {
    await service.tirer(Projet.CHUES);

    const awa = prisma.inscriptions.find((ligne) => ligne.identifiantDistant === 'c-1');
    expect(awa?.statutDistant).toBe('submitted');
    expect(awa?.nom).toBe('Sy');
    expect(awa?.prenom).toBe('Awa');
    expect(awa?.inscriteLe?.toISOString()).toBe(new Date(1_770_000_000_000).toISOString());
    expect(awa?.soumiseLe?.toISOString()).toBe(new Date(1_770_100_000_000).toISOString());
    // La décision ne vit que sur la demande d'adhésion, reliée par l'e-mail.
    expect(awa?.decideeLe?.toISOString()).toBe(new Date(1_770_300_000_000).toISOString());

    const moussa = prisma.inscriptions.find((ligne) => ligne.identifiantDistant === 'c-2');
    expect(moussa?.statutDistant).toBe('compte-en-attente');
    expect(moussa?.decideeLe).toBeNull();
  });

  it('RAPPROCHE le prospect du même projet et LAISSE l’autre sans lien', async () => {
    prisma.prospects = [
      {
        id: 'prospect-chues',
        projet: Projet.CHUES,
        phoneE164: '+221771000001',
        whatsappE164: null,
        clientCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
      },
      {
        id: 'prospect-grand-public',
        projet: Projet.GRAND_PUBLIC,
        phoneE164: '+221772000002',
        whatsappE164: null,
        clientCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
      },
    ];

    const tirage = await service.tirer(Projet.CHUES);

    expect(tirage.rapproches).toBe(1);
    expect(
      prisma.inscriptions.find((ligne) => ligne.identifiantDistant === 'c-1')?.prospectId,
    ).toBe('prospect-chues');
    // Le prospect Grand Public porte le numéro de `c-2` : la frontière tient.
    expect(
      prisma.inscriptions.find((ligne) => ligne.identifiantDistant === 'c-2')?.prospectId,
    ).toBeNull();
  });

  it('REMONTE un jeton révoqué au lieu de consigner un tirage vide et silencieux', async () => {
    service = new EnrolementService(
      prisma as unknown as PrismaService,
      configAvec(() => Promise.resolve(json({ message: 'Unauthenticated.' }, 401))),
    );

    const tirage = await service.tirer(Projet.CHUES);

    expect(tirage.erreur).toContain('401');
    expect(prisma.inscriptions).toHaveLength(0);

    const reglages = await service.reglages(Projet.CHUES);
    expect(reglages.dernierTirage?.erreur).toContain('401');
  });

  it('PAGINE le Grand Public et s’arrête sur la dernière page', async () => {
    const pagesVues: string[] = [];
    const fetchGrandPublic: typeof globalThis.fetch = (input) => {
      pagesVues.push(rechercheDe(input));
      const page = Number(new URLSearchParams(rechercheDe(input)).get('page') ?? '1');
      return Promise.resolve(
        json({
          data: [
            {
              // Camel case : `spatie/laravel-data` sérialise ainsi, quel que
              // soit le nom de la colonne. Relevé sur la réponse réelle.
              id: `gp-${String(page)}`,
              name: 'Fatou Ndiaye',
              email: `fatou${String(page)}@example.com`,
              phone: '+221773000003',
              dossierEtape: 3,
              dateInscription: '2026-02-01 10:00:00',
              statut: 'Dossier en préparation',
              demande: { submittedAt: '2026-02-03 10:00:00' },
            },
          ],
          meta: { last_page: 2 },
        }),
      );
    };

    service = new EnrolementService(
      prisma as unknown as PrismaService,
      configAvec(fetchChuesNominal, fetchGrandPublic),
    );

    const tirage = await service.tirer(Projet.GRAND_PUBLIC);

    expect(tirage.erreur).toBeNull();
    expect(pagesVues).toEqual(['?page=1', '?page=2']);
    expect(tirage.lus).toBe(2);

    const premiere = prisma.inscriptions[0];
    expect(premiere?.prenom).toBe('Fatou');
    expect(premiere?.nom).toBe('Ndiaye');
    // Le statut DÉRIVE de l'étape : `statut` de la plateforme est décoratif.
    expect(premiere?.statutDistant).toBe('etape-3');
    expect(premiere?.etapeDistante).toBe(3);
    // Un horodatage sans fuseau est lu en UTC, pas dans celui de la machine.
    expect(premiere?.inscriteLe?.toISOString()).toBe('2026-02-01T10:00:00.000Z');
    expect(premiere?.soumiseLe?.toISOString()).toBe('2026-02-03T10:00:00.000Z');
  });

  it('NE GARDE QUE les inscriptions postérieures à la date de reprise', async () => {
    await service.majReglages(Projet.CHUES, 'admin-1', {
      repriseDepuis: new Date(1_770_150_000_000).toISOString(),
    });

    const tirage = await service.tirer(Projet.CHUES);

    expect(tirage.lus).toBe(1);
    expect(prisma.inscriptions.map((ligne) => ligne.identifiantDistant)).toEqual(['c-2']);
  });

  it('MARQUE disparue la ligne que la plateforme ne rend plus, sans la supprimer', async () => {
    await service.tirer(Projet.CHUES);

    service = new EnrolementService(
      prisma as unknown as PrismaService,
      configAvec(fetchChuesAvec(CLIENTS_CHUES.slice(0, 1))),
    );
    const second = await service.tirer(Projet.CHUES);

    expect(second.disparues).toBe(1);
    expect(prisma.inscriptions).toHaveLength(2);

    const moussa = prisma.inscriptions.find((ligne) => ligne.identifiantDistant === 'c-2');
    expect(moussa?.disparueLe).toBeInstanceOf(Date);
    // La charge utile et le lien restent lisibles : marquer n'est pas effacer.
    expect(moussa?.chargeUtile).not.toBeUndefined();
    expect(
      prisma.inscriptions.find((ligne) => ligne.identifiantDistant === 'c-1')?.disparueLe,
    ).toBeNull();
  });

  it('LÈVE la marque quand la plateforme rend de nouveau la ligne', async () => {
    await service.tirer(Projet.CHUES);
    service = new EnrolementService(
      prisma as unknown as PrismaService,
      configAvec(fetchChuesAvec(CLIENTS_CHUES.slice(0, 1))),
    );
    await service.tirer(Projet.CHUES);

    service = new EnrolementService(
      prisma as unknown as PrismaService,
      configAvec(fetchChuesNominal),
    );
    const retour = await service.tirer(Projet.CHUES);

    expect(retour.disparues).toBe(0);
    expect(
      prisma.inscriptions.find((ligne) => ligne.identifiantDistant === 'c-2')?.disparueLe,
    ).toBeNull();
  });

  it('NE MARQUE RIEN quand la plateforme ne rend plus rien du tout', async () => {
    await service.tirer(Projet.CHUES);

    service = new EnrolementService(
      prisma as unknown as PrismaService,
      configAvec(fetchChuesAvec([])),
    );
    const vide = await service.tirer(Projet.CHUES);

    // Une plateforme muette est une panne d'en face, pas un effacement.
    expect(vide.erreur).toBeNull();
    expect(vide.disparues).toBe(0);
    expect(prisma.inscriptions.every((ligne) => ligne.disparueLe === null)).toBe(true);
  });

  it('NE MARQUE RIEN quand une date de reprise ne rend qu’une tranche', async () => {
    await service.tirer(Projet.CHUES);
    await service.majReglages(Projet.CHUES, 'admin-1', {
      repriseDepuis: new Date(1_770_150_000_000).toISOString(),
    });

    const tirage = await service.tirer(Projet.CHUES);

    expect(tirage.lus).toBe(1);
    expect(tirage.disparues).toBe(0);
    expect(
      prisma.inscriptions.find((ligne) => ligne.identifiantDistant === 'c-1')?.disparueLe,
    ).toBeNull();
  });

  it('consigne durée, volumes et rapprochements du dernier tirage', async () => {
    await service.tirer(Projet.CHUES);

    const reglages = await service.reglages(Projet.CHUES);
    expect(reglages.dernierTirage).toMatchObject({
      lus: 2,
      crees: 2,
      misAJour: 0,
      rapproches: 0,
      erreur: null,
    });
    expect(reglages.dernierTirage?.dureeMs).toBeGreaterThanOrEqual(0);
    expect(reglages.frequenceMinutes).toBe(15);
  });
});
