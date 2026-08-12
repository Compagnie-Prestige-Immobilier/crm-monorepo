import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';

export enum ExportMode {
  /** Une feuille de prospects correspondant exactement aux filtres reçus. */
  FILTERED = 'filtered',
  /** Cinq feuilles : Consolidé, BDD1, BDD2, BDD3, BDD4. */
  CONSOLIDATED = 'consolidated',
}

/** Nom des feuilles du classeur consolidé. Contrôlé par les tests. */
export const CONSOLIDATED_SHEET = 'Consolidé';

export class ExportQueryDto extends ProspectFilterDto {
  @ApiPropertyOptional({
    enum: ExportMode,
    enumName: 'ExportMode',
    default: ExportMode.FILTERED,
    description:
      '`filtered` : une feuille correspondant aux filtres. `consolidated` : cinq feuilles (Consolidé, BDD1…BDD4) ; le paramètre `segment` y est sans effet, puisque c’est le classeur lui-même qui porte la segmentation.',
  })
  @IsOptional()
  @IsEnum(ExportMode)
  mode?: ExportMode;
}
