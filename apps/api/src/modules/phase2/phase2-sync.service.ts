import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CallTaskStatus, Phase2Status, Prisma, type EnrollmentMethod } from '@crm/database';

import { PHASE2_STATUS_FOR_OUTCOME, isTerminalOutcome, normalizeAttempt } from './attempt-rules.js';
import {
  CallAttemptApplyStatus,
  type CallAttemptOpDto,
  type CallAttemptResultDto,
  type ProspectPhase2StateDto,
} from './dto.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONTRAT, opération `call_attempt` du push de synchronisation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le module de synchronisation appartient à un autre périmètre : il n'y a donc
 * ici ni contrôleur, ni route. Ce service expose UNE méthode publique que le
 * push appelle depuis SA transaction.
 *
 *   applyCallAttempt(tx, userId, op): Promise<CallAttemptResultDto>
 *
 * ─── Ce que l'appelant doit fournir ────────────────────────────────────────
 *
 * - `tx`     un client de transaction Prisma DÉJÀ OUVERT. La méthode n'en ouvre
 *            aucune : la sémantique « la première transition terminale validée
 *            gagne » repose sur le verrou de ligne PostgreSQL, qui n'existe que
 *            dans la transaction de l'appelant. Lui passer le client racine
 *            ferait perdre l'atomicité entre la tentative et la transition.
 * - `userId` le commercial qui a RÉELLEMENT passé l'appel. Il est enregistré
 *            dans `CallAttempt.performedById`, distinct de
 *            `CallTask.assignedToId` : n'importe quel commercial authentifié
 *            peut compléter un numéro trouvé dans l'annuaire, y compris un
 *            numéro attribué à un collègue, et l'attribution doit rester juste.
 * - `op`     la charge utile validée par class-validator (`CallAttemptOpDto`).
 *
 * ─── Ce que l'appelant reçoit ──────────────────────────────────────────────
 *
 * - `status: 'applied'`    la tentative a été enregistrée et la transition
 *                          appliquée.
 * - `status: 'duplicate'`  l'identifiant de tentative était déjà connu. RIEN
 *                          n'a été réécrit ; l'état serveur courant est rendu
 *                          tel quel. C'est le cas normal d'un lot rejoué après
 *                          une coupure réseau.
 *
 * ─── Erreurs, et comment les traduire ──────────────────────────────────────
 *
 * Toutes sont des exceptions Nest dont le corps porte un champ `code` :
 *
 * - `BadRequestException`  PHASE2_METHOD_REQUIRED · PHASE2_METHOD_NOT_ALLOWED ·
 *                          PHASE2_COMMENT_REQUIRED · PHASE2_COMMENT_TOO_LONG
 *                          → opération INVALIDE. La rejouer ne servira à rien :
 *                            le client doit la retirer de sa file et la
 *                            signaler.
 * - `NotFoundException`    PHASE2_PROSPECT_NOT_FOUND
 *                          → le prospect n'existe pas (ou plus) côté serveur.
 *                            Également définitif.
 * - `ConflictException`    PHASE2_ALREADY_COMPLETED, avec `state`, l'état
 *                          serveur courant du prospect.
 *                          → un autre commercial a clos le dossier avant.
 *                            Le client garde son entrée locale comme CONFLIT
 *                            VISIBLE et la rapproche de `state`. Seul un ADMIN
 *                            peut corriger ensuite depuis le web.
 *
 * Une exception ANNULE la transaction de l'appelant : c'est voulu pour les
 * conflits, la tentative refusée ne doit pas laisser de trace, mais cela
 * impose au push d'isoler chaque opération dans sa propre transaction s'il veut
 * que les opérations voisines survivent.
 *
 * ─── Sémantique des six issues ─────────────────────────────────────────────
 *
 *   METHOD_OBTAINED  exige une méthode · TERMINALE · clôt toutes les tâches
 *   REFUSED          sans méthode      · TERMINALE · clôt toutes les tâches
 *   WRONG_NUMBER     sans méthode      · TERMINALE · clôt toutes les tâches
 *   UNREACHABLE      sans méthode      · trace seule, la tâche reste ouverte
 *   CALLBACK         sans méthode      · trace seule, la tâche reste ouverte
 *   OTHER            commentaire exigé · trace seule, la tâche reste ouverte
 *
 * « Clôt TOUTES les tâches » et non « la tâche courante » : deux campagnes
 * successives peuvent avoir laissé deux lignes sur le même prospect si la
 * première n'a pas été clôturée proprement. En laisser une ouverte enverrait un
 * second commercial rappeler quelqu'un qui a déjà répondu.
 */

/** Type structurel du client de transaction, pour ne pas imposer d'import à l'appelant. */
export type Phase2TransactionClient = Prisma.TransactionClient;

interface ProspectState {
  id: string;
  phase2Status: Phase2Status;
  enrollmentMethod: EnrollmentMethod | null;
  rev: number;
  updatedAt: Date;
  enrollmentCapturedById: string | null;
  enrollmentCapturedAt: Date | null;
  isDemo: boolean;
}

const PROSPECT_STATE_SELECT = {
  id: true,
  phase2Status: true,
  enrollmentMethod: true,
  rev: true,
  updatedAt: true,
  enrollmentCapturedById: true,
  enrollmentCapturedAt: true,
  // Lu pour la SEULE écriture de la tentative, jamais rendu au client : le
  // DTO d'état ne porte pas la nature de la ligne, et n'a pas à la porter.
  isDemo: true,
} satisfies Prisma.ProspectSelect;

const toState = (row: ProspectState): ProspectPhase2StateDto => ({
  prospectId: row.id,
  phase2Status: row.phase2Status,
  enrollmentMethod: row.enrollmentMethod,
  rev: row.rev,
  updatedAt: row.updatedAt.toISOString(),
  capturedById: row.enrollmentCapturedById,
  capturedAt: row.enrollmentCapturedAt?.toISOString() ?? null,
});

const alreadyCompleted = (state: ProspectPhase2StateDto): ConflictException =>
  new ConflictException({
    code: 'PHASE2_ALREADY_COMPLETED',
    message:
      'Ce prospect a déjà été traité par un autre appel. Votre saisie est conservée localement comme conflit ; seul un administrateur peut corriger le dossier.',
    state,
  });

@Injectable()
export class Phase2SyncService {
  /**
   * Applique une tentative d'appel, de façon atomique et idempotente.
   *
   * Voir le contrat en tête de fichier. L'ordre des étapes n'est pas
   * indifférent : on reconnaît le REJEU avant de constater le CONFLIT, sans
   * quoi un lot rejoué après qu'un collègue a clos le dossier remonterait un
   * faux conflit au client, qui afficherait une alerte pour une opération qu'il
   * avait déjà réussi à envoyer.
   */
  async applyCallAttempt(
    tx: Phase2TransactionClient,
    userId: string,
    op: CallAttemptOpDto,
  ): Promise<CallAttemptResultDto> {
    const attempt = normalizeAttempt(op);

    // ── 1. Rejeu ────────────────────────────────────────────────────────────
    const known = await tx.callAttempt.findUnique({
      where: { id: op.id },
      select: { id: true, taskId: true, task: { select: { status: true } } },
    });

    if (known) {
      const current = await this.loadProspect(tx, op.prospectId);
      return {
        status: CallAttemptApplyStatus.DUPLICATE,
        attemptId: known.id,
        taskId: known.taskId,
        taskStatus: known.task?.status ?? null,
        state: toState(current),
      };
    }

    // ── 2. Le prospect existe-t-il, et est-il encore ouvert ? ───────────────
    const prospect = await this.loadProspect(tx, op.prospectId);
    if (prospect.phase2Status !== Phase2Status.PENDING) {
      // Vaut aussi pour une issue NON terminale : le dossier est clos, y
      // ajouter « injoignable » n'a plus de sens et le client doit le voir.
      throw alreadyCompleted(toState(prospect));
    }

    // ── 3. La tâche active, s'il y en a une ─────────────────────────────────
    // Il peut n'y en avoir aucune : un commercial a le droit de compléter un
    // numéro trouvé dans l'annuaire sans qu'il lui ait été attribué.
    const activeTask = await tx.callTask.findFirst({
      where: { prospectId: op.prospectId, isActive: true },
      select: { id: true, campaignId: true },
      orderBy: { createdAt: 'asc' },
    });

    // ── 4. La trace, écrite avant la transition ─────────────────────────────
    const inserted = await tx.callAttempt.createMany({
      // `skipDuplicates` traduit un ON CONFLICT DO NOTHING : deux envois
      // simultanés du même identifiant se départagent sans faire échouer la
      // transaction, là où un `create` en aurait avorté une.
      data: [
        {
          id: op.id,
          prospectId: op.prospectId,
          taskId: activeTask?.id ?? null,
          campaignId: activeTask?.campaignId ?? null,
          performedById: userId,
          outcome: attempt.outcome,
          method: attempt.method,
          comment: attempt.comment,
          clientCreatedAt: new Date(op.clientCreatedAt),
          // La tentative SUIT LE PROSPECT sur lequel elle porte, exactement
          // comme `RepCallAttempt` suit son représentant. Les deux tables
          // portent la colonne ; seule celle-ci l'oubliait, et le taux de
          // joignabilité affiché mode éteint comptait donc des appels passés
          // sur des fiches fictives.
          //
          // Le prospect, et non l'interrupteur : le chemin est celui de la
          // synchronisation mobile, où le lot arrive longtemps après la
          // saisie. L'état du mode au moment de la remontée ne dit rien de la
          // nature de la fiche appelée.
          isDemo: prospect.isDemo,
        },
      ],
      skipDuplicates: true,
    });

    if (inserted.count === 0) {
      const current = await this.loadProspect(tx, op.prospectId);
      return {
        status: CallAttemptApplyStatus.DUPLICATE,
        attemptId: op.id,
        taskId: activeTask?.id ?? null,
        taskStatus: null,
        state: toState(current),
      };
    }

    // ── 5. Issue non terminale : la tâche reste ouverte ─────────────────────
    if (!attempt.terminal || !isTerminalOutcome(attempt.outcome)) {
      return {
        status: CallAttemptApplyStatus.APPLIED,
        attemptId: op.id,
        taskId: activeTask?.id ?? null,
        taskStatus: activeTask ? CallTaskStatus.OPEN : null,
        state: toState(prospect),
      };
    }

    // ── 6. Transition terminale ─────────────────────────────────────────────
    const completedAt = new Date();
    const nextStatus = PHASE2_STATUS_FOR_OUTCOME[attempt.outcome];

    // Écriture CONDITIONNELLE : c'est elle qui fait gagner la première
    // transition validée. Sous READ COMMITTED, une seconde transaction se
    // bloque sur le verrou de ligne, puis réévalue le `where` après le commit
    // de la première et ne met rien à jour. Une lecture suivie d'une écriture
    // inconditionnelle, elle, écraserait silencieusement le premier résultat.
    const applied = await tx.prospect.updateMany({
      where: { id: op.prospectId, phase2Status: Phase2Status.PENDING },
      data: {
        phase2Status: nextStatus,
        enrollmentMethod: attempt.method,
        enrollmentCapturedAt: completedAt,
        enrollmentCapturedById: userId,
        rev: { increment: 1 },
      },
    });

    if (applied.count === 0) {
      throw alreadyCompleted(toState(await this.loadProspect(tx, op.prospectId)));
    }

    await tx.callTask.updateMany({
      where: { prospectId: op.prospectId, isActive: true },
      data: { status: CallTaskStatus.DONE, isActive: false, completedAt },
    });

    return {
      status: CallAttemptApplyStatus.APPLIED,
      attemptId: op.id,
      taskId: activeTask?.id ?? null,
      taskStatus: activeTask ? CallTaskStatus.DONE : null,
      state: toState(await this.loadProspect(tx, op.prospectId)),
    };
  }

  private async loadProspect(
    tx: Phase2TransactionClient,
    prospectId: string,
  ): Promise<ProspectState> {
    const row = await tx.prospect.findFirst({
      where: { id: prospectId, deletedAt: null },
      select: PROSPECT_STATE_SELECT,
    });

    if (!row) {
      throw new NotFoundException({
        code: 'PHASE2_PROSPECT_NOT_FOUND',
        message: 'Prospect introuvable ou supprimé.',
      });
    }
    return row;
  }
}
