import { ForbiddenException } from '@nestjs/common';
import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { assertOwnership, isAdmin, ownerScope } from './scope.js';

const admin = { id: 'admin-1', role: Role.ADMIN };
const alice = { id: 'com-alice', role: Role.COMMERCIAL };
const bob = { id: 'com-bob', role: Role.COMMERCIAL };

describe('ownerScope', () => {
  it('restreint un COMMERCIAL à ses propres lignes', () => {
    expect(ownerScope(alice)).toEqual({ createdById: 'com-alice' });
  });

  it('n’ajoute aucune restriction pour un ADMIN', () => {
    expect(ownerScope(admin)).toEqual({});
  });

  it('ne laisse jamais fuir l’identifiant d’un autre commercial', () => {
    expect(ownerScope(bob)).not.toEqual(ownerScope(alice));
  });
});

describe('assertOwnership', () => {
  it('refuse la ligne d’un autre commercial', () => {
    expect(() => {
      assertOwnership(alice, { createdById: 'com-bob' });
    }).toThrow(ForbiddenException);
  });

  it('accepte sa propre ligne', () => {
    expect(() => {
      assertOwnership(alice, { createdById: 'com-alice' });
    }).not.toThrow();
  });

  it('laisse passer l’ADMIN sur n’importe quelle ligne', () => {
    expect(() => {
      assertOwnership(admin, { createdById: 'com-bob' });
    }).not.toThrow();
  });

  it('expose un code métier stable', () => {
    try {
      assertOwnership(alice, { createdById: 'com-bob' });
      expect.unreachable('assertOwnership aurait dû lever');
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({ code: 'NOT_OWNER' });
    }
  });
});

describe('isAdmin', () => {
  it('distingue les deux rôles', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(alice)).toBe(false);
  });
});
