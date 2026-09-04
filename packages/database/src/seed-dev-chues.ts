import { createHash } from 'node:crypto';

import {
  CallOutcome,
  EnrollmentMethod,
  NotificationAudience,
  NotificationCategory,
  PaymentMode,
  Phase2Status,
  PrismaClient,
  PrismaPg,
  Projet,
  ProspectStatut,
  RepCallOutcome,
  RepresentantRelation,
  ScheduledCallbackStatus,
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

// Les dates se calent sur aujourd'hui : la supervision lit « Aujourd'hui » et
// « Cette semaine », un jeu figé en janvier n'y apparaîtrait jamais.
const MAINTENANT = new Date();
const MINUIT = Date.UTC(
  MAINTENANT.getUTCFullYear(),
  MAINTENANT.getUTCMonth(),
  MAINTENANT.getUTCDate(),
);
const JOUR = 86_400_000;
// Heures dans les créneaux par défaut du plateau (09:00-14:00, 15:00-18:00 UTC).
const HEURES_PLATEAU = [9, 10, 11, 12, 13, 15, 16, 17] as const;

function quand(joursAvant: number, rang: number): Date {
  const heure = HEURES_PLATEAU[rang % HEURES_PLATEAU.length] ?? 10;
  const minute = (rang * 17) % 60;
  return new Date(MINUIT - joursAvant * JOUR + heure * 3_600_000 + minute * 60_000);
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

interface IssueRep {
  readonly outcome: RepCallOutcome;
  readonly statutCode: string;
  readonly comment?: string;
  readonly promisedProspects?: number;
}

const ISSUES_REP: readonly IssueRep[] = [
  { outcome: RepCallOutcome.REACHED, statutCode: 'INTERESSE' },
  { outcome: RepCallOutcome.CALLBACK, statutCode: 'A_RAPPELER' },
  { outcome: RepCallOutcome.UNREACHABLE, statutCode: 'PAS_DE_REPONSE' },
  {
    outcome: RepCallOutcome.PROSPECTS_PROMISED,
    statutCode: 'TRES_INTERESSE',
    promisedProspects: 12,
  },
  { outcome: RepCallOutcome.REACHED, statutCode: 'DEMANDE_INFOS' },
  { outcome: RepCallOutcome.UNREACHABLE, statutCode: 'MESSAGERIE' },
  { outcome: RepCallOutcome.REFUSED, statutCode: 'NON_INTERESSE' },
  { outcome: RepCallOutcome.WRONG_NUMBER, statutCode: 'FAUX_NUMERO' },
  { outcome: RepCallOutcome.REACHED, statutCode: 'RDV_OBTENU' },
  { outcome: RepCallOutcome.UNREACHABLE, statutCode: 'NUMERO_OCCUPE' },
  {
    outcome: RepCallOutcome.OTHER,
    statutCode: 'DEMANDE_INFOS',
    comment: 'Rappel demandé par un collègue du même établissement.',
  },
];

interface IssueProspect {
  readonly outcome: CallOutcome;
  readonly method?: EnrollmentMethod;
  readonly comment?: string;
}

const ISSUES_PROSPECT: readonly IssueProspect[] = [
  { outcome: CallOutcome.METHOD_OBTAINED, method: EnrollmentMethod.PLATFORM },
  { outcome: CallOutcome.UNREACHABLE },
  { outcome: CallOutcome.CALLBACK },
  { outcome: CallOutcome.METHOD_OBTAINED, method: EnrollmentMethod.PHYSICAL },
  { outcome: CallOutcome.REFUSED },
  { outcome: CallOutcome.METHOD_OBTAINED, method: EnrollmentMethod.APPOINTMENT },
  { outcome: CallOutcome.WRONG_NUMBER },
  { outcome: CallOutcome.OTHER, comment: 'Numéro transmis à un proche, rappeler le soir.' },
  { outcome: CallOutcome.METHOD_OBTAINED, method: EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING },
  { outcome: CallOutcome.CALLBACK },
];

const COMMENTAIRES_REP = [
  'Joint sur WhatsApp, préfère être appelé après 17h.',
  'Directeur en congé jusqu’à la rentrée.',
  'A transmis la liste de ses collègues intéressés.',
  'Numéro confirmé par le secrétariat de l’établissement.',
  'Demande une plaquette avant de s’engager.',
];

const ANNONCES = [
  ['Objectif de la semaine', 'Cent trente-trois fiches prospects par jour sur le plateau.'],
  ['Nouveau créneau', 'Les appels de l’après-midi reprennent à 15h.'],
  ['Rappels promis', 'Solder les rappels en retard avant vendredi.'],
  ['Dossiers bancaires', 'Vérifier les références avant transmission.'],
] as const;

const PREFIXES_MOBILES = ['70', '75', '76', '77', '78'] as const;

function telephone(prefixeRang: number, base: number, rang: number): string {
  const prefixe = PREFIXES_MOBILES[prefixeRang % PREFIXES_MOBILES.length] ?? '77';
  return `+221${prefixe}${String(base + rang * 137).padStart(7, '0')}`;
}

interface Contexte {
  readonly plateau: readonly { id: string }[];
  readonly accueilId: string;
  readonly banqueId: string;
  readonly iefs: readonly { id: string; departementId: string }[];
  readonly departementsSansIef: readonly { id: string }[];
  readonly statutParCode: ReadonlyMap<string, string>;
  readonly offerId: string | null;
  readonly banques: readonly { id: string }[];
  readonly stages: readonly { id: string }[];
  readonly visite: {
    readonly entreprises: readonly { id: string }[];
    readonly objets: readonly { id: string }[];
    readonly directions: readonly { id: string }[];
    readonly destinataires: readonly { id: string }[];
  };
}

async function chargerContexte(): Promise<Contexte> {
  const emails = [
    'fixture.awa@cpi.sn',
    'fixture.fatou@cpi.sn',
    'fixture.superviseur@cpi.sn',
    'fixture.accueil@cpi.sn',
    'fixture.banque@cpi.sn',
  ];
  const [users, iefs, departementsSansIef, statuts, offer, banques, stages, visite] =
    await Promise.all([
      prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }),
      prisma.ief.findMany({
        where: { code: { in: [...IEF_CODES] } },
        select: { id: true, code: true, departementId: true },
      }),
      prisma.departement.findMany({
        where: { code: { in: [...DEPARTEMENT_CODES_SANS_IEF] } },
        select: { id: true, code: true },
      }),
      prisma.statutQualification.findMany({ select: { id: true, code: true } }),
      prisma.offer.findFirst({ where: { isActive: true }, orderBy: { position: 'asc' } }),
      prisma.banque.findMany({ take: 4, orderBy: { shortName: 'asc' }, select: { id: true } }),
      prisma.bankCaseStage.findMany({
        where: { isActive: true },
        orderBy: { position: 'asc' },
        select: { id: true },
      }),
      Promise.all([
        prisma.visiteEntreprise.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true } }),
        prisma.visiteObjet.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true } }),
        prisma.visiteDirection.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true } }),
        prisma.visiteDestinataire.findMany({
          orderBy: { sortOrder: 'asc' },
          select: { id: true },
        }),
      ]),
    ]);

  const parEmail = new Map(users.map((user) => [user.email, user.id]));
  const plateau = emails.slice(0, 3).flatMap((email) => {
    const id = parEmail.get(email);
    return id ? [{ id }] : [];
  });
  const accueilId = parEmail.get('fixture.accueil@cpi.sn');
  const banqueId = parEmail.get('fixture.banque@cpi.sn');
  if (plateau.length < 3 || !accueilId || !banqueId)
    throw new Error('Comptes fixture absents : lancer d’abord `db:seed`.');
  if (iefs.length < IEF_CODES.length) throw new Error('Référentiel IEF incomplet.');
  if (departementsSansIef.length < DEPARTEMENT_CODES_SANS_IEF.length)
    throw new Error('Référentiel des départements incomplet.');
  if (!statuts.length) throw new Error('Référentiel des statuts de qualification vide.');
  if (!banques.length || !stages.length) throw new Error('Référentiel bancaire vide.');
  const [entreprises, objets, directions, destinataires] = visite;
  if (!entreprises.length || !objets.length) throw new Error('Référentiel des visites vide.');

  return {
    plateau,
    accueilId,
    banqueId,
    iefs: IEF_CODES.map((code) => {
      const trouvee = iefs.find((ief) => ief.code === code);
      if (!trouvee) throw new Error(`IEF ${code} introuvable.`);
      return trouvee;
    }),
    departementsSansIef,
    statutParCode: new Map(statuts.map((statut) => [statut.code, statut.id])),
    offerId: offer?.id ?? null,
    banques,
    stages,
    visite: { entreprises, objets, directions, destinataires },
  };
}

function elementA<T>(source: readonly T[], rang: number): T {
  const valeur = source[rang % source.length];
  if (valeur === undefined) throw new Error('Table de fixtures vide.');
  return valeur;
}

function appelsRepresentant(rang: number) {
  const nombre = 1 + (rang % 3);
  return Array.from({ length: nombre }, (_, k) => {
    const issue = elementA(ISSUES_REP, rang + k * 4);
    const clientCreatedAt = quand((rang * 7 + k * 3) % 14, rang + k);
    const confirme = (rang + k) % 3 !== 2;
    return {
      id: devId(`appel:${String(rang)}:${String(k)}`, 100 + rang * 3 + k),
      k,
      issue,
      clientCreatedAt,
      callbackAt:
        issue.outcome === RepCallOutcome.CALLBACK
          ? new Date(clientCreatedAt.getTime() + ((rang % 4) + 1) * JOUR)
          : null,
      deviceCallAt: confirme ? clientCreatedAt : null,
      deviceCallDurationSeconds: confirme ? 45 + ((rang * 31 + k * 7) % 240) : null,
      deviceCallType: confirme ? 'sortant' : null,
    };
  }).sort((a, b) => a.clientCreatedAt.getTime() - b.clientCreatedAt.getTime());
}

function fiche(rang: number, fullName: string, contexte: Contexte) {
  const appels = appelsRepresentant(rang);
  const dernier = appels.at(-1);
  const auteurId = elementA(contexte.plateau, rang).id;
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
    clientCreatedAt: quand(60 - rang, rang),
    relationStatus: elementA(RELATIONS, rang),
    whatsappStatus,
    whatsappE164:
      whatsappStatus === WhatsappStatus.AUTRE_NUMERO ? telephone(2, 6_100_000, rang) : null,
    profession: elementA(PROFESSIONS, rang),
    syndicat: elementA(SYNDICATS, rang),
    connaitUES: rang % 3 === 0,
    contacte: true,
    statutQualificationId: dernier
      ? (contexte.statutParCode.get(dernier.issue.statutCode) ?? null)
      : null,
    lastCallOutcome: dernier?.issue.outcome ?? null,
    lastCallAt: dernier?.clientCreatedAt ?? null,
    lastCallById: auteurId,
    nextCallbackAt: dernier?.callbackAt ?? null,
  };
}

type Fiche = ReturnType<typeof fiche>;

async function ecrireTentatives(
  rang: number,
  representantId: string,
  valeurs: Fiche,
  contexte: Contexte,
): Promise<void> {
  for (const appel of appelsRepresentant(rang)) {
    const tentative = {
      representantId,
      performedById: elementA(contexte.plateau, rang + appel.k).id,
      outcome: appel.issue.outcome,
      promisedProspects: appel.issue.promisedProspects ?? null,
      comment: appel.issue.comment ?? null,
      callbackAt: appel.callbackAt,
      etablissementConfirme: true,
      numeroConfirme: true,
      contacte: true,
      connaitUES: valeurs.connaitUES,
      syndicat: valeurs.syndicat,
      statutQualificationId: contexte.statutParCode.get(appel.issue.statutCode) ?? null,
      deviceCallType: appel.deviceCallType,
      deviceCallDurationSeconds: appel.deviceCallDurationSeconds,
      deviceCallAt: appel.deviceCallAt,
      clientCreatedAt: appel.clientCreatedAt,
    };
    await prisma.repCallAttempt.upsert({
      where: { id: appel.id },
      create: { id: appel.id, ...tentative },
      update: tentative,
    });
  }

  if (rang % 3 !== 0) return;
  const commentId = devId(`commentaire:${String(rang)}`, 400 + rang);
  const commentaire = {
    representantId,
    authorId: valeurs.createdById,
    body: elementA(COMMENTAIRES_REP, rang),
    clientCreatedAt: quand(rang % 9, rang + 2),
  };
  await prisma.representantComment.upsert({
    where: { id: commentId },
    create: { id: commentId, ...commentaire },
    update: commentaire,
  });
}

function appelsProspect(prospectRang: number) {
  const nombre = 1 + (prospectRang % 2);
  return Array.from({ length: nombre }, (_, k) => {
    const issue = elementA(ISSUES_PROSPECT, prospectRang + k * 3);
    const clientCreatedAt = quand((prospectRang * 3 + k * 5) % 10, prospectRang + k + 1);
    return {
      id: devId(`appel-prospect:${String(prospectRang)}:${String(k)}`, 500 + prospectRang * 2 + k),
      issue,
      clientCreatedAt,
      rendezVousAt:
        issue.method === EnrollmentMethod.APPOINTMENT
          ? new Date(clientCreatedAt.getTime() + 3 * JOUR)
          : null,
    };
  }).sort((a, b) => a.clientCreatedAt.getTime() - b.clientCreatedAt.getTime());
}

function phase2(appels: ReturnType<typeof appelsProspect>) {
  const methode = appels.find((appel) => appel.issue.method)?.issue.method;
  if (methode) return { phase2Status: Phase2Status.METHOD_OBTAINED, enrollmentMethod: methode };
  const dernier = appels.at(-1)?.issue.outcome;
  if (dernier === CallOutcome.REFUSED)
    return { phase2Status: Phase2Status.REFUSED, enrollmentMethod: null };
  if (dernier === CallOutcome.WRONG_NUMBER)
    return { phase2Status: Phase2Status.WRONG_NUMBER, enrollmentMethod: null };
  return { phase2Status: Phase2Status.PENDING, enrollmentMethod: null };
}

async function ecrireProspects(
  rang: number,
  representantId: string,
  valeurs: Fiche,
  contexte: Contexte,
): Promise<void> {
  for (const suffixe of [0, 1]) {
    await ecrireProspect(rang * 2 + suffixe, rang, representantId, valeurs, contexte);
  }
}

async function ecrireProspect(
  prospectRang: number,
  rang: number,
  representantId: string,
  valeurs: Fiche,
  contexte: Contexte,
): Promise<void> {
  const prospectId = devId(`prospect:${String(prospectRang)}`, 200 + prospectRang);
  const appels = appelsProspect(prospectRang);
  const dernier = appels.at(-1);
  const etat = phase2(appels);
  const converti = etat.phase2Status === Phase2Status.METHOD_OBTAINED && prospectRang % 3 === 0;
  const statut = converti ? ProspectStatut.CONVERTI : ProspectStatut.CONTACTE;
  const capture = etat.enrollmentMethod ? (dernier?.clientCreatedAt ?? null) : null;
  const prospect = {
    nom: valeurs.fullName.split(' ')[1] ?? valeurs.fullName,
    prenom: `Prospect ${String(prospectRang + 1).padStart(2, '0')}`,
    phoneE164: telephone(prospectRang, 4_200_000, prospectRang),
    projet: Projet.CHUES,
    representantId,
    banqueId: elementA(contexte.banques, prospectRang).id,
    createdById: valeurs.createdById,
    statut,
    ...etat,
    enrollmentCapturedAt: capture,
    enrollmentCapturedById: capture ? valeurs.createdById : null,
    lastCallOutcome: dernier?.issue.outcome ?? null,
    lastCallAt: dernier?.clientCreatedAt ?? null,
    lastCallById: dernier ? valeurs.createdById : null,
    clientCreatedAt: quand((rang * 5) % 20, prospectRang),
  };
  await prisma.prospect.upsert({
    where: { id: prospectId },
    create: { id: prospectId, ...prospect },
    update: prospect,
  });

  const journeyId = devId(`parcours:${String(prospectRang)}`, 300 + prospectRang);
  const convertedAt = converti ? quand(prospectRang % 5, prospectRang + 3) : null;
  const parcours = {
    statut,
    ...etat,
    enrollmentCapturedAt: capture,
    enrollmentCapturedById: prospect.enrollmentCapturedById,
    convertedAt,
    convertedById: converti ? contexte.banqueId : null,
  };
  await prisma.prospectJourney.upsert({
    where: { prospectId_projet: { prospectId, projet: Projet.CHUES } },
    create: { id: journeyId, prospectId, projet: Projet.CHUES, ...parcours },
    update: parcours,
  });

  await ecrireAppelsProspect(prospectRang, prospectId, appels, contexte);
  if (!converti) return;

  const conversion = {
    offerId: contexte.offerId,
    paymentMode: prospectRang % 2 === 0 ? PaymentMode.ECHELONNE : PaymentMode.COMPTANT,
    amountXof: 150_000 + prospectRang * 5_000,
    durationMonths: prospectRang % 2 === 0 ? 12 : null,
    confirmedById: contexte.banqueId,
    confirmedAt: convertedAt ?? MAINTENANT,
  };
  await prisma.prospectConversion.upsert({
    where: { journeyId },
    create: {
      id: devId(`conversion:${String(prospectRang)}`, 700 + prospectRang),
      journeyId,
      ...conversion,
    },
    update: conversion,
  });
  await ecrireDossierBancaire(prospectRang, prospectId, prospect, contexte);
}

async function ecrireAppelsProspect(
  prospectRang: number,
  prospectId: string,
  appels: ReturnType<typeof appelsProspect>,
  contexte: Contexte,
): Promise<void> {
  const confirme = prospectRang % 4 === 0;
  for (const [k, appel] of appels.entries()) {
    const performedById = elementA(contexte.plateau, prospectRang + k).id;
    const tentative = {
      prospectId,
      performedById,
      outcome: appel.issue.outcome,
      method: appel.issue.method ?? null,
      comment: appel.issue.comment ?? null,
      rendezVousAt: appel.rendezVousAt,
      deviceCallType: confirme ? 'sortant' : null,
      deviceCallDurationSeconds: confirme ? 60 + ((prospectRang * 13) % 200) : null,
      deviceCallAt: confirme ? appel.clientCreatedAt : null,
      clientCreatedAt: appel.clientCreatedAt,
    };
    await prisma.callAttempt.upsert({
      where: { id: appel.id },
      create: { id: appel.id, ...tentative },
      update: tentative,
    });
    if (appel.issue.outcome !== CallOutcome.CALLBACK) continue;

    const scheduledAt = new Date(appel.clientCreatedAt.getTime() + ((prospectRang % 3) + 1) * JOUR);
    const honore = scheduledAt < MAINTENANT && prospectRang % 2 === 0;
    // Un seul rappel PENDING par prospect : index unique partiel en base.
    const dernier = k === appels.length - 1;
    let status: ScheduledCallbackStatus = ScheduledCallbackStatus.SUPERSEDED;
    if (honore) status = ScheduledCallbackStatus.DONE;
    else if (dernier) status = ScheduledCallbackStatus.PENDING;
    const rappel = {
      prospectId,
      assignedToId: performedById,
      scheduledAt,
      comment: 'Rappel promis lors de l’appel.',
      status,
    };
    await prisma.scheduledCallback.upsert({
      where: { sourceAttemptId: appel.id },
      create: {
        id: devId(`rappel:${appel.id}`, 600 + prospectRang),
        sourceAttemptId: appel.id,
        ...rappel,
      },
      update: rappel,
    });
  }
}

async function ecrireDossierBancaire(
  prospectRang: number,
  prospectId: string,
  prospect: { prenom: string; nom: string; phoneE164: string; banqueId: string },
  contexte: Contexte,
): Promise<void> {
  const reference = `DEV-CHUES-${String(prospectRang + 1).padStart(3, '0')}`;
  const etape = prospectRang % contexte.stages.length;
  const stage = elementA(contexte.stages, etape);
  const dossier = {
    reference,
    prospectId,
    customerName: `${prospect.prenom} ${prospect.nom}`,
    customerPhoneE164: prospect.phoneE164,
    processingBankId: prospect.banqueId,
    currentStageId: stage.id,
    amountXof: 150_000 + prospectRang * 5_000,
    createdById: contexte.banqueId,
    createdAt: quand(prospectRang % 7, prospectRang),
  };
  const id = devId(`dossier:${String(prospectRang)}`, 800 + prospectRang);
  const cas = await prisma.bankCase.upsert({
    where: { id },
    create: {
      id,
      referenceKey: reference,
      ...dossier,
    },
    update: dossier,
  });
  await prisma.bankCaseTransition.deleteMany({ where: { caseId: cas.id } });
  await prisma.bankCaseTransition.createMany({
    data: contexte.stages.slice(0, etape + 1).map((toStage, index) => ({
      id: devId(
        `transition:${String(prospectRang)}:${String(index)}`,
        900 + prospectRang * 4 + index,
      ),
      caseId: cas.id,
      fromStageId: index === 0 ? null : (contexte.stages[index - 1]?.id ?? null),
      toStageId: toStage.id,
      performedById: contexte.banqueId,
      clientAt: new Date(dossier.createdAt.getTime() + index * 3_600_000),
      createdAt: new Date(dossier.createdAt.getTime() + index * 3_600_000),
    })),
  });
}

// Appels vus par le téléphone sans tentative consignée : la ligne que la
// supervision cherche.
async function ecrireDetectionsNonConsignees(contexte: Contexte): Promise<void> {
  for (let rang = 0; rang < 6; rang++) {
    const id = devId(`detection:${String(rang)}`, 1_000 + rang);
    const deviceCallAt = quand(rang % 2, rang + 5);
    const detection = {
      performedById: elementA(contexte.plateau, rang).id,
      prospectId: rang % 2 === 0 ? devId(`prospect:${String(rang * 4)}`, 200 + rang * 4) : null,
      representantId: rang % 2 === 0 ? null : devId(`representant:${String(rang)}`, rang),
      deviceCallType: rang % 3 === 0 ? 'entrant' : 'sortant',
      deviceCallDurationSeconds: 30 + rang * 20,
      deviceCallAt,
      detectedAt: new Date(deviceCallAt.getTime() + 60_000),
      attemptId: null,
    };
    await prisma.deviceCallDetection.upsert({
      where: { id },
      create: { id, ...detection },
      update: detection,
    });
  }
}

async function ecrireVisites(contexte: Contexte): Promise<void> {
  for (let rang = 0; rang < 8; rang++) {
    const reference = `DEV-VIS-${String(rang + 1).padStart(3, '0')}`;
    const visite = {
      visitedAt: quand(rang % 6, rang),
      visitorName: elementA(NOMS, rang * 3),
      phoneE164: telephone(rang, 5_500_000, rang),
      entrepriseId: elementA(contexte.visite.entreprises, rang).id,
      objetId: elementA(contexte.visite.objets, rang).id,
      directionId: contexte.visite.directions.length
        ? elementA(contexte.visite.directions, rang).id
        : null,
      destinataireId: contexte.visite.destinataires.length
        ? elementA(contexte.visite.destinataires, rang).id
        : null,
      createdById: contexte.accueilId,
    };
    await prisma.visite.upsert({
      where: { reference },
      create: { id: devId(`visite:${String(rang)}`, 1_100 + rang), reference, ...visite },
      update: visite,
    });
  }
}

async function ecrireAnnonces(contexte: Contexte): Promise<void> {
  for (const [rang, [title, body]] of ANNONCES.entries()) {
    const id = devId(`annonce:${String(rang)}`, 1_200 + rang);
    const annonce = {
      title,
      body,
      category: NotificationCategory.ANNONCE,
      audience: NotificationAudience.ALL,
      sentAt: quand(rang, rang),
      createdById: elementA(contexte.plateau, 2).id,
    };
    await prisma.notification.upsert({
      where: { id },
      create: { id, ...annonce },
      update: annonce,
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
    await ecrireTentatives(rang, id, valeurs, contexte);
    // Un représentant sur deux a déjà remis des fiches : le filtre « dormant »
    // de l'annuaire n'a de sens que si les deux cas existent.
    if (rang % 2 === 0) await ecrireProspects(rang, id, valeurs, contexte);
  }
  await ecrireDetectionsNonConsignees(contexte);
  await ecrireVisites(contexte);
  await ecrireAnnonces(contexte);

  const depuisHier = new Date(MINUIT);
  const [representants, prospects, appelsRep, appelsProspects, aujourdhui] = await Promise.all([
    prisma.representant.count({ where: { deletedAt: null } }),
    prisma.prospect.count({ where: { deletedAt: null } }),
    prisma.repCallAttempt.count(),
    prisma.callAttempt.count(),
    prisma.repCallAttempt.count({ where: { clientCreatedAt: { gte: depuisHier } } }),
  ]);
  console.info(
    `Jeu de développement CHUES : ${String(representants)} représentants · ` +
      `${String(prospects)} prospects · ${String(appelsRep)} appels représentants ` +
      `(${String(aujourdhui)} aujourd’hui) · ${String(appelsProspects)} appels prospects`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
