import { Role, segmentWhere } from '@crm/database';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from './decorators/current-user.decorator.js';
import { buildProspectWhere } from './prospect-where.js';

const alice: AuthenticatedUser = {
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  role: Role.COMMERCIAL,
};
const admin: AuthenticatedUser = { ...alice, id: 'admin-1', username: 'admin', role: Role.ADMIN };

describe('filtre par segment', () => {
  it('délègue à segmentWhere plutôt que de réécrire le croisement', () => {
    // Le contrôle est volontairement une ÉGALITÉ avec la définition partagée,
    // et non une vérification de la forme attendue : une clause « équivalente »
    // écrite à la main passerait un test de forme, puis divergerait au premier
    // ajustement de la matrice sans que rien ne le signale.
    for (const segment of ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const) {
      const where = buildProspectWhere(admin, { segment });
      expect(where.AND).toEqual([segmentWhere(segment)]);
    }
  });

  it('BDD1 vise CHUES et CBAO ; BDD4 vise leurs compléments', () => {
    expect(buildProspectWhere(admin, { segment: 'BDD1' }).AND).toEqual([
      { syndicat: { sigle: 'CHUES' }, banque: { shortName: 'CBAO' } },
    ]);
    expect(buildProspectWhere(admin, { segment: 'BDD4' }).AND).toEqual([
      { syndicat: { sigle: { not: 'CHUES' } }, banque: { shortName: { not: 'CBAO' } } },
    ]);
  });

  it('n’écrase pas le filtre par département, qui porte aussi une relation', () => {
    const where = buildProspectWhere(admin, { segment: 'BDD2', departementId: 'dep-1' });
    expect(where.representant).toEqual({ departementId: 'dep-1' });
    expect(where.AND).toEqual([segmentWhere('BDD2')]);
  });

  it('reste soumis au cloisonnement : un segment ne l’élargit pas', () => {
    const where = buildProspectWhere(alice, { segment: 'BDD1' });
    expect(where.createdById).toBe('com-alice');
  });
});

describe('filtres de phase 2', () => {
  it('traduit statut, méthode et auteur de la méthode', () => {
    const where = buildProspectWhere(admin, {
      phase2Status: 'METHOD_OBTAINED',
      enrollmentMethod: 'PLATFORM',
      enrollmentCapturedById: 'com-bob',
    });

    expect(where.phase2Status).toBe('METHOD_OBTAINED');
    expect(where.enrollmentMethod).toBe('PLATFORM');
    expect(where.enrollmentCapturedById).toBe('com-bob');
  });

  it('distingue l’auteur de la méthode du commercial de saisie', () => {
    // Deux colonnes différentes : les confondre attribuerait le travail
    // d'appel de la phase 2 à celui qui a rempli la fiche sur le terrain.
    const where = buildProspectWhere(admin, {
      commercialId: 'com-saisie',
      enrollmentCapturedById: 'com-appel',
    });

    expect(where.createdById).toBe('com-saisie');
    expect(where.enrollmentCapturedById).toBe('com-appel');
  });

  it('filtre la campagne par la relation callTasks', () => {
    const where = buildProspectWhere(admin, { campaignId: 'camp-1' });
    expect(where.AND).toEqual([{ callTasks: { some: { campaignId: 'camp-1' } } }]);
  });

  it('cumule segment et campagne sans que l’un efface l’autre', () => {
    const where = buildProspectWhere(admin, { segment: 'BDD3', campaignId: 'camp-1' });
    expect(where.AND).toEqual([
      segmentWhere('BDD3'),
      { callTasks: { some: { campaignId: 'camp-1' } } },
    ]);
  });

  it('n’ajoute aucune clause AND quand ni segment ni campagne ne sont demandés', () => {
    expect(buildProspectWhere(admin, { statut: 'NOUVEAU' }).AND).toBeUndefined();
  });
});

describe('recherche — la clause téléphone ne doit jamais tout matcher', () => {
  const clauses = (search: string) =>
    (buildProspectWhere(admin, { search }).OR ?? []) as Record<string, unknown>[];

  it('un terme alphabétique ne pose PAS de clause téléphone', () => {
    // Régression : `"ZZZZ".replace(/[^\d+]/g, '')` donne '', et
    // `contains: ''` vaut `LIKE '%%'` — qui renvoie la base entière. Le filtre
    // paraissait fonctionner tant que personne ne cherchait un nom absent.
    const or = clauses('ZZZZZNOPE');
    expect(or).toHaveLength(2);
    expect(or.some((c) => 'phoneE164' in c)).toBe(false);
  });

  it('un nom réel ne pose pas non plus de clause téléphone', () => {
    expect(clauses('Diallo').some((c) => 'phoneE164' in c)).toBe(false);
  });

  it('un fragment de moins de 3 chiffres est ignoré', () => {
    expect(clauses('77').some((c) => 'phoneE164' in c)).toBe(false);
  });

  it('un numéro complet est normalisé en E.164', () => {
    const phone = clauses('77 123 45 67').find((c) => 'phoneE164' in c);
    expect(phone).toEqual({ phoneE164: { contains: '+221771234567' } });
  });

  it('un fragment de numéro suffisamment long est cherché tel quel', () => {
    const phone = clauses('1234').find((c) => 'phoneE164' in c);
    expect(phone).toEqual({ phoneE164: { contains: '1234' } });
  });
});
