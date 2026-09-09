import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CreateVisiteReferentielDto,
  ReorderVisiteReferentielDto,
  SetVisiteReferentielActiveDto,
  UpdateVisiteReferentielDto,
  VisiteReferentielDto,
  VisiteReferentielKind,
  VisiteReferentielListDto,
  VisiteReferentielsBundleDto,
} from './dto.js';

export class VisiteReferentielUsageEntryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) count!: number;
}

export class VisiteReferentielUsageDto {
  @ApiProperty({ type: () => [VisiteReferentielUsageEntryDto] })
  entreprises!: VisiteReferentielUsageEntryDto[];
  @ApiProperty({ type: () => [VisiteReferentielUsageEntryDto] })
  directions!: VisiteReferentielUsageEntryDto[];
  @ApiProperty({ type: () => [VisiteReferentielUsageEntryDto] })
  destinataires!: VisiteReferentielUsageEntryDto[];
  @ApiProperty({ type: () => [VisiteReferentielUsageEntryDto] })
  objets!: VisiteReferentielUsageEntryDto[];
}

const VisiteReferentielError = {
  NOT_FOUND: 'VISITE_REFERENTIEL_NOT_FOUND',
  CODE_CONFLICT: 'VISITE_REFERENTIEL_CODE_CONFLICT',
  LABEL_CONFLICT: 'VISITE_REFERENTIEL_LABEL_CONFLICT',
} as const;

interface ReferentielRow {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  updatedAt: Date;
}

interface ReferentielDelegate {
  findMany(args?: unknown): Promise<ReferentielRow[]>;
  findUnique(args: unknown): Promise<ReferentielRow | null>;
  create(args: unknown): Promise<ReferentielRow>;
  update(args: unknown): Promise<ReferentielRow>;
}

const LABELS: Readonly<Record<VisiteReferentielKind, string>> = {
  entreprises: 'entreprise',
  directions: 'direction',
  destinataires: 'destinataire',
  objets: 'objet de visite',
};

const toDto = (row: ReferentielRow): VisiteReferentielDto => ({
  id: row.id,
  code: row.code,
  label: row.label,
  isActive: row.isActive,
  isSystem: row.isSystem,
  sortOrder: row.sortOrder,
  updatedAt: row.updatedAt.toISOString(),
});

const ORDER = [{ sortOrder: 'asc' as const }, { label: 'asc' as const }];

@Injectable()
export class VisiteReferentielsService {
  constructor(private readonly prisma: PrismaService) {}

  async bundle(activeOnly: boolean): Promise<VisiteReferentielsBundleDto> {
    const [entreprises, directions, destinataires, objets] = await Promise.all([
      this.list('entreprises', activeOnly),
      this.list('directions', activeOnly),
      this.list('destinataires', activeOnly),
      this.list('objets', activeOnly),
    ]);
    return {
      entreprises: entreprises.items,
      directions: directions.items,
      destinataires: destinataires.items,
      objets: objets.items,
    };
  }

  async list(kind: VisiteReferentielKind, activeOnly: boolean): Promise<VisiteReferentielListDto> {
    const rows = await this.delegate(kind).findMany({
      ...(activeOnly ? { where: { isActive: true } } : {}),
      orderBy: ORDER,
    });
    return { items: rows.map(toDto) };
  }

  async create(
    kind: VisiteReferentielKind,
    input: CreateVisiteReferentielDto,
  ): Promise<VisiteReferentielDto> {
    const delegate = this.delegate(kind);
    const code = input.code.trim().toUpperCase();
    const label = input.label.trim();

    const sameCode = await delegate.findUnique({ where: { code } });
    if (sameCode) {
      throw new ConflictException({
        code: VisiteReferentielError.CODE_CONFLICT,
        message: `Le code « ${code} » est déjà porté par « ${sameCode.label} ».`,
        existingId: sameCode.id,
      });
    }

    const sameLabel = await delegate.findUnique({ where: { label } });
    if (sameLabel) {
      throw new ConflictException({
        code: VisiteReferentielError.LABEL_CONFLICT,
        message: `Le libellé « ${label} » existe déjà sous le code « ${sameLabel.code} ».`,
        existingId: sameLabel.id,
      });
    }

    const created = await delegate.create({
      data: {
        code,
        label,
        sortOrder: input.sortOrder ?? 100,
        isActive: true,
        isSystem: false,
      },
    });
    return toDto(created);
  }

  async update(
    kind: VisiteReferentielKind,
    id: string,
    input: UpdateVisiteReferentielDto,
  ): Promise<VisiteReferentielDto> {
    const delegate = this.delegate(kind);
    await this.entry(kind, id);

    if (input.label !== undefined) {
      const label = input.label.trim();
      const sameLabel = await delegate.findUnique({ where: { label } });
      if (sameLabel && sameLabel.id !== id) {
        throw new ConflictException({
          code: VisiteReferentielError.LABEL_CONFLICT,
          message: `Le libellé « ${label} » existe déjà sous le code « ${sameLabel.code} ».`,
          existingId: sameLabel.id,
        });
      }
    }

    const updated = await delegate.update({
      where: { id },
      data: {
        ...(input.label === undefined ? {} : { label: input.label.trim() }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      },
    });
    return toDto(updated);
  }

  /**
   * Désactivation et jamais suppression : les visites déjà enregistrées
   * désignent l'entrée, et le registre d'une année close doit rester lisible.
   */
  async setActive(
    kind: VisiteReferentielKind,
    id: string,
    input: SetVisiteReferentielActiveDto,
  ): Promise<VisiteReferentielDto> {
    await this.entry(kind, id);
    const updated = await this.delegate(kind).update({
      where: { id },
      data: { isActive: input.isActive },
    });
    return toDto(updated);
  }

  async reorder(
    kind: VisiteReferentielKind,
    input: ReorderVisiteReferentielDto,
  ): Promise<VisiteReferentielListDto> {
    const known = await this.delegate(kind).findMany({ where: { id: { in: input.ids } } });
    const found = new Set(known.map((row) => row.id));
    const missing = input.ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new NotFoundException({
        code: VisiteReferentielError.NOT_FOUND,
        message: `Aucun ${LABELS[kind]} sous cet identifiant.`,
        missing,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const delegate = this.delegate(kind, tx);
      for (const [index, id] of input.ids.entries()) {
        await delegate.update({ where: { id }, data: { sortOrder: index + 1 } });
      }
    });

    return this.list(kind, false);
  }

  /** Décompte total, sans plage de dates : combien de visites désignent chaque entrée. */
  async usage(): Promise<VisiteReferentielUsageDto> {
    const [entreprises, directions, destinataires, objets] = await Promise.all([
      this.usageFor('entreprises'),
      this.usageFor('directions'),
      this.usageFor('destinataires'),
      this.usageFor('objets'),
    ]);
    return { entreprises, directions, destinataires, objets };
  }

  private async usageFor(kind: VisiteReferentielKind): Promise<VisiteReferentielUsageEntryDto[]> {
    const entries = (await this.list(kind, false)).items;
    const counts = await Promise.all(entries.map((entry) => this.countFor(kind, entry.id)));
    return entries.map((entry, index) => ({ id: entry.id, count: counts[index] ?? 0 }));
  }

  private countFor(kind: VisiteReferentielKind, id: string): Promise<number> {
    switch (kind) {
      case 'entreprises':
        return this.prisma.visite.count({ where: { entrepriseId: id } });
      case 'directions':
        return this.prisma.visite.count({ where: { directionId: id } });
      case 'destinataires':
        return this.prisma.visite.count({ where: { destinataireId: id } });
      case 'objets':
        return this.prisma.visite.count({ where: { objetId: id } });
    }
  }

  private async entry(kind: VisiteReferentielKind, id: string): Promise<ReferentielRow> {
    const found = await this.delegate(kind).findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundException({
        code: VisiteReferentielError.NOT_FOUND,
        message: `Aucun ${LABELS[kind]} sous cet identifiant.`,
      });
    }
    return found;
  }

  /** Les quatre référentiels ont la MÊME forme : un seul jeu de routes les sert. */
  private delegate(
    kind: VisiteReferentielKind,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): ReferentielDelegate {
    const delegates = {
      entreprises: client.visiteEntreprise,
      directions: client.visiteDirection,
      destinataires: client.visiteDestinataire,
      objets: client.visiteObjet,
    };
    return delegates[kind];
  }
}
