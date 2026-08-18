import { ApiProperty } from '@nestjs/swagger';

export class OkDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;
}
