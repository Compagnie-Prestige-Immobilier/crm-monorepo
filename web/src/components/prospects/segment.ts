import type { BddSegment } from '@/lib/types';

const CHUES_SIGLE = 'CHUES';

const CBAO_SHORT_NAME = 'CBAO';

export function classifySegment(input: {
  syndicatSigle: string;
  banqueShortName: string;
}): BddSegment {
  const isChues = input.syndicatSigle === CHUES_SIGLE;
  const isCbao = input.banqueShortName === CBAO_SHORT_NAME;

  if (isChues) return isCbao ? 'BDD1' : 'BDD2';
  return isCbao ? 'BDD3' : 'BDD4';
}

/** Les quatre bases sans leur code : le syndicat, puis la banque. */
export const SEGMENT_LISIBLE: Record<BddSegment, string> = {
  BDD1: 'CHUES, CBAO',
  BDD2: 'CHUES, autre banque',
  BDD3: 'Autre syndicat, CBAO',
  BDD4: 'Autre syndicat, autre banque',
};
