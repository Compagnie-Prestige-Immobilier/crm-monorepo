import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Le contrat publié, relu tel qu'il est écrit sur le disque.
 *
 * Des clients TypeScript et Dart sont engendrés à partir de ce document. Trois
 * fautes y sont invisibles à la relecture et destructrices en aval :
 *
 *  - une propriété tableau sans `items` typé devient `List<dynamic>` en Dart, et
 *    toute la sécurité de type du mobile disparaît en silence ;
 *  - un montant déclaré `number` perd de la précision au-delà de 2^53 dès la
 *    désérialisation, sans la moindre erreur ;
 *  - un `operationId` manquant fait engendrer un nom de méthode dérivé du
 *    chemin, qui change au premier renommage de route.
 *
 * Ce test lit le fichier RÉELLEMENT publié plutôt que les décorateurs : c'est ce
 * fichier que consomment les générateurs, et lui seul.
 */

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

/** Les routes du module, telles qu'elles doivent apparaître dans le contrat. */
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

/** Schémas du module Banque & Finance. */
const BANK_SCHEMAS = Object.entries(document.components.schemas).filter(([name]) =>
  /^Bank|^CreateBank|^UpdateBank|^ReorderBank|^SetBank|^ProspectSearch/.test(name),
);

/**
 * Forme d'un `operationId` ÉCRIT À LA MAIN.
 *
 * Faute de `@ApiOperation({ operationId })`, Nest en fabrique un à partir du
 * contrôleur et de la méthode : `BankCasesController_list`. Le document reste
 * donc valide, les générateurs produisent du code, et rien ne se voit, jusqu'au
 * jour où quelqu'un renomme la classe et où toutes les méthodes du client
 * changent de nom d'un coup. C'est précisément cette forme engendrée que le
 * motif ci-dessous refuse : minuscule initiale, aucun tiret bas.
 */
const EXPLICITE = /^[a-z][A-Za-z0-9]+$/;

/** Toutes les opérations du document, aplaties. */
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

  /**
   * L'ORDRE des chemins littéraux et paramétrés se joue dans le contrôleur ; ce
   * qui se vérifie ici, c'est qu'ils ont bien tous SURVÉCU. Si `:id` avait avalé
   * `analytics`, ce chemin manquerait purement et simplement du document.
   */
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

/**
 * Les modules ARRIVÉS APRÈS ce test, tenus au même contrat.
 *
 * Chaque entrée fige l'INVENTAIRE COMPLET des opérations d'une étiquette : une
 * route supprimée, ajoutée sans être déclarée ici, ou dont l'`operationId`
 * change, met la ligne au rouge. Un simple compte n'y suffirait pas, deux
 * routes échangées le laisseraient intact.
 */
const MODULES: Record<string, string[]> = {
  'client-requests': [
    'createClientRequest',
    'listClientRequests',
    'getClientRequest',
    'approveClientRequest',
    'rejectClientRequest',
  ],
  'rep-campaigns': [
    'previewRepCampaign',
    'recordRepCallAttempt',
    'listRepCampaigns',
    'createRepCampaign',
    'getRepCampaign',
    'closeRepCampaign',
    'downloadRepProgrammePdf',
  ],
  representants: [
    'listRepresentants',
    'createRepresentant',
    'lookupRepresentantByPhone',
    'importRepresentants',
    'getRepresentant',
    'updateRepresentant',
    'deleteRepresentant',
  ],
  export: [
    'exportBankCasesXlsx',
    'exportProspectsXlsx',
    'downloadRepresentantsTemplateXlsx',
    'exportRepresentantsXlsx',
  ],
};

/** Opérations du document portant l'étiquette donnée. */
const taggedWith = (tag: string): { method: string; path: string; operation: Operation }[] =>
  OPERATIONS.filter((entry) => (entry.operation.tags ?? []).includes(tag));

describe('operationId sur tout le document publié', () => {
  /**
   * Le contrôle porte sur le DOCUMENT, pas sur une liste locale. Une version
   * antérieure de ce test bouclait sur la table `ROUTES` déclarée juste
   * au-dessus et vérifiait que ses propres chaînes ressemblaient à des
   * identifiants : elle ne pouvait pas échouer, quoi qu'il arrive au serveur.
   */
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

    // Sans ce garde, un document vide ou un changement de forme du JSON ferait
    // passer la boucle à vide, donc au vert.
    expect(OPERATIONS.length).toBeGreaterThanOrEqual(100);
  });

  it('les operationId sont uniques dans tout le document', () => {
    const vus = new Map<string, string[]>();
    for (const { method, path, operation } of OPERATIONS) {
      const id = operation.operationId ?? '(absent)';
      vus.set(id, [...(vus.get(id) ?? []), `${method.toUpperCase()} ${path}`]);
    }
    const doublons = [...vus.entries()].filter(([, routes]) => routes.length > 1);
    // Deux opérations de même identifiant font engendrer deux méthodes de même
    // nom : le client Dart ne compile plus, ou pire, l'une écrase l'autre.
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

  /**
   * `analytics` est le seul module dont l'inventaire bouge encore à chaque lot ;
   * on y fige ce qui ne doit PAS disparaître plutôt que la liste entière.
   */
  it('le module analytics conserve ses agrégats de pilotage', () => {
    const trouves = taggedWith('analytics').map(({ operation }) => operation.operationId);
    for (const attendu of [
      'getAnalyticsFunnel',
      'getAnalyticsTotals',
      'getCampaignPilotage',
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

  /**
   * L'import de représentants est un `multipart/form-data`. Déclaré en JSON, le
   * client engendré poste un corps que Fastify rejette avec un 406 illisible.
   */
  it('l’import de représentants est déclaré en multipart', () => {
    const corps = (
      document.paths['/api/v1/representants/import']?.post as unknown as
        { requestBody?: { content?: Record<string, unknown> } } | undefined
    )?.requestBody;
    expect(Object.keys(corps?.content ?? {})).toEqual(['multipart/form-data']);
  });
});

describe('discipline des schémas', () => {
  /**
   * Sans `items`, le générateur Dart produit `List<dynamic>` : le code compile,
   * l'application tourne, et le premier champ mal lu ne se manifeste qu'à
   * l'exécution chez l'utilisateur.
   */
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

  /** XOF est un Decimal(18,0) : un nombre JSON le corromprait au-delà de 2^53. */
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
    // Garde-fou : si le filtre de schémas cessait de correspondre, la boucle
    // ci-dessus passerait à vide et ne prouverait plus rien.
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

  /**
   * `nullable: true` et « optionnel » sont deux choses différentes : un champ
   * absent n'a pas de valeur, un champ nul en a une qui vaut « rien ». Les
   * confondre fait engendrer en Dart un type non-nullable là où le serveur
   * envoie `null`, et l'application se termine sur une exception de
   * désérialisation.
   */
  it('les champs qui valent null sont déclarés nullable et restent obligatoires', () => {
    const dossier = document.components.schemas.BankCaseDto;
    for (const property of ['amountXof', 'rejectionDetail', 'updatedById', 'updatedByName']) {
      expect(dossier?.properties?.[property]?.nullable, `${property} devrait être nullable`).toBe(
        true,
      );
    }
    // Nullable ne veut pas dire absent : le serveur envoie toujours la clé.
    const requis = (dossier as unknown as { required?: string[] }).required ?? [];
    expect(requis).toContain('amountXof');
    expect(requis).toContain('rejectionDetail');
  });

  it('les énumérations sont nommées, donc engendrées en types Dart et non en chaînes libres', () => {
    // `TimeGranularity` est le pas de temps COMMUN : le module ne publie plus
    // de doublon `BankTimeGranularity` de mêmes valeurs.
    for (const nom of ['BankStageType', 'BankCaseSortField', 'TimeGranularity']) {
      expect(Object.keys(document.components.schemas)).toContain(nom);
    }
  });
});
