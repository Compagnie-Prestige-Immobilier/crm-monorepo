import { ForbiddenException } from '@nestjs/common';
import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import {
  assertOwnership,
  assertReadable,
  attributionScope,
  isAdmin,
  ownerScope,
  prospectSyncScope,
  readScope,
} from './scope.js';

const admin = { id: 'admin-1', role: Role.ADMIN };
const alice = { id: 'com-alice', role: Role.COMMERCIAL };
const bob = { id: 'com-bob', role: Role.COMMERCIAL };
const superviseur = { id: 'sup-1', role: Role.SUPERVISEUR };

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

  it('BORNE un SUPERVISEUR, dont la portée large ne passe pas par ici', () => {
    expect(ownerScope(superviseur)).toEqual({ createdById: 'sup-1' });
  });
});

describe('readScope', () => {
  it('ouvre la lecture nationale au SUPERVISEUR', () => {
    expect(readScope(superviseur)).toEqual({});
    expect(readScope(admin)).toEqual({});
  });

  it('laisse un téléconseiller borné à ses propres lignes', () => {
    expect(readScope(alice)).toEqual({ createdById: 'com-alice' });
  });
});

describe('attributionScope', () => {
  it('borne un COMMERCIAL à ses fiches ET à ses attributions de lot', () => {
    expect(attributionScope(alice)).toEqual({
      OR: [{ createdById: 'com-alice' }, { lotItems: { some: { assigneeId: 'com-alice' } } }],
    });
  });

  it('n’ajoute rien pour l’encadrement', () => {
    expect(attributionScope(admin)).toEqual({});
    expect(attributionScope(superviseur)).toEqual({});
  });

  it('le tirage mobile reste GLOBAL : c’est le téléphone qui filtre', () => {
    expect(prospectSyncScope(alice)).toEqual({});
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
    let leve: unknown;
    try {
      assertOwnership(alice, { createdById: 'com-bob' });
    } catch (error) {
      leve = error;
    }

    expect(leve).toBeInstanceOf(ForbiddenException);
    expect((leve as ForbiddenException).getResponse()).toMatchObject({ code: 'NOT_OWNER' });
  });
});

describe('isAdmin', () => {
  it('distingue les deux rôles', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(alice)).toBe(false);
  });

  it('ne compte PAS le SUPERVISEUR : il lit, il n’écrit pas', () => {
    expect(isAdmin(superviseur)).toBe(false);
    expect(() => {
      assertOwnership(superviseur, { createdById: 'com-bob' });
    }).toThrow(ForbiddenException);
  });
});

describe('assertReadable', () => {
  it('laisse le SUPERVISEUR ouvrir la fiche d’autrui', () => {
    expect(() => {
      assertReadable(superviseur, { createdById: 'com-bob' });
    }).not.toThrow();
  });

  it('refuse toujours celle d’un autre téléconseiller', () => {
    expect(() => {
      assertReadable(alice, { createdById: 'com-bob' });
    }).toThrow(ForbiddenException);
  });
});
