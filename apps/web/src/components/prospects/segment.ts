import type { BddSegment } from '@/lib/types';

export const CHUES_SIGLE = 'CHUES';

export const CBAO_SHORT_NAME = 'CBAO';

export function classifySegment(input: {
  syndicatSigle: string;
  banqueShortName: string;
}): BddSegment {
  const isChues = input.syndicatSigle === CHUES_SIGLE;
  const isCbao = input.banqueShortName === CBAO_SHORT_NAME;

  if (isChues) return isCbao ? 'BDD1' : 'BDD2';
  return isCbao ? 'BDD3' : 'BDD4';
}
