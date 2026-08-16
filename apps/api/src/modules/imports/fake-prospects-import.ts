import { ImportMode, Phase2Status } from '@crm/database';
import type { EnrollmentMethod } from '@crm/database';

import type { ImportRunContext } from './import-adapter.js';

/**
 * Doublure Prisma en mémoire pour l'import prospects.
 *
 * POURQUOI UNE DOUBLURE QUI *APPLIQUE LES CONTRAINTES* PLUTÔT QUE DES `vi.fn()`.
 *
 * Ce que l'adaptateur doit prouver n'est pas qu'il appelle Prisma, c'est qu'il
 * ne peut PAS produire une ligne que PostgreSQL refuserait. Une doublure qui
 * accepterait tout laisserait passer les deux fautes exactes que ce module
 * existe pour empêcher : une méthode d'enrôlement incohérente avec le statut de
 * phase 2, et un doublon de téléphone sur une fiche vivante. Les tests
 * seraient verts et la production tomberait à la première tranche.
 *
 * Cette doublure rejoue donc les deux invariants que la migration pose en dur :
 *   - le CHECK `prospects_enrollment_method_matches_status` ;
 *   - l'index unique partiel `prospects_phone_e164_active_key`, dont
 *     `skipDuplicates` est la contrepartie applicative.
 *
 * Ce qu'elle ne prétend PAS faire : exécuter du SQL, ordonner comme
 * PostgreSQL, ou remplacer un test d'intégration sur les clés étrangères. Elle
 * rend seulement testable, sans base, la logique pure d'analyse de ligne et les
 * quatre familles de doublons.
 */

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
  /**
   * Numéros saisis par un commercial ENTRE notre lecture et notre écriture.
   *
   * C'est le seul moyen de reproduire la troisième famille de doublons : la
   * relecture ne les voit pas, l'index unique partiel les refuse. Sans ce
   * levier, `skipDuplicates` ne serait jamais exercé et le comptage de
   * `skipped` ne serait vérifié par rien — or c'est précisément le comptage
   * qui empêche le rapport d'annoncer des créations qui n'ont pas eu lieu.
   */
  racingPhones: string[];
}

/** Numéros du jeu par défaut, en E.164 pour ne pas dépendre de la normalisation. */
export const FAKE_REPRESENTANT_PHONE = '+221769876543';
export const FAKE_OTHER_REPRESENTANT_PHONE = '+221701112233';

/**
 * Jeu minimal mais réaliste : deux banques et deux syndicats, choisis pour
 * couvrir les DEUX axes du segment BDD (CBAO / non-CBAO, CHUES / non-CHUES).
 * Un jeu à une seule banque laisserait croire que le rapprochement exact est
 * sans conséquence.
 */
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

/** Fiche déjà en base, pour éprouver les doublons contre l'existant. */
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

/**
 * Contexte d'exécution complet, doublure comprise.
 *
 * Le `tx` est converti par `as unknown as` : la doublure n'implémente
 * volontairement que les cinq accès dont l'adaptateur se sert, et prétendre
 * implémenter tout le client Prisma obligerait à écrire des centaines de
 * méthodes qui ne seraient jamais appelées. Le jour où l'adaptateur touche à
 * une sixième table, l'exécution échoue immédiatement sur un accès indéfini,
 * ce qui est le bon signal : la doublure doit suivre, pas être contournée.
 */
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
          // L'index est PARTIEL : il ne contraint que les lignes vivantes.
          // Une fiche supprimée logiquement libère donc son numéro, et la
          // doublure doit le refléter, sinon elle interdirait une ressaisie
          // que la base autorise.
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

/**
 * Rejoue `prospects_enrollment_method_matches_status`.
 *
 * La contrainte est posée en base précisément pour qu'aucun chemin d'écriture
 * ne puisse la contourner ; une doublure qui l'ignorerait rendrait le test
 * aveugle au seul cas où l'adaptateur ferait échouer toute une tranche.
 */
function assertEnrollmentCheck(row: FakeProspectCreate): void {
  const obtained = row.phase2Status === Phase2Status.METHOD_OBTAINED;
  const hasMethod = row.enrollmentMethod !== null;
  if (obtained !== hasMethod) {
    throw new Error(
      `CHECK prospects_enrollment_method_matches_status violée : phase2Status=${row.phase2Status}, enrollmentMethod=${String(row.enrollmentMethod)}`,
    );
  }
}
