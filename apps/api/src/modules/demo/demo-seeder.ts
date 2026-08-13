import { argon2id, hash } from 'argon2';
import { DEMO_DATASET, Prisma } from '@crm/database';

import type { DemoRegistry } from './demo-registry.js';

/**
 * Mêmes paramètres que `packages/database/src/seed.ts` et que la vérification à
 * la connexion. Un écart rendrait les comptes de démonstration inutilisables —
 * et le défaut ne se verrait qu'en pleine démonstration.
 */
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
 * Ensemence la base à partir de `DEMO_DATASET`.
 *
 * Deux invariants gouvernent cette fonction :
 *
 * 1. **Tout ce qui est créé est enregistré dans le registre.** Une ligne créée
 *    sans être tracée ne serait jamais retirée à la désactivation et
 *    subsisterait indéfiniment parmi les données réelles.
 *
 * 2. **Aucun référentiel n'est créé ni modifié.** Banques, syndicats,
 *    départements, étapes bancaires et motifs de rejet sont des données de
 *    plateforme partagées : la démonstration les RÉFÉRENCE, résolus par clé
 *    naturelle, et n'y touche jamais.
 */
export async function seedDemoData(
  tx: Prisma.TransactionClient,
  registry: DemoRegistry,
): Promise<void> {
  // ── Référentiels : lecture seule, résolution par clé naturelle ────────────
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

  /**
   * Échec explicite plutôt que silencieux : une clé absente signifie que le
   * seed de référentiels n'a pas tourné. Mieux vaut le dire tout de suite que
   * produire une démonstration à trous devant un auditoire.
   */
  const need = <T>(map: Map<string, T>, key: string, kind: string): T => {
    const value = map.get(key);
    if (value === undefined) {
      throw new Error(
        `Référentiel manquant : ${kind} « ${key} ». Lancez d’abord \`pnpm db:seed\`.`,
      );
    }
    return value;
  };

  // Les clés du jeu de données sont LOCALES : elles ne servent qu'à relier les
  // entités entre elles ici, et ne sont jamais persistées. Ces tables les
  // traduisent en identifiants réels au fil de l'écriture.
  const userIdByKey = new Map<string, string>();
  const repIdByKey = new Map<string, string>();
  const prospectIdByKey = new Map<string, string>();

  // ── Utilisateurs ──────────────────────────────────────────────────────────
  for (const spec of DEMO_DATASET.users) {
    // La surcharge d'`argon2.hash` retenue ici résout en `any` : l'assertion
    // est nécessaire, une simple annotation reste une affectation aveugle aux
    // yeux du lint. `hash` rend bien une chaîne dans cette forme d'appel.
    const passwordHash = (await hash(spec.password, ARGON2_OPTIONS)) as string;
    const created = await tx.user.create({
      data: {
        // Taguée : c'est ce drapeau, et lui seul, qui décide de la
        // visibilité de la ligne selon l'état du mode démonstration.
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

  // ── Représentants ─────────────────────────────────────────────────────────
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

  // ── Prospects ─────────────────────────────────────────────────────────────
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
        // La contrainte CHECK impose : méthode présente si et seulement si le
        // statut vaut METHOD_OBTAINED. Le jeu de données la respecte déjà ; on
        // se contente de transmettre ce qu'il décrit.
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

  // ── Campagnes, tâches et tentatives ───────────────────────────────────────
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

    // L'index dans `commerciauxKeys` EST la position dans le round-robin :
    // c'est ce qui fixe le contenu de chaque programme PDF.
    for (const [position, key] of campaign.commerciauxKeys.entries()) {
      const membership = await tx.callCampaignCommercial.create({
        data: { campaignId: created.id, userId: userId(key), position },
        select: { id: true },
      });
      registry.record('callCampaignCommercial', membership.id);
    }

    for (const task of campaign.tasks) {
      const createdTask = await tx.callTask.create({
        data: {
          isDemo: true,
          campaignId: created.id,
          prospectId: prospectId(task.prospectKey),
          assignedToId: userId(task.assignedToKey),
          position: task.position,
          status: task.status,
          // Porte l'index unique partiel « une seule tâche active par
          // prospect » : le jeu de données garantit déjà l'unicité.
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
            // Le commercial qui a RÉELLEMENT appelé, distinct de l'assigné :
            // n'importe quel commercial peut compléter un numéro de l'annuaire.
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

  // ── Dossiers bancaires et leur historique ─────────────────────────────────
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
        // Identité COPIÉE : un dossier bancaire est une pièce historique. Il
        // doit continuer de refléter ce qui a été transmis à la banque même si
        // la fiche prospect est corrigée par la suite.
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
