/**
 * Seed idempotent : conçu pour être relancé sur une base déjà peuplée sans
 * jamais dupliquer ni écraser des données de production.
 *
 * Chaque entité est écrite en `upsert` sur sa clé naturelle (`code`, `name`,
 * `sigle`), pas sur son identifiant : les identifiants sont générés et ne sont
 * donc pas stables entre deux environnements.
 *
 * Les référentiels ne sont jamais SUPPRIMÉS ici. Une banque retirée de la liste
 * BCEAO peut rester référencée par des prospects existants ; la désactiver
 * (`isActive = false`) est l'affaire de l'admin, depuis le panel web.
 */
import { argon2id, hash } from 'argon2';

import {
  BANK_REJECTION_REASONS,
  BANK_STAGES,
  BANQUES_SENEGAL,
  DEPARTEMENT_COUNT,
  PrismaClient,
  PrismaPg,
  IEFS,
  REGIONS_SENEGAL,
  Role,
  SYNDICATS_SENEGAL,
} from './index.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://crm:crm@localhost:5434/crm',
  }),
});

// Mêmes paramètres que la vérification à la connexion. Un écart ici rendrait
// le mot de passe de l'admin initial invérifiable.
const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

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
        // `isActive` est délibérément absent : un département désactivé par
        // l'admin ne doit pas être réactivé par un simple re-seed.
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

/**
 * Les IEF, rattachées à leur département par son CODE.
 *
 * Le code et non le libellé : la matrice nationale écrit « Birkilane » là où la
 * feuille de route régionale et l'orthographe officielle écrivent
 * « Birkelane ». Un rattachement par libellé aurait donc échoué sur ce seul
 * département, et l'échec se serait lu comme « IEF manquante » plutôt que
 * comme « les deux sources ne s'accordent pas sur un nom ».
 */
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
      // Même raison que pour les départements : `isActive` n'est pas réécrit.
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

async function seedBankWorkflow(): Promise<void> {
  for (const stage of BANK_STAGES) {
    await prisma.bankCaseStage.upsert({
      where: { code: stage.code },
      create: stage,
      // `isActive` est absent de l'update : une étape intermédiaire désactivée
      // par l'admin ne doit pas être réactivée par un simple re-seed.
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
    // On ne réécrit JAMAIS le mot de passe d'un compte existant : un re-seed
    // en production remettrait le mot de passe de l'administrateur à la valeur
    // du fichier .env, silencieusement.
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

async function main(): Promise<void> {
  console.info('Seed CPI GO');
  await seedGeography();
  await seedBanques();
  await seedSyndicats();
  await seedBankWorkflow();
  await seedAdmin();
  console.info('Seed terminé.');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
