import { Role } from '@crm/database';
import type { Prisma } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { buildProspectWhere } from '../../common/prospect-where.js';
import { prospectConditions } from '../analytics/analytics.sql.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
};
const alice: AuthenticatedUser = {
  ...admin,
  id: 'com-alice',
  username: 'alice',
  role: Role.COMMERCIAL,
};

function rendered(sql: Prisma.Sql): string {
  return sql.strings.reduce(
    (text, chunk, index) =>
      index === 0 ? chunk : `${text}${JSON.stringify(sql.values[index - 1])}${chunk}`,
    '',
  );
}

const CHAMPS: Readonly<Record<keyof ProspectFilterDto, ProspectFilterDto>> = {
  search: { search: 'Ndiaye' },
  representantId: { representantId: 'r-1' },
  banqueId: { banqueId: 'b-1' },
  syndicatId: { syndicatId: 's-1' },
  departementId: { departementId: 'd-1' },
  commercialId: { commercialId: 'com-bob' },
  projet: { projet: 'GRAND_PUBLIC' },
  type: { type: 'INFORMEL' },
  canalProvenanceId: { canalProvenanceId: 'canal-1' },
  statut: { statut: 'CONVERTI' },
  origin: { origin: 'BANQUE' },
  segment: { segment: 'BDD2' },
  phase2Status: { phase2Status: 'METHOD_OBTAINED' },
  enrollmentMethod: { enrollmentMethod: 'PLATFORM' },
  campaignId: { campaignId: 'camp-1' },
  assignedToId: { assignedToId: 'com-bob' },
  enrollmentCapturedById: { enrollmentCapturedById: 'com-omar' },
  dateFrom: { dateFrom: '2026-01-01T00:00:00.000Z' },
  dateTo: { dateTo: '2026-12-31T23:59:59.000Z' },
  includeDeleted: { includeDeleted: true },
};

describe('un filtre, la même population sur les trois surfaces', () => {
  const referenceWhere = JSON.stringify(buildProspectWhere(admin, {}));
  const referenceSql = rendered(prospectConditions(admin, {}));

  for (const [champ, filtre] of Object.entries(CHAMPS)) {
    it(`« ${champ} » restreint la liste ET les agrégats`, () => {
      expect(JSON.stringify(buildProspectWhere(admin, filtre))).not.toBe(referenceWhere);
      expect(rendered(prospectConditions(admin, filtre))).not.toBe(referenceSql);
    });
  }

  it('couvre tous les champs du DTO, sans exception silencieuse', () => {
    const declares = Object.keys(CHAMPS).toSorted();
    const attendus = [
      'assignedToId',
      'banqueId',
      'campaignId',
      'canalProvenanceId',
      'commercialId',
      'dateFrom',
      'dateTo',
      'departementId',
      'enrollmentCapturedById',
      'enrollmentMethod',
      'includeDeleted',
      'origin',
      'phase2Status',
      'projet',
      'representantId',
      'search',
      'segment',
      'statut',
      'syndicatId',
      'type',
    ];
    expect(declares).toEqual(attendus);
  });

  it('le cloisonnement s’applique aux trois surfaces, et n’est jamais surchargeable', () => {
    const filtre: ProspectFilterDto = { commercialId: 'com-bob', includeDeleted: true };

    expect(buildProspectWhere(alice, filtre)).toMatchObject({
      createdById: '__aucun__',
      deletedAt: null,
    });

    const sql = rendered(prospectConditions(alice, filtre));
    expect(sql).toContain('p."createdById" = "com-alice"');
    expect(sql).toContain('"__aucun__"');
    expect(sql).toContain('p."deletedAt" IS NULL');
  });

  it('le segment ne se combine jamais en écrasant un autre filtre relationnel', () => {
    const filtre: ProspectFilterDto = { segment: 'BDD1', departementId: 'd-1' };

    const where = buildProspectWhere(admin, filtre);
    expect(where.representant).toEqual({ departementId: 'd-1' });
    expect(where.AND).toHaveLength(1);

    const sql = rendered(prospectConditions(admin, filtre));
    expect(sql).toContain('r."departementId" = "d-1"');
    expect(sql).toContain('sy."sigle" = "CHUES"');
    expect(sql).toContain('bq."shortName" = "CBAO"');
  });
});
