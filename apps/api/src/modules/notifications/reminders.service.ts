import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BankStageType,
  CallTaskStatus,
  CampaignStatus,
  NotificationAudience,
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationStatus,
  Prisma,
  Role,
} from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { isOpenApiGeneration } from '../../env.js';
import { DELIVERY_RETRY_ERROR, NotificationsService } from './notifications.service.js';
import { SENDING_LEASE_MS } from './dispatch-claim.js';
import { readNotificationsEnv } from './notifications.env.js';
import { renderNotification } from './template.js';
import type { ReminderRunDto } from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';

/**
 * Rappels programmés.
 *
 * ═══ L'IDEMPOTENCE EST LA SEULE PROPRIÉTÉ QUI COMPTE ICI ═══
 *
 * Un rappel n'est pas un envoi ordinaire : il se déclenche tout seul, la nuit,
 * sans personne pour constater qu'il est parti deux fois. Trois situations
 * ordinaires le feraient partir en double :
 *
 *   · un redémarrage de l'API juste après l'heure du tick ;
 *   · deux instances derrière un répartiteur de charge, qui tiquent ensemble ;
 *   · un déploiement qui rejoue le tick sur la nouvelle instance.
 *
 * La parade n'est PAS un verrou applicatif ni un « j'ai déjà tourné » en
 * mémoire, les deux disparaissent au redémarrage, c'est-à-dire exactement au
 * moment où on en a besoin. C'est une CONTRAINTE UNIQUE en base :
 *
 *   Notification         `(reminderKey, period)`
 *   NotificationDelivery `(reminderKey, userId, period)`
 *
 * La seconde tentative se heurte à l'index, lève P2002, et est comptée comme
 * ignorée. La garantie tient donc même si deux processus écrivent à la
 * milliseconde près, parce que c'est PostgreSQL qui arbitre, pas notre code.
 *
 * ═══ IDEMPOTENT NE VEUT PAS DIRE À USAGE UNIQUE ═══
 *
 * Le piège symétrique : une personne dont l'envoi a échoué de façon PASSAGÈRE
 * (Brevo en 429, socket coupée) verrait sa notification écrite, la contrainte
 * unique bloquer toute nouvelle écriture, et donc plus aucune tentative avant
 * la période suivante. `retryStalled` traite ce cas en rejouant l'envoi
 * EXISTANT plutôt qu'en en créant un second : une seule notification par
 * personne et par période, plusieurs tentatives de remise.
 *
 * ═══ L'INTERRUPTEUR DE DÉMONSTRATION : CE QUE CHAQUE TÂCHE EN FAIT ═══
 *
 * Ce fichier porte DEUX tâches planifiées, et elles ne traitent pas
 * l'interrupteur de la même façon. Énoncer la règle pour « les rappels » en
 * général serait faux dans les deux sens, il faut donc les nommer :
 *
 *   · `cpi.notifications.reminders` (`runAll` et tout ce qu'il appelle)
 *     IGNORE l'interrupteur, sans condition. Il COMPOSE des lignes : ce qu'il
 *     décide, personne d'autre ne le rattrapera.
 *   · `cpi.notifications.due` (`dispatchDue`) le RESPECTE, en filtre de
 *     lecture. Il n'invente rien et se contente d'EXPÉDIER des lignes composées
 *     ailleurs, y compris une annonce écrite pour une séance de démonstration,
 *     qui ne doit pas partir pour de bon vers de vrais destinataires. La ligne
 *     masquée reste programmée et repartira si le mode se rallume.
 *
 * POURQUOI LA COMPOSITION IGNORE L'INTERRUPTEUR. `demo_mode` est un réglage
 * GLOBAL, et `DemoReadOnlyGuard` ne juge que des requêtes HTTP. Une tâche
 * planifiée ne traverse aucune garde : elle tourne pendant la démonstration
 * comme le reste du temps, et ce qu'elle écrit atterrit dans la boîte de
 * réception de VRAIS commerciaux.
 *
 * Ce balayage lisait pourtant sa population avec `demoScope(demoEnabled)`.
 * Mode allumé, les fiches FICTIVES entraient dans les décomptes et les comptes
 * fictifs dans le public : un vrai commercial s'entendait annoncer des fiches
 * qu'il ne verrait jamais, et `demo.awa@cpi.sn` recevait un vrai e-mail par
 * Brevo, sur le vrai quota.
 *
 * PRÉCISION QUI A SON IMPORTANCE, parce qu'elle a déjà été lue de travers : la
 * version fautive lisait sous l'interrupteur, elle n'a JAMAIS écrit
 * `isDemo: demoEnabled`. Elle ne posait pas `isDemo` du tout, la colonne
 * prenait donc son défaut `false`. Toute relance jamais écrite par ce fichier
 * est réelle. Il n'existe pas, et il n'a jamais pu exister, de ligne de rappel
 * fictive à rattraper en base : `reminderKey` n'est écrit qu'ici, ni
 * `Notification` ni `NotificationDelivery` ne figurent dans
 * `DEMO_ENTITY_TYPES`, et aucun ensemencement ne les touche.
 *
 * D'où la règle : les rappels comptent du réel et écrivent du réel.
 * `demoScope(false)` sur chaque population interrogée, `isDemo: false` posé
 * EXPLICITEMENT sur la notification comme sur ses livraisons, plutôt que laissé
 * au défaut de colonne, pour que l'intention se lise sur place.
 *
 * CE QUE `state()` CHANGE ICI : RIEN, ET C'EST VÉRIFIÉ. `DemoVisibilityService`
 * distingue désormais « éteint » de « on ne sait pas », parce qu'`enabled()`
 * rend `false` quand la lecture du réglage échoue, ce qui est le bon repli pour
 * une lecture et le mauvais pour une garde d'ÉCRITURE. Ce fichier n'a aucune
 * garde d'écriture : la composition ne consulte pas l'interrupteur, et le seul
 * appel restant, celui de `dispatchDue`, est une décision de VISIBILITÉ. Son
 * repli en cas de panne de lecture est donc déjà le bon : on n'expédie que le
 * réel, et l'éventuelle ligne de démonstration attend le passage suivant.
 *
 * ═══ POURQUOI ÉMETTRE PLUTÔT QUE SE TAIRE ═══
 *
 * L'autre issue défendable était de ne rien émettre tant que le mode est
 * allumé : pas d'écriture, donc pas de ligne fictive à récupérer. Elle est
 * refusée pour une raison mesurable : le cron ne tique QU'UNE FOIS PAR JOUR. Un
 * rappel sauté n'est pas différé, il est perdu, et `demo_mode` est un réglage
 * persistant que rien n'oblige à retomber le soir. Une démonstration laissée
 * allumée une semaine coûterait une semaine de relances jamais parties, sans la
 * moindre trace. Un rappel non émis ne se rattrape pas ; une relance émise en
 * trop se referme au pire par une lecture.
 *
 * ═══ CE QUE L'IDEMPOTENCE A À VOIR AVEC TOUT ÇA ═══
 *
 * `(reminderKey, period)` NE PORTE PAS `isDemo`, et n'a pas à le porter : rien
 * ne peut occuper cette clé qu'une ligne écrite par `emit()`, et `emit()`
 * n'écrit que du réel. Les deux populations ne se rencontrent pas dans l'index,
 * il n'y a donc pas de collision à empêcher par un index plus large.
 *
 * Ce qui EST vrai, en revanche : la place prise l'est pour la journée ENTIÈRE,
 * et une seule fois. C'est ce qui rendait la lecture sous interrupteur durable
 * plutôt que passagère : le rappel de 8 h, gonflé par les fiches fictives,
 * occupait la clé du jour, et le chiffre faux ne pouvait plus être corrigé
 * avant le lendemain. Le passage suivant ne voyait qu'une contrainte violée.
 *
 * Compter du réel referme la question : la ligne qui occupe la clé porte le bon
 * chiffre du premier coup. C'est un argument de plus contre l'abstention, qui
 * aurait laissé la clé libre mais la journée vide.
 */

const env = readNotificationsEnv();

/**
 * Expression cron construite à L'IMPORT depuis l'environnement.
 *
 * Les décorateurs sont évalués une fois, au chargement du module : leur
 * argument ne peut pas venir d'une injection. Même contrainte, même solution
 * que `SYNC_MAX_BATCH_SIZE` dans le module de synchronisation.
 */
export const remindersCron = (at: string): string => {
  const [hours, minutes] = at.split(':');
  return `0 ${minutes ?? '0'} ${hours ?? '8'} * * *`;
};

export const REMINDERS_CRON = remindersCron(env.NOTIFICATIONS_REMINDERS_AT);

/**
 * Réexporté pour les tests et pour les lecteurs de ce fichier : la durée du
 * bail est définie avec le bail lui-même, dans `dispatch-claim.ts`, parce que
 * c'est la prise en charge qui l'applique et non l'ordonnanceur qui la
 * déclenche.
 */
export { SENDING_LEASE_MS };

/** Familles de rappel. Ces chaînes sont persistées : les renommer casse l'idempotence. */
export const ReminderKey = {
  OPEN_CALL_TASKS: 'open-call-tasks',
  // Clé DISTINCTE de `open-call-tasks`, et non un compte fusionné : les deux
  // files sont deux métiers (appeler des prospects, appeler des
  // représentants), elles renvoient vers deux écrans, et l'idempotence par
  // `(reminderKey, période)` doit pouvoir en relancer une sans l'autre.
  OPEN_REP_CALL_TASKS: 'open-rep-call-tasks',
  BANK_CASES_PENDING: 'bank-cases-pending',
  BANK_CASES_STALE: 'bank-cases-stale',
} as const;

export type ReminderKeyValue = (typeof ReminderKey)[keyof typeof ReminderKey];

/**
 * Période d'un rappel : la JOURNÉE CIVILE dans le fuseau métier.
 *
 * `Africa/Dakar` et non UTC : un rappel de 8 h du matin à Dakar tombe un jour
 * plus tôt en UTC pendant une partie de la nuit. Découper les périodes en UTC
 * ferait donc, deux fois par an et à chaque tick nocturne, considérer deux
 * envois du même matin comme appartenant à deux jours différents.
 */
export const periodFor = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

/**
 * Ce que les deux tables de tâches ont en commun, vu du rappel.
 *
 * Un type STRUCTUREL plutôt qu'une union des deux délégués Prisma : le rappel
 * n'utilise qu'un `groupBy` par destinataire, et le lier aux types complets
 * ferait échouer la compilation au premier champ ajouté à l'une des deux
 * tables sans rapport avec les relances.
 */
interface OpenTaskDelegate {
  groupBy(args: {
    by: ['assignedToId'];
    where: Record<string, unknown>;
    _count: { _all: true };
  }): Promise<{ assignedToId: string; _count: { _all: number } }[]>;
}

interface ReminderCandidate {
  readonly userId: string;
  readonly fullName: string;
  readonly variables: Record<string, string>;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private readonly config = readNotificationsEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly demo: DemoVisibilityService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Tick d'expédition des envois programmés
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Expédie les notifications dont l'heure est venue, et RATTRAPE celles qu'un
   * processus mort a laissées en chemin.
   *
   * LE VERROU EST UN `updateMany` CONDITIONNEL, pas une lecture suivie d'une
   * écriture, et IL N'EST PLUS POSÉ ICI : c'est `dispatch()` qui réclame, pour
   * tous ses appelants à la fois (voir `DispatchClaim`). Ce balayage ne fait
   * plus que DÉSIGNER des candidates ; celles qu'un autre processus tient déjà
   * rendent `claimed: false` et ne sont pas comptées. Poser une seconde prise
   * ici aurait rendu la première inutile tout en laissant croire qu'elle
   * protège, ce qui est exactement l'histoire que ce module vient de vivre.
   *
   * ═══ DEUX POPULATIONS, UNE SEULE PRISE EN CHARGE ═══
   *
   * 1. `SCHEDULED` dont l'heure est passée : le cas ordinaire.
   * 2. `SENDING` dont le BAIL a expiré : une notification prise en charge par un
   *    processus qui n'a jamais fini. Sans cette seconde branche, la ligne
   *    restait `SENDING` indéfiniment et n'était plus jamais relue, puisque la
   *    requête ne demandait que `SCHEDULED`. Ni envoyée, ni en échec, ni
   *    signalée : perdue en silence.
   *
   * Le prédicat sur `updatedAt` est réévalué DANS l'`updateMany`, exactement
   * comme `SyncBatchStore` réévalue sa date de reprise : deux repreneurs
   * simultanés ne peuvent pas gagner tous les deux, le second retrouve un bail
   * déjà renouvelé par `@updatedAt` et repart avec 0 ligne.
   *
   * ═══ CE N'EST PAS LE TRAVAIL DE `retryStalled`, ET C'EST VOULU ═══
   *
   * `retryStalled` ne peut pas couvrir ce cas, pour deux raisons cumulées, et il
   * ne faut donc pas chercher à fondre les deux mécanismes :
   *
   *   · il n'est appelé que depuis `emit()`, sur violation de contrainte unique,
   *     donc uniquement pour des lignes que le balayage a lui-même écrites. Les
   *     envois PROGRAMMÉS, qui sont toute la population de `dispatchDue`, ont
   *     `reminderKey` à `null` : une recherche par `reminderKey` ne peut par
   *     construction pas les retrouver ;
   *   · il exige `error: DELIVERY_RETRY_ERROR` sur la livraison. Un processus tué
   *     n'écrit aucun marqueur : la livraison reste `error: null` et il l'écarte.
   *
   * Les deux réparent des pannes différentes, à des étages différents :
   * `retryStalled` traite l'échec du TRANSPORT sur une livraison, le bail traite
   * la disparition du PROCESSUS sur une notification.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'cpi.notifications.due' })
  async dispatchDue(now: Date = new Date()): Promise<number> {
    if (isOpenApiGeneration()) return 0;

    /** Au-delà, le processus qui tenait la notification est réputé mort. */
    const leaseExpired = new Date(now.getTime() - SENDING_LEASE_MS);

    const claimable = [
      { status: NotificationStatus.SCHEDULED, scheduledFor: { lte: now } },
      { status: NotificationStatus.SENDING, updatedAt: { lt: leaseExpired } },
    ];

    // Une notification de démonstration n'est PAS expédiée mode éteint : elle
    // partirait vers de vrais destinataires (le public est résolu sans
    // cloisonnement quand le mode est allumé) avec un texte écrit pour une
    // séance de démonstration. Elle reste DANS L'ÉTAT OÙ elle est, programmée
    // ou en cours d'envoi, et sera reprise si le mode se rallume : c'est le
    // comportement d'une ligne masquée, pas supprimée. Une ligne en cours
    // d'envoi ne « redevient » pas programmée pour autant, c'est son bail
    // expiré qui la rendra prenable.
    const due = await this.prisma.notification.findMany({
      where: {
        OR: claimable,
        ...demoScope(await this.demo.enabled()),
      },
      select: { id: true },
      // Second critère de tri parce que le premier ne départage rien pour les
      // reprises : un rappel écrit par `emit()` n'a pas de `scheduledFor`, et
      // toutes ces lignes-là arriveraient donc dans un ordre indéterminé, la
      // plus ancienne pouvant rester derrière les cinquante autres.
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });

    let dispatched = 0;
    for (const row of due) {
      try {
        // L'instant du tick est passé jusqu'à la prise : l'échéance d'un envoi
        // programmé et l'expiration d'un bail se jugent sur la MÊME horloge que
        // celle qui a sélectionné la ligne, sinon les deux bouts de la
        // comparaison appartiennent à deux instants différents.
        if ((await this.notifications.dispatch(row.id, now)).claimed) dispatched += 1;
      } catch (error) {
        this.logger.error(
          `Expédition programmée ${row.id} en échec : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (dispatched)
      this.logger.log(`${String(dispatched)} notification(s) programmée(s) expédiée(s).`);
    return dispatched;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Rappels récurrents
  // ───────────────────────────────────────────────────────────────────────────

  @Cron(REMINDERS_CRON, { name: 'cpi.notifications.reminders', timeZone: env.BUSINESS_TIME_ZONE })
  async runAll(now: Date = new Date()): Promise<ReminderRunDto> {
    if (isOpenApiGeneration()) return { created: 0, skipped: 0 };
    if (!this.config.NOTIFICATIONS_REMINDERS_ENABLED) {
      this.logger.debug('Rappels désactivés (NOTIFICATIONS_REMINDERS_ENABLED=false).');
      return { created: 0, skipped: 0 };
    }

    const tasks = await this.remindOpenCallTasks(now);
    const repTasks = await this.remindOpenRepCallTasks(now);
    const bankPending = await this.remindBankCasesPending(now);
    const bankStale = await this.remindBankCasesStale(now);

    const runs = [tasks, repTasks, bankPending, bankStale];
    return {
      created: runs.reduce((total, run) => total + run.created, 0),
      skipped: runs.reduce((total, run) => total + run.skipped, 0),
    };
  }

  /** Commerciaux avec des fiches PROSPECT encore à appeler dans une campagne ACTIVE. */
  async remindOpenCallTasks(now: Date = new Date()): Promise<ReminderRunDto> {
    return this.remindOpenTasks({
      now,
      delegate: this.prisma.callTask,
      key: ReminderKey.OPEN_CALL_TASKS,
      title: 'Appels en attente',
      body: 'Il vous reste {{nombre}} fiche(s) à appeler dans la campagne en cours.',
      route: '/phase2',
    });
  }

  /**
   * Le même rappel, pour les campagnes REPRÉSENTANTS.
   *
   * Il manquait purement et simplement. L'en-tête du module des campagnes
   * représentants affirme que les deux familles de campagnes se comportent de
   * la même façon, mais le rappel n'interrogeait que `callTask` : un
   * téléconseiller pouvait laisser dormir cent représentants à rappeler sans
   * qu'aucune relance ne parte jamais. Le silence ressemblait exactement à
   * « rien à faire ».
   */
  async remindOpenRepCallTasks(now: Date = new Date()): Promise<ReminderRunDto> {
    return this.remindOpenTasks({
      now,
      delegate: this.prisma.repCallTask,
      key: ReminderKey.OPEN_REP_CALL_TASKS,
      title: 'Représentants à rappeler',
      body: 'Il vous reste {{nombre}} représentant(s) à appeler dans la campagne en cours.',
      route: '/rep-campaigns',
    });
  }

  /**
   * Corps commun aux deux files d'appel.
   *
   * Écrit une fois : deux copies auraient divergé au premier ajustement du
   * seuil ou de la visibilité de démonstration, et les deux familles de
   * campagnes se seraient mises à relancer selon deux règles sans que rien ne
   * le signale.
   */
  private async remindOpenTasks(options: {
    now: Date;
    delegate: OpenTaskDelegate;
    key: ReminderKeyValue;
    title: string;
    body: string;
    route: string;
  }): Promise<ReminderRunDto> {
    const { now, delegate, key, title, body, route } = options;
    if (!this.config.NOTIFICATIONS_OPEN_TASKS_ENABLED) return { created: 0, skipped: 0 };

    // `demoScope(false)` et non l'interrupteur : une fiche fictive n'est due à
    // personne. Comptée, elle gonflerait le « il vous reste 12 fiches » d'un
    // vrai commercial de fiches qu'il ne verra jamais, et l'enverrait sur un
    // écran qui en montre trois.
    const grouped = await delegate.groupBy({
      by: ['assignedToId'],
      where: {
        status: CallTaskStatus.OPEN,
        isActive: true,
        campaign: { status: CampaignStatus.ACTIVE },
        ...demoScope(false),
      },
      _count: { _all: true },
    });

    const eligible = grouped.filter(
      (group) => group._count._all >= this.config.NOTIFICATIONS_OPEN_TASKS_MIN,
    );
    if (!eligible.length) return { created: 0, skipped: 0 };

    // MÊME PORTÉE que le décompte, pour la raison qui vaut déjà mode éteint :
    // compter sous une visibilité et résoudre les destinataires sous une autre
    // produirait un chiffre adressé à personne. Et un compte fictif n'a pas de
    // relance à recevoir : `demo.awa@cpi.sn` est une adresse d'exemple, elle
    // partirait par Brevo comme une autre.
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: eligible.map((group) => group.assignedToId) },
        isActive: true,
        deletedAt: null,
        ...demoScope(false),
      },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((user) => [user.id, user.fullName]));

    const candidates: ReminderCandidate[] = eligible
      .filter((group) => nameById.has(group.assignedToId))
      .map((group) => ({
        userId: group.assignedToId,
        fullName: nameById.get(group.assignedToId) ?? '',
        variables: {
          nom: nameById.get(group.assignedToId) ?? '',
          nombre: String(group._count._all),
        },
      }));

    return this.emit({
      key,
      now,
      candidates,
      titleTemplate: title,
      bodyTemplate: body,
      route,
      category: NotificationCategory.CAMPAGNE,
    });
  }

  /**
   * Dossiers encore à une étape OPEN au-delà du délai de traitement.
   *
   * LE COMPTE EST GLOBAL, PAS PERSONNEL. Un dossier bancaire n'a pas de
   * propriétaire : il stationne à une étape, et c'est le pôle banque et
   * financement qui le fait avancer. Le rappel s'adresse donc à tout le rôle,
   * avec le même chiffre pour chacun. Attribuer arbitrairement les dossiers à
   * un agent produirait des relances adressées à quelqu'un qui n'a pas la main.
   *
   * L'ancienneté se mesure sur la CRÉATION du dossier : c'est la durée que
   * subit le client, la seule qu'il faille regarder pour dire « celui-ci
   * traîne ». La mesurer sur le dernier mouvement décrirait autre chose, et
   * c'est précisément l'objet du rappel suivant.
   */
  async remindBankCasesPending(now: Date = new Date()): Promise<ReminderRunDto> {
    if (!this.config.NOTIFICATIONS_BANK_PENDING_ENABLED) return { created: 0, skipped: 0 };

    const days = this.config.NOTIFICATIONS_BANK_PENDING_DAYS;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Réel seulement : un dossier de démonstration n'attend aucune décision, et
    // le pôle qui lirait « 14 dossiers » n'en trouverait que six à l'écran.
    const total = await this.prisma.bankCase.count({
      where: {
        deletedAt: null,
        currentStage: { type: BankStageType.OPEN },
        createdAt: { lte: cutoff },
        ...demoScope(false),
      },
    });
    if (!total) return { created: 0, skipped: 0 };

    return this.emit({
      key: ReminderKey.BANK_CASES_PENDING,
      now,
      candidates: await this.bankAudience({
        nombre: String(total),
        jours: String(days),
      }),
      titleTemplate: 'Dossiers en attente',
      bodyTemplate:
        '{{nombre}} dossier(s) sont ouverts depuis plus de {{jours}} jour(s) et attendent une décision.',
      route: '/dossiers',
      category: NotificationCategory.RAPPEL,
    });
  }

  /**
   * Dossiers ouverts que plus aucune transition n'a touchés depuis N jours.
   *
   * Le critère est l'ABSENCE de transition, et non `updatedAt` : une simple
   * correction de montant écrit `updatedAt` sans faire avancer le dossier, et
   * suffirait à le sortir de la liste. Or ce que ce rappel cherche est
   * exactement l'inverse, le dossier que personne ne fait plus bouger.
   *
   * Les dossiers créés APRÈS le seuil sont exclus : un dossier de la veille
   * n'a évidemment aucune transition, et l'y compter noierait le signal sous
   * les entrées du jour.
   */
  async remindBankCasesStale(now: Date = new Date()): Promise<ReminderRunDto> {
    if (!this.config.NOTIFICATIONS_BANK_STALE_ENABLED) return { created: 0, skipped: 0 };

    const days = this.config.NOTIFICATIONS_BANK_STALE_DAYS;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Même raison que le rappel précédent : le réel seul est en souffrance.
    const total = await this.prisma.bankCase.count({
      where: {
        deletedAt: null,
        currentStage: { type: BankStageType.OPEN },
        createdAt: { lte: cutoff },
        transitions: { none: { createdAt: { gt: cutoff } } },
        ...demoScope(false),
      },
    });
    if (!total) return { created: 0, skipped: 0 };

    return this.emit({
      key: ReminderKey.BANK_CASES_STALE,
      now,
      candidates: await this.bankAudience({
        nombre: String(total),
        jours: String(days),
      }),
      titleTemplate: 'Dossiers sans mouvement',
      bodyTemplate:
        "{{nombre}} dossier(s) n'ont enregistré aucun mouvement depuis {{jours}} jour(s).",
      route: '/dossiers',
      category: NotificationCategory.RAPPEL,
    });
  }

  /**
   * Le pôle banque et financement, en état de recevoir.
   *
   * La portée est composée ici AUSSI, et c'est la même que celle qui a servi à
   * compter : compter les dossiers d'un côté et résoudre les destinataires de
   * l'autre produirait un chiffre adressé à personne, ou l'inverse. Elle est
   * fixe, `demoScope(false)`, parce que le compte l'est également : le pôle qui
   * reçoit est fait de gens réels, il n'y a pas d'agent de démonstration à
   * prévenir de quoi que ce soit.
   */
  private async bankAudience(variables: Record<string, string>): Promise<ReminderCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: Role.BANQUE_FINANCE,
        isActive: true,
        deletedAt: null,
        ...demoScope(false),
      },
      select: { id: true, fullName: true },
    });

    return users.map((user) => ({
      userId: user.id,
      fullName: user.fullName,
      variables: { ...variables, nom: user.fullName },
    }));
  }

  /**
   * Écrit un rappel par destinataire, puis l'expédie.
   *
   * UNE NOTIFICATION PAR PERSONNE, et non une seule pour tous : le texte porte
   * un compte personnel (« 12 fiches »), ce qu'une ligne partagée ne peut pas
   * faire. La `reminderKey` de la NOTIFICATION porte donc l'identifiant du
   * destinataire, tandis que celle de la LIVRAISON reste la famille nue, c'est
   * cette dernière qui porte la garantie demandée,
   * `(reminderKey, userId, period)`, indépendamment de la façon dont les
   * notifications sont regroupées.
   */
  private async emit(input: {
    key: ReminderKeyValue;
    now: Date;
    candidates: readonly ReminderCandidate[];
    titleTemplate: string;
    bodyTemplate: string;
    route: string;
    category: NotificationCategory;
  }): Promise<ReminderRunDto> {
    const period = periodFor(input.now, this.config.BUSINESS_TIME_ZONE);
    let created = 0;
    let skipped = 0;

    for (const candidate of input.candidates) {
      const rendered = renderNotification(
        input.titleTemplate,
        input.bodyTemplate,
        candidate.variables,
      );

      try {
        const notification = await this.prisma.notification.create({
          data: {
            title: rendered.title,
            body: rendered.body,
            category: input.category,
            route: input.route,
            audience: NotificationAudience.USERS,
            audienceUserIds: [candidate.userId],
            status: NotificationStatus.SENDING,
            reminderKey: `${input.key}:${candidate.userId}`,
            period,
            // TOUJOURS RÉEL, jamais l'interrupteur. Les candidats sortent d'une
            // population réelle : ce rappel est dû à une vraie personne, sur du
            // vrai travail. L'écrire `true` le ferait disparaître de sa boîte à
            // l'extinction du mode, sans que la purge sache le reprendre.
            isDemo: false,
            deliveries: {
              create: [
                {
                  userId: candidate.userId,
                  status: NotificationDeliveryStatus.PENDING,
                  reminderKey: input.key,
                  period,
                  // La livraison suit sa notification : une ligne masquée
                  // accrochée à une notification visible afficherait une boîte
                  // de réception vide sur un rappel pourtant parti.
                  isDemo: false,
                },
              ],
            },
          },
          select: { id: true },
        });

        await this.notifications.dispatch(notification.id, input.now);
        created += 1;
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Déjà émis pour cette personne et cette période. C'est le chemin
          // NORMAL après un redémarrage : ce n'est pas une anomalie.
          skipped += 1;
          await this.retryStalled(input.key, candidate.userId, period, input.now);
          continue;
        }
        throw error;
      }
    }

    if (created || skipped) {
      this.logger.log(
        `Rappel ${input.key} (${period}) : ${String(created)} émis, ${String(skipped)} déjà présents.`,
      );
    }
    return { created, skipped };
  }

  /**
   * Rejoue un rappel DÉJÀ ÉCRIT dont l'envoi a buté sur un échec passager.
   *
   * ═══ POURQUOI CETTE MÉTHODE EXISTE ═══
   *
   * L'idempotence par `(reminderKey, period)` est ce qui empêche un rappel de
   * partir deux fois. Prise seule, elle produit aussi l'effet inverse de celui
   * qu'on veut : la personne dont l'e-mail a échoué sur un 429 ou une socket
   * coupée voit sa notification écrite en base, la contrainte unique interdit
   * d'en créer une seconde, et PLUS AUCUN passage ne retentera l'envoi avant le
   * lendemain. Un incident réseau de trente secondes coûtait ainsi une journée
   * de rappel.
   *
   * La parade n'est pas d'affaiblir la contrainte, ce serait rouvrir la porte
   * aux doublons, mais de REJOUER L'ENVOI EXISTANT : la ligne de livraison est
   * encore `PENDING` et porte le marqueur de réessai, `dispatch()` la reprend
   * telle quelle. Une seule notification, plusieurs tentatives.
   *
   * Le filtre sur le marqueur est essentiel : sans lui, on rejouerait aussi les
   * lignes en file pour la raison ordinaire (destinataire non servi par
   * e-mail), c'est-à-dire à chaque passage et pour rien.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * CE CHEMIN ENVOYAIT SANS RIEN RÉCLAMER, ET C'ÉTAIT LA PORTE RESTÉE OUVERTE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Il appelait `dispatch()` directement, sans prise en charge d'aucune sorte,
   * pendant que cinq rondes de corrections renforçaient le bail de
   * `dispatchDue`. Deux ticks de rappel simultanés, ou un réessai croisant le
   * balayage d'échéances, servaient donc les mêmes livraisons en même temps.
   *
   * Il n'y a rien à réclamer ICI pour autant : `dispatch()` réclame désormais
   * pour tous ses appelants (voir `DispatchClaim`), et une prise supplémentaire
   * à cet endroit serait précisément la liste d'appelants que personne ne tient
   * à jour.
   *
   * CE QUE CELA CHANGE POUR CE CHEMIN-CI, ET IL FAUT LE DIRE : le réessai
   * n'est plus IMMÉDIAT. Si l'envoi d'origine a eu lieu il y a moins d'un bail,
   * son détenteur est réputé vivant et `dispatch()` rend `claimed: false`. Le
   * rappel n'est pas perdu pour autant, et c'est ce qui rend le compromis
   * acceptable : la notification reste `SENDING`, donc `dispatchDue` la reprend
   * dès le bail expiré, soit quinze minutes plus tard, très loin de la fin de
   * la journée que le rappel décrit. On échange un réessai à la seconde contre
   * la certitude de ne jamais servir la même livraison deux fois.
   */
  private async retryStalled(
    key: ReminderKeyValue,
    userId: string,
    period: string,
    now: Date,
  ): Promise<void> {
    // LA MÊME PORTÉE QUE L'ÉCRITURE, et elle est fixe des deux côtés. C'est
    // précisément ce que l'interrupteur cassait : une ligne écrite mode allumé,
    // relue mode éteint, était introuvable, et le rappel restait bloqué
    // jusqu'au lendemain sans que rien ne le signale.
    const stalled = await this.prisma.notificationDelivery.findFirst({
      where: {
        reminderKey: key,
        userId,
        period,
        status: NotificationDeliveryStatus.PENDING,
        error: DELIVERY_RETRY_ERROR,
        ...demoScope(false),
      },
      select: { notificationId: true },
    });
    if (!stalled) return;

    try {
      const retried = await this.notifications.dispatch(stalled.notificationId, now);
      if (retried.claimed) {
        this.logger.log(`Rappel ${key} (${period}) : nouvelle tentative d'envoi pour ${userId}.`);
      } else {
        this.logger.debug(
          `Rappel ${key} (${period}) : envoi tenu par un autre passage, reprise laissée au bail.`,
        );
      }
    } catch (error) {
      // Un réessai qui échoue ne doit pas emporter le reste du passage : les
      // autres destinataires n'ont rien à voir avec cet incident.
      this.logger.warn(
        `Rappel ${key} (${period}) : réessai impossible pour ${userId} (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  }
}

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** Réexporté pour les tests, qui composent des publics de rappel. */
export const REMINDER_ROLE_DEFAULT = Role.COMMERCIAL;
