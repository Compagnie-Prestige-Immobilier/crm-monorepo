import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GrandPublicConsent,
  Prisma,
  Projet,
  type ProspectStatut,
  ScheduledCallbackStatus,
  classifySegment,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import { lastAttemptsByProspect, type LastAttempt } from './last-attempt.js';
import { normalizePhone } from '../../common/phone.js';
import { AuditAction, audit } from '../../common/audit.js';
import { PROSPECT_STATUT_TRANSITIONS, assertTransition } from '../../common/transitions.js';
import { assertOwnership, isAdmin, ownerScope, prospectReadScope } from '../../common/scope.js';
import { buildProspectWhere } from '../../common/prospect-where.js';
import { ProspectSortField, SortOrder } from '../../common/dto/prospect-filter.dto.js';
import type { ProspectQueryDto } from '../../common/dto/prospect-filter.dto.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { OkDto } from '../../common/dto/ok.dto.js';
import type {
  CreateProspectDto,
  ConfirmGrandPublicConversionDto,
  MergeProspectsDto,
  ProspectDto,
  ProspectListDto,
  ReassignProspectsDto,
  ReassignResultDto,
  UpdateProspectDto,
} from './dto.js';

export const PROSPECT_INCLUDE = {
  // `shortName` en plus de `name` : c'est lui, et non le nom complet, qui porte
  // l'axe CBAO de la segmentation.
  banque: { select: { name: true, shortName: true } },
  syndicat: { select: { sigle: true } },
  createdBy: { select: { id: true, fullName: true } },
  enrollmentCapturedBy: { select: { id: true, fullName: true } },
  canalProvenance: { select: { label: true } },
  professionRef: { select: { label: true, isTeaching: true } },
  incomeBand: { select: { label: true } },
  journeys: {
    select: {
      id: true,
      projet: true,
      statut: true,
      consent: true,
      consentAt: true,
      convertedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  representant: {
    select: {
      fullName: true,
      phoneE164: true,
      departementId: true,
      departement: { select: { name: true } },
    },
  },
} satisfies Prisma.ProspectInclude;

type ProspectRow = Prisma.ProspectGetPayload<{ include: typeof PROSPECT_INCLUDE }>;

// `Partial<T>` seul ne suffit pas : sous `exactOptionalPropertyTypes`, une
// clé `profession?: string | undefined` reste distincte de `profession?:
// string`, alors que les deux décrivent la même absence pour Prisma. Le
// mapped type retire `undefined` du type de chaque valeur en plus de rendre
// la clé optionnelle.
function defined<T extends Record<string, unknown>>(
  values: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

const isoOrNull = (value: Date | null | undefined): string | null =>
  value === null || value === undefined ? null : value.toISOString();

export async function closeProspectWork(
  tx: Prisma.TransactionClient,
  prospectId: string,
): Promise<void> {
  await tx.scheduledCallback.updateMany({
    where: { prospectId, status: ScheduledCallbackStatus.PENDING },
    data: { status: ScheduledCallbackStatus.CANCELLED },
  });
}

/** Avancement d'un parcours : la fusion garde toujours le plus avancé des deux. */
const STATUT_RANK: Record<ProspectStatut, number> = {
  NOUVEAU: 0,
  PERDU: 1,
  CONTACTE: 2,
  CONVERTI: 3,
};

/**
 * Déplace les parcours de la source vers la cible.
 *
 * `@@unique([prospectId, projet])` interdit le simple `updateMany` : quand les
 * deux fiches suivent le même projet, il faut choisir. La règle est de ne
 * JAMAIS perdre une conversion — `ProspectConversion` est en `onDelete:
 * Cascade` sur le parcours, donc supprimer le mauvais parcours effacerait
 * silencieusement un engagement signé et daté.
 */
async function moveJourneys(
  tx: Prisma.TransactionClient,
  sourceId: string,
  targetId: string,
): Promise<void> {
  const select = {
    id: true,
    projet: true,
    statut: true,
    consent: true,
    conversion: { select: { id: true } },
  } as const;
  const [source, target] = await Promise.all([
    tx.prospectJourney.findMany({ where: { prospectId: sourceId }, select }),
    tx.prospectJourney.findMany({ where: { prospectId: targetId }, select }),
  ]);
  const parProjet = new Map(target.map((row) => [row.projet, row]));

  for (const depart of source) {
    const arrivee = parProjet.get(depart.projet);
    if (!arrivee) {
      await tx.prospectJourney.update({
        where: { id: depart.id },
        data: { prospectId: targetId },
      });
      continue;
    }

    if (depart.conversion && arrivee.conversion) {
      throw new ConflictException({
        code: 'MERGE_TWO_CONVERSIONS',
        message:
          `Les deux fiches portent une conversion confirmée sur le projet ${depart.projet}. ` +
          'Corrigez l’une des deux avant de fusionner.',
      });
    }

    // C'est le parcours PORTEUR de la conversion qui survit.
    if (depart.conversion) {
      await tx.prospectJourney.delete({ where: { id: arrivee.id } });
      await tx.prospectJourney.update({
        where: { id: depart.id },
        data: { prospectId: targetId },
      });
      continue;
    }

    await tx.prospectJourney.update({
      where: { id: arrivee.id },
      data: {
        ...(STATUT_RANK[depart.statut] > STATUT_RANK[arrivee.statut]
          ? { statut: depart.statut }
          : {}),
        ...(arrivee.consent === GrandPublicConsent.NON_DEMANDE &&
        depart.consent !== GrandPublicConsent.NON_DEMANDE
          ? { consent: depart.consent }
          : {}),
      },
    });
    await tx.prospectJourney.delete({ where: { id: depart.id } });
  }
}

export function toProspectDto(row: ProspectRow, lastAttempt?: LastAttempt): ProspectDto {
  const banque = row.banque ?? { name: null, shortName: null };
  const syndicat = row.syndicat ?? { sigle: null };
  const representant = row.representant ?? {
    fullName: null,
    phoneE164: null,
    departementId: null,
    departement: { name: null },
  };
  const profession = row.professionRef ?? { label: row.profession, isTeaching: null };
  const incomeBand = row.incomeBand ?? { label: null };
  const provenance = row.canalProvenance ?? { label: null };
  const enrollmentAuthor = row.enrollmentCapturedBy ?? { fullName: null };
  const attempt = lastAttempt ?? { outcome: null, comment: null, at: null };

  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    phoneE164: row.phoneE164,
    rev: row.rev,
    statut: row.statut,
    projet: row.projet,
    banqueId: row.banqueId,
    banqueName: banque.name,
    syndicatId: row.syndicatId,
    syndicatSigle: syndicat.sigle,
    representantId: row.representantId,
    representantName: representant.fullName,
    representantPhoneE164: representant.phoneE164,
    departementId: representant.departementId,
    departementName: representant.departement.name,
    ownedByCommercialId: row.createdBy.id,
    ownedByCommercialName: row.createdBy.fullName,
    type: row.type,
    profession: profession.label,
    professionId: row.professionId ?? null,
    professionIsTeaching: profession.isTeaching,
    incomeBandId: row.incomeBandId ?? null,
    incomeBandLabel: incomeBand.label,
    paymentMode: row.paymentMode ?? null,
    journeys: row.journeys.map((journey) => ({
      ...journey,
      consentAt: isoOrNull(journey.consentAt),
      convertedAt: isoOrNull(journey.convertedAt),
    })),
    dureeSystemeMois: row.dureeSystemeMois,
    canalProvenanceId: row.canalProvenanceId,
    canalProvenanceLabel: provenance.label,
    // Définition UNIQUE du croisement : le même helper sert au filtrage, aux
    // statistiques et aux onglets du classeur. NUL dès qu'il manque un axe.
    segment: classifySegment({
      syndicatSigle: syndicat.sigle,
      banqueShortName: banque.shortName,
    }),
    phase2Status: row.phase2Status,
    enrollmentMethod: row.enrollmentMethod,
    enrollmentCapturedById: row.enrollmentCapturedById,
    enrollmentCapturedByName: enrollmentAuthor.fullName,
    enrollmentCapturedAt: isoOrNull(row.enrollmentCapturedAt),
    origin: row.origin,
    originLabel: row.originLabel,
    lastOutcome: attempt.outcome,
    lastComment: attempt.comment,
    lastAttemptAt: isoOrNull(attempt.at),
    clientCreatedAt: row.clientCreatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: isoOrNull(row.deletedAt),
  };
}

@Injectable()
export class ProspectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: ProspectQueryDto): Promise<ProspectListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    // Cloisonnement inclus dans buildProspectWhere : la liste, les agrégats et
    // l'export partagent la même clause, donc la même portée.
    const where = buildProspectWhere(user, query);

    const sortBy = query.sortBy ?? ProspectSortField.CLIENT_CREATED_AT;
    const sortOrder = query.sortOrder ?? SortOrder.DESC;

    const [total, rows] = await Promise.all([
      this.prisma.prospect.count({ where }),
      this.prisma.prospect.findMany({
        where,
        include: PROSPECT_INCLUDE,
        // `id` en second critère : sans lui, deux lignes de même date peuvent
        // s'échanger entre deux pages et l'une disparaît de la pagination.
        orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // UNE seule requête supplémentaire pour toute la page, quel que soit son
    // nombre de lignes. La variante évidente, lire les tentatives dans le
    // `include` ou par ligne, produirait un aller-retour par prospect affiché.
    const attempts = await lastAttemptsByProspect(
      this.prisma,
      rows.map((row) => row.id),
    );

    return {
      items: rows.map((row) => toProspectDto(row, attempts.get(row.id))),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async get(user: AuthenticatedUser, id: string): Promise<ProspectDto> {
    const row = await this.prisma.prospect.findFirst({
      where: { id, deletedAt: null, ...prospectReadScope(user) },
      include: PROSPECT_INCLUDE,
    });
    // Deux requêtes seulement quand la lecture échoue : la règle de portée reste
    // écrite à un seul endroit, et « pas à vous » ne se confond pas avec
    // « n'existe pas ».
    if (!row) {
      const ailleurs = await this.prisma.prospect.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (ailleurs) {
        throw new ForbiddenException({
          code: 'NOT_OWNER',
          message: 'Cette fiche appartient à un autre téléconseiller.',
        });
      }
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'Prospect introuvable.' });
    }
    const attempts = await lastAttemptsByProspect(this.prisma, [row.id]);
    return toProspectDto(row, attempts.get(row.id));
  }

  async create(user: AuthenticatedUser, input: CreateProspectDto): Promise<ProspectDto> {
    const phoneE164 = normalizePhone(input.phone);
    const id = input.id ?? uuidv7();

    await this.assertIdAvailable(user, id);
    // Le rattachement est facultatif : une fiche Grand Public n'en a aucun.
    if (input.representantId) await this.assertRepresentantUsable(input.representantId);
    const projet = input.projet ?? Projet.CHUES;
    const attached = await this.attachProjectByPhone(user, phoneE164, projet, input);
    if (attached) return attached;
    await this.assertPhoneFree(user, phoneE164);
    this.assertPayment(input.paymentMode, input.dureeSystemeMois);

    const created = await this.prisma.prospect.create({
      data: {
        id,
        nom: input.nom.trim(),
        prenom: input.prenom?.trim() ?? '',
        phoneE164,
        banqueId: input.banqueId ?? null,
        syndicatId: input.syndicatId ?? null,
        representantId: input.representantId ?? null,
        createdById: user.id,
        ...defined({
          projet: input.projet === undefined ? undefined : projet,
          type: input.type,
          profession: input.profession?.trim(),
          professionId: input.professionId,
          incomeBandId: input.incomeBandId,
          paymentMode: input.paymentMode,
          dureeSystemeMois: input.dureeSystemeMois,
          canalProvenanceId: input.canalProvenanceId,
          statut: input.statut,
        }),
        journeys: {
          create: {
            projet,
            ...(input.statut ? { statut: input.statut } : {}),
            consent:
              projet === Projet.GRAND_PUBLIC
                ? GrandPublicConsent.INTERESSE
                : GrandPublicConsent.NON_DEMANDE,
            consentAt: projet === Projet.GRAND_PUBLIC ? new Date() : null,
          },
        },
        clientCreatedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : new Date(),
      },
      include: PROSPECT_INCLUDE,
    });
    return toProspectDto(created);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    input: UpdateProspectDto,
  ): Promise<ProspectDto> {
    const existing = await this.prisma.prospect.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'Prospect introuvable.' });
    }
    assertOwnership(user, existing);

    const phoneE164 = input.phone ? normalizePhone(input.phone) : undefined;
    if (phoneE164 && phoneE164 !== existing.phoneE164)
      await this.assertPhoneFree(user, phoneE164, id);
    if (input.representantId && input.representantId !== existing.representantId) {
      await this.assertRepresentantUsable(input.representantId);
    }
    this.assertPayment(
      input.paymentMode ?? existing.paymentMode,
      input.dureeSystemeMois ?? existing.dureeSystemeMois,
    );

    // `CONVERTI` porte une `ProspectConversion` signée et datée : on n'y entre
    // que par `confirmGrandPublicConversion`, qui exige le consentement et
    // écrit l'engagement. Sans cette garde, un simple PATCH y menait, sans
    // consentement, sans conversion, sans auteur — et depuis n'importe quel
    // état, `PERDU` compris.
    this.assertStatusUpdate(user, existing.statut, input.statut);
    await this.upsertJourney(id, input);

    const updated = await this.prisma.prospect.update({
      where: { id },
      data: {
        ...defined({
          nom: input.nom?.trim(),
          prenom: input.prenom?.trim(),
          phoneE164,
          banqueId: input.banqueId,
          syndicatId: input.syndicatId,
          representantId: input.representantId,
          projet: input.projet,
          type: input.type,
          profession: input.profession?.trim(),
          professionId: input.professionId,
          incomeBandId: input.incomeBandId,
          paymentMode: input.paymentMode,
          dureeSystemeMois: input.dureeSystemeMois,
          canalProvenanceId: input.canalProvenanceId,
          statut: input.statut,
          clientCreatedAt:
            input.clientCreatedAt === undefined ? undefined : new Date(input.clientCreatedAt),
        }),
        rev: { increment: 1 },
      },
      include: PROSPECT_INCLUDE,
    });
    // La fiche peut déjà porter des tentatives d'appel : les omettre ici
    // renverrait au client une réponse qui contredit la liste dont il vient.
    const attempts = await lastAttemptsByProspect(this.prisma, [updated.id]);
    return toProspectDto(updated, attempts.get(updated.id));
  }

  private assertStatusUpdate(
    user: AuthenticatedUser,
    current: ProspectStatut,
    next: ProspectStatut | undefined,
  ): void {
    if (next === undefined || next === current) return;
    assertTransition(PROSPECT_STATUT_TRANSITIONS, current, next, {
      code: 'PROSPECT_STATUT_TRANSITION_REFUSED',
      label: 'Statut du prospect',
      ...(isAdmin(user) ? { bypass: true } : {}),
    });
    if (next !== 'CONVERTI' || isAdmin(user)) return;
    throw new ForbiddenException({
      code: 'PROSPECT_CONVERSION_REQUIRES_CONFIRMATION',
      message:
        'Une conversion s’enregistre par la confirmation dédiée, qui recueille ' +
        'l’offre et le montant.',
    });
  }

  private async upsertJourney(id: string, input: UpdateProspectDto): Promise<void> {
    if (input.projet === undefined) return;
    await this.prisma.prospectJourney.upsert({
      where: { prospectId_projet: { prospectId: id, projet: input.projet } },
      create: {
        prospectId: id,
        projet: input.projet,
        ...(input.statut ? { statut: input.statut } : {}),
        consent:
          input.projet === Projet.GRAND_PUBLIC
            ? GrandPublicConsent.INTERESSE
            : GrandPublicConsent.NON_DEMANDE,
        consentAt: input.projet === Projet.GRAND_PUBLIC ? new Date() : null,
      },
      update: input.statut === undefined ? {} : { statut: input.statut },
    });
  }

  private assertPayment(
    paymentMode: string | null | undefined,
    durationMonths: number | null | undefined,
  ): void {
    if (paymentMode === 'COMPTANT' && durationMonths != null) {
      throw new BadRequestException({
        code: 'PROSPECT_PAYMENT_DURATION_INVALID',
        message: 'La durée ne concerne que le paiement échelonné.',
      });
    }
  }

  async remove(user: AuthenticatedUser, id: string): Promise<OkDto> {
    const existing = await this.prisma.prospect.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'Prospect introuvable.' });
    }
    assertOwnership(user, existing);

    // Suppression logique : l'index unique sur le téléphone étant PARTIEL
    // (`WHERE deletedAt IS NULL`), le numéro redevient immédiatement
    // ressaisissable. C'est la raison d'être de cet index partiel.
    await this.prisma.$transaction(async (tx) => {
      await tx.prospect.update({
        where: { id },
        data: { deletedAt: new Date(), rev: { increment: 1 } },
      });
      await closeProspectWork(tx, id);
      await audit(tx, user, {
        action: AuditAction.PROSPECT_DELETE,
        entity: 'prospect',
        entityId: id,
        before: { nom: existing.nom, prenom: existing.prenom, phoneE164: existing.phoneE164 },
      });
    });
    return { ok: true };
  }

  async setGrandPublicConsent(
    user: AuthenticatedUser,
    id: string,
    consent: GrandPublicConsent,
  ): Promise<ProspectDto> {
    const prospect = await this.prisma.prospect.findFirst({ where: { id, deletedAt: null } });
    if (!prospect) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'Prospect introuvable.' });
    }
    assertOwnership(user, prospect);
    const at = consent === GrandPublicConsent.NON_DEMANDE ? null : new Date();
    await this.prisma.prospectJourney.upsert({
      where: { prospectId_projet: { prospectId: id, projet: Projet.GRAND_PUBLIC } },
      create: {
        prospectId: id,
        projet: Projet.GRAND_PUBLIC,
        consent,
        consentAt: at,
        consentById: consent === GrandPublicConsent.NON_DEMANDE ? null : user.id,
      },
      update: {
        consent,
        consentAt: at,
        consentById: consent === GrandPublicConsent.NON_DEMANDE ? null : user.id,
      },
    });
    return this.get(user, id);
  }

  async confirmGrandPublicConversion(
    user: AuthenticatedUser,
    id: string,
    input: ConfirmGrandPublicConversionDto,
  ): Promise<ProspectDto> {
    this.assertPayment(input.paymentMode, input.durationMonths);
    const prospect = await this.prisma.prospect.findFirst({ where: { id, deletedAt: null } });
    if (!prospect) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'Prospect introuvable.' });
    }
    assertOwnership(user, prospect);
    const journey = await this.prisma.prospectJourney.findUnique({
      where: { prospectId_projet: { prospectId: id, projet: Projet.GRAND_PUBLIC } },
    });
    if (!journey || journey.consent !== GrandPublicConsent.INTERESSE) {
      throw new BadRequestException({
        code: 'GRAND_PUBLIC_CONSENT_REQUIRED',
        message: 'Le parcours Grand Public doit être accepté avant sa conversion.',
      });
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.prospectJourney.update({
        where: { id: journey.id },
        data: { statut: 'CONVERTI', convertedAt: now, convertedById: user.id },
      }),
      this.prisma.prospectConversion.upsert({
        where: { journeyId: journey.id },
        create: {
          journeyId: journey.id,
          offerId: input.offerId,
          ...(input.paymentMode ? { paymentMode: input.paymentMode } : {}),
          ...(input.amountXof === undefined ? {} : { amountXof: input.amountXof }),
          ...(input.durationMonths === undefined ? {} : { durationMonths: input.durationMonths }),
          confirmedById: user.id,
          confirmedAt: now,
        },
        update: {
          offerId: input.offerId,
          ...(input.paymentMode ? { paymentMode: input.paymentMode } : {}),
          ...(input.amountXof === undefined ? {} : { amountXof: input.amountXof }),
          ...(input.durationMonths === undefined ? {} : { durationMonths: input.durationMonths }),
          confirmedById: user.id,
          confirmedAt: now,
        },
      }),
      this.prisma.prospect.update({
        where: { id },
        data: { statut: 'CONVERTI', rev: { increment: 1 } },
      }),
    ]);
    return this.get(user, id);
  }

  /**
   * Fusionne deux fiches désignant la même personne.
   *
   * La source est supprimée logiquement dans la MÊME transaction que la mise à
   * jour de la cible : entre les deux, les deux fiches partageraient le même
   * numéro vivant et l'index unique partiel refuserait l'écriture.
   */
  async merge(user: AuthenticatedUser, input: MergeProspectsDto): Promise<ProspectDto> {
    if (input.sourceId === input.targetId) {
      throw new BadRequestException({
        code: 'MERGE_SAME_PROSPECT',
        message: 'Impossible de fusionner une fiche avec elle-même.',
      });
    }

    const [target, source] = await Promise.all([
      this.prisma.prospect.findFirst({ where: { id: input.targetId, deletedAt: null } }),
      this.prisma.prospect.findFirst({ where: { id: input.sourceId, deletedAt: null } }),
    ]);
    if (!target || !source) {
      throw new NotFoundException({
        code: 'PROSPECT_NOT_FOUND',
        message: 'L’une des deux fiches est introuvable.',
      });
    }
    assertOwnership(user, target);
    assertOwnership(user, source);

    // Deux dossiers bancaires ouverts ne se fusionnent pas tout seuls : lequel
    // survit, avec quel montant et quelle étape, est une décision d'instruction
    // que le code ne peut pas prendre.
    const dossiersOuverts = await this.prisma.bankCase.count({
      where: { prospectId: { in: [source.id, target.id] }, currentStage: { type: 'OPEN' } },
    });
    if (dossiersOuverts > 1) {
      throw new ConflictException({
        code: 'MERGE_TWO_OPEN_BANK_CASES',
        message:
          'Ces deux fiches portent chacune un dossier bancaire en cours. ' +
          'Clôturez ou corrigez l’un des deux avant de fusionner.',
      });
    }

    const merged = await this.prisma.$transaction(async (tx) => {
      await tx.prospect.update({
        where: { id: source.id },
        data: { deletedAt: new Date(), rev: { increment: 1 } },
      });

      // TOUT ce qui pend à la source suit, sinon la fusion perd le classement
      // par projet, les dossiers et l'historique d'appels : le parcours restait
      // accroché à une fiche supprimée, donc la personne disparaissait des
      // listes de ce projet, et le dossier encaissé pointait vers une fiche
      // qu'aucun écran ne montre plus.
      await moveJourneys(tx, source.id, target.id);
      // Déroulé et non bouclé : l'union des délégués Prisma n'est pas appelable.
      const versLaCible = { where: { prospectId: source.id }, data: { prospectId: target.id } };
      await tx.bankCase.updateMany(versLaCible);
      await tx.callAttempt.updateMany(versLaCible);
      await tx.scheduledCallback.updateMany(versLaCible);
      // La demande bancaire nomme sa fiche `createdProspectId`, et un CHECK
      // exige qu'une demande approuvée en porte une : la laisser sur la fiche
      // supprimée rendrait la demande orpheline aux yeux de la banque.
      await tx.clientCreationRequest.updateMany({
        where: { createdProspectId: source.id },
        data: { createdProspectId: target.id },
      });
      const fusionnee = await tx.prospect.update({
        where: { id: target.id },
        data: {
          ...(input.preferSource
            ? {
                nom: source.nom,
                prenom: source.prenom,
                phoneE164: source.phoneE164,
                banqueId: source.banqueId,
                syndicatId: source.syndicatId,
                statut: source.statut,
              }
            : {}),
          // La date de saisie retenue est la PLUS ANCIENNE des deux : c'est
          // celle du premier contact réel, et les statistiques d'activité
          // s'appuient dessus.
          clientCreatedAt:
            source.clientCreatedAt < target.clientCreatedAt
              ? source.clientCreatedAt
              : target.clientCreatedAt,
          rev: { increment: 1 },
        },
        include: PROSPECT_INCLUDE,
      });

      await audit(tx, user, {
        action: AuditAction.PROSPECT_MERGE,
        entity: 'prospect',
        entityId: target.id,
        before: { sourceId: source.id, sourcePhone: source.phoneE164 },
        after: { targetId: target.id, preferSource: input.preferSource === true },
      });
      return fusionnee;
    });

    const attempts = await lastAttemptsByProspect(this.prisma, [merged.id]);
    return toProspectDto(merged, attempts.get(merged.id));
  }

  /** Réaffecte des prospects à un autre représentant, et pour l'ADMIN à un autre commercial. */
  async reassign(user: AuthenticatedUser, input: ReassignProspectsDto): Promise<ReassignResultDto> {
    if (!input.prospectIds.length) return { updated: 0, prospectIds: [] };
    if (!input.representantId && !input.commercialId) {
      throw new BadRequestException({
        code: 'REASSIGN_NO_TARGET',
        message: 'Indiquez au moins un représentant ou un commercial de destination.',
      });
    }
    if (input.commercialId && !isAdmin(user)) {
      throw new ForbiddenException({
        code: 'REASSIGN_OWNER_FORBIDDEN',
        message: 'Seul un administrateur peut changer le commercial propriétaire.',
      });
    }

    // Le `where` porte le cloisonnement : un COMMERCIAL ne peut désigner que
    // ses propres lignes, et les identifiants qui ne lui appartiennent pas
    // sortent simplement de l'ensemble au lieu de lever.
    const rows = await this.prisma.prospect.findMany({
      where: { id: { in: input.prospectIds }, deletedAt: null, ...ownerScope(user) },
      select: { id: true },
    });
    if (!rows.length) return { updated: 0, prospectIds: [] };

    if (input.representantId) await this.assertRepresentantUsable(input.representantId);
    if (input.commercialId) {
      const owner = await this.prisma.user.findFirst({
        where: { id: input.commercialId, deletedAt: null },
        select: { id: true },
      });
      if (!owner) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: 'Commercial de destination introuvable.',
        });
      }
    }

    const ids = rows.map((row) => row.id);
    const result = await this.prisma.prospect.updateMany({
      where: { id: { in: ids } },
      data: {
        ...(input.representantId ? { representantId: input.representantId } : {}),
        ...(input.commercialId ? { createdById: input.commercialId } : {}),
        rev: { increment: 1 },
      },
    });
    return { updated: result.count, prospectIds: ids };
  }

  /**
   * L'ANNUAIRE est commun : tout représentant vivant sert de rattachement, quel
   * que soit son créateur. Le cloisonnement se joue sur le PROSPECT créé, qui
   * reste celui de son auteur.
   */
  private async assertRepresentantUsable(
    representantId: string,
  ): Promise<{ id: string; createdById: string }> {
    const representant = await this.prisma.representant.findFirst({
      where: { id: representantId, deletedAt: null },
      select: { id: true, createdById: true },
    });
    if (!representant) {
      throw new NotFoundException({
        code: 'REPRESENTANT_NOT_FOUND',
        message: 'Représentant introuvable.',
      });
    }
    return representant;
  }

  private async assertIdAvailable(user: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.prisma.prospect.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });
    if (!existing) return;
    if (!isAdmin(user) && existing.createdById !== user.id) {
      throw new ForbiddenException({
        code: 'ENTITY_ID_OWNED_BY_ANOTHER_USER',
        message: 'Cet identifiant appartient à un autre commercial.',
      });
    }
    throw new ConflictException({
      code: 'PROSPECT_ALREADY_EXISTS',
      message: 'Un prospect porte déjà cet identifiant.',
      existingId: id,
    });
  }

  /**
   * 409 nommant la fiche existante ET son commercial.
   *
   * C'est le contrat que l'app mobile exploite pour afficher « Déjà enregistré
   * par Fatou Ndiaye » : sans le nom, l'utilisateur ne peut rien faire de
   * l'erreur, et la même saisie sera retentée indéfiniment.
   */
  /*
   * LECTURE GLOBALE délibérée : l'index unique partiel
   * `prospects_phone_e164_active_key` est global, il ne connaît pas le mode
   * démonstration. Filtré, ce contrôle déclarerait libre un numéro que la base
   * refuse ensuite, et le mobile recevrait un 409 générique au lieu du message
   * nominatif dont il a besoin pour arrêter de rejouer la même saisie.
   */
  private async assertPhoneFree(
    user: AuthenticatedUser,
    phoneE164: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.prisma.prospect.findFirst({
      where: {
        phoneE164,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        representant: { select: { id: true, fullName: true } },
      },
    });
    if (!clash) return;

    // La recherche est GLOBALE (l'index unique l'est), mais le corps ne l'est
    // pas : rendre l'identité civile d'une fiche d'autrui ferait de ce 409 un
    // annuaire interrogeable numéro par numéro. Le nom du propriétaire reste,
    // c'est lui qui dit à qui s'adresser et qui arrête le rejeu.
    const visible = isAdmin(user) || clash.createdById === user.id;
    throw new ConflictException({
      code: 'PROSPECT_PHONE_CONFLICT',
      message: `Ce numéro a déjà été enregistré par ${clash.createdBy.fullName}.`,
      existing: visible
        ? {
            id: clash.id,
            nom: clash.nom,
            prenom: clash.prenom,
            representantId: clash.representant?.id ?? null,
            representantName: clash.representant?.fullName ?? null,
            ownedByCommercialId: clash.createdBy.id,
            ownedByCommercialName: clash.createdBy.fullName,
            createdAt: clash.createdAt.toISOString(),
          }
        : { ownedByCommercialName: clash.createdBy.fullName },
    });
  }

  private async attachProjectByPhone(
    user: AuthenticatedUser,
    phoneE164: string,
    projet: Projet,
    input: CreateProspectDto,
  ): Promise<ProspectDto | null> {
    const existing = await this.prisma.prospect.findFirst({
      where: { phoneE164, deletedAt: null },
      select: {
        id: true,
        createdById: true,
        journeys: { where: { projet }, select: { id: true } },
      },
    });
    if (!existing || existing.journeys.length > 0) return null;
    if (!isAdmin(user) && existing.createdById !== user.id) return null;

    await this.prisma.prospectJourney.create({
      data: {
        prospectId: existing.id,
        projet,
        ...(input.statut ? { statut: input.statut } : {}),
        consent:
          projet === Projet.GRAND_PUBLIC
            ? GrandPublicConsent.INTERESSE
            : GrandPublicConsent.NON_DEMANDE,
        consentAt: projet === Projet.GRAND_PUBLIC ? new Date() : null,
      },
    });
    const updated = await this.prisma.prospect.update({
      where: { id: existing.id },
      data: {
        ...(input.type ? { type: input.type } : {}),
        ...(input.professionId ? { professionId: input.professionId } : {}),
        ...(input.incomeBandId ? { incomeBandId: input.incomeBandId } : {}),
        ...(input.paymentMode ? { paymentMode: input.paymentMode } : {}),
        ...(input.canalProvenanceId ? { canalProvenanceId: input.canalProvenanceId } : {}),
        rev: { increment: 1 },
      },
      include: PROSPECT_INCLUDE,
    });
    return toProspectDto(updated);
  }
}
