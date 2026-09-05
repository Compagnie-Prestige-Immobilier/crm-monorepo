import { Injectable } from '@nestjs/common';
import { Prisma, RappelOrigine, ScheduledCallbackStatus } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { attributionScope, prospectReadScope, readsEveryone } from '../../common/scope.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import {
  type ComptageOuverturesDto,
  type ComptageOuverturesQueryDto,
  type EnregistrerBrouillonDto,
  type OuvertureFicheDto,
  type OuvertureFicheListDto,
  type OuvrirFicheDto,
} from './dto.js';
import {
  cibleInvalide,
  dejaFermee,
  dejaOuverte,
  ficheIntrouvable,
  idPris,
  ouvertureIntrouvable,
} from './errors.js';

const OUVERTURE_INCLUDE = {
  openedBy: { select: { fullName: true } },
  releasedBy: { select: { fullName: true } },
  representant: { select: { fullName: true } },
  prospect: { select: { nom: true, prenom: true } },
} satisfies Prisma.OuvertureFicheInclude;

type OuvertureRow = Prisma.OuvertureFicheGetPayload<{ include: typeof OUVERTURE_INCLUDE }>;

function nomDeLaFiche(row: OuvertureRow): string {
  if (row.representant) return row.representant.fullName;
  if (!row.prospect) return '';
  return `${row.prospect.prenom} ${row.prospect.nom}`.trim();
}

function toDto(row: OuvertureRow): OuvertureFicheDto {
  const closedAt = row.closedAt;
  return {
    id: row.id,
    openedById: row.openedById,
    openedByName: row.openedBy.fullName,
    representantId: row.representantId,
    prospectId: row.prospectId,
    ficheNom: nomDeLaFiche(row),
    openedAt: row.openedAt.toISOString(),
    closedAt: closedAt?.toISOString() ?? null,
    dureeSecondes:
      closedAt === null ? null : Math.round((closedAt.getTime() - row.openedAt.getTime()) / 1_000),
    closingAttemptId: row.closingAttemptId,
    draft: (row.draft as Record<string, unknown> | null) ?? null,
    releasedByName: row.releasedBy?.fullName ?? null,
    releasedAt: row.releasedAt?.toISOString() ?? null,
  };
}

/**
 * La qualification lève le verrou, dans la MÊME transaction qu'elle : une
 * fermeture faite après coup peut se perdre, et la fiche resterait alors
 * verrouillée jusqu'à ce qu'un superviseur la libère à la main.
 *
 * `updateMany` et non `update` : une ouverture inconnue, déjà fermée ou ouverte
 * par quelqu'un d'autre ne fait rien, elle ne fait pas échouer une tentative
 * venue du terrain.
 *
 * La borne de fermeture ne descend jamais sous l'ouverture : l'horloge d'un
 * appareil peut reculer, et la contrainte `closedAt >= openedAt` avorterait la
 * transaction entière.
 */
export async function fermerOuverture(
  tx: Prisma.TransactionClient,
  input: { ouvertureId: string; openedById: string; attemptId: string; at: Date },
): Promise<void> {
  const ouverture = await tx.ouvertureFiche.findUnique({
    where: { id: input.ouvertureId },
    select: { openedAt: true },
  });
  if (!ouverture) return;

  await tx.ouvertureFiche.updateMany({
    where: { id: input.ouvertureId, openedById: input.openedById, closedAt: null },
    data: {
      closedAt: input.at < ouverture.openedAt ? ouverture.openedAt : input.at,
      closingAttemptId: input.attemptId,
    },
  });
}

@Injectable()
export class OuverturesService {
  constructor(private readonly prisma: PrismaService) {}

  async ouvrir(user: AuthenticatedUser, body: OuvrirFicheDto): Promise<OuvertureFicheDto> {
    if ((body.representantId === undefined) === (body.prospectId === undefined)) {
      throw cibleInvalide();
    }

    const rejoue = await this.prisma.ouvertureFiche.findUnique({
      where: { id: body.id },
      include: OUVERTURE_INCLUDE,
    });
    if (rejoue) {
      if (rejoue.openedById !== user.id) throw idPris();
      return toDto(rejoue);
    }

    await this.assertFicheOuvrable(user, body);

    const draft = body.draft
      ? (body.draft as Prisma.InputJsonObject)
      : await this.brouillonPrecedent(user, body);

    try {
      const cree = await this.prisma.ouvertureFiche.create({
        data: {
          id: body.id,
          openedById: user.id,
          representantId: body.representantId ?? null,
          prospectId: body.prospectId ?? null,
          openedAt: new Date(body.openedAt),
          draft: draft ?? Prisma.DbNull,
        },
        include: OUVERTURE_INCLUDE,
      });
      return toDto(cree);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      // Deux causes possibles pour la même violation : le rejeu de la même
      // ouverture, et le verrou. La relecture par identifiant les sépare sans
      // dépendre du nom de l'index.
      const concurrent = await this.prisma.ouvertureFiche.findUnique({
        where: { id: body.id },
        include: OUVERTURE_INCLUDE,
      });
      if (concurrent?.openedById === user.id) return toDto(concurrent);
      throw dejaOuverte();
    }
  }

  /** La fiche que le téléconseiller a en main, avec ce qu'il y a déjà saisi. */
  async courante(user: AuthenticatedUser): Promise<OuvertureFicheDto | null> {
    const row = await this.prisma.ouvertureFiche.findFirst({
      where: { openedById: user.id, closedAt: null },
      include: OUVERTURE_INCLUDE,
    });
    return row ? toDto(row) : null;
  }

  async enregistrerBrouillon(
    user: AuthenticatedUser,
    id: string,
    body: EnregistrerBrouillonDto,
  ): Promise<OuvertureFicheDto> {
    const modifie = await this.prisma.ouvertureFiche.updateMany({
      where: { id, openedById: user.id, closedAt: null },
      data: { draft: body.draft as Prisma.InputJsonObject },
    });
    if (modifie.count === 0) throw await this.brouillonRefuse(user, id);

    const row = await this.prisma.ouvertureFiche.findUniqueOrThrow({
      where: { id },
      include: OUVERTURE_INCLUDE,
    });
    return toDto(row);
  }

  /** Les fiches restées ouvertes, celles que l'encadrement peut libérer. */
  async ouvertes(): Promise<OuvertureFicheListDto> {
    const rows = await this.prisma.ouvertureFiche.findMany({
      where: { closedAt: null },
      include: OUVERTURE_INCLUDE,
      orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
    });
    return { items: rows.map(toDto) };
  }

  /**
   * Libérer, c'est fermer sans qualifier. Jamais automatique : une fiche qu'une
   * machine libère est une fiche qu'on croit traitée. La fiche repasse en file
   * de rappel, sans quoi la libérer la ferait disparaître du travail de tous.
   */
  async liberer(user: AuthenticatedUser, id: string): Promise<OuvertureFicheDto> {
    const row = await this.prisma.ouvertureFiche.findUnique({
      where: { id },
      select: {
        id: true,
        openedById: true,
        openedAt: true,
        closedAt: true,
        representantId: true,
        prospectId: true,
      },
    });
    if (!row) throw ouvertureIntrouvable();
    if (row.closedAt !== null) throw dejaFermee();

    const maintenant = new Date();
    const at = maintenant < row.openedAt ? row.openedAt : maintenant;

    await this.prisma.$transaction(async (tx) => {
      const libere = await tx.ouvertureFiche.updateMany({
        where: { id, closedAt: null },
        data: { closedAt: at, releasedById: user.id, releasedAt: at },
      });
      if (libere.count === 0) throw dejaFermee();

      if (row.representantId !== null) {
        await tx.representant.update({
          where: { id: row.representantId },
          data: {
            nextCallbackAt: at,
            nextCallbackOrigine: RappelOrigine.AUTOMATIQUE,
            rev: { increment: 1 },
          },
        });
        return;
      }
      if (row.prospectId === null) return;

      await tx.scheduledCallback.updateMany({
        where: { prospectId: row.prospectId, status: ScheduledCallbackStatus.PENDING },
        data: { status: ScheduledCallbackStatus.SUPERSEDED },
      });
      await tx.scheduledCallback.createMany({
        // `sourceAttemptId` est unique et sans clé étrangère : l'identifiant de
        // l'ouverture y rend la libération rejouable sans compter les lignes.
        data: [
          {
            prospectId: row.prospectId,
            assignedToId: row.openedById,
            scheduledAt: at,
            sourceAttemptId: row.id,
          },
        ],
        skipDuplicates: true,
      });
    });

    const relu = await this.prisma.ouvertureFiche.findUniqueOrThrow({
      where: { id },
      include: OUVERTURE_INCLUDE,
    });
    return toDto(relu);
  }

  /**
   * Fiches ouvertes par téléconseiller et par jour, avec la DMT qui se lit
   * entre les deux bornes. Un téléconseiller ne lit que son propre compte.
   */
  async comptage(
    user: AuthenticatedUser,
    query: ComptageOuverturesQueryDto,
  ): Promise<ComptageOuverturesDto> {
    const borne = readsEveryone(user) ? (query.openedById ?? null) : user.id;
    const filtres = [
      borne === null ? Prisma.sql`TRUE` : Prisma.sql`o."openedById" = ${borne}`,
      query.from ? Prisma.sql`o."openedAt" >= ${inclusiveDateFrom(query.from)}` : Prisma.sql`TRUE`,
      query.to ? Prisma.sql`o."openedAt" <= ${inclusiveDateTo(query.to)}` : Prisma.sql`TRUE`,
    ];

    const items = await this.prisma.$queryRaw<ComptageOuverturesDto['items']>`
      SELECT
        o."openedById"                                          AS "openedById",
        u."fullName"                                            AS "openedByName",
        to_char(date_trunc('day', o."openedAt"), 'YYYY-MM-DD')   AS jour,
        COUNT(*)::int                                           AS ouvertures,
        AVG(EXTRACT(EPOCH FROM (o."closedAt" - o."openedAt")))::int AS "dureeMoyenneSecondes"
      FROM "ouvertures_fiche" o
      INNER JOIN "users" u ON u."id" = o."openedById"
      WHERE ${Prisma.join(filtres, ' AND ')}
      GROUP BY 1, 2, 3
      ORDER BY 3 DESC, 2 ASC
    `;
    return { items };
  }

  private async assertFicheOuvrable(user: AuthenticatedUser, body: OuvrirFicheDto): Promise<void> {
    if (body.representantId !== undefined) {
      const representant = await this.prisma.representant.findFirst({
        where: { id: body.representantId, deletedAt: null, ...attributionScope(user) },
        select: { id: true },
      });
      if (!representant) throw ficheIntrouvable();
      return;
    }
    if (body.prospectId === undefined) throw cibleInvalide();
    const prospect = await this.prisma.prospect.findFirst({
      where: { id: body.prospectId, deletedAt: null, ...prospectReadScope(user) },
      select: { id: true },
    });
    if (!prospect) throw ficheIntrouvable();
  }

  /**
   * EB-10 : au rappel, le formulaire se rouvre pré-rempli. La reprise se limite
   * à l'ouverture précédente du MÊME téléconseiller : le commentaire hérité
   * repart dans l'historique sous le nom de celui qui enregistre, et signer
   * quelqu'un d'autre serait pire que ressaisir.
   */
  private async brouillonPrecedent(
    user: AuthenticatedUser,
    body: OuvrirFicheDto,
  ): Promise<Prisma.InputJsonObject | null> {
    const precedente = await this.prisma.ouvertureFiche.findFirst({
      where: {
        openedById: user.id,
        closedAt: { not: null },
        representantId: body.representantId ?? null,
        prospectId: body.prospectId ?? null,
      },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      select: { draft: true },
    });

    const draft = precedente?.draft;
    if (
      draft === undefined ||
      draft === null ||
      typeof draft !== 'object' ||
      Array.isArray(draft)
    ) {
      return null;
    }
    return draft as Prisma.InputJsonObject;
  }

  /** « Pas à vous » ne se confond pas avec « déjà qualifiée ». */
  private async brouillonRefuse(user: AuthenticatedUser, id: string): Promise<Error> {
    const row = await this.prisma.ouvertureFiche.findUnique({
      where: { id },
      select: { openedById: true, closedAt: true },
    });
    if (!row || row.openedById !== user.id) return ouvertureIntrouvable();
    return dejaFermee();
  }
}
