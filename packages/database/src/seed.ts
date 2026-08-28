import { argon2id, hash } from 'argon2';

import {
  BANK_REJECTION_REASONS,
  BANK_STAGES,
  BANQUES_SENEGAL,
  CALL_OUTCOME_REASONS,
  CANAUX_PROVENANCE,
  DEPARTEMENT_COUNT,
  PrismaClient,
  PrismaPg,
  IEFS,
  INCOME_BANDS,
  OFFERS,
  PROFESSIONS_SENEGAL,
  REGIONS_SENEGAL,
  Role,
  SYNDICATS_SENEGAL,
  VISITE_DESTINATAIRES,
  VISITE_DIRECTIONS,
  VISITE_ENTREPRISES,
  VISITE_OBJETS,
} from './index.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://crm:crm@localhost:5434/crm',
  }),
});

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const FIXTURE_USERS = [
  {
    email: 'fixture.awa@cpi.sn',
    username: 'fixture.awa',
    fullName: 'Awa Fixture',
    role: Role.COMMERCIAL,
  },
  {
    email: 'fixture.fatou@cpi.sn',
    username: 'fixture.fatou',
    fullName: 'Fatou Fixture',
    role: Role.COMMERCIAL,
  },
  {
    email: 'fixture.banque@cpi.sn',
    username: 'fixture.banque',
    fullName: 'Moussa Fixture',
    role: Role.BANQUE_FINANCE,
  },
  {
    email: 'fixture.superviseur@cpi.sn',
    username: 'fixture.superviseur',
    fullName: 'Superviseur Fixture',
    role: Role.SUPERVISEUR,
  },
  {
    email: 'fixture.direction@cpi.sn',
    username: 'fixture.direction',
    fullName: 'Direction Fixture',
    role: Role.DIRECTION,
  },
  {
    email: 'fixture.accueil@cpi.sn',
    username: 'fixture.accueil',
    fullName: 'Accueil Fixture',
    role: Role.ACCUEIL,
  },
] as const;

async function seedGeography(): Promise<void> {
  for (const region of REGIONS_SENEGAL) {
    const saved = await prisma.region.upsert({
      where: { code: region.code },
      create: { code: region.code, name: region.name },
      update: { name: region.name },
    });

    for (const departement of region.departements) {
      await prisma.departement.upsert({
        where: { code: departement.code },
        create: { code: departement.code, name: departement.name, regionId: saved.id },
        update: { name: departement.name, regionId: saved.id },
      });
    }
  }

  const count = await prisma.departement.count();
  if (count < DEPARTEMENT_COUNT) {
    throw new Error(`Seed géographique incomplet : ${String(count)}/${String(DEPARTEMENT_COUNT)}`);
  }
  console.info(`  régions : ${String(REGIONS_SENEGAL.length)} · départements : ${String(count)}`);

  await seedIefs();
}

async function seedIefs(): Promise<void> {
  const departements = await prisma.departement.findMany({ select: { id: true, code: true } });
  const byCode = new Map(departements.map((row) => [row.code, row.id]));

  for (const ief of IEFS) {
    const departementId = byCode.get(ief.departementCode);
    if (departementId === undefined) {
      throw new Error(`IEF ${ief.code} : département ${ief.departementCode} introuvable`);
    }

    await prisma.ief.upsert({
      where: { code: ief.code },
      create: { code: ief.code, name: ief.name, departementId },
      update: { name: ief.name, departementId },
    });
  }

  const count = await prisma.ief.count();
  if (count < IEFS.length) {
    throw new Error(`Seed IEF incomplet : ${String(count)}/${String(IEFS.length)}`);
  }
  console.info(`  IEF : ${String(count)}`);
}

async function seedBanques(): Promise<void> {
  for (const banque of BANQUES_SENEGAL) {
    await prisma.banque.upsert({
      where: { name: banque.name },
      create: banque,
      update: { shortName: banque.shortName, sortOrder: banque.sortOrder },
    });
  }
  console.info(`  banques : ${String(BANQUES_SENEGAL.length)}`);
}

async function seedSyndicats(): Promise<void> {
  for (const syndicat of SYNDICATS_SENEGAL) {
    await prisma.syndicat.upsert({
      where: { sigle: syndicat.sigle },
      create: syndicat,
      update: {
        name: syndicat.name,
        secteur: syndicat.secteur,
        sortOrder: syndicat.sortOrder,
      },
    });
  }
  console.info(`  syndicats : ${String(SYNDICATS_SENEGAL.length)}`);
}

async function seedCanauxProvenance(): Promise<void> {
  for (const canal of CANAUX_PROVENANCE) {
    await prisma.canalProvenance.upsert({
      where: { code: canal.code },
      // Le `code` n'est jamais reecrit : il identifie le canal sur les fiches.
      create: canal,
      update: { label: canal.label, position: canal.position },
    });
  }
  console.info(`  canaux de provenance : ${String(CANAUX_PROVENANCE.length)}`);
}

async function seedProspectReferentiels(): Promise<void> {
  for (const profession of PROFESSIONS_SENEGAL) {
    await prisma.profession.upsert({
      where: { code: profession.code },
      create: profession,
      update: {
        label: profession.label,
        isTeaching: profession.isTeaching,
        position: profession.position,
      },
    });
  }
  for (const band of INCOME_BANDS) {
    await prisma.incomeBand.upsert({
      where: { code: band.code },
      create: band,
      update: {
        label: band.label,
        minXof: band.minXof,
        maxXof: band.maxXof,
        position: band.position,
      },
    });
  }
  for (const offer of OFFERS) {
    await prisma.offer.upsert({
      where: { code: offer.code },
      create: offer,
      update: {
        label: offer.label,
        description: offer.description,
        position: offer.position,
      },
    });
  }
  console.info(
    `  professions : ${String(PROFESSIONS_SENEGAL.length)} · revenus : ${String(INCOME_BANDS.length)} · offres : ${String(OFFERS.length)}`,
  );
}

async function seedBankWorkflow(): Promise<void> {
  for (const stage of BANK_STAGES) {
    await prisma.bankCaseStage.upsert({
      where: { code: stage.code },
      create: stage,
      update: {
        label: stage.label,
        position: stage.position,
        color: stage.color,
        type: stage.type,
        isInitial: stage.isInitial,
        isSystem: stage.isSystem,
      },
    });
  }

  for (const reason of BANK_REJECTION_REASONS) {
    await prisma.bankRejectionReason.upsert({
      where: { code: reason.code },
      create: reason,
      update: { label: reason.label, sortOrder: reason.sortOrder },
    });
  }

  console.info(
    `  workflow bancaire : ${String(BANK_STAGES.length)} \u00e9tapes \u00b7 ` +
      `${String(BANK_REJECTION_REASONS.length)} motifs de rejet`,
  );
}

async function seedCallOutcomes(): Promise<void> {
  for (const reason of CALL_OUTCOME_REASONS) {
    await prisma.callOutcomeReason.upsert({
      where: { code: reason.code },
      // `minPayloadVersion` a 1: seuls ces six motifs sont emettables par les
      // telephones deja deployes.
      create: { ...reason, isSystem: true, minPayloadVersion: 1 },
      update: {
        label: reason.label,
        effect: reason.effect,
        requiresComment: reason.requiresComment,
        requiresCallback: reason.requiresCallback,
        countsAsReached: reason.countsAsReached,
        color: reason.color,
        sortOrder: reason.sortOrder,
        isSystem: true,
        minPayloadVersion: 1,
      },
    });
  }
  console.info(`  issues d'appel : ${String(CALL_OUTCOME_REASONS.length)} motifs systeme`);
}

async function seedVisiteReferentiels(): Promise<void> {
  for (const entreprise of VISITE_ENTREPRISES) {
    await prisma.visiteEntreprise.upsert({
      where: { code: entreprise.code },
      create: { ...entreprise, isSystem: true },
      update: { label: entreprise.label, sortOrder: entreprise.sortOrder, isSystem: true },
    });
  }

  for (const direction of VISITE_DIRECTIONS) {
    await prisma.visiteDirection.upsert({
      where: { code: direction.code },
      create: { ...direction, isSystem: true },
      update: { label: direction.label, sortOrder: direction.sortOrder, isSystem: true },
    });
  }

  for (const destinataire of VISITE_DESTINATAIRES) {
    await prisma.visiteDestinataire.upsert({
      where: { code: destinataire.code },
      create: { ...destinataire, isSystem: true },
      update: { label: destinataire.label, sortOrder: destinataire.sortOrder, isSystem: true },
    });
  }

  for (const objet of VISITE_OBJETS) {
    await prisma.visiteObjet.upsert({
      where: { code: objet.code },
      create: { ...objet, isSystem: true },
      update: { label: objet.label, sortOrder: objet.sortOrder, isSystem: true },
    });
  }

  console.info(
    `  registre des visites : ${String(VISITE_ENTREPRISES.length)} entreprises · ` +
      `${String(VISITE_DIRECTIONS.length)} directions · ` +
      `${String(VISITE_DESTINATAIRES.length)} destinataires · ` +
      `${String(VISITE_OBJETS.length)} objets`,
  );
}

async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_FULL_NAME ?? 'Administrateur CPI';

  if (!email || !username || !password) {
    console.warn('  admin : ignoré (SEED_ADMIN_EMAIL / _USERNAME / _PASSWORD absents)');
    return;
  }
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD doit faire au moins 12 caractères.');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.info(`  admin : ${email} existe déjà, inchangé`);
    return;
  }

  const passwordHash = String(await hash(password, ARGON2_OPTIONS));

  await prisma.user.create({
    data: {
      email,
      username,
      fullName,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });
  console.info(`  admin : ${email} créé`);
}

async function seedFixtureUsers(): Promise<void> {
  const password = process.env.SEED_FIXTURE_PASSWORD ?? 'ChangeMoi123456';
  if (password.length < 12) {
    throw new Error('SEED_FIXTURE_PASSWORD doit faire au moins 12 caractères.');
  }

  const passwordHash = String(await hash(password, ARGON2_OPTIONS));

  for (const fixture of FIXTURE_USERS) {
    await prisma.user.upsert({
      where: { email: fixture.email },
      create: { ...fixture, passwordHash, isActive: true },
      update: {
        username: fixture.username,
        fullName: fixture.fullName,
        role: fixture.role,
        passwordHash,
        isActive: true,
      },
    });
  }

  console.info(`  fixtures : ${String(FIXTURE_USERS.length)} comptes prêts`);
}

async function main(): Promise<void> {
  console.info('Seed CPI GO');
  await seedGeography();
  await seedBanques();
  await seedSyndicats();
  await seedCanauxProvenance();
  await seedProspectReferentiels();
  await seedBankWorkflow();
  await seedCallOutcomes();
  await seedVisiteReferentiels();
  await seedAdmin();
  await seedFixtureUsers();
  console.info('Seed terminé.');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
