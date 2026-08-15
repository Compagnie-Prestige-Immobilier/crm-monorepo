import type { Prisma } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { bankCaseConditions } from './bank-cases.sql.js';

/**
 * Le filtre de la liste est traduit UNE fois, ici, pour la liste, les agrégats
 * et l'export. Un critère du DTO que cette traduction ne lit pas ne se voit
 * nulle part : la requête part sans lui et l'écran affiche simplement « tout »,
 * ce qui ressemble à un filtre qui ne retient rien plutôt qu'à une panne.
 */

/** Le SQL avec ses paramètres substitués, pour être comparable à lui-même. */
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
});
