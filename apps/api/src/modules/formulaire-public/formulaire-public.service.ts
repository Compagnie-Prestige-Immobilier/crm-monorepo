import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationAudience,
  NotificationCategory,
  PaymentMode,
  Prisma,
  Projet,
  ProspectType,
  Role,
  WhatsappStatus,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PROSPECT_ORIGIN_FORMULAIRE_PUBLIC } from '../../common/prospect-origin.js';
import { normalizePhone } from '../../common/phone.js';
import { isPrismaKnownError } from '../../common/filters/prisma-exception.filter.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  BREVO_TRANSPORT,
  type BrevoMessage,
  type BrevoTransport,
} from '../notifications/brevo.transport.js';
import { readNotificationsEnv } from '../notifications/notifications.env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ParametresChuesService } from '../parametres-chues/parametres-chues.service.js';
import { ChampsConversionService } from '../champs-conversion/champs-conversion.service.js';
import type { ReglageChampDto } from '../champs-conversion/dto.js';
import { normaliserReponses, type ChampConversion } from '../champs-conversion/catalogue.js';
import { whatsappDuProspect } from '../prospects/whatsapp.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { OkDto } from '../../common/dto/ok.dto.js';
import type { DemandePubliqueDto, FormulairePublicDto } from './dto.js';
import { verifierTurnstile } from './turnstile.js';

const TITRE_MAX = 120;
const CORPS_MAX = 500;

type Agent = Pick<AuthenticatedUser, 'id' | 'email' | 'username' | 'fullName' | 'role'>;

/**
 * Ce que le catalogue de la conversion porte SANS que le formulaire public
 * puisse le recueillir. La méthode d'enrôlement clôt le dossier : elle écrit
 * `phase2Status` et l'auteur du closing, et un visiteur non vérifié ne peut pas
 * se déclarer converti. La date de rendez-vous n'existe qu'avec elle.
 *
 * Le retrait est fait par soustraction : un champ ajouté au catalogue sans être
 * nommé ici casse la compilation de `CHAMPS_PUBLICS`.
 */
type ChampHorsPublic = 'method' | 'rendezVousAt';
type ChampPublic = Exclude<ChampConversion, ChampHorsPublic>;

const CHAMPS_PUBLICS = {
  nom: true,
  prenom: true,
  phoneE164: true,
  email: true,
  profession: true,
  dureeEtablissementMois: true,
  fonctionnaire: true,
  type: true,
  syndicatId: true,
  banqueId: true,
  engagementEnCours: true,
  incomeBandId: true,
  paymentMode: true,
  etablissement: true,
  dureeSystemeMois: true,
  whatsappStatus: true,
  whatsappE164: true,
} as const satisfies Readonly<Record<ChampPublic, true>>;

const estChampPublic = (champ: string): champ is ChampPublic =>
  Object.hasOwn(CHAMPS_PUBLICS, champ);

const PROSPECT_RAPPROCHE = {
  id: true,
  nom: true,
  prenom: true,
  phoneE164: true,
  email: true,
  profession: true,
  employeur: true,
  etablissement: true,
  banqueId: true,
  syndicatId: true,
  incomeBandId: true,
  type: true,
  paymentMode: true,
  dureeSystemeMois: true,
  whatsappStatus: true,
  whatsappE164: true,
  champsLibres: true,
} satisfies Prisma.ProspectSelect;

type ProspectRapproche = Prisma.ProspectGetPayload<{ select: typeof PROSPECT_RAPPROCHE }>;

interface SaisiePublique {
  readonly nom: string;
  readonly prenom: string;
  readonly phoneE164: string;
  readonly email?: string;
  readonly profession?: string;
  readonly employeur?: string;
  readonly etablissement?: string;
  readonly banqueId?: string;
  readonly syndicatId?: string;
  readonly incomeBandId?: string;
  readonly type?: ProspectType;
  readonly paymentMode?: PaymentMode;
  readonly dureeSystemeMois?: number;
  readonly whatsappStatus?: WhatsappStatus;
  readonly whatsappE164?: string;
  readonly champsLibres: Record<string, string>;
  /** Sans colonne sur la fiche : repris dans le résumé de relecture. */
  readonly dureeEtablissementMois?: number;
  readonly fonctionnaire?: boolean;
  readonly engagementEnCours?: boolean;
}

const lienInvalide = (): NotFoundException =>
  new NotFoundException({
    code: 'LIEN_INVALIDE',
    message: 'Ce lien ne fonctionne plus. Demandez-en un nouveau à votre conseiller CPI.',
  });

const champsManquants = (libelles: readonly string[]): BadRequestException =>
  new BadRequestException({
    code: 'CHAMPS_OBLIGATOIRES',
    message: `Renseignez ${libelles.join(', ')} avant d’envoyer.`,
  });

const enHtml = (texte: string): string =>
  `<p>${texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br />')}</p>`;

/** Jetons `{prenomNom}` du texte d'accusé réglé par l'administrateur (EB-29). */
const remplacerJetons = (texte: string, jetons: Readonly<Record<string, string>>): string =>
  texte.replace(/\{(\w+)\}/g, (jeton, nom: string) => jetons[nom] ?? jeton);

function ouiNon(valeur: boolean | undefined): string | null {
  if (valeur === undefined) return null;
  return valeur ? 'oui' : 'non';
}

/**
 * Le référentiel choisi n'est PAS repris ici : il est déjà sur la fiche, sous
 * son libellé. Ne restent que le numéro saisi et ce qu'aucune colonne ne porte.
 */
const resumer = (demande: DemandePubliqueDto, saisie: SaisiePublique): string => {
  const fonctionnaire = ouiNon(saisie.fonctionnaire);
  const engagement = ouiNon(saisie.engagementEnCours);
  return [
    `Nom : ${saisie.prenom} ${saisie.nom}`,
    `Téléphone : ${saisie.phoneE164}`,
    saisie.email === undefined ? null : `E-mail : ${saisie.email}`,
    saisie.profession === undefined ? null : `Profession : ${saisie.profession}`,
    saisie.etablissement === undefined ? null : `Établissement : ${saisie.etablissement}`,
    saisie.employeur === undefined ? null : `Employeur : ${saisie.employeur}`,
    saisie.dureeEtablissementMois === undefined
      ? null
      : `Durée dans l’établissement : ${saisie.dureeEtablissementMois} mois`,
    fonctionnaire === null ? null : `Fonctionnaire : ${fonctionnaire}`,
    engagement === null ? null : `Engagement en cours à la banque : ${engagement}`,
    demande.message === undefined ? null : `Message : ${demande.message}`,
  ]
    .filter((ligne) => ligne !== null)
    .join('\n');
};

const texteOuUndefined = (valeur: string | undefined): string | undefined => {
  const propre = valeur?.trim();
  return propre === undefined || propre === '' ? undefined : propre;
};

/** Vrai numéro de téléphone déjà en base, mais pas de doublon d'e-mail : la colonne n'est pas unique. */
const estDoublonDeNumero = (error: unknown): boolean =>
  isPrismaKnownError(error) && error.code === 'P2002';

/**
 * Le formulaire public : la seule écriture de ce dépôt qui n'a pas d'auteur
 * connecté.
 *
 * Le lien porte le compte qui l'a partagé, et c'est lui qui devient auteur de la
 * fiche : `prospects.createdById` est obligatoire, et l'attribuer à un compte
 * choisi au hasard rendrait la fiche invisible au téléconseiller qui a démarché.
 */
@Injectable()
export class FormulairePublicService {
  private readonly logger = new Logger(FormulairePublicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly parametres: ParametresChuesService,
    private readonly champs: ChampsConversionService,
    @Inject(BREVO_TRANSPORT) private readonly email: BrevoTransport,
  ) {}

  /**
   * De quoi composer la page : les champs réglés par l'administrateur et les
   * seules listes dont ces champs ont besoin. Rien d'une fiche existante.
   */
  async formulaire(): Promise<FormulairePublicDto> {
    const [reglages, banques, syndicats, revenus] = await Promise.all([
      this.champs.reglages(Projet.CHUES),
      this.prisma.banque.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true },
      }),
      this.prisma.syndicat.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true },
      }),
      this.prisma.incomeBand.findMany({
        where: { isActive: true },
        orderBy: [{ position: 'asc' }, { minXof: 'asc' }],
        select: { id: true, label: true },
      }),
    ]);

    return {
      champs: reglages.champs.filter((champ) => estChampPublic(champ.champ)),
      libres: [...reglages.libres],
      banques: banques.map((row) => ({ id: row.id, libelle: row.name })),
      syndicats: syndicats.map((row) => ({ id: row.id, libelle: row.name })),
      revenus: revenus.map((row) => ({ id: row.id, libelle: row.label })),
    };
  }

  async recevoir(jeton: string, demande: DemandePubliqueDto, ip?: string): Promise<OkDto> {
    // Le piège est rempli : la réponse est celle d'un envoi accepté, et rien
    // n'est écrit. Un refus explicite apprendrait au robot à contourner.
    if (demande.site !== undefined && demande.site.trim() !== '') return { ok: true };

    await verifierTurnstile(demande.turnstileToken, ip);

    const agent = await this.prisma.user.findFirst({
      where: { id: jeton, isActive: true, deletedAt: null },
      select: { id: true, email: true, username: true, fullName: true, role: true },
    });
    if (!agent) throw lienInvalide();

    const saisie = await this.retenir(demande);
    const now = new Date();
    const prospectId = await this.rapprocherOuCreer(agent.id, saisie, now);

    try {
      await this.prevenir(agent, prospectId, demande, saisie, now);
    } catch (error) {
      // La demande est enregistrée : la perdre parce qu'un e-mail n'est pas
      // parti ferait ressaisir le visiteur pour rien.
      this.logger.error({ err: error, prospectId }, 'Demande publique enregistrée, avis non émis');
    }

    return { ok: true };
  }

  /**
   * Applique les réglages d'EB-28. Un champ masqué et envoyé quand même est
   * ignoré : une page en cache ou un robot ne doit pas faire échouer un vrai
   * visiteur. Un champ exigé et absent, lui, arrête l'envoi.
   */
  private async retenir(demande: DemandePubliqueDto): Promise<SaisiePublique> {
    const reglages = await this.champs.reglages(Projet.CHUES);
    // Le garde porte sur la PROPRIETE : sans predicat typé, `filter` laisse
    // l'element en `ChampConversion` et `valeurSaisie` le refuse.
    const rendus = reglages.champs.filter(
      (champ): champ is ReglageChampDto & { champ: ChampPublic } =>
        champ.visible && estChampPublic(champ.champ),
    );
    const visibles = new Set<string>(rendus.map((champ) => champ.champ));
    const garde = <T>(champ: ChampPublic, valeur: T | undefined): T | undefined =>
      visibles.has(champ) ? valeur : undefined;

    const champsLibres = normaliserReponses(demande.champsLibres) ?? {};
    const declares = new Map(reglages.libres.map((libre) => [libre.id, libre]));
    for (const id of Object.keys(champsLibres)) {
      if (!declares.has(id)) delete champsLibres[id];
    }

    const manquants = [
      ...rendus.filter(
        (champ) => champ.obligatoire && valeurSaisie(demande, champ.champ) === undefined,
      ),
      ...reglages.libres.filter(
        (libre) => libre.obligatoire && champsLibres[libre.id] === undefined,
      ),
    ].map((champ) => champ.libelle);
    if (manquants.length) throw champsManquants(manquants);

    const whatsappE164 = garde('whatsappE164', texteOuUndefined(demande.whatsappE164));

    return {
      nom: demande.nom.trim(),
      prenom: demande.prenom.trim(),
      phoneE164: normalizePhone(demande.phone),
      champsLibres,
      ...defini({
        email: garde('email', demande.email?.trim().toLowerCase()),
        profession: garde('profession', texteOuUndefined(demande.profession)),
        etablissement: garde('etablissement', texteOuUndefined(demande.etablissement)),
        employeur: texteOuUndefined(demande.employeur),
        banqueId: garde('banqueId', demande.banqueId),
        syndicatId: garde('syndicatId', demande.syndicatId),
        incomeBandId: garde('incomeBandId', demande.incomeBandId),
        type: garde('type', demande.type),
        paymentMode: garde('paymentMode', demande.paymentMode),
        dureeSystemeMois: garde('dureeSystemeMois', demande.dureeSystemeMois),
        whatsappStatus: garde('whatsappStatus', demande.whatsappStatus),
        whatsappE164: whatsappE164 === undefined ? undefined : normalizePhone(whatsappE164),
        dureeEtablissementMois: garde('dureeEtablissementMois', demande.dureeEtablissementMois),
        fonctionnaire: garde('fonctionnaire', demande.fonctionnaire),
        engagementEnCours: garde('engagementEnCours', demande.engagementEnCours),
      }),
    };
  }

  /**
   * Le rapprochement se fait ICI, après envoi : le formulaire n'affiche jamais
   * qu'un numéro est déjà connu, et ne pré-remplit rien depuis la base.
   *
   * Une fiche existante n'est pas réécrite par une saisie non vérifiée : la
   * demande ne remplit que ses cases vides, et pose la marque à revoir.
   */
  private async rapprocherOuCreer(
    agentId: string,
    saisie: SaisiePublique,
    now: Date,
  ): Promise<string> {
    const existant = await this.trouver(saisie);
    if (existant) return this.completer(existant, saisie, now);

    try {
      const cree = await this.prisma.prospect.create({
        data: {
          id: uuidv7(),
          nom: saisie.nom,
          prenom: saisie.prenom,
          phoneE164: saisie.phoneE164,
          createdById: agentId,
          origin: PROSPECT_ORIGIN_FORMULAIRE_PUBLIC,
          aRevoirAt: now,
          journeys: { create: { projet: Projet.CHUES } },
          clientCreatedAt: now,
          ...defini({
            email: saisie.email,
            profession: saisie.profession,
            employeur: saisie.employeur,
            etablissement: saisie.etablissement,
            banqueId: saisie.banqueId,
            syndicatId: saisie.syndicatId,
            incomeBandId: saisie.incomeBandId,
            type: saisie.type,
            paymentMode: saisie.paymentMode,
            dureeSystemeMois: saisie.dureeSystemeMois,
          }),
          ...whatsappDuProspect(
            defini({ statut: saisie.whatsappStatus, numero: saisie.whatsappE164 }),
            {
              whatsappStatus: WhatsappStatus.NON_DEMANDE,
              whatsappE164: null,
              phoneE164: saisie.phoneE164,
            },
          ),
          ...(Object.keys(saisie.champsLibres).length ? { champsLibres: saisie.champsLibres } : {}),
        },
        select: { id: true },
      });
      return cree.id;
    } catch (error) {
      // Le double clic et deux onglets ouverts arrivent ici ensemble :
      // `prospects_phone_e164_active_key` a laissé passer une seule insertion.
      // C'est cet index qui rend l'envoi idempotent, et le perdant reprend le
      // chemin du rapprochement au lieu de rendre une erreur au visiteur.
      if (!estDoublonDeNumero(error)) throw error;
      const concurrent = await this.trouver(saisie);
      if (concurrent === null) throw error;
      return this.completer(concurrent, saisie, now);
    }
  }

  /**
   * Le TÉLÉPHONE fait foi : il porte l'index unique partiel et reste
   * l'identifiant métier. L'e-mail ne sert qu'à rattraper le numéro inconnu.
   * Quand les deux désignent deux fiches différentes, celle du numéro l'emporte
   * et l'autre n'est pas touchée : fusionner serait destructeur.
   */
  private async trouver(saisie: SaisiePublique): Promise<ProspectRapproche | null> {
    const parNumero = await this.prisma.prospect.findFirst({
      where: { phoneE164: saisie.phoneE164, deletedAt: null },
      select: PROSPECT_RAPPROCHE,
    });
    if (parNumero || saisie.email === undefined) return parNumero;

    // `id` est un UUID v7 : trier dessus prend la PLUS ANCIENNE fiche, et rend
    // le rapprochement déterministe quand une adresse en désigne plusieurs.
    return this.prisma.prospect.findFirst({
      where: { email: saisie.email, deletedAt: null },
      orderBy: { id: 'asc' },
      select: PROSPECT_RAPPROCHE,
    });
  }

  private async completer(
    existant: ProspectRapproche,
    saisie: SaisiePublique,
    now: Date,
  ): Promise<string> {
    await this.prisma.prospect.update({
      where: { id: existant.id },
      data: {
        origin: PROSPECT_ORIGIN_FORMULAIRE_PUBLIC,
        aRevoirAt: now,
        ...casesVides(existant, saisie),
      },
    });
    return existant.id;
  }

  /**
   * Supervision et compte partageur dans la boîte de réception, la même chose
   * par e-mail, et l'accusé au visiteur s'il a laissé une adresse.
   *
   * L'e-mail de supervision part d'ici et non de `dispatch()` : celui-ci ne sert
   * que les téléconseillers, par choix, et EB-30 veut l'encadrement servi aussi.
   */
  private async prevenir(
    agent: Agent,
    prospectId: string,
    demande: DemandePubliqueDto,
    saisie: SaisiePublique,
    now: Date,
  ): Promise<void> {
    const parametres = await this.parametres.lire();
    const superviseurs = await this.prisma.user.findMany({
      where: { role: Role.SUPERVISEUR, isActive: true, deletedAt: null },
      select: { id: true, email: true, fullName: true },
    });

    const prenomNom = `${saisie.prenom} ${saisie.nom}`;
    const informations = resumer(demande, saisie);
    const titre = `Demande reçue du formulaire public : ${prenomNom}`.slice(0, TITRE_MAX);
    const corps = `${informations}\nLien partagé par ${agent.fullName}.`.slice(0, CORPS_MAX);

    await this.notifications.create(agent, {
      title: titre,
      body: corps,
      category: NotificationCategory.SYSTEME,
      route: `/chues/prospects/${prospectId}`,
      audience: NotificationAudience.USERS,
      audienceUserIds: [...new Set([...superviseurs.map((membre) => membre.id), agent.id])],
    });

    const messages: BrevoMessage[] = [];

    const copies = [
      ...superviseurs.map((membre) => ({ email: membre.email, name: membre.fullName })),
      ...parametres.destinatairesSupervision.map((adresse) => ({ email: adresse })),
    ].filter((destinataire) => destinataire.email.trim() !== '');

    if (copies.length) {
      messages.push({
        recipients: copies,
        subject: titre,
        textContent: corps,
        htmlContent: enHtml(corps),
      });
    }

    if (saisie.email !== undefined) {
      const jetons = {
        prenomNom,
        date: now.toLocaleDateString('fr-FR', {
          dateStyle: 'long',
          timeZone: readNotificationsEnv().BUSINESS_TIME_ZONE,
        }),
        informations,
        telephone: saisie.phoneE164,
        emailChues: parametres.emailChues,
        whatsappChues: parametres.whatsappChuesE164,
      };
      const accuse = remplacerJetons(parametres.accuseReceptionCorps, jetons);
      messages.push({
        recipients: [{ email: saisie.email, name: prenomNom }],
        subject: remplacerJetons(parametres.accuseReceptionObjet, jetons),
        textContent: accuse,
        htmlContent: enHtml(accuse),
      });
    }

    if (!messages.length) return;

    const envoi = await this.email.send(messages);
    if (envoi.status !== 'SENT') {
      this.logger.warn({ prospectId, status: envoi.status }, 'Avis de demande publique non remis');
    }
  }
}

function valeurSaisie(demande: DemandePubliqueDto, champ: ChampPublic): unknown {
  if (champ === 'phoneE164') return demande.phone;
  return demande[champ];
}

// `Partial<T>` seul ne suffit pas sous `exactOptionalPropertyTypes` : la clé
// doit disparaître, pas valoir `undefined`. Voir `defined` dans phase2-sync.
function defini<T extends Record<string, unknown>>(
  values: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

/**
 * La règle qui prime sur tout le reste : une saisie publique non vérifiée ne
 * remplit que ce qui est vide. Le numéro n'est jamais réécrit, la fiche
 * rapprochée par e-mail garde le sien.
 */
function casesVides(existant: ProspectRapproche, saisie: SaisiePublique): Prisma.ProspectUpdateInput {
  const patch: Record<string, unknown> = {};
  const combler = (cle: string, courant: unknown, valeur: unknown): void => {
    if (valeur === undefined) return;
    if (courant !== null && courant !== '') return;
    patch[cle] = valeur;
  };

  combler('nom', existant.nom, saisie.nom);
  combler('prenom', existant.prenom, saisie.prenom);
  combler('email', existant.email, saisie.email);
  combler('profession', existant.profession, saisie.profession);
  combler('employeur', existant.employeur, saisie.employeur);
  combler('etablissement', existant.etablissement, saisie.etablissement);
  combler('banqueId', existant.banqueId, saisie.banqueId);
  combler('syndicatId', existant.syndicatId, saisie.syndicatId);
  combler('incomeBandId', existant.incomeBandId, saisie.incomeBandId);
  combler('type', existant.type, saisie.type);
  combler('paymentMode', existant.paymentMode, saisie.paymentMode);
  combler('dureeSystemeMois', existant.dureeSystemeMois, saisie.dureeSystemeMois);

  // La question n'a jamais été posée : sinon le statut porte une réponse, et
  // une déclaration publique ne la corrige pas.
  if (existant.whatsappStatus === WhatsappStatus.NON_DEMANDE && existant.whatsappE164 === null) {
    Object.assign(
      patch,
      whatsappDuProspect(defini({ statut: saisie.whatsappStatus, numero: saisie.whatsappE164 }), {
        whatsappStatus: existant.whatsappStatus,
        whatsappE164: existant.whatsappE164,
        phoneE164: existant.phoneE164,
      }),
    );
  }

  const libres = reponsesAbsentes(existant.champsLibres, saisie.champsLibres);
  if (libres) patch.champsLibres = libres;

  return patch as Prisma.ProspectUpdateInput;
}

function reponsesAbsentes(
  deja: Prisma.JsonValue,
  saisies: Record<string, string>,
): Prisma.InputJsonValue | null {
  const courant = normaliserReponses(deja) ?? {};
  const ajouts = Object.entries(saisies).filter(([id]) => courant[id] === undefined);
  if (!ajouts.length) return null;
  return { ...courant, ...Object.fromEntries(ajouts) };
}
