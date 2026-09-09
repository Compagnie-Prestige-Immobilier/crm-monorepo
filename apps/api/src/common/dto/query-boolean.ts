import type { TransformFnParams } from 'class-transformer';

export const queryBoolean = (params: TransformFnParams): boolean =>
  params.value === true || params.value === 'true' || params.value === '1';
