export const PROSPECT_ORIGINS = ['BANQUE'] as const;

export type ProspectOrigin = (typeof PROSPECT_ORIGINS)[number];
