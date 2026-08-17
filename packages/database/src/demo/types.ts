import type {
  CallOutcome,
  CallTaskStatus,
  CampaignScope,
  CampaignStatus,
  EnrollmentMethod,
  Phase2Status,
  ProspectStatut,
  Role,
} from '@prisma/client';

export interface DemoUser {
  key: string;
  email: string;
  username: string;
  fullName: string;
  password: string;
  role: Role;
  phoneE164: string;
  departementCode: string | null;
  lastLoginDaysAgo: number | null;
}

export interface DemoRepresentant {
  key: string;
  fullName: string;
  phoneE164: string;
  departementCode: string;
  createdByKey: string;
  notes: string | null;
  daysAgo: number;
}

export interface DemoProspect {
  key: string;
  prenom: string;
  nom: string;
  syndicatSigle: string;
  banqueShortName: string;
  phoneE164: string;
  representantKey: string;
  createdByKey: string;
  statut: ProspectStatut;
  phase2Status: Phase2Status;
  enrollmentMethod: EnrollmentMethod | null;
  enrollmentDaysAgo: number | null;
  daysAgo: number;
}

export interface DemoCallAttempt {
  key: string;
  prospectKey: string;
  performedByKey: string;
  outcome: CallOutcome;
  method: EnrollmentMethod | null;
  comment: string | null;
  daysAgo: number;
}

export interface DemoCallTask {
  key: string;
  prospectKey: string;
  assignedToKey: string;
  position: number;
  status: CallTaskStatus;
  isActive: boolean;
  completedDaysAgo: number | null;
  attempts: DemoCallAttempt[];
}

export interface DemoCampaign {
  key: string;
  name: string;
  scope: CampaignScope;
  seed: string;
  status: CampaignStatus;
  createdByKey: string;
  daysAgo: number;
  closedDaysAgo: number | null;
  commerciauxKeys: string[];
  tasks: DemoCallTask[];
}

export interface DemoBankCaseTransition {
  fromStageCode: string | null;
  toStageCode: string;
  performedByKey: string;
  amountXof: string | null;
  rejectionReasonCode: string | null;
  rejectionDetail: string | null;
  comment: string | null;
  daysAgo: number;
}

export interface DemoBankCase {
  key: string;
  reference: string;
  prospectKey: string;
  processingBankShortName: string;
  currentStageCode: string;
  amountXof: string | null;
  rejectionReasonCode: string | null;
  rejectionDetail: string | null;
  createdByKey: string;
  updatedByKey: string | null;
  daysAgo: number;
  transitions: DemoBankCaseTransition[];
}

export interface DemoDataset {
  users: DemoUser[];
  representants: DemoRepresentant[];
  prospects: DemoProspect[];
  campaigns: DemoCampaign[];
  bankCases: DemoBankCase[];
}
