import type { Prisma } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { bankCaseConditions } from './bank-cases.sql.js';

function rendered(sql: Prisma.Sql): string {
  return sql.strings.reduce(
    (text, chunk, index) =>
      index === 0 ? chunk : `${text}${JSON.stringify(sql.values[index - 1])}${chunk}`,
    '',
  );
}

describe('bankCaseConditions', () => {
  it('« banqueId » restreint bien la banque de traitement', () => {
    const sql = rendered(bankCaseConditions({ banqueId: 'bnq-bhs' }, true));

    expect(sql).toContain('c."processingBankId" = "bnq-bhs"');
  });

  it('sans « banqueId », aucune clause de banque n’est posée', () => {
    expect(rendered(bankCaseConditions({}, true))).not.toContain('processingBankId');
  });

  it('exclut un dossier dont le PROSPECT est fictif, pas seulement le dossier', () => {
    const sql = rendered(bankCaseConditions({}, false));

    expect(sql).toContain('c."isDemo" = FALSE');
    expect(sql).toContain('"prospects"');
    expect(sql).toContain('dp."isDemo" = TRUE');
    expect(sql).toContain('dp."id" = c."prospectId"');
  });

  it('ne cloisonne RIEN quand le mode démonstration est allumé', () => {
    const sql = rendered(bankCaseConditions({}, true));

    expect(sql).not.toContain('isDemo');
    expect(sql).not.toContain('"prospects"');
  });
});
