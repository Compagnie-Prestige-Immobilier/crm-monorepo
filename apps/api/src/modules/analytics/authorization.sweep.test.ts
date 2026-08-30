import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { rendered } from './fake-analytics-prisma.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { FunnelService } from './funnel.service.js';
import { PilotageService } from './pilotage.service.js';
import { PortfolioService } from './portfolio.service.js';
import { QualityService } from './quality.service.js';
import { SegmentConversionsService } from './segment-conversions.service.js';

const ALICE: AuthenticatedUser = {
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  role: Role.COMMERCIAL,
};
const ADMIN: AuthenticatedUser = { ...ALICE, id: 'admin-1', username: 'admin', role: Role.ADMIN };
const SUPERVISEUR: AuthenticatedUser = {
  ...ALICE,
  id: 'sup-1',
  username: 'sup',
  role: Role.SUPERVISEUR,
};

const MINIMUM_ROUTES = 20;

/**
 * Double qui garde la TRACE de chaque interrogation, brute ou passée par
 * l'ORM : le balayage ne peut pas juger une route dont il ne voit qu'un
 * résultat vide.
 */
function tracingPrisma(): { service: PrismaService; traces: () => string[] } {
  const seen: string[] = [];

  const record = (value: unknown): void => {
    seen.push(JSON.stringify(value));
  };

  const prisma = {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
      seen.push(
        strings.reduce((text, chunk, index) => {
          if (index === 0) return chunk;
          const value: unknown = values[index - 1];
          const isSql =
            typeof value === 'object' && value !== null && 'strings' in value && 'values' in value;
          return `${text}${isSql ? rendered(value as never) : JSON.stringify(value)}${chunk}`;
        }, ''),
      );
      return Promise.resolve([]);
    },
    segmentChange: {
      count: (args: unknown): Promise<number> => {
        record(args);
        return Promise.resolve(0);
      },
      findMany: (args: unknown): Promise<unknown[]> => {
        record(args);
        return Promise.resolve([]);
      },
      groupBy: (args: unknown): Promise<unknown[]> => {
        record(args);
        return Promise.resolve([]);
      },
    },
    user: {
      findMany: (args: unknown): Promise<unknown[]> => {
        record(args);
        return Promise.resolve([]);
      },
    },
  };

  return { service: prisma as unknown as PrismaService, traces: () => [...seen] };
}

function controllerFor(prisma: PrismaService): AnalyticsController {
  return new AnalyticsController(
    new AnalyticsService(prisma),
    new FunnelService(prisma),
    new PilotageService(prisma),
    new PortfolioService(prisma),
    new QualityService(prisma),
    new SegmentConversionsService(prisma),
  );
}

const routeNames = (): string[] =>
  Object.getOwnPropertyNames(AnalyticsController.prototype).filter(
    (name) => name !== 'constructor',
  );

type Route = (user: AuthenticatedUser, query: object) => Promise<unknown>;

async function tracesOf(route: string, user: AuthenticatedUser): Promise<string[]> {
  const { service, traces } = tracingPrisma();
  const controller = controllerFor(service) as unknown as Record<string, Route>;
  const handler = controller[route];
  if (typeof handler !== 'function') throw new Error(`${route} n’est pas une route`);
  await handler.call(controller, user, {});
  return traces();
}

describe('cloisonnement du tableau de bord, balayage', () => {
  it('couvre bien toutes les routes du module', () => {
    expect(routeNames().length).toBeGreaterThanOrEqual(MINIMUM_ROUTES);
  });

  it.each(routeNames())(
    'AUCUN chiffre global ne sort de %s pour un téléconseiller',
    async (route) => {
      const traces = await tracesOf(route, ALICE);

      expect(traces.length, `${route} n’interroge rien : le balayage ne juge rien`).toBeGreaterThan(
        0,
      );
      for (const trace of traces) {
        expect(
          trace,
          `${route} interroge la base sans borner sur l’appelant :\n${trace}`,
        ).toContain(ALICE.id);
      }
    },
  );

  it('un ADMIN, lui, n’est borné par personne', async () => {
    const traces = await tracesOf('totals', ADMIN);
    expect(traces.join('\n')).not.toContain(ADMIN.id);
  });

  /**
   * Deux intentions opposées sur la même clause, et le balayage doit les
   * distinguer : le téléconseiller est CLOISONNÉ, le superviseur lit LARGE.
   * Une route qui bornerait le superviseur sur lui-même ne lèverait rien, elle
   * rendrait un écran entier à zéro.
   */
  it.each(routeNames())('un SUPERVISEUR n’est borné sur personne dans %s', async (route) => {
    const traces = await tracesOf(route, SUPERVISEUR);

    expect(traces.length, `${route} n’interroge rien : le balayage ne juge rien`).toBeGreaterThan(
      0,
    );
    for (const trace of traces) {
      expect(
        trace,
        `${route} borne le superviseur sur son propre compte : l’écran s’affichera à zéro sans la moindre erreur :\n${trace}`,
      ).not.toContain(SUPERVISEUR.id);
    }
  });
});
