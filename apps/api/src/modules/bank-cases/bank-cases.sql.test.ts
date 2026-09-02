import { Projet } from '@crm/database';
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
    const sql = rendered(bankCaseConditions({ banqueId: 'bnq-bhs' }));

    expect(sql).toContain('c."processingBankId" = "bnq-bhs"');
  });

  it('sans « banqueId », aucune clause de banque n’est posée', () => {
    expect(rendered(bankCaseConditions({}))).not.toContain('processingBankId');
  });

  it('« projet » restreint au projet de la fiche liée', () => {
    const sql = rendered(bankCaseConditions({ projet: Projet.GRAND_PUBLIC }));

    expect(sql).toContain('FROM "prospects" p');
    expect(sql).toContain('p."projet" = "GRAND_PUBLIC"');
  });

  // Sans filtre, les deux projets sortent : un défaut ferait disparaître la
  // moitié des dossiers du tableau de bord sans que rien ne le dise.
  it('sans « projet », aucune clause de projet n’est posée', () => {
    expect(rendered(bankCaseConditions({}))).not.toContain('prospects');
  });
});
