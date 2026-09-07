import { createHash } from 'node:crypto';

import { generateDemoVolume } from './demo-volume.js';
import { GrandPublicConsent, Projet, ProspectType, type PrismaClient } from '@prisma/client';

export const DEMO_SEED_SETTING = 'demo.seed.version';
export const DEMO_SEED_VERSION = '4';

const MIRRORED_TABLES = [
  'regions',
  'departements',
  'iefs',
  'banques',
  'syndicats',
  'canaux_provenance',
  'professions',
  'income_bands',
  'offers',
  'bank_case_stages',
  'bank_rejection_reasons',
  'call_outcome_reasons',
  'statuts_qualification',
  'pays',
  'employeurs',
  'visite_entreprises',
  'visite_directions',
  'visite_destinataires',
  'visite_objets',
  'users',
] as const;

export function demoId(key: string): string {
  const hex = createHash('sha256').update(`cpi-demo:${key}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function demoProspectProfil(
  grandPublic: boolean,
  banque: { id: string } | null | undefined,
  syndicat: { id: string } | null | undefined,
  representant: { id: string } | null | undefined,
) {
  if (grandPublic) {
    return {
      prenom: 'Grand Public',
      projet: Projet.GRAND_PUBLIC,
      type: ProspectType.INFORMEL,
      profession: 'Activité de démonstration',
      banqueId: null,
      syndicatId: null,
      representantId: null,
    };
  }
  return {
    prenom: 'CHUES',
    projet: Projet.CHUES,
    type: null,
    profession: null,
    banqueId: banque?.id ?? null,
    syndicatId: syndicat?.id ?? null,
    representantId: representant?.id ?? null,
  };
}

export class DemoWorkspaceFactory {
  constructor(private readonly demoDb: PrismaClient) {}

  async reset(now = new Date()): Promise<void> {
    await this.demoDb.$executeRawUnsafe(`
      DO $$
      DECLARE row record;
      BEGIN
        FOR row IN
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'demo' AND tablename <> '_prisma_migrations'
        LOOP
          EXECUTE format('TRUNCATE TABLE demo.%I CASCADE', row.tablename);
        END LOOP;
      END $$
    `);

    for (const table of MIRRORED_TABLES) {
      await this.demoDb.$executeRawUnsafe(
        `INSERT INTO demo."${table}" SELECT (json_populate_record(NULL::demo."${table}", row_to_json(source))).* FROM public."${table}" source`,
      );
    }

    await this.createSample(now);
  }

  private async createSample(now: Date): Promise<void> {
    const [author, departement, banque, syndicat, stage] = await Promise.all([
      this.demoDb.user.findFirst({
        where: { isActive: true, deletedAt: null },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      }),
      this.demoDb.departement.findFirst({ orderBy: { code: 'asc' } }),
      this.demoDb.banque.findFirst({ orderBy: { shortName: 'asc' } }),
      this.demoDb.syndicat.findFirst({ orderBy: { sigle: 'asc' } }),
      this.demoDb.bankCaseStage.findFirst({ orderBy: { position: 'asc' } }),
    ]);
    if (!author || !departement) return;

    const createdAt = new Date(now.getTime() - 7 * 86_400_000);
    const representatives = Array.from({ length: 8 }, (_, index) => ({
      id: demoId(`representant:${String(index)}`),
      fullName: `Représentant Démo ${String(index + 1).padStart(2, '0')}`,
      phoneE164: `+22177010${String(index + 1).padStart(4, '0')}`,
      departementId: departement.id,
      createdById: author.id,
      clientCreatedAt: createdAt,
      createdAt,
    }));
    await this.demoDb.representant.createMany({ data: representatives });

    const prospects = Array.from({ length: 16 }, (_, index) => {
      const grandPublic = index >= 8;
      return {
        id: demoId(`prospect:${String(index)}`),
        nom: `Prospect Démo ${String(index + 1).padStart(2, '0')}`,
        phoneE164: `+22177020${String(index + 1).padStart(4, '0')}`,
        ...demoProspectProfil(grandPublic, banque, syndicat, representatives[index]),
        createdById: author.id,
        clientCreatedAt: new Date(createdAt.getTime() + index * 3_600_000),
        createdAt: new Date(createdAt.getTime() + index * 3_600_000),
      };
    });
    await this.demoDb.prospect.createMany({ data: prospects });
    await this.demoDb.prospectJourney.createMany({
      data: prospects.map((prospect) => ({
        id: demoId(`journey:${prospect.id}:${prospect.projet}`),
        prospectId: prospect.id,
        projet: prospect.projet,
        consent:
          prospect.projet === Projet.GRAND_PUBLIC
            ? GrandPublicConsent.INTERESSE
            : GrandPublicConsent.NON_DEMANDE,
        consentAt: prospect.projet === Projet.GRAND_PUBLIC ? prospect.createdAt : null,
      })),
    });

    if (banque && stage) {
      await this.demoDb.bankCase.createMany({
        data: prospects.slice(0, 3).map((prospect, index) => ({
          id: demoId(`bank-case:${String(index)}`),
          reference: `DEMO-${String(index + 1).padStart(3, '0')}`,
          referenceKey: `DEMO-${String(index + 1).padStart(3, '0')}`,
          prospectId: prospect.id,
          customerName: `${prospect.prenom} ${prospect.nom}`,
          customerPhoneE164: prospect.phoneE164,
          processingBankId: banque.id,
          currentStageId: stage.id,
          createdById: author.id,
          createdAt,
        })),
      });
    }

    await generateDemoVolume(this.demoDb);

    await this.demoDb.appSetting.create({
      data: { key: DEMO_SEED_SETTING, value: DEMO_SEED_VERSION },
    });
  }
}
