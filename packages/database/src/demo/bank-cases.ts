import type { DemoBankCase, DemoBankCaseTransition } from './types.js';

const A_TRAITER = 'A_TRAITER';
const EN_TRAITEMENT = 'EN_TRAITEMENT_BANQUE';
const ENCAISSE = 'ENCAISSE';
const REJETE = 'REJETE';

const AGENT = 'banque';

type Outcome =
  | { kind: 'ENCAISSE'; daysAgo: number; amountXof: string }
  | { kind: 'REJETE'; daysAgo: number; reasonCode: string; detail: string | null };

interface CaseSpec {
  key: string;
  reference: string;
  prospectKey: string;
  bank: string;
  createdByKey: string;
  openedDaysAgo: number;
  toBankDaysAgo: number | null;
  outcome: Outcome | null;
}

function transition(
  from: string | null,
  to: string,
  performedByKey: string,
  daysAgo: number,
  extra: Partial<DemoBankCaseTransition> = {},
): DemoBankCaseTransition {
  return {
    fromStageCode: from,
    toStageCode: to,
    performedByKey,
    amountXof: null,
    rejectionReasonCode: null,
    rejectionDetail: null,
    comment: null,
    daysAgo,
    ...extra,
  };
}

function buildCase(spec: CaseSpec): DemoBankCase {
  const opening = transition(null, A_TRAITER, spec.createdByKey, spec.openedDaysAgo, {
    comment: 'Dossier transmis par le commercial.',
  });
  const next: DemoBankCaseTransition[] = [];

  if (spec.toBankDaysAgo !== null) {
    next.push(transition(A_TRAITER, EN_TRAITEMENT, AGENT, spec.toBankDaysAgo));
  }

  const previous = spec.toBankDaysAgo === null ? A_TRAITER : EN_TRAITEMENT;

  if (spec.outcome?.kind === 'ENCAISSE') {
    next.push(
      transition(previous, ENCAISSE, AGENT, spec.outcome.daysAgo, {
        amountXof: spec.outcome.amountXof,
      }),
    );
  } else if (spec.outcome?.kind === 'REJETE') {
    next.push(
      transition(previous, REJETE, AGENT, spec.outcome.daysAgo, {
        amountXof: '0',
        rejectionReasonCode: spec.outcome.reasonCode,
        rejectionDetail: spec.outcome.detail,
      }),
    );
  }

  const transitions = [opening, ...next];
  const last = next.at(-1) ?? opening;

  return {
    key: spec.key,
    reference: spec.reference,
    prospectKey: spec.prospectKey,
    processingBankShortName: spec.bank,
    currentStageCode: last.toStageCode,
    amountXof: last.amountXof,
    rejectionReasonCode: last.rejectionReasonCode,
    rejectionDetail: last.rejectionDetail,
    createdByKey: spec.createdByKey,
    updatedByKey: transitions.length > 1 ? AGENT : null,
    daysAgo: spec.openedDaysAgo,
    transitions,
  };
}

const CASE_SPECS: CaseSpec[] = [
  {
    key: 'bc01',
    reference: 'CPI-DEMO-0001',
    prospectKey: 'p001',
    bank: 'CBAO',
    createdByKey: AGENT,
    openedDaysAgo: 30,
    toBankDaysAgo: 26,
    outcome: { kind: 'ENCAISSE', daysAgo: 21, amountXof: '2500000' },
  },
  {
    key: 'bc02',
    reference: 'CPI-DEMO-0002',
    prospectKey: 'p003',
    bank: 'CBAO',
    createdByKey: AGENT,
    openedDaysAgo: 28,
    toBankDaysAgo: 24,
    outcome: { kind: 'ENCAISSE', daysAgo: 19, amountXof: '1800000' },
  },
  {
    key: 'bc03',
    reference: 'CPI-DEMO-0003',
    prospectKey: 'p005',
    bank: 'CBAO',
    createdByKey: AGENT,
    openedDaysAgo: 26,
    toBankDaysAgo: 22,
    outcome: { kind: 'ENCAISSE', daysAgo: 17, amountXof: '4500000' },
  },
  {
    key: 'bc04',
    reference: 'CPI-DEMO-0004',
    prospectKey: 'p070',
    bank: 'CBAO',
    createdByKey: AGENT,
    openedDaysAgo: 52,
    toBankDaysAgo: 47,
    outcome: { kind: 'ENCAISSE', daysAgo: 40, amountXof: '3200000' },
  },
  {
    key: 'bc05',
    reference: 'CPI-DEMO-0005',
    prospectKey: 'p050',
    bank: 'SGS',
    createdByKey: AGENT,
    openedDaysAgo: 44,
    toBankDaysAgo: 38,
    outcome: { kind: 'ENCAISSE', daysAgo: 31, amountXof: '1250000' },
  },
  {
    key: 'bc06',
    reference: 'CPI-DEMO-0006',
    prospectKey: 'p098',
    bank: 'Ecobank',
    createdByKey: AGENT,
    openedDaysAgo: 58,
    toBankDaysAgo: 50,
    outcome: { kind: 'ENCAISSE', daysAgo: 42, amountXof: '6000000' },
  },
  {
    key: 'bc07',
    reference: 'CPI-DEMO-0007',
    prospectKey: 'p072',
    bank: 'BHS',
    createdByKey: AGENT,
    openedDaysAgo: 46,
    toBankDaysAgo: 40,
    outcome: { kind: 'ENCAISSE', daysAgo: 33, amountXof: '2750000' },
  },

  {
    key: 'bc08',
    reference: 'CPI-DEMO-0008',
    prospectKey: 'p008',
    bank: 'CBAO',
    createdByKey: AGENT,
    openedDaysAgo: 25,
    toBankDaysAgo: 21,
    outcome: { kind: 'REJETE', daysAgo: 16, reasonCode: 'DOCUMENT_MANQUANT', detail: null },
  },
  {
    key: 'bc09',
    reference: 'CPI-DEMO-0009',
    prospectKey: 'p010',
    bank: 'CBAO',
    createdByKey: AGENT,
    openedDaysAgo: 24,
    toBankDaysAgo: 20,
    outcome: { kind: 'REJETE', daysAgo: 15, reasonCode: 'DOCUMENT_MANQUANT', detail: null },
  },
  {
    key: 'bc10',
    reference: 'CPI-DEMO-0010',
    prospectKey: 'p076',
    bank: 'SGS',
    createdByKey: AGENT,
    openedDaysAgo: 40,
    toBankDaysAgo: 35,
    outcome: { kind: 'REJETE', daysAgo: 29, reasonCode: 'SOLDE_INSUFFISANT', detail: null },
  },
  {
    key: 'bc11',
    reference: 'CPI-DEMO-0011',
    prospectKey: 'p103',
    bank: 'CMS',
    createdByKey: AGENT,
    openedDaysAgo: 45,
    toBankDaysAgo: 39,
    outcome: {
      kind: 'REJETE',
      daysAgo: 32,
      reasonCode: 'AUTRE',
      detail: 'Prélèvement déjà en cours auprès d’un autre partenaire.',
    },
  },

  {
    key: 'bc12',
    reference: 'CPI-DEMO-0012',
    prospectKey: 'p013',
    bank: 'CBAO',
    createdByKey: AGENT,
    openedDaysAgo: 22,
    toBankDaysAgo: 18,
    outcome: null,
  },
  {
    key: 'bc13',
    reference: 'CPI-DEMO-0013',
    prospectKey: 'p015',
    bank: 'CBAO',
    createdByKey: AGENT,
    openedDaysAgo: 20,
    toBankDaysAgo: 16,
    outcome: null,
  },
  {
    key: 'bc14',
    reference: 'CPI-DEMO-0014',
    prospectKey: 'p044',
    bank: 'SGS',
    createdByKey: AGENT,
    openedDaysAgo: 32,
    toBankDaysAgo: 27,
    outcome: null,
  },
  {
    key: 'bc15',
    reference: 'CPI-DEMO-0015',
    prospectKey: 'p078',
    bank: 'Ecobank',
    createdByKey: AGENT,
    openedDaysAgo: 33,
    toBankDaysAgo: 28,
    outcome: null,
  },
  {
    key: 'bc16',
    reference: 'CPI-DEMO-0016',
    prospectKey: 'p108',
    bank: 'BHS',
    createdByKey: AGENT,
    openedDaysAgo: 30,
    toBankDaysAgo: 25,
    outcome: null,
  },

  {
    key: 'bc17',
    reference: 'CPI-DEMO-0017',
    prospectKey: 'p017',
    bank: 'CBAO',
    createdByKey: AGENT,
    openedDaysAgo: 12,
    toBankDaysAgo: null,
    outcome: null,
  },
  {
    key: 'bc18',
    reference: 'CPI-DEMO-0018',
    prospectKey: 'p046',
    bank: 'SGS',
    createdByKey: AGENT,
    openedDaysAgo: 10,
    toBankDaysAgo: null,
    outcome: null,
  },
  {
    key: 'bc19',
    reference: 'CPI-DEMO-0019',
    prospectKey: 'p085',
    bank: 'Ecobank',
    createdByKey: 'admin',
    openedDaysAgo: 8,
    toBankDaysAgo: null,
    outcome: null,
  },
  {
    key: 'bc20',
    reference: 'CPI-DEMO-0020',
    prospectKey: 'p112',
    bank: 'CMS',
    createdByKey: 'admin',
    openedDaysAgo: 6,
    toBankDaysAgo: null,
    outcome: null,
  },
];

export const DEMO_BANK_CASES: DemoBankCase[] = CASE_SPECS.map(buildCase);
