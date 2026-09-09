import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImportKind, VisiteImportChangeKind, type Prisma } from '@crm/database';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { PrismaService } from '../../prisma/prisma.service.js';
import { PageMetaDto } from '../../common/dto/prospect-filter.dto.js';
import { OkDto } from '../../common/dto/ok.dto.js';

/**
 * L'écran de revue de l'aller-retour Excel : les différences que la
 * SIMULATION a détectées, décochables avant l'APPLICATION.
 *
 * Le job doit être un import `VISITES_REGISTRE` : un import de prospects n'a
 * pas de différences, mais sans ce garde-fou nommé, cette porte deviendrait
 * un moyen d'atteindre l'apply d'un travail d'une autre nature.
 */

export class VisiteImportChangeFieldDto {
  @ApiProperty({ description: 'Clé machine de la colonne, ex. `entreprise`.' }) field!: string;
  @ApiProperty({ description: 'En-tête de la colonne, tel qu’affiché.' }) label!: string;
  @ApiProperty() before!: string;
  @ApiProperty() after!: string;
}

export class VisiteImportChangeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() sheet!: string;
  @ApiProperty({ type: Number }) rowNumber!: number;

  @ApiProperty({ enum: VisiteImportChangeKind, enumName: 'VisiteImportChangeKind' })
  kind!: VisiteImportChangeKind;

  @ApiProperty({ type: String, nullable: true, description: 'Nul pour une création.' })
  reference!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  visiteId!: string | null;

  @ApiProperty({ description: '« MME LY SEYNABOU, 12/08 14:30 », sans avoir à relire la visite.' })
  label!: string;

  @ApiProperty({ type: () => [VisiteImportChangeFieldDto] }) fields!: VisiteImportChangeFieldDto[];

  @ApiProperty({
    type: Boolean,
    description: 'Coché par défaut : décocher retire la ligne de l’application.',
  })
  selected!: boolean;
}

export class VisiteImportChangeListDto {
  @ApiProperty({ type: () => [VisiteImportChangeDto] }) items!: VisiteImportChangeDto[];
  @ApiProperty({ type: () => PageMetaDto }) meta!: PageMetaDto;
}

export class VisiteImportChangeQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;
}

export class SetVisiteImportChangeSelectionDto {
  @ApiProperty({ type: [String], format: 'uuid', description: 'Les lignes visées par ce geste.' })
  // Les lignes de revue portent des UUID v7.
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(5_000)
  ids!: string[];

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  selected!: boolean;
}

const NOT_FOUND = {
  code: 'IMPORT_JOB_NOT_FOUND',
  message: 'Ce travail d’import n’existe pas.',
};

function toFieldDto(raw: Prisma.JsonValue): VisiteImportChangeFieldDto[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const row = entry as Record<string, unknown>;
    if (
      typeof row.field !== 'string' ||
      typeof row.label !== 'string' ||
      typeof row.before !== 'string' ||
      typeof row.after !== 'string'
    ) {
      return [];
    }
    return [{ field: row.field, label: row.label, before: row.before, after: row.after }];
  });
}

@Injectable()
export class VisitesRegistreRevueService {
  constructor(private readonly prisma: PrismaService) {}

  /** 404, jamais 403 : un import d'une autre nature ne doit même pas se laisser deviner. */
  async assertRegistreJob(jobId: string): Promise<void> {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
      select: { kind: true },
    });
    if (job === null || job.kind !== ImportKind.VISITES_REGISTRE) {
      throw new NotFoundException(NOT_FOUND);
    }
  }

  async revue(
    jobId: string,
    query: VisiteImportChangeQueryDto,
  ): Promise<VisiteImportChangeListDto> {
    await this.assertRegistreJob(jobId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const [total, rows] = await Promise.all([
      this.prisma.visiteImportChange.count({ where: { importJobId: jobId } }),
      this.prisma.visiteImportChange.findMany({
        where: { importJobId: jobId },
        orderBy: [{ sheet: 'asc' }, { rowNumber: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        sheet: row.sheet,
        rowNumber: row.rowNumber,
        kind: row.kind,
        reference: row.reference,
        visiteId: row.visiteId,
        label: row.label,
        fields: toFieldDto(row.fields),
        selected: row.selected,
      })),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async setSelection(jobId: string, body: SetVisiteImportChangeSelectionDto): Promise<OkDto> {
    await this.assertRegistreJob(jobId);

    await this.prisma.visiteImportChange.updateMany({
      where: { importJobId: jobId, id: { in: body.ids } },
      data: { selected: body.selected },
    });

    return { ok: true };
  }
}
