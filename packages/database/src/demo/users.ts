/**
 * Comptes de démonstration.
 *
 * Toutes les adresses sont en `demo.*@cpi.sn` et tous les noms sont fictifs :
 * personne ne doit pouvoir confondre un compte de démo avec un compte réel, ni
 * pendant la démonstration, ni dans un export, ni dans le journal d'audit.
 *
 * L'équipe raconte une histoire lisible sur le tableau de bord :
 *   Awa      — la meilleure commerciale, 42 prospects, Dakar
 *   Moussa   — 30 prospects, Thiès
 *   Fatou    — 26 prospects, Saint-Louis
 *   Ibrahima — le dernier arrivé, 22 prospects, Kaolack
 * Un panel où les quatre commerciaux ont exactement le même score ressemble à
 * du bruit généré ; celui-ci se lit d'un coup d'œil.
 */
import type { DemoUser } from './types.js';

/**
 * MOT DE PASSE PARTAGÉ des six comptes de démonstration, en clair et assumé :
 * l'animateur doit pouvoir se connecter devant l'auditoire sans chercher.
 *
 * Le semeur le hache avec argon2id avant écriture — il n'est jamais stocké tel
 * quel. Il ne donne accès qu'à des données de démonstration, effacées avec
 * elles quand l'interrupteur est refermé.
 */
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

/** Les commerciaux, dans l'ordre où les campagnes les servent. */
export const DEMO_COMMERCIAL_KEYS = ['awa', 'moussa', 'fatou', 'ibrahima'];
