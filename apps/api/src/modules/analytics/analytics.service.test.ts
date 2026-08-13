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

/** Requête rendue avec ses paramètres substitués, pour être lisible par un test. */
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
      // Le service compose sa requête avec des fragments `Prisma.Sql` ; on les
      // aplatit pour pouvoir vérifier ce qui part réellement vers PostgreSQL.
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
    // Le contrôle relie la clause SQL à `segmentAxes`, la MÊME source que
    // `segmentWhere` utilisé par la liste et par les onglets du classeur. Une
    // matrice réécrite ici passerait un test de forme puis divergerait au
    // premier ajustement, sans que rien ne le signale.
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

      // Égalité côté Prisma ⇔ `=` côté SQL ; négation ⇔ `<>`.
      expect(sql.includes('sy."sigle" = ')).toBe(typeof where.syndicat.sigle === 'string');
      expect(sql.includes('bq."shortName" = ')).toBe(typeof where.banque.shortName === 'string');
    }
  });

  it('l’expression de classement couvre les quatre segments, sans fourre-tout', () => {
    const sql = rendered(SEGMENT_EXPR);
    for (const segment of ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const) {
      expect(sql).toContain(`THEN "${segment}"::text`);
    }
    // Pas de branche `ELSE` : un segment ajouté sans reconstruire l'expression
    // doit rendre NULL, pas se ranger silencieusement quelque part.
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
    // L'auteur de la MÉTHODE, jamais confondu avec l'auteur de la saisie.
    expect(sql).toContain('p."enrollmentCapturedById" = "com-bob"');
    expect(sql).not.toContain('p."createdById" = "com-bob"');
  });

  it('filtre la campagne par une sous-requête sur les tâches', () => {
    const sql = rendered(prospectConditions(admin, { campaignId: 'camp-1' }, false));
    expect(sql).toContain('"call_tasks"');
    expect(sql).toContain('ct."campaignId" = "camp-1"');
  });

  it('exclut les fiches supprimées et celles d’un représentant supprimé', () => {
    const sql = rendered(prospectConditions(admin, {}, false));
    expect(sql).toContain('p."deletedAt" IS NULL');
    // Sans elle, un total « par département » dépasserait le total global.
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

    // Un histogramme qui perd une barre dès que le compteur tombe à zéro change
    // de forme sans raison : l'absence de « Refus » se lirait comme une panne.
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
    // `total` est celui des porteurs d'une méthode, pas celui de la population.
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
    // Libellé issu de SEGMENT_LABELS, jamais réécrit ici.
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

    // Chaque requête est examinée séparément : `bySegment` embarque en plus
    // l'expression de classement, qui cite les quatre segments, et un comptage
    // d'occurrences sur le texte concaténé serait donc trompeur.
    for (const query of queries()) {
      expect(query).toContain('ct."campaignId" = "camp-1"');
      // BDD2 = CHUES × banque autre que CBAO, telle que la définit la matrice.
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
    // La valeur vient d'une énumération fermée : une chaîne arbitraire retombe
    // sur 'day' plutôt que d'atteindre la requête.
    await new AnalyticsService(service, fakeDemoVisibility()).overTime(admin, {
      granularity: "day'); DROP TABLE prospects; --" as never,
    });

    expect(sql()).toContain("date_trunc('day'");
    expect(sql()).not.toContain('DROP TABLE');
  });
});
