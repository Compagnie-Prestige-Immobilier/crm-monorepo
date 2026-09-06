import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationAudience, NotificationCategory, Projet, Role } from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PROSPECT_ORIGIN_FORMULAIRE_PUBLIC } from '../../common/prospect-origin.js';
import { normalizePhone } from '../../common/phone.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  BREVO_TRANSPORT,
  type BrevoMessage,
  type BrevoTransport,
} from '../notifications/brevo.transport.js';
import { readNotificationsEnv } from '../notifications/notifications.env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ParametresChuesService } from '../parametres-chues/parametres-chues.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { OkDto } from '../../common/dto/ok.dto.js';
import { DemandePubliqueDto } from './dto.js';
import { verifierTurnstile } from './turnstile.js';

const TITRE_MAX = 120;
const CORPS_MAX = 500;

type Agent = Pick<AuthenticatedUser, 'id' | 'email' | 'username' | 'fullName' | 'role'>;

const lienInvalide = (): NotFoundException =>
  new NotFoundException({
    code: 'LIEN_INVALIDE',
    message: 'Ce lien ne fonctionne plus. Demandez-en un nouveau à votre conseiller CPI.',
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

const resumer = (demande: DemandePubliqueDto, phoneE164: string): string =>
  [
    `Nom : ${demande.prenom} ${demande.nom}`,
    `Téléphone : ${phoneE164}`,
    demande.email === undefined ? null : `E-mail : ${demande.email}`,
    demande.profession === undefined ? null : `Profession : ${demande.profession}`,
    demande.employeur === undefined ? null : `Employeur : ${demande.employeur}`,
    demande.message === undefined ? null : `Message : ${demande.message}`,
  ]
    .filter((ligne) => ligne !== null)
    .join('\n');

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
    @Inject(BREVO_TRANSPORT) private readonly email: BrevoTransport,
  ) {}

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

    const phoneE164 = normalizePhone(demande.phone);
    const now = new Date();
    const prospectId = await this.rapprocherOuCreer(agent.id, phoneE164, demande, now);

    try {
      await this.prevenir(agent, prospectId, phoneE164, demande, now);
    } catch (error) {
      // La demande est enregistrée : la perdre parce qu'un e-mail n'est pas
      // parti ferait ressaisir le visiteur pour rien.
      this.logger.error({ err: error, prospectId }, 'Demande publique enregistrée, avis non émis');
    }

    return { ok: true };
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
    phoneE164: string,
    demande: DemandePubliqueDto,
    now: Date,
  ): Promise<string> {
    const existant = await this.prisma.prospect.findFirst({
      where: { phoneE164, deletedAt: null },
      select: { id: true, prenom: true, profession: true, employeur: true },
    });

    if (existant) {
      await this.prisma.prospect.update({
        where: { id: existant.id },
        data: {
          origin: PROSPECT_ORIGIN_FORMULAIRE_PUBLIC,
          aRevoirAt: now,
          ...this.champsAManques(existant, demande),
        },
      });
      return existant.id;
    }

    const cree = await this.prisma.prospect.create({
      data: {
        id: uuidv7(),
        nom: demande.nom.trim(),
        prenom: demande.prenom.trim(),
        phoneE164,
        createdById: agentId,
        origin: PROSPECT_ORIGIN_FORMULAIRE_PUBLIC,
        aRevoirAt: now,
        ...(demande.profession === undefined ? {} : { profession: demande.profession.trim() }),
        ...(demande.employeur === undefined ? {} : { employeur: demande.employeur.trim() }),
        journeys: { create: { projet: Projet.CHUES } },
        clientCreatedAt: now,
      },
      select: { id: true },
    });
    return cree.id;
  }

  private champsAManques(
    existant: { prenom: string; profession: string | null; employeur: string | null },
    demande: DemandePubliqueDto,
  ): Record<string, string> {
    return {
      ...(existant.prenom === '' ? { prenom: demande.prenom.trim() } : {}),
      ...(existant.profession === null && demande.profession !== undefined
        ? { profession: demande.profession.trim() }
        : {}),
      ...(existant.employeur === null && demande.employeur !== undefined
        ? { employeur: demande.employeur.trim() }
        : {}),
    };
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
    phoneE164: string,
    demande: DemandePubliqueDto,
    now: Date,
  ): Promise<void> {
    const parametres = await this.parametres.lire();
    const superviseurs = await this.prisma.user.findMany({
      where: { role: Role.SUPERVISEUR, isActive: true, deletedAt: null },
      select: { id: true, email: true, fullName: true },
    });

    const prenomNom = `${demande.prenom.trim()} ${demande.nom.trim()}`;
    const informations = resumer(demande, phoneE164);
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

    if (demande.email !== undefined) {
      const jetons = {
        prenomNom,
        date: now.toLocaleDateString('fr-FR', {
          dateStyle: 'long',
          timeZone: readNotificationsEnv().BUSINESS_TIME_ZONE,
        }),
        informations,
        telephone: phoneE164,
        emailChues: parametres.emailChues,
        whatsappChues: parametres.whatsappChuesE164,
      };
      const accuse = remplacerJetons(parametres.accuseReceptionCorps, jetons);
      messages.push({
        recipients: [{ email: demande.email, name: prenomNom }],
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
