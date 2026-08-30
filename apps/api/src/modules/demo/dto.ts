import { ApiProperty } from '@nestjs/swagger';

export class DemoWorkspaceCountsDto {
  @ApiProperty() users!: number;
  @ApiProperty() representants!: number;
  @ApiProperty() prospects!: number;
  @ApiProperty() bankCases!: number;
}

export class DemoWorkspaceStatusDto {
  @ApiProperty({ enum: ['demo'] }) workspace!: 'demo';
  @ApiProperty({ type: DemoWorkspaceCountsDto }) counts!: DemoWorkspaceCountsDto;
}
