/**
 * Représentants de démonstration : 15 délégués répartis sur 12 départements de
 * 6 régions.
 *
 * Le département est désigné par `Departement.code` (voir `seed-data/geo.ts`),
 * jamais par son identifiant. La couverture est volontairement inégale : Dakar
 * concentre 5 délégués, Kaolack un seul. Une répartition parfaitement uniforme
 * rendrait la carte et le regroupement « par département » sans intérêt.
 *
 * Les représentants sont datés de 120 à 165 jours, tous antérieurs au plus
 * ancien de leurs prospects (118 jours) : on n'enrôle pas un prospect avant le
 * représentant qui l'a présenté.
 */
import type { DemoRepresentant } from './types.js';

export const DEMO_REPRESENTANTS: DemoRepresentant[] = [
  // ── Awa (Dakar) ────────────────────────────────────────────────────────────
  {
    key: 'r01',
    fullName: 'Mamadou Diagne',
    phoneE164: '+221784050001',
    departementCode: 'DK-DAK',
    createdByKey: 'awa',
    notes: 'Délégué CHUES du lycée Blaise Diagne, disponible le mercredi.',
    daysAgo: 165,
  },
  {
    key: 'r02',
    fullName: 'Aminata Cissé',
    phoneE164: '+221784050002',
    departementCode: 'DK-DAK',
    createdByKey: 'awa',
    notes: 'Trésorière de section, tient la liste des adhérents à jour.',
    daysAgo: 160,
  },
  {
    key: 'r03',
    fullName: 'Ousmane Sy',
    phoneE164: '+221784050003',
    departementCode: 'DK-GUE',
    createdByKey: 'awa',
    notes: null,
    daysAgo: 156,
  },
  {
    key: 'r04',
    fullName: 'Ndèye Fatou Kane',
    phoneE164: '+221784050004',
    departementCode: 'DK-PIK',
    createdByKey: 'awa',
    notes: 'Passe par le bureau de Pikine tous les lundis matin.',
    daysAgo: 152,
  },
  {
    key: 'r05',
    fullName: 'Serigne Mbaye',
    phoneE164: '+221784050005',
    departementCode: 'DK-RUF',
    createdByKey: 'awa',
    notes: null,
    daysAgo: 148,
  },

  // ── Moussa (Thiès) ─────────────────────────────────────────────────────────
  {
    key: 'r06',
    fullName: 'Abdoulaye Thiam',
    phoneE164: '+221784050006',
    departementCode: 'TH-THI',
    createdByKey: 'moussa',
    notes: 'Secrétaire général adjoint de la section régionale.',
    daysAgo: 145,
  },
  {
    key: 'r07',
    fullName: 'Khady Faye',
    phoneE164: '+221784050007',
    departementCode: 'TH-THI',
    createdByKey: 'moussa',
    notes: null,
    daysAgo: 141,
  },
  {
    key: 'r08',
    fullName: 'Alioune Badara Seck',
    phoneE164: '+221784050008',
    departementCode: 'TH-MBO',
    createdByKey: 'moussa',
    notes: 'Couvre aussi Saly et Ngaparou.',
    daysAgo: 137,
  },
  {
    key: 'r09',
    fullName: 'Coumba Diallo',
    phoneE164: '+221784050009',
    departementCode: 'TH-TIV',
    createdByKey: 'moussa',
    notes: null,
    daysAgo: 133,
  },

  // ── Fatou (Saint-Louis) ────────────────────────────────────────────────────
  {
    key: 'r10',
    fullName: 'Cheikh Tidiane Ba',
    phoneE164: '+221784050010',
    departementCode: 'SL-STL',
    createdByKey: 'fatou',
    notes: 'Le plus actif du Nord : 10 prospects en trois mois.',
    daysAgo: 130,
  },
  {
    key: 'r11',
    fullName: 'Rokhaya Sow',
    phoneE164: '+221784050011',
    departementCode: 'SL-STL',
    createdByKey: 'fatou',
    notes: null,
    daysAgo: 127,
  },
  {
    key: 'r12',
    fullName: 'Babacar Niang',
    phoneE164: '+221784050012',
    departementCode: 'SL-DAG',
    createdByKey: 'fatou',
    notes: 'Réunion de section le premier samedi du mois à Richard-Toll.',
    daysAgo: 124,
  },

  // ── Ibrahima (Kaolack, Diourbel) ───────────────────────────────────────────
  {
    key: 'r13',
    fullName: 'Adama Touré',
    phoneE164: '+221784050013',
    departementCode: 'KL-KAO',
    createdByKey: 'ibrahima',
    notes: null,
    daysAgo: 122,
  },
  {
    key: 'r14',
    fullName: 'Mariama Ndour',
    phoneE164: '+221784050014',
    departementCode: 'DB-DIO',
    createdByKey: 'ibrahima',
    notes: 'Contact unique pour tout le département de Diourbel.',
    daysAgo: 121,
  },
  {
    key: 'r15',
    fullName: 'Ismaïla Guèye',
    phoneE164: '+221784050015',
    departementCode: 'KL-NIO',
    createdByKey: 'ibrahima',
    notes: null,
    daysAgo: 120,
  },
];
