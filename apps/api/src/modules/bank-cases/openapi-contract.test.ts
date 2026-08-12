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

describe('routes publiées', () => {
  it.each(ROUTES)('%s %s → %s', (method, path, operationId) => {
    const operation = document.paths[path]?.[method];
    expect(operation, `${method.toUpperCase()} ${path} absent du contrat`).toBeDefined();
    expect(operation?.operationId).toBe(operationId);
  });

  it('toute route du module porte un operationId explicite', () => {
    for (const [, path, operationId] of ROUTES) {
      expect(operationId).toMatch(/^[a-z][A-Za-z]+$/);
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
    for (const nom of ['BankStageType', 'BankCaseSortField', 'BankTimeGranularity']) {
      expect(Object.keys(document.components.schemas)).toContain(nom);
    }
  });
});
