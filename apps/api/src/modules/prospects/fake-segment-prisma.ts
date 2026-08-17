import { Role } from '@crm/database';
import type { BddSegment, ChangeSource } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';

export interface FakeBanque {
  id: string;
  name: string;
  shortName: string;
}

export interface FakeSyndicat {
  id: string;
  sigle: string;
}

export interface FakeUser {
  id: string;
  fullName: string;
  role: Role;
}

export interface FakeProspect {
  id: string;
  nom: string;
  prenom: string;
  phoneE164: string;
  rev: number;
  statut: string;
  banqueId: string;
  syndicatId: string;
  representantId: string;
  createdById: string;
  isDemo: boolean;
  deletedAt: Date | null;
}

export interface FakeSegmentChange {
  id: string;
  prospectId: string;
  fromSegment: BddSegment;
  toSegment: BddSegment;
  fromBanqueId: string;
  toBanqueId: string;
  fromSyndicatId: string;
  toSyndicatId: string;
  reason: string | null;
  changedById: string;
  source: ChangeSource;
  changedAt: Date;
  isDemo: boolean;
}

const BASE = new Date('2026-08-01T08:00:00.000Z');

export const BANQUE_CBAO: FakeBanque = { id: 'bnq-cbao', name: 'CBAO Sénégal', shortName: 'CBAO' };
export const BANQUE_BHS: FakeBanque = {
  id: 'bnq-bhs',
  name: 'Banque de l’Habitat',
  shortName: 'BHS',
};
export const SYNDICAT_CHUES: FakeSyndicat = { id: 'snd-chues', sigle: 'CHUES' };
export const SYNDICAT_SAES: FakeSyndicat = { id: 'snd-saes', sigle: 'SAES' };

export const ALICE: FakeUser = { id: 'com-alice', fullName: 'Alice Diop', role: Role.COMMERCIAL };
export const BOB: FakeUser = { id: 'com-bob', fullName: 'Bob Sarr', role: Role.COMMERCIAL };

type Where = Record<string, unknown>;

export class FakeSegmentPrisma {
  banques: FakeBanque[] = [{ ...BANQUE_CBAO }, { ...BANQUE_BHS }];
  syndicats: FakeSyndicat[] = [{ ...SYNDICAT_CHUES }, { ...SYNDICAT_SAES }];
  users: FakeUser[] = [{ ...ALICE }, { ...BOB }];
  prospects: FakeProspect[] = [];
  segmentChanges: FakeSegmentChange[] = [];

  onSegmentChangeCreate: (() => void) | undefined;

  private sequence = 0;

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, '0')}`;
  }

  private clock(): Date {
    this.sequence += 1;
    return new Date(BASE.getTime() + this.sequence * 1000);
  }

  addProspect(over: Partial<FakeProspect> & { id: string }): FakeProspect {
    const row: FakeProspect = {
      nom: 'Fall',
      prenom: 'Moussa',
      phoneE164: '+221771234567',
      rev: 1,
      statut: 'NOUVEAU',
      banqueId: BANQUE_BHS.id,
      syndicatId: SYNDICAT_SAES.id,
      representantId: 'rep-1',
      createdById: ALICE.id,
      isDemo: false,
      deletedAt: null,
      ...over,
    };
    this.prospects.push(row);
    return row;
  }

  private hydrateProspect(row: FakeProspect): unknown {
    const banque = this.banques.find((item) => item.id === row.banqueId);
    const syndicat = this.syndicats.find((item) => item.id === row.syndicatId);
    const author = this.users.find((item) => item.id === row.createdById);
    return {
      ...row,
      clientCreatedAt: BASE,
      createdAt: BASE,
      updatedAt: BASE,
      phase2Status: 'PENDING',
      enrollmentMethod: null,
      enrollmentCapturedAt: null,
      enrollmentCapturedById: null,
      enrollmentCapturedBy: null,
      origin: null,
      originLabel: null,
      banque: { name: banque?.name ?? '?', shortName: banque?.shortName ?? '?' },
      syndicat: { sigle: syndicat?.sigle ?? '?' },
      createdBy: { id: author?.id ?? row.createdById, fullName: author?.fullName ?? '?' },
      representant: {
        fullName: 'Cheikh Ba',
        phoneE164: '+221770000000',
        departementId: 'dep-1',
        departement: { name: 'Dakar' },
      },
    };
  }

  private matchesProspect(row: FakeProspect, where: Where): boolean {
    for (const [key, expected] of Object.entries(where)) {
      if (expected === undefined) continue;
      const actual = (row as unknown as Record<string, unknown>)[key];
      if (key === 'deletedAt') {
        if ((actual ?? null) !== expected) return false;
        continue;
      }
      if (actual !== expected) return false;
    }
    return true;
  }

  readonly prospect = {
    findFirst: ({ where, include }: { where: Where; include?: unknown }): Promise<unknown> => {
      const row = this.prospects.find((item) => this.matchesProspect(item, where));
      if (!row) return Promise.resolve(null);
      return Promise.resolve(include ? this.hydrateProspect(row) : { ...row });
    },

    findUnique: ({ where }: { where: Where }): Promise<unknown> => {
      const row = this.prospects.find((item) => item.id === where.id);
      return Promise.resolve(row ? { ...row } : null);
    },

    updateMany: ({
      where,
      data,
    }: {
      where: Where;
      data: Record<string, unknown>;
    }): Promise<{ count: number }> => {
      const rows = this.prospects.filter((item) => this.matchesProspect(item, where));
      for (const row of rows) {
        const target = row as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(data)) {
          if (value !== null && typeof value === 'object' && 'increment' in value) {
            target[key] = (target[key] as number) + (value.increment as number);
            continue;
          }
          target[key] = value;
        }
      }
      return Promise.resolve({ count: rows.length });
    },
  };

  readonly segmentChange = {
    create: ({ data }: { data: Record<string, unknown> }): Promise<unknown> => {
      this.onSegmentChangeCreate?.();
      const row: FakeSegmentChange = {
        id: this.nextId('sgc'),
        prospectId: data.prospectId as string,
        fromSegment: data.fromSegment as BddSegment,
        toSegment: data.toSegment as BddSegment,
        fromBanqueId: data.fromBanqueId as string,
        toBanqueId: data.toBanqueId as string,
        fromSyndicatId: data.fromSyndicatId as string,
        toSyndicatId: data.toSyndicatId as string,
        reason: (data.reason as string | undefined) ?? null,
        changedById: data.changedById as string,
        source: data.source as ChangeSource,
        changedAt: this.clock(),
        isDemo: data.isDemo as boolean,
      };
      this.segmentChanges.push(row);
      return Promise.resolve({ ...row });
    },

    findMany: ({ where }: { where: Where }): Promise<unknown[]> => {
      const rows = this.segmentChanges
        .filter((item) => item.prospectId === where.prospectId)
        .sort((left, right) => right.changedAt.getTime() - left.changedAt.getTime());
      return Promise.resolve(
        rows.map((row) => ({
          ...row,
          changedBy: this.users.find((item) => item.id === row.changedById) ?? {
            id: row.changedById,
            fullName: '?',
          },
        })),
      );
    },
  };

  readonly banque = {
    findUnique: ({ where }: { where: Where }): Promise<unknown> => {
      const row = this.banques.find((item) => item.id === where.id);
      return Promise.resolve(row ? { ...row } : null);
    },
  };

  readonly syndicat = {
    findUnique: ({ where }: { where: Where }): Promise<unknown> => {
      const row = this.syndicats.find((item) => item.id === where.id);
      return Promise.resolve(row ? { ...row } : null);
    },
  };

  async $transaction<T>(work: (tx: FakeSegmentPrisma) => Promise<T>): Promise<T> {
    const prospects = this.prospects.map((row) => ({ ...row }));
    const changes = this.segmentChanges.map((row) => ({ ...row }));
    try {
      return await work(this);
    } catch (error) {
      this.prospects = prospects;
      this.segmentChanges = changes;
      throw error;
    }
  }

  $queryRaw(): Promise<never[]> {
    return Promise.resolve([]);
  }

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}
