import { Role } from '@crm/database';
import type { Prisma } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { buildProspectWhere } from '../../common/prospect-where.js';
import { prospectConditions } from '../analytics/analytics.sql.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';

/**
 * Un filtre, trois surfaces.
 *
 * La liste et les deux exports passent par `buildProspectWhere` ; les agrégats
 * du tableau de bord passent par `prospectConditions`, parce qu'ils comptent en
 * SQL sans jamais remonter de lignes. Deux traductions donc, et c'est
 * exactement là que le décalage s'installe : un champ ajouté au DTO, câblé dans
 * l'une et oublié dans l'autre, produit un tableau de bord qui annonce 1 200
 * prospects là où le fichier exporté en contient 300, sans qu'aucun test de
 * module ne s'en aperçoive.
 *
 * Ces contrôles vérifient que CHAQUE champ du filtre restreint réellement les
 * DEUX traductions. Ils ne comparent pas les clauses entre elles, l'une est un
 * objet Prisma, l'autre du SQL, mais ils constatent qu'aucune des deux ne
 * traverse un champ sans réagir.
 */

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

/** Le SQL avec ses paramètres substitués, pour être comparable à lui-même. */
function rendered(sql: Prisma.Sql): string {
  return sql.strings.reduce(
    (text, chunk, index) =>
      index === 0 ? chunk : `${text}${JSON.stringify(sql.values[index - 1])}${chunk}`,
    '',
  );
}

/**
 * Un jeu couvrant TOUS les champs de `ProspectFilterDto`.
 *
 * Le contrôle d'exhaustivité ci-dessous compare cette liste aux clés que le DTO
 * accepte réellement : un champ ajouté au filtre sans être ajouté ici fait
 * échouer la suite, plutôt que d'être silencieusement dispensé de vérification.
 */
const CHAMPS: Readonly<Record<keyof ProspectFilterDto, ProspectFilterDto>> = {
  search: { search: 'Ndiaye' },
  representantId: { representantId: 'r-1' },
  banqueId: { banqueId: 'b-1' },
  syndicatId: { syndicatId: 's-1' },
  departementId: { departementId: 'd-1' },
  commercialId: { commercialId: 'com-bob' },
  statut: { statut: 'CONVERTI' },
  origin: { origin: 'BANQUE' },
  segment: { segment: 'BDD2' },
  phase2Status: { phase2Status: 'METHOD_OBTAINED' },
  enrollmentMethod: { enrollmentMethod: 'PLATFORM' },
  campaignId: { campaignId: 'camp-1' },
  enrollmentCapturedById: { enrollmentCapturedById: 'com-omar' },
  dateFrom: { dateFrom: '2026-01-01T00:00:00.000Z' },
  dateTo: { dateTo: '2026-12-31T23:59:59.000Z' },
  includeDeleted: { includeDeleted: true },
};

describe('un filtre, la même population sur les trois surfaces', () => {
  const referenceWhere = JSON.stringify(buildProspectWhere(admin, {}, false));
  const referenceSql = rendered(prospectConditions(admin, {}, false));

  for (const [champ, filtre] of Object.entries(CHAMPS)) {
    it(`« ${champ} » restreint la liste ET les agrégats`, () => {
      // Côté liste et exports.
      expect(JSON.stringify(buildProspectWhere(admin, filtre, false))).not.toBe(referenceWhere);
      // Côté tableau de bord.
      expect(rendered(prospectConditions(admin, filtre, false))).not.toBe(referenceSql);
    });
  }

  it('couvre tous les champs du DTO, sans exception silencieuse', () => {
    // Les clés sont relevées sur le DTO tel qu'il est réellement traduit, et
    // non sur une liste recopiée : c'est ce qui rend l'oubli détectable.
    const declares = Object.keys(CHAMPS).toSorted();
    const attendus = [
      'banqueId',
      'campaignId',
      'commercialId',
      'dateFrom',
      'dateTo',
      'departementId',
      'enrollmentCapturedById',
      'enrollmentMethod',
      'includeDeleted',
      'origin',
      'phase2Status',
      'representantId',
      'search',
      'segment',
      'statut',
      'syndicatId',
    ];
    expect(declares).toEqual(attendus);
  });

  it('le cloisonnement s’applique aux trois surfaces, et n’est jamais surchargeable', () => {
    const filtre: ProspectFilterDto = { commercialId: 'com-bob', includeDeleted: true };

    expect(buildProspectWhere(alice, filtre, false)).toMatchObject({
      createdById: '__aucun__',
      // `includeDeleted` reste sans effet pour un non-ADMIN.
      deletedAt: null,
    });

    const sql = rendered(prospectConditions(alice, filtre, false));
    expect(sql).toContain('p."createdById" = "com-alice"');
    expect(sql).toContain('"__aucun__"');
    expect(sql).toContain('p."deletedAt" IS NULL');
  });

  it('le segment ne se combine jamais en écrasant un autre filtre relationnel', () => {
    // La liste porte segment ET département sur des relations distinctes ; les
    // agrégats les portent sur des jointures. Les deux doivent conserver les
    // deux contraintes, faute de quoi une feuille « BDD1 » d'un département
    // donné contiendrait tout le département.
    const filtre: ProspectFilterDto = { segment: 'BDD1', departementId: 'd-1' };

    const where = buildProspectWhere(admin, filtre, false);
    expect(where.representant).toEqual({ departementId: 'd-1' });
    expect(where.AND).toHaveLength(1);

    const sql = rendered(prospectConditions(admin, filtre, false));
    expect(sql).toContain('r."departementId" = "d-1"');
    expect(sql).toContain('sy."sigle" = "CHUES"');
    expect(sql).toContain('bq."shortName" = "CBAO"');
  });
});
