import { Role, segmentAxes, segmentWhere } from '@crm/database';
import type { Prisma } from '@crm/database';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { AnalyticsService } from './analytics.service.js';
import { SEGMENT_EXPR, prospectConditions, segmentCondition } from './analytics.sql.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

const alice: AuthenticatedUser = {
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  role: Role.COMMERCIAL,
};
const admin: AuthenticatedUser = { ...alice, id: 'admin-1', username: 'admin', role: Role.ADMIN };

function rendered(sql: Prisma.Sql): string {
  return sql.strings.reduce(
    (text, chunk, index) =>
      index === 0 ? chunk : `${text}${JSON.stringify(sql.values[index - 1])}${chunk}`,
    '',
  );
}

function makePrisma(rows: unknown[]): {
  service: PrismaService;
  sql: () => string;
  queries: () => string[];
  calls: () => number;
} {
  const seen: string[] = [];
  const prisma = {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
      seen.push(
        strings.reduce((text, chunk, index) => {
          if (index === 0) return chunk;
          const value: unknown = values[index - 1];
          const isSql =
            typeof value === 'object' && value !== null && 'strings' in value && 'values' in value;
          return `${text}${isSql ? rendered(value as Prisma.Sql) : JSON.stringify(value)}${chunk}`;
        }, ''),
      );
      return Promise.resolve(rows);
    },
  };
  return {
    service: prisma as unknown as PrismaService,
    sql: () => seen.join('\n'),
    queries: () => [...seen],
    calls: () => seen.length,
  };
}

describe('traduction SQL du segment', () => {
  it('reprend les axes de la définition partagée au lieu de les redécider', () => {
    for (const segment of ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const) {
      const { isChues, isCbao } = segmentAxes(segment);
      const sql = rendered(segmentCondition(segment));

      expect(sql).toContain(isChues ? 'sy."sigle" = "CHUES"' : 'sy."sigle" <> "CHUES"');
      expect(sql).toContain(isCbao ? 'bq."shortName" = "CBAO"' : 'bq."shortName" <> "CBAO"');
    }
  });

  it('dit la même chose que le filtre Prisma de la liste', () => {
    for (const segment of ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const) {
      const where = segmentWhere(segment) as {
        syndicat: { sigle: string | { not: string } };
        banque: { shortName: string | { not: string } };
      };
      const sql = rendered(segmentCondition(segment));

      expect(sql.includes('sy."sigle" = ')).toBe(typeof where.syndicat.sigle === 'string');
      expect(sql.includes('bq."shortName" = ')).toBe(typeof where.banque.shortName === 'string');
    }
  });

  it('l’expression de classement couvre les quatre segments, sans fourre-tout', () => {
    const sql = rendered(SEGMENT_EXPR);
    for (const segment of ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const) {
      expect(sql).toContain(`THEN "${segment}"::text`);
    }
    expect(sql).not.toContain('ELSE');
  });
});

describe('conditions communes', () => {
  it('borne un COMMERCIAL à ses lignes, avant tout filtre', () => {
    expect(rendered(prospectConditions(alice, {}, false))).toContain(
      'p."createdById" = "com-alice"',
    );
  });

  it('un COMMERCIAL qui vise un collègue obtient l’ensemble vide', () => {
    const sql = rendered(prospectConditions(alice, { commercialId: 'com-bob' }, false));
    expect(sql).not.toContain('"com-bob"');
    expect(sql).toContain('"__aucun__"');
  });

  it('traduit les filtres de phase 2 sur les bonnes colonnes', () => {
    const sql = rendered(
      prospectConditions(
        admin,
        {
          phase2Status: 'METHOD_OBTAINED',
          enrollmentMethod: 'PLATFORM',
          enrollmentCapturedById: 'com-bob',
        },
        false,
      ),
    );

    expect(sql).toContain('p."phase2Status" = "METHOD_OBTAINED"');
    expect(sql).toContain('p."enrollmentMethod" = "PLATFORM"');
    expect(sql).toContain('p."enrollmentCapturedById" = "com-bob"');
    expect(sql).not.toContain('p."createdById" = "com-bob"');
  });

  it('filtre la campagne par une sous-requête sur les tâches', () => {
    const sql = rendered(prospectConditions(admin, { campaignId: 'camp-1' }, false));
    expect(sql).toContain('"call_tasks"');
    expect(sql).toContain('ct."campaignId" = "camp-1"');
  });

  it('CLOISONNE la sous-requête de campagne, mode éteint', () => {
    const sql = rendered(prospectConditions(admin, { campaignId: 'camp-1' }, false));
    expect(sql).toContain('ct."isDemo" = FALSE');
  });

  it('et l’ouvre quand le mode est allumé', () => {
    const sql = rendered(prospectConditions(admin, { campaignId: 'camp-1' }, true));
    expect(sql).not.toContain('ct."isDemo" = FALSE');
    expect(sql).toContain('AND TRUE');
  });

  it('exclut les fiches supprimées et celles d’un représentant supprimé', () => {
    const sql = rendered(prospectConditions(admin, {}, false));
    expect(sql).toContain('p."deletedAt" IS NULL');
    expect(sql).toContain('r."deletedAt" IS NULL');
  });
});

describe('séries de phase 2', () => {
  it('rend les quatre statuts, y compris ceux à zéro', async () => {
    const { service } = makePrisma([
      { key: 'PENDING', prospects: 7 },
      { key: 'METHOD_OBTAINED', prospects: 3 },
    ]);

    const result = await new AnalyticsService(service, fakeDemoVisibility()).byPhase2Status(
      admin,
      {},
    );

    expect(result.items.map((item) => item.status)).toEqual([
      'PENDING',
      'METHOD_OBTAINED',
      'REFUSED',
      'WRONG_NUMBER',
    ]);
    expect(result.items.map((item) => item.prospects)).toEqual([7, 3, 0, 0]);
    expect(result.total).toBe(10);
    expect(result.items[0]?.share).toBe(70);
    expect(result.items[0]?.label).toBe('En attente');
  });

  it('ne compte comme méthodes que les fiches qui en portent une', async () => {
    const { service, sql } = makePrisma([{ key: 'PLATFORM', prospects: 4 }]);

    const result = await new AnalyticsService(service, fakeDemoVisibility()).byEnrollmentMethod(
      admin,
      {},
    );

    expect(sql()).toContain('p."enrollmentMethod" IS NOT NULL');
    expect(result.items.map((item) => item.method)).toEqual([
      'PLATFORM',
      'PHYSICAL',
      'VOICE_OR_ELECTRONIC_MESSAGING',
    ]);
    expect(result.total).toBe(4);
    expect(result.items[0]?.share).toBe(100);
  });

  it('rend les quatre segments et le nombre de méthodes obtenues de chacun', async () => {
    const { service } = makePrisma([
      { segment: 'BDD1', prospects: 5, obtained: 2 },
      { segment: 'BDD4', prospects: 5, obtained: 0 },
    ]);

    const result = await new AnalyticsService(service, fakeDemoVisibility()).bySegment(admin, {});

    expect(result.items.map((item) => item.segment)).toEqual(['BDD1', 'BDD2', 'BDD3', 'BDD4']);
    expect(result.items.map((item) => item.prospects)).toEqual([5, 0, 0, 5]);
    expect(result.items.map((item) => item.methodObtained)).toEqual([2, 0, 0, 0]);
    expect(result.total).toBe(10);
    expect(result.items[0]?.label).toContain('CHUES');
  });

  it('agrège en SQL : une requête par série, aucune ligne remontée', async () => {
    const { service, calls } = makePrisma([]);
    const analytics = new AnalyticsService(service, fakeDemoVisibility());

    await analytics.bySegment(admin, {});
    await analytics.byPhase2Status(admin, {});
    await analytics.byEnrollmentMethod(admin, {});

    expect(calls()).toBe(3);
  });

  it('applique le filtre reçu à chaque série', async () => {
    const { service, queries } = makePrisma([]);
    const analytics = new AnalyticsService(service, fakeDemoVisibility());
    const filter = { segment: 'BDD2', campaignId: 'camp-1' } as const;

    await analytics.bySegment(admin, filter);
    await analytics.byPhase2Status(admin, filter);
    await analytics.byEnrollmentMethod(admin, filter);

    for (const query of queries()) {
      expect(query).toContain('ct."campaignId" = "camp-1"');
      expect(query).toContain('(sy."sigle" = "CHUES" AND bq."shortName" <> "CBAO")');
    }
    expect(queries()).toHaveLength(3);
  });

  it('rend zéro plutôt qu’une division par zéro sur une base vide', async () => {
    const { service } = makePrisma([]);
    const result = await new AnalyticsService(service, fakeDemoVisibility()).byPhase2Status(
      admin,
      {},
    );
    expect(result.total).toBe(0);
    expect(result.items.every((item) => item.share === 0)).toBe(true);
  });
});

describe('cloisonnement des agrégats', () => {
  it('un COMMERCIAL ne lit jamais les chiffres de ses collègues', async () => {
    const { service, sql } = makePrisma([]);
    const analytics = new AnalyticsService(service, fakeDemoVisibility());

    await analytics.bySegment(alice, {});
    await analytics.byPhase2Status(alice, {});
    await analytics.byEnrollmentMethod(alice, {});
    await analytics.totals(alice, {});

    expect(sql().match(/p\."createdById" = "com-alice"/g)).toHaveLength(4);
  });

  it('un ADMIN n’est borné par rien', async () => {
    const { service, sql } = makePrisma([]);
    await new AnalyticsService(service, fakeDemoVisibility()).totals(admin, {});
    expect(sql()).not.toContain('p."createdById" =');
  });
});

describe('granularité temporelle', () => {
  it('n’injecte jamais la valeur reçue dans le date_trunc', async () => {
    const { service, sql } = makePrisma([]);
    await new AnalyticsService(service, fakeDemoVisibility()).overTime(admin, {
      granularity: "day'); DROP TABLE prospects; --" as never,
    });

    expect(sql()).toContain("date_trunc('day'");
    expect(sql()).not.toContain('DROP TABLE');
  });
});
