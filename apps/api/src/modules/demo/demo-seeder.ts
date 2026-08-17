import { argon2id, hash } from 'argon2';
import { DEMO_DATASET, Prisma } from '@crm/database';

import type { DemoRegistry } from './demo-registry.js';

// Mêmes paramètres que `packages/database/src/seed.ts` et que la vérification à la connexion : un
// écart rendrait les comptes de démonstration inutilisables, et ne se verrait qu'en démonstration.
const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const daysAgoToDate = (days: number): Date => new Date(Date.now() - days * 86_400_000);

const referenceKeyOf = (reference: string): string =>
  reference.toUpperCase().replace(/\s+/g, ' ').trim();

/**
 * Toute ligne créée ici doit être passée au `registry` : non tracée, la purge ne la retire jamais.
 * Les référentiels (banques, syndicats, départements, étapes, motifs) sont seulement RÉFÉRENCÉS,
 * résolus par clé naturelle, jamais créés ni modifiés : ce sont des données de plateforme.
 */
export async function seedDemoData(
  tx: Prisma.TransactionClient,
  registry: DemoRegistry,
): Promise<void> {
  const [departements, banques, syndicats, stages, reasons] = await Promise.all([
    tx.departement.findMany({ select: { id: true, code: true } }),
    tx.banque.findMany({ select: { id: true, shortName: true } }),
    tx.syndicat.findMany({ select: { id: true, sigle: true } }),
    tx.bankCaseStage.findMany({ select: { id: true, code: true } }),
    tx.bankRejectionReason.findMany({ select: { id: true, code: true } }),
  ]);

  const depByCode = new Map(departements.map((d) => [d.code, d.id]));
  const banqueByShort = new Map(banques.map((b) => [b.shortName, b.id]));
  const syndicatBySigle = new Map(syndicats.map((s) => [s.sigle, s.id]));
  const stageByCode = new Map(stages.map((s) => [s.code, s.id]));
  const reasonByCode = new Map(reasons.map((r) => [r.code, r.id]));

  const need = <T>(map: Map<string, T>, key: string, kind: string): T => {
    const value = map.get(key);
    if (value === undefined) {
      throw new Error(
        `Référentiel manquant : ${kind} « ${key} ». Lancez d’abord \`pnpm db:seed\`.`,
      );
    }
    return value;
  };

  const userIdByKey = new Map<string, string>();
  const repIdByKey = new Map<string, string>();
  const prospectIdByKey = new Map<string, string>();

  for (const spec of DEMO_DATASET.users) {
    const passwordHash = (await hash(spec.password, ARGON2_OPTIONS)) as string;
    const created = await tx.user.create({
      data: {
        isDemo: true,
        email: spec.email,
        username: spec.username,
        fullName: spec.fullName,
        passwordHash,
        role: spec.role,
        phoneE164: spec.phoneE164,
        isActive: true,
        ...(spec.departementCode
          ? { departementId: need(depByCode, spec.departementCode, 'département') }
          : {}),
        ...(spec.lastLoginDaysAgo === null
          ? {}
          : { lastLoginAt: daysAgoToDate(spec.lastLoginDaysAgo) }),
      },
      select: { id: true },
    });
    registry.record('user', created.id);
    userIdByKey.set(spec.key, created.id);
  }

  const userId = (key: string): string => need(userIdByKey, key, 'compte de démonstration');

  for (const spec of DEMO_DATASET.representants) {
    const at = daysAgoToDate(spec.daysAgo);
    const created = await tx.representant.create({
      data: {
        isDemo: true,
        id: crypto.randomUUID(),
        fullName: spec.fullName,
        phoneE164: spec.phoneE164,
        departementId: need(depByCode, spec.departementCode, 'département'),
        createdById: userId(spec.createdByKey),
        ...(spec.notes === null ? {} : { notes: spec.notes }),
        clientCreatedAt: at,
        createdAt: at,
      },
      select: { id: true },
    });
    registry.record('representant', created.id);
    repIdByKey.set(spec.key, created.id);
  }

  for (const spec of DEMO_DATASET.prospects) {
    const at = daysAgoToDate(spec.daysAgo);
    const created = await tx.prospect.create({
      data: {
        isDemo: true,
        id: crypto.randomUUID(),
        nom: spec.nom,
        prenom: spec.prenom,
        phoneE164: spec.phoneE164,
        representantId: need(repIdByKey, spec.representantKey, 'représentant'),
        banqueId: need(banqueByShort, spec.banqueShortName, 'banque'),
        syndicatId: need(syndicatBySigle, spec.syndicatSigle, 'syndicat'),
        createdById: userId(spec.createdByKey),
        statut: spec.statut,
        phase2Status: spec.phase2Status,
        // Contrainte CHECK : méthode présente si et seulement si le statut vaut METHOD_OBTAINED.
        ...(spec.enrollmentMethod === null ? {} : { enrollmentMethod: spec.enrollmentMethod }),
        ...(spec.enrollmentDaysAgo === null
          ? {}
          : {
              enrollmentCapturedAt: daysAgoToDate(spec.enrollmentDaysAgo),
              enrollmentCapturedById: userId(spec.createdByKey),
            }),
        clientCreatedAt: at,
        createdAt: at,
      },
      select: { id: true },
    });
    registry.record('prospect', created.id);
    prospectIdByKey.set(spec.key, created.id);
  }

  const prospectId = (key: string): string => need(prospectIdByKey, key, 'prospect');

  for (const campaign of DEMO_DATASET.campaigns) {
    const created = await tx.callCampaign.create({
      data: {
        isDemo: true,
        name: campaign.name,
        scope: campaign.scope,
        seed: campaign.seed,
        status: campaign.status,
        createdById: userId(campaign.createdByKey),
        createdAt: daysAgoToDate(campaign.daysAgo),
        ...(campaign.closedDaysAgo === null
          ? {}
          : { closedAt: daysAgoToDate(campaign.closedDaysAgo) }),
      },
      select: { id: true },
    });
    registry.record('callCampaign', created.id);

    for (const [position, key] of campaign.commerciauxKeys.entries()) {
      const membership = await tx.callCampaignCommercial.create({
        data: { campaignId: created.id, userId: userId(key), position },
        select: { id: true },
      });
      registry.record('callCampaignCommercial', membership.id);
    }

    for (const task of campaign.tasks) {
      // Index unique partiel « une seule tâche active par prospect » : le jeu de données l'assure.
      const createdTask = await tx.callTask.create({
        data: {
          isDemo: true,
          campaignId: created.id,
          prospectId: prospectId(task.prospectKey),
          assignedToId: userId(task.assignedToKey),
          position: task.position,
          status: task.status,
          isActive: task.isActive,
          ...(task.completedDaysAgo === null
            ? {}
            : { completedAt: daysAgoToDate(task.completedDaysAgo) }),
        },
        select: { id: true },
      });
      registry.record('callTask', createdTask.id);

      for (const attempt of task.attempts) {
        const at = daysAgoToDate(attempt.daysAgo);
        const createdAttempt = await tx.callAttempt.create({
          data: {
            isDemo: true,
            id: crypto.randomUUID(),
            prospectId: prospectId(attempt.prospectKey),
            taskId: createdTask.id,
            campaignId: created.id,
            performedById: userId(attempt.performedByKey),
            outcome: attempt.outcome,
            ...(attempt.method === null ? {} : { method: attempt.method }),
            ...(attempt.comment === null ? {} : { comment: attempt.comment }),
            clientCreatedAt: at,
            createdAt: at,
          },
          select: { id: true },
        });
        registry.record('callAttempt', createdAttempt.id);
      }
    }
  }

  for (const spec of DEMO_DATASET.bankCases) {
    const linked = prospectId(spec.prospectKey);
    const prospect = await tx.prospect.findUniqueOrThrow({
      where: { id: linked },
      select: { nom: true, prenom: true, phoneE164: true },
    });

    const created = await tx.bankCase.create({
      data: {
        isDemo: true,
        reference: spec.reference,
        referenceKey: referenceKeyOf(spec.reference),
        prospectId: linked,
        // Identité COPIÉE : un dossier bancaire est une pièce historique, il doit continuer de
        // refléter ce qui a été transmis à la banque même si la fiche prospect est corrigée après.
        customerName: `${prospect.prenom} ${prospect.nom}`,
        customerPhoneE164: prospect.phoneE164,
        processingBankId: need(banqueByShort, spec.processingBankShortName, 'banque'),
        currentStageId: need(stageByCode, spec.currentStageCode, 'étape bancaire'),
        ...(spec.amountXof === null ? {} : { amountXof: new Prisma.Decimal(spec.amountXof) }),
        ...(spec.rejectionReasonCode === null
          ? {}
          : { rejectionReasonId: need(reasonByCode, spec.rejectionReasonCode, 'motif de rejet') }),
        ...(spec.rejectionDetail === null ? {} : { rejectionDetail: spec.rejectionDetail }),
        createdById: userId(spec.createdByKey),
        ...(spec.updatedByKey === null ? {} : { updatedById: userId(spec.updatedByKey) }),
        createdAt: daysAgoToDate(spec.daysAgo),
      },
      select: { id: true },
    });
    registry.record('bankCase', created.id);

    for (const transition of spec.transitions) {
      const createdTransition = await tx.bankCaseTransition.create({
        data: {
          isDemo: true,
          caseId: created.id,
          ...(transition.fromStageCode === null
            ? {}
            : { fromStageId: need(stageByCode, transition.fromStageCode, 'étape bancaire') }),
          toStageId: need(stageByCode, transition.toStageCode, 'étape bancaire'),
          performedById: userId(transition.performedByKey),
          ...(transition.amountXof === null
            ? {}
            : { amountXof: new Prisma.Decimal(transition.amountXof) }),
          ...(transition.rejectionReasonCode === null
            ? {}
            : {
                rejectionReasonId: need(
                  reasonByCode,
                  transition.rejectionReasonCode,
                  'motif de rejet',
                ),
              }),
          ...(transition.rejectionDetail === null
            ? {}
            : { rejectionDetail: transition.rejectionDetail }),
          ...(transition.comment === null ? {} : { comment: transition.comment }),
          createdAt: daysAgoToDate(transition.daysAgo),
        },
        select: { id: true },
      });
      registry.record('bankCaseTransition', createdTransition.id);
    }
  }
}
