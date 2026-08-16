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

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * LE DOSSIER *ET* SON CLIENT, sans quoi deux écrans donnent deux chiffres.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Le tableau de bord part des prospects puis rejoint les dossiers : il exige
   * les deux colonnes à `FALSE`. Cette traduction-ci n'en exigeait qu'une. Un
   * dossier réel accroché à un prospect fictif entrait donc dans « Banques » et
   * pas dans le tableau de bord — constaté en production, 12 M FCFA d'un côté,
   * 0 FCFA de l'autre.
   *
   * Ces deux tests tombent si la clause sur le prospect disparaît.
   */
  it('exclut un dossier dont le PROSPECT est fictif, pas seulement le dossier', () => {
    const sql = rendered(bankCaseConditions({}, false));

    expect(sql).toContain('c."isDemo" = FALSE');
    // La forme exacte importe peu ; la présence de la sous-requête sur le
    // prospect, elle, est la correction elle-même.
    expect(sql).toContain('"prospects"');
    expect(sql).toContain('dp."isDemo" = TRUE');
    expect(sql).toContain('dp."id" = c."prospectId"');
  });

  /**
   * LE PENDANT INDISPENSABLE. Mode ALLUMÉ, les lignes fictives sont justement
   * ce qu'on veut voir : poser la clause en permanence viderait l'écran pendant
   * la démonstration, et ce test resterait vert si on l'oubliait.
   */
  it('ne cloisonne RIEN quand le mode démonstration est allumé', () => {
    const sql = rendered(bankCaseConditions({}, true));

    expect(sql).not.toContain('isDemo');
    expect(sql).not.toContain('"prospects"');
  });
});
