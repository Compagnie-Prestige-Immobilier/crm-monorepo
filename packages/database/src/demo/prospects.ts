/**
 * 120 prospects de démonstration, écrits en tableau compact.
 *
 * ── Répartition VOULUE des segments BDD ──────────────────────────────────────
 * Le segment n'est pas une colonne : il se DÉDUIT du croisement
 * (syndicat = CHUES ?) × (banque = CBAO ?), via `classifySegment`. Les paires
 * ci-dessous sont donc choisies pour produire exactement cette répartition,
 * que le test vérifie en recalculant les segments :
 *
 *   BDD1  CHUES / CBAO          42 prospects  (35 %)   lignes p001 → p042
 *   BDD2  CHUES / autre banque  24 prospects  (20 %)   lignes p043 → p066
 *   BDD3  autre syndicat / CBAO 30 prospects  (25 %)   lignes p067 → p096
 *   BDD4  autre / autre         24 prospects  (20 %)   lignes p097 → p120
 *
 * ── Répartition VOULUE de la phase 2 ─────────────────────────────────────────
 *   PENDING          60  (50 %)   le stock à travailler
 *   METHOD_OBTAINED  40  (33 %)   dont 18 PLATFORM, 14 PHYSICAL, 8 VOICE…
 *   REFUSED          12  (10 %)
 *   WRONG_NUMBER      8  ( 7 %)
 * BDD1 convertit mieux que BDD4 (18/42 contre 5/24) : c'est le message que la
 * démonstration doit faire passer, pas une égalité artificielle entre segments.
 *
 * ── Propriété des fiches ─────────────────────────────────────────────────────
 * Le commercial propriétaire n'est PAS saisi ligne à ligne : il est déduit du
 * représentant. Une seule source, donc aucune contradiction possible entre
 * « le représentant d'Awa » et « le prospect de Moussa ».
 *   Awa 42 · Moussa 30 · Fatou 26 · Ibrahima 22
 *
 * Toutes les clés de référentiel employées ici — sigles de syndicats et noms
 * courts de banques — existent dans `seed-data/syndicats.ts` et
 * `seed-data/banques.ts`, et le test le revérifie une par une.
 */
import type { EnrollmentMethod, Phase2Status, ProspectStatut } from '@prisma/client';

import { DEMO_REPRESENTANTS } from './representants.js';
import type { DemoProspect } from './types.js';

// Abréviations locales : sans elles, un tableau de 120 lignes déborde et
// devient illisible — or c'est justement sa lisibilité qui permet de vérifier
// la répartition à l'œil avant même de lancer le test.
const WAIT: Phase2Status = 'PENDING';
const OK: Phase2Status = 'METHOD_OBTAINED';
const NO: Phase2Status = 'REFUSED';
const BAD: Phase2Status = 'WRONG_NUMBER';

const PLAT: EnrollmentMethod = 'PLATFORM';
const PHYS: EnrollmentMethod = 'PHYSICAL';
const VOIX: EnrollmentMethod = 'VOICE_OR_ELECTRONIC_MESSAGING';

type ProspectRow = readonly [
  key: string,
  prenom: string,
  nom: string,
  syndicatSigle: string,
  banqueShortName: string,
  representantKey: string,
  phase2Status: Phase2Status,
  enrollmentMethod: EnrollmentMethod | null,
  daysAgo: number,
  enrollmentDaysAgo: number | null,
];

const PROSPECT_ROWS: readonly ProspectRow[] = [
  // ══ BDD1 — CHUES / CBAO — 42 ═══════════════════════════════════════════════
  ['p001', 'Awa', 'Diop', 'CHUES', 'CBAO', 'r01', OK, PLAT, 95, 36],
  ['p002', 'Modou', 'Fall', 'CHUES', 'CBAO', 'r01', WAIT, null, 88, null],
  ['p003', 'Aïssatou', 'Sarr', 'CHUES', 'CBAO', 'r01', OK, PHYS, 84, 34],
  ['p004', 'Ibrahima', 'Guèye', 'CHUES', 'CBAO', 'r01', WAIT, null, 80, null],
  ['p005', 'Fatou', 'Ndiaye', 'CHUES', 'CBAO', 'r02', OK, PLAT, 76, 32],
  ['p006', 'Cheikh', 'Sow', 'CHUES', 'CBAO', 'r02', NO, null, 74, null],
  ['p007', 'Bineta', 'Ba', 'CHUES', 'CBAO', 'r02', WAIT, null, 70, null],
  ['p008', 'Assane', 'Cissé', 'CHUES', 'CBAO', 'r03', OK, PHYS, 68, 30],
  ['p009', 'Sokhna', 'Faye', 'CHUES', 'CBAO', 'r03', WAIT, null, 66, null],
  ['p010', 'Malick', 'Diallo', 'CHUES', 'CBAO', 'r03', OK, PLAT, 64, 28],
  ['p011', 'Astou', 'Mbaye', 'CHUES', 'CBAO', 'r04', WAIT, null, 62, null],
  ['p012', 'Samba', 'Seck', 'CHUES', 'CBAO', 'r04', BAD, null, 60, null],
  ['p013', 'Marième', 'Thiam', 'CHUES', 'CBAO', 'r04', OK, VOIX, 58, 26],
  ['p014', 'Idrissa', 'Sy', 'CHUES', 'CBAO', 'r05', WAIT, null, 56, null],
  ['p015', 'Seynabou', 'Kane', 'CHUES', 'CBAO', 'r05', OK, PLAT, 54, 24],
  ['p016', 'Papa', 'Touré', 'CHUES', 'CBAO', 'r06', WAIT, null, 52, null],
  ['p017', 'Dieynaba', 'Niang', 'CHUES', 'CBAO', 'r06', OK, PHYS, 50, 40],
  ['p018', 'Amadou', 'Ndour', 'CHUES', 'CBAO', 'r06', WAIT, null, 48, null],
  ['p019', 'Yacine', 'Diagne', 'CHUES', 'CBAO', 'r07', OK, PLAT, 46, 33],
  ['p020', 'Souleymane', 'Camara', 'CHUES', 'CBAO', 'r07', NO, null, 44, null],
  ['p021', 'Anta', 'Sané', 'CHUES', 'CBAO', 'r07', WAIT, null, 42, null],
  ['p022', 'Lamine', 'Badji', 'CHUES', 'CBAO', 'r08', OK, PHYS, 40, 30],
  ['p023', 'Nogaye', 'Coly', 'CHUES', 'CBAO', 'r08', WAIT, null, 39, null],
  ['p024', 'Bocar', 'Mendy', 'CHUES', 'CBAO', 'r08', OK, PLAT, 38, 28],
  ['p025', 'Maïmouna', 'Sagna', 'CHUES', 'CBAO', 'r09', WAIT, null, 37, null],
  ['p026', 'Saliou', 'Diatta', 'CHUES', 'CBAO', 'r09', OK, VOIX, 36, 27],
  ['p027', 'Penda', 'Dieng', 'CHUES', 'CBAO', 'r10', WAIT, null, 35, null],
  ['p028', 'Pape', 'Wade', 'CHUES', 'CBAO', 'r10', OK, PLAT, 34, 25],
  ['p029', 'Oumou', 'Lô', 'CHUES', 'CBAO', 'r10', NO, null, 33, null],
  ['p030', 'Boubacar', 'Samb', 'CHUES', 'CBAO', 'r10', WAIT, null, 32, null],
  ['p031', 'Ramatoulaye', 'Gaye', 'CHUES', 'CBAO', 'r11', OK, PHYS, 31, 22],
  ['p032', 'Djibril', 'Diouf', 'CHUES', 'CBAO', 'r11', WAIT, null, 30, null],
  ['p033', 'Thioro', 'Ndoye', 'CHUES', 'CBAO', 'r11', OK, PLAT, 29, 10],
  ['p034', 'Élimane', 'Bèye', 'CHUES', 'CBAO', 'r12', WAIT, null, 28, null],
  ['p035', 'Fatoumata', 'Diakhaté', 'CHUES', 'CBAO', 'r12', OK, PHYS, 27, 9],
  ['p036', 'Massamba', 'Tall', 'CHUES', 'CBAO', 'r13', WAIT, null, 26, null],
  ['p037', 'Salimata', 'Diop', 'CHUES', 'CBAO', 'r13', BAD, null, 25, null],
  ['p038', 'Daouda', 'Ndiaye', 'CHUES', 'CBAO', 'r13', OK, VOIX, 24, 7],
  ['p039', 'Nafissatou', 'Fall', 'CHUES', 'CBAO', 'r14', WAIT, null, 23, null],
  ['p040', 'Mor', 'Sow', 'CHUES', 'CBAO', 'r14', OK, PLAT, 22, 5],
  ['p041', 'Adja', 'Sarr', 'CHUES', 'CBAO', 'r15', WAIT, null, 21, null],
  ['p042', 'Baba', 'Guèye', 'CHUES', 'CBAO', 'r15', NO, null, 20, null],

  // ══ BDD2 — CHUES / autre banque — 24 ═══════════════════════════════════════
  ['p043', 'Ndèye', 'Diouf', 'CHUES', 'SGS', 'r01', WAIT, null, 92, null],
  ['p044', 'Alioune', 'Faye', 'CHUES', 'Ecobank', 'r01', OK, PLAT, 90, 35],
  ['p045', 'Coumba', 'Mbaye', 'CHUES', 'BHS', 'r02', WAIT, null, 86, null],
  ['p046', 'Serigne', 'Diallo', 'CHUES', 'CMS', 'r02', OK, PHYS, 82, 31],
  ['p047', 'Khady', 'Thiam', 'CHUES', 'SGS', 'r03', WAIT, null, 78, null],
  ['p048', 'Ousmane', 'Ndoye', 'CHUES', 'Ecobank', 'r03', NO, null, 72, null],
  ['p049', 'Aminata', 'Seck', 'CHUES', 'BOA Sénégal', 'r04', WAIT, null, 68, null],
  ['p050', 'Abdoulaye', 'Sy', 'CHUES', 'SGS', 'r05', OK, PLAT, 64, 48],
  ['p051', 'Rokhaya', 'Camara', 'CHUES', 'CMS', 'r05', WAIT, null, 60, null],
  ['p052', 'Babacar', 'Diagne', 'CHUES', 'Ecobank', 'r06', WAIT, null, 56, null],
  ['p053', 'Mame Diarra', 'Sané', 'CHUES', 'BHS', 'r06', OK, VOIX, 52, 38],
  ['p054', 'Ismaïla', 'Badji', 'CHUES', 'SGS', 'r07', WAIT, null, 50, null],
  ['p055', 'Nafissatou', 'Coly', 'CHUES', 'CMS', 'r08', BAD, null, 47, null],
  ['p056', 'Tapha', 'Mendy', 'CHUES', 'Ecobank', 'r09', WAIT, null, 45, null],
  ['p057', 'Adja', 'Sagna', 'CHUES', 'BHS', 'r10', OK, PLAT, 43, 30],
  ['p058', 'Ngagne', 'Diatta', 'CHUES', 'SGS', 'r10', WAIT, null, 41, null],
  ['p059', 'Bineta', 'Dieng', 'CHUES', 'CMS', 'r11', OK, PHYS, 39, 26],
  ['p060', 'Cheikh', 'Wade', 'CHUES', 'Ecobank', 'r11', WAIT, null, 37, null],
  ['p061', 'Astou', 'Lô', 'CHUES', 'SGS', 'r12', NO, null, 35, null],
  ['p062', 'Modou', 'Samb', 'CHUES', 'BOA Sénégal', 'r12', WAIT, null, 33, null],
  ['p063', 'Seynabou', 'Gaye', 'CHUES', 'CMS', 'r13', OK, PLAT, 31, 20],
  ['p064', 'Amadou', 'Bèye', 'CHUES', 'Ecobank', 'r14', WAIT, null, 29, null],
  ['p065', 'Yacine', 'Diakhaté', 'CHUES', 'SGS', 'r15', NO, null, 27, null],
  ['p066', 'Malick', 'Tall', 'CHUES', 'BHS', 'r15', OK, PHYS, 25, 14],

  // ══ BDD3 — autre syndicat / CBAO — 30 ══════════════════════════════════════
  ['p067', 'Mor', 'Ndiaye', 'UES', 'CBAO', 'r01', OK, PLAT, 98, 38],
  ['p068', 'Sokhna', 'Diop', 'SAEMSS', 'CBAO', 'r01', WAIT, null, 94, null],
  ['p069', 'Assane', 'Fall', 'CUSEMS', 'CBAO', 'r02', WAIT, null, 91, null],
  ['p070', 'Marième', 'Sow', 'SUTSAS', 'CBAO', 'r02', OK, PHYS, 87, 60],
  ['p071', 'Samba', 'Ba', 'CNTS', 'CBAO', 'r03', WAIT, null, 83, null],
  ['p072', 'Anta', 'Sarr', 'SAES', 'CBAO', 'r03', OK, PLAT, 79, 52],
  ['p073', 'Saliou', 'Guèye', 'SELS', 'CBAO', 'r04', WAIT, null, 75, null],
  ['p074', 'Dieynaba', 'Cissé', 'UES', 'CBAO', 'r04', NO, null, 71, null],
  ['p075', 'Djibril', 'Faye', 'SAEMSS', 'CBAO', 'r05', WAIT, null, 67, null],
  ['p076', 'Oumou', 'Diallo', 'SUTSAS', 'CBAO', 'r05', OK, VOIX, 63, 44],
  ['p077', 'Massamba', 'Mbaye', 'CUSEMS', 'CBAO', 'r06', WAIT, null, 59, null],
  ['p078', 'Penda', 'Seck', 'SAMES', 'CBAO', 'r06', OK, PLAT, 55, 36],
  ['p079', 'Bocar', 'Thiam', 'CNTS', 'CBAO', 'r07', WAIT, null, 51, null],
  ['p080', 'Ramatoulaye', 'Sy', 'UES', 'CBAO', 'r07', BAD, null, 49, null],
  ['p081', 'Daouda', 'Kane', 'SAEMSS', 'CBAO', 'r08', WAIT, null, 46, null],
  ['p082', 'Fatoumata', 'Touré', 'SELS', 'CBAO', 'r08', OK, PHYS, 44, 28],
  ['p083', 'Élimane', 'Niang', 'UNSAS', 'CBAO', 'r09', WAIT, null, 42, null],
  ['p084', 'Thioro', 'Ndour', 'SUTSAS', 'CBAO', 'r09', WAIT, null, 40, null],
  ['p085', 'Baba', 'Diagne', 'CNTS', 'CBAO', 'r10', OK, PLAT, 38, 24],
  ['p086', 'Salimata', 'Camara', 'SAEMSS', 'CBAO', 'r10', WAIT, null, 36, null],
  ['p087', 'Pape', 'Sané', 'CUSEMS', 'CBAO', 'r11', NO, null, 34, null],
  ['p088', 'Nogaye', 'Badji', 'SYTJUST', 'CBAO', 'r11', WAIT, null, 32, null],
  ['p089', 'Boubacar', 'Coly', 'UES', 'CBAO', 'r12', OK, PHYS, 30, 18],
  ['p090', 'Maïmouna', 'Mendy', 'SAES', 'CBAO', 'r12', WAIT, null, 28, null],
  ['p091', 'Lamine', 'Sagna', 'SUTSAS', 'CBAO', 'r13', WAIT, null, 26, null],
  ['p092', 'Aïssatou', 'Diatta', 'CNTS', 'CBAO', 'r13', OK, VOIX, 24, 12],
  ['p093', 'Souleymane', 'Dieng', 'SELS', 'CBAO', 'r14', BAD, null, 22, null],
  ['p094', 'Bineta', 'Wade', 'SAEMSS', 'CBAO', 'r14', WAIT, null, 20, null],
  ['p095', 'Idrissa', 'Lô', 'UES', 'CBAO', 'r15', NO, null, 18, null],
  ['p096', 'Adja', 'Samb', 'CUSEMS', 'CBAO', 'r15', WAIT, null, 16, null],

  // ══ BDD4 — autre syndicat / autre banque — 24 ══════════════════════════════
  ['p097', 'Ngagne', 'Diop', 'SAEMSS', 'SGS', 'r01', WAIT, null, 96, null],
  ['p098', 'Astou', 'Ndiaye', 'CNTS', 'Ecobank', 'r01', OK, PHYS, 93, 64],
  ['p099', 'Cheikh', 'Diallo', 'UES', 'CMS', 'r02', WAIT, null, 89, null],
  ['p100', 'Khady', 'Sow', 'SUTSAS', 'BHS', 'r02', WAIT, null, 85, null],
  ['p101', 'Modou', 'Cissé', 'SELS', 'SGS', 'r03', BAD, null, 81, null],
  ['p102', 'Coumba', 'Faye', 'CUSEMS', 'PAMECAS', 'r04', WAIT, null, 77, null],
  ['p103', 'Alioune', 'Ba', 'SAES', 'Ecobank', 'r04', OK, VOIX, 73, 50],
  ['p104', 'Fatou', 'Kane', 'SAMES', 'CMS', 'r05', WAIT, null, 69, null],
  ['p105', 'Papa', 'Ndoye', 'UNSAS', 'SGS', 'r06', WAIT, null, 65, null],
  ['p106', 'Sokhna', 'Camara', 'SAEMSS', 'BOA Sénégal', 'r06', NO, null, 61, null],
  ['p107', 'Amadou', 'Sané', 'CNTS', 'Ecobank', 'r07', WAIT, null, 57, null],
  ['p108', 'Marième', 'Badji', 'SYTJUST', 'BHS', 'r07', OK, PHYS, 53, 34],
  ['p109', 'Ousmane', 'Coly', 'UES', 'CMS', 'r08', WAIT, null, 48, null],
  ['p110', 'Yacine', 'Mendy', 'SUTSAS', 'SGS', 'r09', BAD, null, 45, null],
  ['p111', 'Serigne', 'Sagna', 'SELS', 'PAMECAS', 'r10', WAIT, null, 43, null],
  ['p112', 'Rokhaya', 'Diatta', 'CUSEMS', 'Ecobank', 'r10', OK, VOIX, 41, 26],
  ['p113', 'Ibrahima', 'Dieng', 'SAES', 'BHS', 'r11', WAIT, null, 39, null],
  ['p114', 'Mame Diarra', 'Wade', 'CNTS', 'CMS', 'r11', WAIT, null, 37, null],
  ['p115', 'Assane', 'Lô', 'SAEMSS', 'SGS', 'r12', NO, null, 35, null],
  ['p116', 'Anta', 'Samb', 'UES', 'Ecobank', 'r13', WAIT, null, 33, null],
  ['p117', 'Malick', 'Gaye', 'SUTSAS', 'BOA Sénégal', 'r13', OK, PLAT, 31, 17],
  ['p118', 'Penda', 'Bèye', 'SNELAS/FC', 'CMS', 'r14', WAIT, null, 29, null],
  ['p119', 'Saliou', 'Diakhaté', 'CUSEMS', 'SGS', 'r14', BAD, null, 27, null],
  ['p120', 'Seynabou', 'Tall', 'SELS', 'BHS', 'r15', WAIT, null, 25, null],
];

/**
 * Numéros sénégalais plausibles et uniques par construction.
 *
 * Le rang du prospect est encodé dans le numéro : deux lignes ne peuvent donc
 * pas partager un numéro, ce qui compte parce que le téléphone est la clé de
 * déduplication métier — un doublon ferait échouer le semis de la démo.
 * Les préfixes alternent entre les quatre plages mobiles réelles (77, 78, 76,
 * 70) pour que la liste ne ressemble pas à une suite générée.
 */
const PHONE_BANDS = ['77243', '78615', '76308', '70452'] as const;

function demoPhone(rank: number): string {
  const band = PHONE_BANDS[(rank - 1) % PHONE_BANDS.length] ?? PHONE_BANDS[0];
  return `+221${band}${String(rank).padStart(3, '0')}${String(rank % 10)}`;
}

/**
 * Statut de prospection générale (phase 1), déduit de la phase 2.
 *
 * Les deux dimensions sont indépendantes dans le schéma, mais elles ne sont pas
 * décorrélées dans la réalité : un prospect dont on a obtenu la méthode est
 * converti, un refus est une perte. Le stock en attente est « nouveau » tant
 * qu'il est récent, « contacté » au-delà de six semaines — l'ancienneté est le
 * seul signal disponible ici, et il suffit à peupler les deux colonnes.
 */
function deriveStatut(phase2Status: Phase2Status, daysAgo: number): ProspectStatut {
  if (phase2Status === 'METHOD_OBTAINED') return 'CONVERTI';
  if (phase2Status === 'REFUSED' || phase2Status === 'WRONG_NUMBER') return 'PERDU';
  return daysAgo > 45 ? 'CONTACTE' : 'NOUVEAU';
}

const OWNER_BY_REPRESENTANT = new Map(
  DEMO_REPRESENTANTS.map((representant) => [representant.key, representant.createdByKey]),
);

export const DEMO_PROSPECTS: DemoProspect[] = PROSPECT_ROWS.map((row, index) => {
  const [
    key,
    prenom,
    nom,
    syndicatSigle,
    banqueShortName,
    representantKey,
    phase2Status,
    enrollmentMethod,
    daysAgo,
    enrollmentDaysAgo,
  ] = row;

  return {
    key,
    prenom,
    nom,
    syndicatSigle,
    banqueShortName,
    phoneE164: demoPhone(index + 1),
    representantKey,
    createdByKey: OWNER_BY_REPRESENTANT.get(representantKey) ?? 'awa',
    statut: deriveStatut(phase2Status, daysAgo),
    phase2Status,
    enrollmentMethod,
    enrollmentDaysAgo,
    daysAgo,
  };
});
