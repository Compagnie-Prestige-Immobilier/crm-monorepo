import { createHash } from 'node:crypto';

import {
  PrismaClient,
  PrismaPg,
  Projet,
  ProspectStatut,
  RepCallOutcome,
  RepresentantRelation,
  WhatsappStatus,
} from './index.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://crm:crm@localhost:5434/crm',
  }),
});

const MARQUEUR = 'Jeu de développement CHUES';

// Les identifiants sont des UUID v7 engendrés ici, jamais par la base, et
// dérivés d'une clé stable pour que rejouer le script réécrive les mêmes lignes.
const HORODATAGE_BASE = Date.UTC(2026, 0, 5, 8, 0, 0);

function devId(cle: string, rang: number): string {
  const temps = (HORODATAGE_BASE + rang * 60_000).toString(16).padStart(12, '0');
  const hex = createHash('sha256').update(`cpi-dev-chues:${cle}`).digest('hex');
  const variante = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${temps.slice(0, 8)}-${temps.slice(8, 12)}-7${hex.slice(0, 3)}-${variante}${hex.slice(13, 16)}-${hex.slice(20, 32)}`;
}

const IEF_CODES = [
  'DK-DAK-ALMA',
  'DK-DAK-PARC',
  'DK-GUE-GUED',
  'DK-PIK-THIA',
  'DK-RUF-RUFI',
  'TH-THI-THIE',
  'TH-MBO-MBOU',
  'KL-KAO-KAOL',
  'SL-STL-SAIN',
  'ZG-ZIG-ZIGU',
] as const;

// Le rattachement à une IEF est facultatif : quelques fiches n'en portent pas.
const DEPARTEMENT_CODES_SANS_IEF = ['DB-DIO', 'LG-LOU', 'MT-MAT', 'TC-TAM'] as const;

const NOMS = [
  'Abdoulaye Ndiaye',
  'Aminata Sow',
  'Ousmane Fall',
  'Fatou Diallo',
  'Mamadou Ba',
  'Khady Diop',
  'Ibrahima Sarr',
  'Aïssatou Camara',
  'Cheikh Gueye',
  'Ndeye Faye',
  'Modou Cissé',
  'Rokhaya Mbaye',
  'Alioune Thiam',
  'Sokhna Seck',
  'Babacar Niang',
  'Mariama Barry',
  'Serigne Diouf',
  'Adama Kane',
  'Moussa Sylla',
  'Bineta Toure',
  'Papa Samb',
  'Coumba Wade',
  'Lamine Diagne',
  'Astou Ndour',
  'Idrissa Sane',
  'Yacine Badji',
  'Malick Diatta',
  'Awa Sagna',
  'Saliou Mbengue',
  'Dieynaba Ly',
] as const;

const ETABLISSEMENTS = [
  'École élémentaire Diamalaye',
  'CEM Ouakam',
  'Lycée Seydina Limamoulaye',
  'École Cheikh Anta Diop',
  'CEM Malick Sy',
  'Lycée Demba Diop',
  'École Serigne Fallou',
  'CEM El Hadji Malick',
] as const;

const PROFESSIONS = ['Instituteur', 'Professeur', 'Directeur d’école', 'Surveillant'] as const;
const SYNDICATS = ['SAEMSS', 'CUSEMS', 'UDEN', 'SELS'] as const;

const RELATIONS = [
  RepresentantRelation.INCONNU,
  RepresentantRelation.INCONNU,
  RepresentantRelation.INCONNU,
  RepresentantRelation.CONTACTE,
  RepresentantRelation.AMBASSADEUR,
  RepresentantRelation.REFUS,
] as const;

const WHATSAPP = [
  WhatsappStatus.MEME_NUMERO,
  WhatsappStatus.NON_DEMANDE,
  WhatsappStatus.AUTRE_NUMERO,
  WhatsappStatus.AUCUN,
] as const;

interface Appel {
  readonly rang: number;
  readonly outcome: RepCallOutcome;
  readonly statutCode: string;
  readonly comment?: string;
  readonly promisedProspects?: number;
}

const APPELS: readonly Appel[] = [
  { rang: 0, outcome: RepCallOutcome.REACHED, statutCode: 'INTERESSE' },
  { rang: 1, outcome: RepCallOutcome.CALLBACK, statutCode: 'A_RAPPELER' },
  { rang: 3, outcome: RepCallOutcome.UNREACHABLE, statutCode: 'PAS_DE_REPONSE' },
  {
    rang: 4,
    outcome: RepCallOutcome.PROSPECTS_PROMISED,
    statutCode: 'TRES_INTERESSE',
    promisedProspects: 12,
  },
  { rang: 6, outcome: RepCallOutcome.REACHED, statutCode: 'DEMANDE_INFOS' },
  { rang: 7, outcome: RepCallOutcome.UNREACHABLE, statutCode: 'MESSAGERIE' },
  { rang: 9, outcome: RepCallOutcome.CALLBACK, statutCode: 'A_RAPPELER' },
  { rang: 11, outcome: RepCallOutcome.REFUSED, statutCode: 'NON_INTERESSE' },
  { rang: 13, outcome: RepCallOutcome.WRONG_NUMBER, statutCode: 'FAUX_NUMERO' },
  { rang: 15, outcome: RepCallOutcome.REACHED, statutCode: 'RDV_OBTENU' },
  { rang: 18, outcome: RepCallOutcome.UNREACHABLE, statutCode: 'NUMERO_OCCUPE' },
  {
    rang: 21,
    outcome: RepCallOutcome.OTHER,
    statutCode: 'DEMANDE_INFOS',
    comment: 'Rappel demandé par un collègue du même établissement.',
  },
];

const PREFIXES_MOBILES = ['70', '75', '76', '77', '78'] as const;

function telephone(prefixeRang: number, base: number, rang: number): string {
  const prefixe = PREFIXES_MOBILES[prefixeRang % PREFIXES_MOBILES.length] ?? '77';
  return `+221${prefixe}${String(base + rang * 137).padStart(7, '0')}`;
}

function jourAvant(jours: number): Date {
  return new Date(HORODATAGE_BASE - jours * 86_400_000);
}

interface Contexte {
  readonly auteurs: readonly { id: string }[];
  readonly iefs: readonly { id: string; departementId: string }[];
  readonly departementsSansIef: readonly { id: string }[];
  readonly statutParCode: ReadonlyMap<string, string>;
}

async function chargerContexte(): Promise<Contexte> {
  const [auteurs, iefs, departementsSansIef, statuts] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: ['fixture.awa@cpi.sn', 'fixture.fatou@cpi.sn', 'admin@cpi.sn'] } },
      select: { id: true, email: true },
      orderBy: { email: 'asc' },
    }),
    prisma.ief.findMany({
      where: { code: { in: [...IEF_CODES] } },
      select: { id: true, code: true, departementId: true },
    }),
    prisma.departement.findMany({
      where: { code: { in: [...DEPARTEMENT_CODES_SANS_IEF] } },
      select: { id: true, code: true },
    }),
    prisma.statutQualification.findMany({ select: { id: true, code: true } }),
  ]);

  if (!auteurs.length) throw new Error('Aucun compte fixture : lancer d’abord `db:seed`.');
  if (iefs.length < IEF_CODES.length) throw new Error('Référentiel IEF incomplet.');
  if (departementsSansIef.length < DEPARTEMENT_CODES_SANS_IEF.length)
    throw new Error('Référentiel des départements incomplet.');
  if (!statuts.length) throw new Error('Référentiel des statuts de qualification vide.');

  return {
    auteurs,
    iefs: IEF_CODES.map((code) => {
      const trouvee = iefs.find((ief) => ief.code === code);
      if (!trouvee) throw new Error(`IEF ${code} introuvable.`);
      return trouvee;
    }),
    departementsSansIef,
    statutParCode: new Map(statuts.map((statut) => [statut.code, statut.id])),
  };
}

function elementA<T>(source: readonly T[], rang: number): T {
  const valeur = source[rang % source.length];
  if (valeur === undefined) throw new Error('Table de fixtures vide.');
  return valeur;
}

const APPEL_PAR_RANG = new Map(APPELS.map((appel) => [appel.rang, appel]));

function fiche(rang: number, fullName: string, contexte: Contexte) {
  const appel = APPEL_PAR_RANG.get(rang);
  const auteurId = elementA(contexte.auteurs, rang).id;
  const sansIef = rang >= NOMS.length - DEPARTEMENT_CODES_SANS_IEF.length;
  const ief = elementA(contexte.iefs, rang);
  const whatsappStatus = elementA(WHATSAPP, rang);
  return {
    fullName,
    prenom: fullName.split(' ')[0] ?? null,
    etablissement: elementA(ETABLISSEMENTS, rang),
    phoneE164: telephone(rang, 3_000_000, rang),
    notes: MARQUEUR,
    departementId: sansIef ? elementA(contexte.departementsSansIef, rang).id : ief.departementId,
    iefId: sansIef ? null : ief.id,
    createdById: auteurId,
    clientCreatedAt: jourAvant(60 - rang),
    relationStatus: elementA(RELATIONS, rang),
    whatsappStatus,
    whatsappE164:
      whatsappStatus === WhatsappStatus.AUTRE_NUMERO ? telephone(2, 6_100_000, rang) : null,
    profession: elementA(PROFESSIONS, rang),
    syndicat: elementA(SYNDICATS, rang),
    connaitUES: rang % 3 === 0,
    contacte: appel !== undefined,
    statutQualificationId: appel ? (contexte.statutParCode.get(appel.statutCode) ?? null) : null,
    lastCallOutcome: appel?.outcome ?? null,
    lastCallAt: appel ? jourAvant(30 - rang) : null,
    lastCallById: appel ? auteurId : null,
    nextCallbackAt: appel?.outcome === RepCallOutcome.CALLBACK ? jourAvant(-(rang % 5) - 1) : null,
  };
}

type Fiche = ReturnType<typeof fiche>;

async function ecrireTentative(
  rang: number,
  representantId: string,
  valeurs: Fiche,
): Promise<void> {
  const appel = APPEL_PAR_RANG.get(rang);
  if (!appel || !valeurs.lastCallAt || !valeurs.lastCallById) return;

  const id = devId(`appel:${String(rang)}`, 100 + rang);
  const tentative = {
    representantId,
    performedById: valeurs.lastCallById,
    outcome: appel.outcome,
    promisedProspects: appel.promisedProspects ?? null,
    comment: appel.comment ?? null,
    callbackAt: valeurs.nextCallbackAt,
    etablissementConfirme: true,
    numeroConfirme: true,
    contacte: true,
    connaitUES: valeurs.connaitUES,
    syndicat: valeurs.syndicat,
    statutQualificationId: valeurs.statutQualificationId,
    clientCreatedAt: valeurs.lastCallAt,
  };
  await prisma.repCallAttempt.upsert({
    where: { id },
    create: { id, ...tentative },
    update: tentative,
  });
}

async function ecrireProspects(
  rang: number,
  representantId: string,
  valeurs: Fiche,
): Promise<void> {
  for (const suffixe of [0, 1]) {
    const prospectRang = rang * 2 + suffixe;
    const prospectId = devId(`prospect:${String(prospectRang)}`, 200 + prospectRang);
    const statut = suffixe === 0 ? ProspectStatut.NOUVEAU : ProspectStatut.CONTACTE;
    const prospect = {
      nom: valeurs.fullName.split(' ')[1] ?? valeurs.fullName,
      prenom: `Prospect ${String(prospectRang + 1).padStart(2, '0')}`,
      phoneE164: telephone(prospectRang, 4_200_000, prospectRang),
      projet: Projet.CHUES,
      representantId,
      createdById: valeurs.createdById,
      statut,
      clientCreatedAt: jourAvant(50 - rang),
    };
    await prisma.prospect.upsert({
      where: { id: prospectId },
      create: { id: prospectId, ...prospect },
      update: prospect,
    });
    await prisma.prospectJourney.upsert({
      where: { prospectId_projet: { prospectId, projet: Projet.CHUES } },
      create: {
        id: devId(`parcours:${String(prospectRang)}`, 300 + prospectRang),
        prospectId,
        projet: Projet.CHUES,
        statut,
      },
      update: { statut },
    });
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.warn('Jeu de développement CHUES : ignoré, NODE_ENV vaut production.');
    return;
  }

  const contexte = await chargerContexte();

  for (const [rang, fullName] of NOMS.entries()) {
    const valeurs = fiche(rang, fullName, contexte);
    const id = devId(`representant:${String(rang)}`, rang);
    await prisma.representant.upsert({
      where: { id },
      create: { id, ...valeurs },
      update: valeurs,
    });
    await ecrireTentative(rang, id, valeurs);
    // Un représentant sur deux a déjà remis des fiches : le filtre « dormant »
    // de l'annuaire n'a de sens que si les deux cas existent.
    if (rang % 2 === 0) await ecrireProspects(rang, id, valeurs);
  }

  const [representants, prospects, parcours, tentatives] = await Promise.all([
    prisma.representant.count({ where: { deletedAt: null } }),
    prisma.prospect.count({ where: { deletedAt: null } }),
    prisma.prospectJourney.count({ where: { projet: Projet.CHUES } }),
    prisma.repCallAttempt.count(),
  ]);
  console.info(
    `Jeu de développement CHUES : ${String(representants)} représentants · ` +
      `${String(prospects)} prospects · ${String(parcours)} parcours CHUES · ` +
      `${String(tentatives)} tentatives d’appel`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
