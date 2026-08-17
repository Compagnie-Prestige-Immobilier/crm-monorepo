import { ImportMode, Phase2Status } from '@crm/database';
import type { EnrollmentMethod } from '@crm/database';

import type { ImportRunContext } from './import-adapter.js';

export interface FakeBanque {
  id: string;
  shortName: string;
  isActive: boolean;
  sortOrder: number;
}

export interface FakeSyndicat {
  id: string;
  sigle: string;
  isActive: boolean;
  sortOrder: number;
}

export interface FakeRepresentant {
  id: string;
  phoneE164: string;
  isDemo: boolean;
  deletedAt: Date | null;
}

export interface FakeProspectRow {
  id: string;
  nom: string;
  prenom: string;
  phoneE164: string;
  banqueId: string;
  syndicatId: string;
  representantId: string;
  createdById: string;
  phase2Status: Phase2Status;
  enrollmentMethod: EnrollmentMethod | null;
  enrollmentCapturedAt: Date | null;
  enrollmentCapturedById: string | null;
  clientCreatedAt: Date;
  isDemo: boolean;
  deletedAt: Date | null;
}

export type FakeProspectCreate = Omit<FakeProspectRow, 'deletedAt'>;

export interface FakeProspectsImportStore {
  banques: FakeBanque[];
  syndicats: FakeSyndicat[];
  representants: FakeRepresentant[];
  prospects: FakeProspectRow[];
  racingPhones: string[];
}

export const FAKE_REPRESENTANT_PHONE = '+221769876543';
export const FAKE_OTHER_REPRESENTANT_PHONE = '+221701112233';

export function createFakeImportStore(
  over: Partial<FakeProspectsImportStore> = {},
): FakeProspectsImportStore {
  return {
    banques: over.banques ?? [
      { id: 'ban-cbao', shortName: 'CBAO', isActive: true, sortOrder: 10 },
      { id: 'ban-bnde', shortName: 'BNDE', isActive: true, sortOrder: 20 },
    ],
    syndicats: over.syndicats ?? [
      { id: 'syn-chues', sigle: 'CHUES', isActive: true, sortOrder: 10 },
      { id: 'syn-sudes', sigle: 'SUDES', isActive: true, sortOrder: 20 },
    ],
    representants: over.representants ?? [
      { id: 'rep-1', phoneE164: FAKE_REPRESENTANT_PHONE, isDemo: false, deletedAt: null },
      { id: 'rep-2', phoneE164: FAKE_OTHER_REPRESENTANT_PHONE, isDemo: false, deletedAt: null },
    ],
    prospects: over.prospects ?? [],
    racingPhones: over.racingPhones ?? [],
  };
}

export function fakeExistingProspect(over: {
  id: string;
  phoneE164: string;
  representantId: string;
  deletedAt?: Date | null;
}): FakeProspectRow {
  return {
    id: over.id,
    nom: 'Fall',
    prenom: 'Moussa',
    phoneE164: over.phoneE164,
    banqueId: 'ban-cbao',
    syndicatId: 'syn-chues',
    representantId: over.representantId,
    createdById: 'user-terrain',
    phase2Status: Phase2Status.PENDING,
    enrollmentMethod: null,
    enrollmentCapturedAt: null,
    enrollmentCapturedById: null,
    clientCreatedAt: new Date('2026-01-01T08:00:00.000Z'),
    isDemo: false,
    deletedAt: over.deletedAt ?? null,
  };
}

interface ReferentialFindManyArgs {
  where: { isActive: boolean };
}

interface RepresentantFindManyArgs {
  where: { deletedAt: null; isDemo: boolean };
}

interface ProspectFindManyArgs {
  where: { phoneE164: { in: string[] }; deletedAt: null };
}

interface ProspectCreateManyArgs {
  data: readonly FakeProspectCreate[];
  skipDuplicates?: boolean;
}

export function fakeImportContext(
  store: FakeProspectsImportStore,
  over: Partial<Pick<ImportRunContext, 'jobId' | 'mode' | 'requestedById'>> = {},
): ImportRunContext {
  const tx = {
    banque: {
      findMany: (args: ReferentialFindManyArgs) =>
        Promise.resolve(
          store.banques
            .filter((row) => row.isActive === args.where.isActive)
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder || a.shortName.localeCompare(b.shortName))
            .map((row) => ({ id: row.id, shortName: row.shortName })),
        ),
    },
    syndicat: {
      findMany: (args: ReferentialFindManyArgs) =>
        Promise.resolve(
          store.syndicats
            .filter((row) => row.isActive === args.where.isActive)
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder || a.sigle.localeCompare(b.sigle))
            .map((row) => ({ id: row.id, sigle: row.sigle })),
        ),
    },
    representant: {
      findMany: (args: RepresentantFindManyArgs) =>
        Promise.resolve(
          store.representants
            .filter((row) => row.deletedAt === null && row.isDemo === args.where.isDemo)
            .map((row) => ({ id: row.id, phoneE164: row.phoneE164 })),
        ),
    },
    prospect: {
      findMany: (args: ProspectFindManyArgs) =>
        Promise.resolve(
          store.prospects
            .filter(
              (row) => row.deletedAt === null && args.where.phoneE164.in.includes(row.phoneE164),
            )
            .map((row) => ({ phoneE164: row.phoneE164, representantId: row.representantId })),
        ),
      createMany: (args: ProspectCreateManyArgs) => {
        let count = 0;
        for (const row of args.data) {
          assertEnrollmentCheck(row);
          const taken =
            store.racingPhones.includes(row.phoneE164) ||
            store.prospects.some(
              (existing) => existing.deletedAt === null && existing.phoneE164 === row.phoneE164,
            );
          if (taken) {
            if (args.skipDuplicates === true) continue;
            throw new Error(`P2002: prospects_phone_e164_active_key (${row.phoneE164})`);
          }
          store.prospects.push({ ...row, deletedAt: null });
          count += 1;
        }
        return Promise.resolve({ count });
      },
    },
  };

  return {
    jobId: over.jobId ?? 'job-1',
    mode: over.mode ?? ImportMode.APPLY,
    requestedById: over.requestedById ?? 'user-admin',
    tx: tx as unknown as ImportRunContext['tx'],
  };
}

function assertEnrollmentCheck(row: FakeProspectCreate): void {
  const obtained = row.phase2Status === Phase2Status.METHOD_OBTAINED;
  const hasMethod = row.enrollmentMethod !== null;
  if (obtained !== hasMethod) {
    throw new Error(
      `CHECK prospects_enrollment_method_matches_status violée : phase2Status=${row.phase2Status}, enrollmentMethod=${String(row.enrollmentMethod)}`,
    );
  }
}
