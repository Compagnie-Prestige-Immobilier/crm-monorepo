import { ApiProperty } from '@nestjs/swagger';

/** Accusé de réception minimal, pour les opérations sans corps de réponse utile. */
export class OkDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;
}
