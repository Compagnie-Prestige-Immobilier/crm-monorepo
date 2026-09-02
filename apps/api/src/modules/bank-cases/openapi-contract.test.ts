import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

interface Schema {
  type?: string;
  format?: string;
  nullable?: boolean;
  $ref?: string;
  items?: Schema;
  properties?: Record<string, Schema>;
  allOf?: Schema[];
}

interface Operation {
  operationId?: string;
  tags?: string[];
  responses?: Record<string, { content?: Record<string, { schema?: Schema }> }>;
}

interface Document {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
}

const document = JSON.parse(
  readFileSync(new URL('../../../openapi.json', import.meta.url), 'utf8'),
) as Document;

const ROUTES: [string, string, string][] = [
  ['get', '/api/v1/bank-cases', 'listBankCases'],
  ['post', '/api/v1/bank-cases', 'createBankCase'],
  ['get', '/api/v1/bank-cases/analytics', 'getBankCaseAnalytics'],
  ['get', '/api/v1/bank-cases/prospect-search', 'searchBankCaseProspects'],
  ['get', '/api/v1/bank-cases/rejection-reasons', 'listBankRejectionReasons'],
  ['get', '/api/v1/bank-cases/{id}', 'getBankCase'],
  ['patch', '/api/v1/bank-cases/{id}', 'updateBankCase'],
  ['post', '/api/v1/bank-cases/{id}/transitions', 'createBankCaseTransition'],
  ['post', '/api/v1/bank-cases/{id}/corrections', 'createBankCaseCorrection'],
  ['get', '/api/v1/bank-case-stages', 'listBankCaseStages'],
  ['post', '/api/v1/bank-case-stages', 'createBankCaseStage'],
  ['post', '/api/v1/bank-case-stages/reorder', 'reorderBankCaseStages'],
  ['patch', '/api/v1/bank-case-stages/{id}', 'updateBankCaseStage'],
  ['post', '/api/v1/bank-case-stages/{id}/active', 'setBankCaseStageActive'],
  ['get', '/api/v1/export/bank-cases.xlsx', 'exportBankCasesXlsx'],
];

const BANK_SCHEMAS = Object.entries(document.components.schemas).filter(([name]) =>
  /^Bank|^CreateBank|^UpdateBank|^ReorderBank|^SetBank|^ProspectSearch/.test(name),
);

const EXPLICITE = /^[a-z][A-Za-z0-9]+$/;

const OPERATIONS: { method: string; path: string; operation: Operation }[] = Object.entries(
  document.paths,
).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, operation]) => ({ method, path, operation })),
);

describe('routes publiées', () => {
  it.each(ROUTES)('%s %s → %s', (method, path, operationId) => {
    const operation = document.paths[path]?.[method];
    expect(operation, `${method.toUpperCase()} ${path} absent du contrat`).toBeDefined();
    expect(operation?.operationId).toBe(operationId);
  });

  it('toute route du module porte un operationId explicite', () => {
    for (const [method, path] of ROUTES) {
      const operation = document.paths[path]?.[method];
      const identifiant = operation?.operationId;
      expect(identifiant, `${method.toUpperCase()} ${path} sans operationId`).toBeDefined();
      expect(identifiant, `${method.toUpperCase()} ${path} : operationId engendré`).toMatch(
        EXPLICITE,
      );
      expect(path.startsWith('/api/v1/')).toBe(true);
    }
  });

  it('les chemins littéraux n’ont pas été avalés par :id', () => {
    for (const litteral of [
      '/api/v1/bank-cases/analytics',
      '/api/v1/bank-cases/prospect-search',
      '/api/v1/bank-cases/rejection-reasons',
      '/api/v1/bank-case-stages/reorder',
    ]) {
      expect(Object.keys(document.paths)).toContain(litteral);
    }
  });

  it('l’export xlsx est déclaré en binaire, pas en JSON', () => {
    const response = document.paths['/api/v1/export/bank-cases.xlsx']?.get?.responses?.['200'];
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    expect(Object.keys(response?.content ?? {})).toEqual([mime]);
    expect(response?.content?.[mime]?.schema).toEqual({ type: 'string', format: 'binary' });
  });
});

const MODULES: Record<string, string[]> = {
  'client-requests': [
    'createClientRequest',
    'listClientRequests',
    'getClientRequest',
    'approveClientRequest',
    'rejectClientRequest',
  ],
  'rep-campaigns': ['recordRepCallAttempt'],
  representants: [
    'listRepresentants',
    'createRepresentant',
    'lookupRepresentantByPhone',
    'importRepresentants',
    'getRepresentant',
    'updateRepresentant',
    'listRepresentantRelationChanges',
    'listRepresentantComments',
    'addRepresentantComment',
    'deleteRepresentantComment',
    'deleteRepresentant',
  ],
  export: [
    'exportBankCasesXlsx',
    'exportProspectsXlsx',
    'downloadProspectsTemplateXlsx',
    'downloadProspectsGrandPublicTemplateXlsx',
    'downloadRepresentantsTemplateXlsx',
    'exportRepresentantsXlsx',
    'exportVisitesXlsx',
  ],
};

const taggedWith = (tag: string): { method: string; path: string; operation: Operation }[] =>
  OPERATIONS.filter((entry) => (entry.operation.tags ?? []).includes(tag));

describe('operationId sur tout le document publié', () => {
  it('aucune opération publiée ne porte un operationId engendré par Nest', () => {
    const engendres = OPERATIONS.filter(
      ({ operation }) =>
        operation.operationId === undefined || !EXPLICITE.test(operation.operationId),
    ).map(
      ({ method, path, operation }) =>
        `${method.toUpperCase()} ${path} → ${String(operation.operationId)}`,
    );

    expect(
      engendres,
      'Ajoutez @ApiOperation({ operationId }) sur ces routes : sans lui, le nom ' +
        'de méthode du client engendré suit le nom de la CLASSE et change au ' +
        'premier renommage.',
    ).toEqual([]);

    expect(OPERATIONS.length).toBeGreaterThanOrEqual(100);
  });

  it('les operationId sont uniques dans tout le document', () => {
    const vus = new Map<string, string[]>();
    for (const { method, path, operation } of OPERATIONS) {
      const id = operation.operationId ?? '(absent)';
      vus.set(id, [...(vus.get(id) ?? []), `${method.toUpperCase()} ${path}`]);
    }
    const doublons = [...vus.entries()].filter(([, routes]) => routes.length > 1);
    expect(doublons).toEqual([]);
  });

  it('toute route publiée est versionnée sous /api/v1/', () => {
    const hors = OPERATIONS.map(({ path }) => path).filter((path) => !path.startsWith('/api/v1/'));
    expect(hors).toEqual([]);
  });

  it.each(Object.entries(MODULES))('le module %s publie exactement ses routes', (tag, attendus) => {
    const trouves = taggedWith(tag).map(({ operation }) => operation.operationId ?? '(absent)');
    expect(trouves.sort()).toEqual([...attendus].sort());
  });

  it('le module analytics conserve ses agrégats de pilotage', () => {
    const trouves = taggedWith('analytics').map(({ operation }) => operation.operationId);
    for (const attendu of [
      'getAnalyticsFunnel',
      'getAnalyticsTotals',
      'getAnalyticsDelays',
      'getBankAging',
      'getWeeklyCohorts',
      'getDepartementYield',
      'getRepresentantProductivity',
      'getDataQuality',
      'getOriginBreakdown',
    ]) {
      expect(trouves, `${attendu} a disparu du contrat`).toContain(attendu);
    }
  });

  it('l’import de représentants est déclaré en multipart', () => {
    const corps = (
      document.paths['/api/v1/representants/import']?.post as unknown as
        { requestBody?: { content?: Record<string, unknown> } } | undefined
    )?.requestBody;
    expect(Object.keys(corps?.content ?? {})).toEqual(['multipart/form-data']);
  });
});

describe('discipline des schémas', () => {
  it('toute propriété tableau porte un `items` typé', () => {
    for (const [name, schema] of BANK_SCHEMAS) {
      for (const [property, definition] of Object.entries(schema.properties ?? {})) {
        if (definition.type !== 'array') continue;
        const items = definition.items;
        expect(items, `${name}.${property} : tableau sans items`).toBeDefined();
        expect(
          items?.$ref !== undefined || items?.type !== undefined,
          `${name}.${property} : items sans type ni $ref`,
        ).toBe(true);
      }
    }
  });

  it('tout montant est une CHAÎNE, jamais un nombre', () => {
    const monetaires = new Set(['amountXof', 'amountMin', 'amountMax', 'totalAmountCashed']);
    let vus = 0;

    for (const [name, schema] of BANK_SCHEMAS) {
      for (const [property, definition] of Object.entries(schema.properties ?? {})) {
        if (!monetaires.has(property)) continue;
        vus += 1;
        expect(definition.type, `${name}.${property} devrait être une chaîne`).toBe('string');
      }
    }
    expect(vus).toBeGreaterThanOrEqual(6);
  });

  it('tout identifiant est déclaré en uuid', () => {
    for (const [name, schema] of BANK_SCHEMAS) {
      for (const [property, definition] of Object.entries(schema.properties ?? {})) {
        if (!/^(id|.*Id)$/.test(property)) continue;
        if (definition.type === 'array') continue;
        expect(definition.format, `${name}.${property} sans format uuid`).toBe('uuid');
      }
    }
  });

  it('les champs qui valent null sont déclarés nullable et restent obligatoires', () => {
    const dossier = document.components.schemas.BankCaseDto;
    for (const property of ['amountXof', 'rejectionDetail', 'updatedById', 'updatedByName']) {
      expect(dossier?.properties?.[property]?.nullable, `${property} devrait être nullable`).toBe(
        true,
      );
    }
    const requis = (dossier as unknown as { required?: string[] }).required ?? [];
    expect(requis).toContain('amountXof');
    expect(requis).toContain('rejectionDetail');
  });

  it('les énumérations sont nommées, donc engendrées en types Dart et non en chaînes libres', () => {
    for (const nom of ['BankStageType', 'BankCaseSortField', 'TimeGranularity']) {
      expect(Object.keys(document.components.schemas)).toContain(nom);
    }
  });
});
