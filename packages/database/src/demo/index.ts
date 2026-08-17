import { DEMO_BANK_CASES } from './bank-cases.js';
import { DEMO_CAMPAIGNS } from './campaigns.js';
import { DEMO_PROSPECTS } from './prospects.js';
import { DEMO_REPRESENTANTS } from './representants.js';
import type { DemoDataset } from './types.js';
import { DEMO_USERS } from './users.js';

export * from './types.js';
export { DEMO_PASSWORD, DEMO_USERS, DEMO_COMMERCIAL_KEYS } from './users.js';
export { DEMO_REPRESENTANTS } from './representants.js';
export { DEMO_PROSPECTS } from './prospects.js';
export { DEMO_CAMPAIGNS } from './campaigns.js';
export { DEMO_BANK_CASES } from './bank-cases.js';

export const DEMO_DATASET: DemoDataset = {
  users: DEMO_USERS,
  representants: DEMO_REPRESENTANTS,
  prospects: DEMO_PROSPECTS,
  campaigns: DEMO_CAMPAIGNS,
  bankCases: DEMO_BANK_CASES,
};
