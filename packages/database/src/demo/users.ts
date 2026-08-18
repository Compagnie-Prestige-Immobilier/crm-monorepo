import type { DemoUser } from './types.js';

export const DEMO_PASSWORD = 'Demo1-CPI-Sunugal';

export const DEMO_USERS: DemoUser[] = [
  {
    key: 'admin',
    email: 'demo.admin@cpi.sn',
    username: 'demo.admin',
    fullName: 'Cheikh Mbaye',
    password: DEMO_PASSWORD,
    role: 'ADMIN',
    phoneE164: '+221775010006',
    departementCode: 'DK-DAK',
    lastLoginDaysAgo: 0,
  },
  {
    key: 'awa',
    email: 'demo.awa@cpi.sn',
    username: 'demo.awa',
    fullName: 'Awa Ndiaye',
    password: DEMO_PASSWORD,
    role: 'COMMERCIAL',
    phoneE164: '+221775010001',
    departementCode: 'DK-DAK',
    lastLoginDaysAgo: 0,
  },
  {
    key: 'moussa',
    email: 'demo.moussa@cpi.sn',
    username: 'demo.moussa',
    fullName: 'Moussa Diop',
    password: DEMO_PASSWORD,
    role: 'COMMERCIAL',
    phoneE164: '+221775010002',
    departementCode: 'TH-THI',
    lastLoginDaysAgo: 1,
  },
  {
    key: 'fatou',
    email: 'demo.fatou@cpi.sn',
    username: 'demo.fatou',
    fullName: 'Fatou Sarr',
    password: DEMO_PASSWORD,
    role: 'COMMERCIAL',
    phoneE164: '+221775010003',
    departementCode: 'SL-STL',
    lastLoginDaysAgo: 2,
  },
  {
    key: 'ibrahima',
    email: 'demo.ibrahima@cpi.sn',
    username: 'demo.ibrahima',
    fullName: 'Ibrahima Fall',
    password: DEMO_PASSWORD,
    role: 'COMMERCIAL',
    phoneE164: '+221775010004',
    departementCode: 'KL-KAO',
    lastLoginDaysAgo: 3,
  },
  {
    key: 'banque',
    email: 'demo.banque@cpi.sn',
    username: 'demo.banque',
    fullName: 'Aïssatou Guèye',
    password: DEMO_PASSWORD,
    role: 'BANQUE_FINANCE',
    phoneE164: '+221775010005',
    departementCode: 'DK-DAK',
    lastLoginDaysAgo: 1,
  },
];

export const DEMO_COMMERCIAL_KEYS = ['awa', 'moussa', 'fatou', 'ibrahima'];
