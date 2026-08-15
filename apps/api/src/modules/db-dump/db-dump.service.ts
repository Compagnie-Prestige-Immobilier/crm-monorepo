import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { mkdir, open, readdir, rm, stat, type FileHandle } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationAudience, NotificationCategory, type Prisma } from '@crm/database';
import type { FastifyReply } from 'fastify';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isOpenApiGeneration, readEnv } from '../../env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  dumpFileName,
  DUMP_TTL_MS,
  effectiveStatus,
  isInFlight,
  STALLED_REASON,
  type DumpJob,
  type DumpStatus,
} from './db-dump.job.js';
import { DUMP_RUNNER, type DumpRunner } from './db-dump.runner.js';
import type { DatabaseDumpJobDto } from './dto.js';

/**
 * Export intégral de la base, depuis les paramètres.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER PRODUIT, ET POURQUOI TOUT LE RESTE EN DÉCOULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un `.sql.gz` contenant la base ENTIÈRE : le nom et le numéro de téléphone de
 * chaque prospect, le montant en francs CFA de chaque dossier bancaire, les
 * comptes et leurs empreintes de mots de passe. Des personnes réelles, au
 * Sénégal. Ce n'est pas un export de travail, c'est un second exemplaire de
 * l'entreprise.
 *
 * LES CINQ VERROUS, ET AUCUN N'EST DÉCORATIF :
 *
 * 1. ADMIN. Posé sur le contrôleur.
 *
 * 2. PAS PENDANT UNE DÉMONSTRATION. Rien n'est écrit ici pour l'obtenir :
 *    `DemoReadOnlyGuard` refuse toute méthode mutante tant que l'interrupteur
 *    est allumé, et la demande est un POST. La route ne porte donc PAS
 *    `@DemoWritable`, et c'est la décision, pas un oubli.
 *
 *    ATTENTION À LA RAISON, QUI A LONGTEMPS ÉTÉ ÉCRITE FAUSSE ICI. Ce refus ne
 *    garantit PAS un export exempt de lignes fictives. `pg_dump` est lancé
 *    sans `--exclude-table` et sans filtre de lignes (voir
 *    `PG_DUMP_ARGUMENTS`) : il exporte TOUTE ligne de TOUTE table. Or éteindre
 *    la démonstration ne supprime rien, cela masque : les lignes semées gardent
 *    `isDemo: true` et ne disparaissent des écrans que par `demoScope`. Un
 *    export pris interrupteur ÉTEINT contient donc exactement les mêmes lignes
 *    fictives qu'un export pris interrupteur allumé, tant que le jeu de
 *    démonstration n'a pas été PURGÉ.
 *
 *    Ce que le 409 contrôle réellement est le MOMENT, et cela vaut d'être
 *    gardé : on ne produit pas une copie complète de la base pendant que le
 *    jeu fictif est à son maximum et que l'attention de l'opérateur est
 *    ailleurs. Ce qu'il ne contrôle pas, c'est la contamination, et c'est
 *    l'écran de confirmation qui le dit à l'administrateur.
 *
 *    Le TÉLÉCHARGEMENT, lui, est un GET : il reste possible, et c'est correct.
 *    L'archive porte en revanche `X-Demo-Mode: false` de façon explicite, sans
 *    quoi le panel l'enregistrerait sous un nom la déclarant fictive alors
 *    qu'elle contient la clientèle réelle (voir `setDownloadHeaders`).
 *
 * 3. AUCUN LIEN NE VOYAGE. L'avis de fin ne contient pas d'URL, pas de jeton,
 *    pas de pièce jointe : il dit que l'export est prêt et invite à se
 *    connecter. Le téléchargement se fait dans la session authentifiée de
 *    l'administrateur, par une route ADMIN ordinaire. Une boîte aux lettres
 *    compromise ou un message transféré ne donne donc accès à RIEN.
 *
 * 4. LE FICHIER NE SURVIT PAS. Détruit dès qu'il a été téléchargé, et de toute
 *    façon à l'échéance (voir `DUMP_TTL_MS`). Dans le cas nominal il vit
 *    quelques minutes.
 *
 * 5. TOUT EST TRACÉ. La demande et le téléchargement écrivent chacun une ligne
 *    dans `audit_logs`, nommant l'administrateur. Le même journal que la purge.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OÙ VIT L'ÉTAT, ET POURQUOI PAS EN MÉMOIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dans `app_settings`, sous une clé unique, exactement comme la release Android
 * (`mobile.android.release`). Deux raisons, et aucune n'est le confort :
 *
 *  - Le fichier vit sur un VOLUME, donc il survit à un redéploiement. Un état
 *    en mémoire, lui, ne survivrait pas : l'écran repartirait de zéro devant un
 *    fichier bien présent, que plus rien ne saurait ni servir ni détruire. Un
 *    exemplaire complet de la clientèle deviendrait orphelin sur le disque.
 *  - Une clé unique EST le verrou d'unicité. « Un seul export à la fois » n'est
 *    pas une règle qu'on vérifie, c'est la forme de la donnée.
 *
 * Aucune migration n'est demandée pour autant : `app_settings` existe, et
 * ajouter une table pour une ligne qui vit quelques heures coûterait plus cher
 * que ce qu'elle rapporte.
 */

/** La clé unique. Un seul export à la fois, par construction. */
const SETTING_KEY = 'admin.database.dump';

/** Type MIME de l'archive. Rien qu'un navigateur tenterait d'afficher. */
const DUMP_CONTENT_TYPE = 'application/gzip';

const AUDIT_REQUESTED = 'DATABASE_DUMP_REQUESTED';
const AUDIT_DOWNLOADED = 'DATABASE_DUMP_DOWNLOADED';

/**
 * Au-delà, une RÉSERVATION de téléchargement est réputée abandonnée.
 *
 * La réservation est ce qui garantit UNE livraison (voir `DumpJob.reservedAt`).
 * Comme tout verrou posé par un processus, elle doit avoir une durée de vie
 * propre : un conteneur tué pendant l'envoi laisserait sinon une archive
 * réservée pour l'éternité, c'est-à-dire un fichier que plus personne ne peut
 * ni télécharger ni faire détruire par un téléchargement.
 *
 * Dix minutes : très au-delà de ce que prend l'envoi d'une archive compressée,
 * même sur une liaison mobile à Dakar, et très en deçà de l'échéance du fichier.
 */
const RESERVATION_LEASE_MS = 10 * 60 * 1_000;

/**
 * Refus d'une seconde livraison simultanée.
 *
 * 409 et non 404 : l'archive existe, elle est simplement en train de partir
 * ailleurs. Un 404 enverrait l'administrateur relancer un export dont il n'a
 * pas besoin, ce qui remettrait un exemplaire de plus sur le disque.
 */
const alreadyDelivering = (): ConflictException =>
  new ConflictException({
    code: 'DATABASE_DUMP_DELIVERING',
    message:
      'Cet export est déjà en cours de téléchargement. Attendez la fin du transfert, ou ' +
      'réessayez dans quelques minutes s’il a été interrompu.',
  });

/** L'état enregistré, avec la chaîne EXACTE qui le porte en base. */
interface Stored {
  readonly job: DumpJob;
  readonly value: string;
}

/**
 * Relecture DÉFENSIVE de la ligne. Une valeur illisible vaut « pas d'export ».
 *
 * Écrit à part pour être appelé aussi bien par le service que par la
 * réconciliation d'amorçage, qui n'a pas d'acteur sous la main.
 */
function parseJob(raw: string): DumpJob | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<DumpJob>;
    if (typeof record.id !== 'string' || typeof record.status !== 'string') return null;
    // `reservedAt` a été ajouté après coup : une ligne écrite par une version
    // antérieure n'en a pas, et `undefined` traverserait ensuite tous les
    // contrôles d'égalité à `null`.
    return { ...record, reservedAt: record.reservedAt ?? null } as DumpJob;
  } catch {
    return null;
  }
}

/**
 * Le fichier que la ligne durable PROTÈGE, ou `null` si elle n'en protège aucun.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX ÉTATS ONT UN FICHIER VIVANT, PAS UN SEUL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `ready`, évidemment : c'est l'archive téléchargeable.
 *
 * `running` AUSSI, et c'est ce qui manquait. `pg_dump` écrit à cet instant même
 * dans le fichier que la ligne nomme. Le balayage ne regardait que `ready` :
 * un export en cours voyait donc sa sortie effacée sous lui par la
 * réconciliation horaire, qui finit forcément par tomber au milieu d'un export.
 *
 * Tous les autres états n'ont RIEN à protéger, et c'est délibéré :
 *
 *  · `failed` nomme encore un fichier PARTIEL, qu'il faut justement effacer.
 *    Un `.sql.gz` tronqué est indiscernable d'un export valide pour qui le
 *    trouve sur le volume ;
 *  · `queued` n'a pas encore de fichier ;
 *  · `expired` a déjà eu le sien détruit.
 *
 * Le statut lu est l'EFFECTIF, pas celui de la ligne : un `running` que la
 * borne de trente minutes a enterré est un mort, et son fichier partiel doit
 * partir avec lui.
 */
const liveFile = (job: DumpJob, now: Date): string | null => {
  if (job.fileName === null) return null;
  const status = effectiveStatus(job, now);
  return status === 'ready' || status === 'running' ? basename(job.fileName) : null;
};

@Injectable()
export class DbDumpService implements OnModuleInit {
  private readonly logger = new Logger(DbDumpService.name);
  private readonly directory = resolve(readEnv().DB_DUMP_DIR);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(DUMP_RUNNER) private readonly runner: DumpRunner,
  ) {}

  /**
   * RÉCONCILIATION D'AMORÇAGE. C'est elle qui rattrape les arrêts brutaux.
   *
   * Tout le reste du module ne s'exécute que si quelqu'un appelle une route.
   * Or ce qu'un redémarrage laisse derrière lui est précisément ce que personne
   * ne regarde : une archive partielle abandonnée en plein `pg_dump`, une
   * archive complète dont la destruction après envoi n'a pas eu le temps
   * d'aboutir, une réservation dont le processus détenteur n'existe plus. Ces
   * fichiers survivaient au redéploiement sur le volume, sans que rien ne
   * sache plus ni les servir ni les détruire.
   *
   * `deliveriesLost` est vrai ici, et seulement ici : au démarrage, TOUTE
   * réservation appartient à un processus mort, sans avoir à attendre son bail.
   *
   * L'échec ne fait pas échouer l'amorçage : une base indisponible à la
   * seconde du démarrage ne doit pas empêcher l'API de servir le reste. Le
   * balayage périodique repassera.
   */
  async onModuleInit(): Promise<void> {
    // Le conteneur est monté sans base pendant `pnpm openapi:generate`.
    if (isOpenApiGeneration()) return;
    try {
      await this.sweep(new Date(), true);
    } catch (error) {
      this.logger.error(
        `Export de la base : réconciliation d’amorçage impossible. ${String(error)}`,
      );
    }
  }

  /**
   * Balayage PÉRIODIQUE, le seul mécanisme d'échéance qui ne dépende de personne.
   *
   * L'échéance reposait sur un `setTimeout` armé à la fin de l'export, perdu au
   * moindre redémarrage, doublé d'une application paresseuse au premier regard
   * porté sur l'écran. Un fichier produit un vendredi soir, jamais téléchargé,
   * pouvait donc rester sur le volume tout le week-end, très au-delà des six
   * heures annoncées, et se retrouver dans les instantanés de sauvegarde du
   * fournisseur, qui passent la nuit.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * TOUTES LES DIX MINUTES, ET LA CADENCE EST LA BORNE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Le rythme était HORAIRE, et la justification écrite ici disait « le
   * dépassement maximal est donc d'une heure » comme si c'était acceptable. Ce
   * ne l'est pas : une heure sur six, c'est SEIZE POUR CENT de vie en plus
   * accordés à une copie complète et non chiffrée de la clientèle, hors de la
   * base, sur un volume que traversent les instantanés de sauvegarde du
   * fournisseur. `DUMP_TTL_MS` annonce six heures ; l'archive pouvait rester
   * près de sept.
   *
   * Le cas n'est pas théorique, il est simplement invisible. `state()` et
   * `download()` réconcilient immédiatement, donc l'écart ne se produit que
   * quand PERSONNE ne regarde : l'export du vendredi soir que son demandeur ne
   * vient jamais chercher, c'est-à-dire exactement la situation que ce
   * balayage existe pour couvrir.
   *
   * LA NOUVELLE BORNE EST DIX MINUTES, soit un trente-sixième des six heures,
   * moins de trois pour cent. Le dépassement cesse d'être une fraction
   * significative de l'échéance et devient un arrondi.
   *
   * ET IL N'Y A RIEN À PAYER POUR CELA. Un balayage, c'est une lecture de la
   * ligne `app_settings` par sa clé primaire, puis un `readdir` sur un
   * répertoire qui contient ZÉRO OU UN fichier, et rien d'autre quand il n'y a
   * rien à détruire, ce qui est le cas de la quasi-totalité des passages. Six
   * fois presque rien reste presque rien. Descendre plus bas n'achèterait plus
   * grand-chose : l'échéance elle-même se compte en heures.
   */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'cpi.db-dump.sweep' })
  async sweepExpired(): Promise<void> {
    if (isOpenApiGeneration()) return;
    try {
      await this.sweep();
    } catch (error) {
      this.logger.error(`Export de la base : balayage périodique impossible. ${String(error)}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lecture
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * L'état courant, RÉCONCILIÉ avec l'horloge.
   *
   * C'est ce que l'écran sonde. La réconciliation a lieu ICI et non dans une
   * tâche planifiée : le module n'a alors aucun ordonnanceur à posséder, et
   * surtout un fichier échu est détruit au premier regard porté sur lui, ce qui
   * est le moment où cela compte.
   *
   * Un ordonnanceur reste souhaitable pour le cas où PERSONNE ne regarde
   * pendant des jours ; le minuteur armé à la fin de l'export le couvre tant
   * que le processus vit, et la demande suivante balaie ce qui traîne. C'est
   * assumé, pas oublié.
   */
  async state(now = new Date()): Promise<DatabaseDumpJobDto> {
    const current = await this.reconcile(now);
    return this.toDto(current?.job ?? null, now);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Demande
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Demande un export. Rend IMMÉDIATEMENT.
   *
   * Le travail part en arrière-plan, délibérément non attendu : un `pg_dump`
   * tient la requête HTTP ouverte pendant des minutes, et le relais Next comme
   * le navigateur la coupent bien avant. L'écran sonde `state()`.
   *
   * Un export DÉJÀ EN COURS est RENDU tel quel, sans en démarrer un second.
   * C'est la réponse utile : celui qui reclique veut son fichier, pas une
   * seconde copie de la base sur le même disque.
   */
  async request(actor: AuthenticatedUser, now = new Date()): Promise<DatabaseDumpJobDto> {
    const existing = await this.reconcile(now);
    if (existing !== null && isInFlight(effectiveStatus(existing.job, now))) {
      return this.toDto(existing.job, now);
    }

    // UNE ARCHIVE PRÊTE N'EST PAS REMPLACÉE EN SILENCE.
    //
    // La demande détruisait l'archive courante pour en produire une autre. Deux
    // conséquences, et la seconde est la pire : l'administrateur qui téléchargeait
    // au même instant voyait son transfert mourir sans explication, et celui qui
    // recliquait par réflexe perdait un fichier déjà produit, déjà annoncé, pour
    // attendre plusieurs minutes de plus. Le refus est explicite, et il nomme le
    // geste qui débloque : télécharger, ou laisser l'échéance passer.
    if (existing !== null && effectiveStatus(existing.job, now) === 'ready') {
      throw new ConflictException({
        code: 'DATABASE_DUMP_ALREADY_READY',
        message:
          'Un export est déjà prêt au téléchargement. Téléchargez-le, ou attendez son ' +
          'échéance, avant d’en demander un autre.',
      });
    }

    const job: DumpJob = {
      id: randomUUID(),
      status: 'queued',
      requestedById: actor.id,
      requestedByName: actor.fullName,
      requestedAt: now.toISOString(),
      startedAt: null,
      finishedAt: null,
      fileName: null,
      fileSize: null,
      sha256: null,
      expiresAt: null,
      reservedAt: null,
      downloadedAt: null,
      failureReason: null,
      noticeStatus: null,
      noticeDetail: null,
    };

    // LA PRISE, et tout le reste en découle. Le drapeau `private starting` qui
    // tenait ce rôle ne valait que dans un processus : deux répliques
    // démarraient deux `pg_dump` sur la même base. Ici, la base arbitre.
    if (!(await this.claim(job, actor.id, existing?.value ?? null))) {
      throw new ConflictException({
        code: 'DATABASE_DUMP_IN_PROGRESS',
        message: 'Un export est déjà en cours de démarrage.',
      });
    }

    await this.audit(actor, AUDIT_REQUESTED, { jobId: job.id });

    // Balayage APRÈS la prise, et l'ordre est une correction. Balayer avant
    // revenait à effacer le répertoire sans détenir aucun droit dessus : une
    // réplique en plein `pg_dump` voyait son fichier partiel disparaître sous
    // elle. Une fois la clé prise, on sait qu'aucun autre export n'est en
    // cours, et ce qui traîne est donc bien un orphelin.
    await this.sweepOrphans(null);

    // Non attendu, EXPRÈS. `void` et un `catch` : une promesse rejetée sans
    // gestionnaire ferait tomber le processus Node entier.
    void this.execute(job, actor).catch((error: unknown) => {
      this.logger.error(`Export de la base : échec non rattrapé. ${String(error)}`);
    });

    return this.toDto(job, now);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Téléchargement
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Sert l'archive, puis la détruit.
   *
   * LA ROUTE NE PREND AUCUN PARAMÈTRE. Le nom du fichier vient de la ligne
   * `app_settings`, écrite par ce service, et il repasse par `basename` avant
   * d'être joint au répertoire : même une valeur corrompue en base ne peut pas
   * faire sortir la lecture du répertoire des exports. Un chemin dérivé de la
   * requête, sur une route qui sert la base entière, serait la faute la plus
   * chère du dépôt.
   *
   * La destruction n'a lieu QUE si la réponse est allée jusqu'au bout
   * (`writableFinished`). Un téléchargement coupé au deux tiers, sur une
   * liaison mobile, ne doit pas emporter le fichier : l'administrateur
   * recommencerait, et il n'y aurait plus rien à reprendre.
   */
  async download(actor: AuthenticatedUser, reply: FastifyReply, now = new Date()): Promise<void> {
    const current = await this.reconcile(now);
    if (
      current === null ||
      effectiveStatus(current.job, now) !== 'ready' ||
      current.job.fileName === null
    ) {
      throw new NotFoundException({
        code: 'DATABASE_DUMP_NOT_READY',
        message: 'Aucun export n’est disponible au téléchargement.',
      });
    }

    const job = current.job;
    // Le nom vient de la ligne écrite par ce service, jamais de la requête, et
    // repasse tout de même par `basename` : une valeur corrompue en base ne
    // doit pas pouvoir faire sortir la lecture du répertoire des exports.
    const fileName = basename(job.fileName ?? '');
    const path = join(this.directory, fileName);

    // ═══════════════════════════════════════════════════════════════════════
    // UN HEAD NE CONSOMME RIEN
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Fastify inscrit automatiquement un HEAD pour chaque GET, servi par le
    // MÊME gestionnaire. Un `HEAD .../download` authentifié administrateur
    // traversait donc tout ce qui suit : la ligne d'audit « téléchargé » était
    // écrite, la réponse s'achevait normalement (`writableFinished` est vrai
    // pour un HEAD, la garde `finish` plutôt que `close` n'y change rien), et
    // l'archive était DÉTRUITE sans qu'un seul octet ne soit parti. Une sonde,
    // un préchargement de navigateur ou un antivirus de passerelle suffisaient
    // à faire disparaître l'export, en laissant une trace affirmant qu'un
    // administrateur l'avait emporté.
    //
    // On rend les en-têtes, et rien d'autre : pas de réservation, pas d'audit,
    // pas de destruction.
    if (reply.request.method.toUpperCase() !== 'GET') {
      const probe = await this.openSealed(path);
      if (probe === null) return this.forgetMissingFile(job);
      await probe.handle.close();
      this.setDownloadHeaders(reply, fileName, probe.size);
      await reply.send();
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LA RÉSERVATION, ET POURQUOI ELLE PRÉCÈDE LE PREMIER OCTET
    // ═══════════════════════════════════════════════════════════════════════
    //
    // « Détruit après téléchargement » ne garantit UNE livraison que si la prise
    // est exclusive AVANT l'envoi. Deux requêtes simultanées passaient toutes
    // deux le contrôle `ready` et recevaient toutes deux l'archive intégrale ;
    // la destruction, qui n'a lieu qu'à la fin, arrivait trop tard pour
    // empêcher quoi que ce soit. Deux exemplaires complets de la clientèle
    // sortaient donc d'une fonctionnalité écrite pour n'en laisser sortir qu'un.
    //
    // Deux verrous, parce qu'il y a deux courses différentes :
    //  · le contrôle explicite ci-dessous arrête la seconde requête quand la
    //    première a déjà inscrit sa réservation ;
    //  · la comparaison-et-échange arbitre les deux requêtes qui ont lu la même
    //    ligne au même instant, et qui voient donc toutes deux `reservedAt` nul.
    // L'un sans l'autre laisse passer une des deux courses.
    if (job.reservedAt !== null) throw alreadyDelivering();

    const reserved: DumpJob = { ...job, reservedAt: now.toISOString() };
    if (!(await this.claim(reserved, actor.id, current.value))) throw alreadyDelivering();

    const opened = await this.openSealed(path);
    if (opened === null) {
      // La base annonce un fichier que le disque n'a pas : on remet l'état
      // d'accord avec la réalité plutôt que de laisser l'écran proposer
      // indéfiniment un téléchargement impossible.
      return this.forgetMissingFile(reserved);
    }
    const { handle, size } = opened;

    this.setDownloadHeaders(reply, fileName, size);

    // `finish` et NON `close`. `finish` ne se déclenche que lorsque la réponse
    // a été entièrement écrite ; `close` se déclenche AUSSI quand la connexion
    // tombe.
    // `once` et non `on`, pour les deux : la destruction de l'archive et
    // l'écriture de la trace ne doivent avoir lieu QU'UNE fois. Un émetteur qui
    // signalerait deux fois la fin d'une même réponse produirait deux lignes
    // d'audit pour un seul téléchargement, dans le journal qui sert justement à
    // savoir combien de copies de la clientèle circulent.
    reply.raw.once('finish', () => {
      // L'AUDIT EST ÉCRIT ICI, ET PAS AVANT.
      //
      // Il l'était avant l'envoi : un flux qui mourait au premier octet
      // laissait donc une ligne affirmant que l'administrateur avait emporté la
      // base. Le journal servait précisément à répondre « qui détient une copie
      // de la clientèle ? », et il répondait faux, dans le sens qui accuse.
      void this.finishDelivery(reserved, actor, fileName, size).catch((error: unknown) => {
        this.logger.error(
          `Export de la base : destruction après envoi impossible. ${String(error)}`,
        );
      });
    });
    reply.raw.once('close', () => {
      if (reply.raw.writableFinished) return;
      // Envoi interrompu : la réservation est RELÂCHÉE par le processus qui la
      // détient, seul à savoir que les octets ne sont pas tous partis. Le
      // téléchargement coupé sur une liaison mobile reste donc reprenable, ce
      // qui était la promesse d'origine.
      this.logger.warn('Export de la base : téléchargement interrompu, le fichier est conservé.');
      void this.writeOwned({ ...reserved, reservedAt: null }, actor.id).catch(() => undefined);
    });

    await reply.send(handle.createReadStream({ autoClose: true }));
  }

  private setDownloadHeaders(reply: FastifyReply, fileName: string, size: number): void {
    reply.header('Content-Type', DUMP_CONTENT_TYPE);
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    reply.header('Content-Length', String(size));
    // Un export de la clientèle ne doit rester dans aucun cache intermédiaire.
    reply.header('Cache-Control', 'no-store');
    // ═══════════════════════════════════════════════════════════════════════
    // CE FICHIER N'EST JAMAIS UNE DÉMONSTRATION, ET L'EN-TÊTE DOIT LE DIRE
    // ═══════════════════════════════════════════════════════════════════════
    //
    // `DemoModeInterceptor` estampille `X-Demo-Mode: true` sur toute réponse
    // pendant une démonstration, et `useFileDownload`, côté panel, renomme
    // alors le fichier en « …-DEMONSTRATION ». Le téléchargement reste ouvert
    // pendant une démonstration, délibérément, puisque l'archive a
    // nécessairement été produite hors démonstration : la conséquence était
    // qu'un administrateur enregistrait la base RÉELLE de ses clients sous un
    // nom affirmant le contraire. C'est l'inverse exact de ce que le marquage
    // existe pour éviter, et c'est le sens dangereux de l'erreur : un fichier
    // réel pris pour un jouet est un fichier qu'on ne protège plus.
    //
    // L'en-tête est posé EXPLICITEMENT à `false`. L'intercepteur ne l'écrase
    // pas, il n'estampille que ce qui ne porte rien.
    reply.header('X-Demo-Mode', 'false');
  }

  /**
   * Ouvre l'archive SANS SUIVRE DE LIEN SYMBOLIQUE.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * CE QUE `basename` NE COUVRAIT PAS
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `basename` empêche de SORTIR du répertoire par le nom : aucun `../` ne
   * survit. Il ne dit rien de ce que le nom DÉSIGNE une fois dans le
   * répertoire. `stat` et `createReadStream` suivent les liens symboliques :
   * qui peut écrire sur le volume (un conteneur voisin, une sauvegarde
   * restaurée, un opérateur) pouvait y déposer un lien portant le nom attendu
   * et faire servir n'importe quel fichier local par une route authentifiée
   * administrateur, `/etc/passwd` ou la clé privée du serveur.
   *
   * `O_NOFOLLOW` fait échouer l'ouverture si le dernier élément du chemin est
   * un lien. Le contrôle porte sur le descripteur OUVERT, pas sur le chemin :
   * il n'y a donc aucune fenêtre entre la vérification et l'usage, contrairement
   * à un `lstat` suivi d'un `open`. La taille rendue vient elle aussi du
   * descripteur, et décrit donc exactement ce qui sera envoyé.
   */
  private async openSealed(path: string): Promise<{ handle: FileHandle; size: number } | null> {
    let handle: FileHandle;
    try {
      handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch {
      return null;
    }
    try {
      const info = await handle.stat();
      if (!info.isFile()) {
        this.logger.error(`Export de la base : ${path} n’est pas un fichier ordinaire.`);
        await handle.close();
        return null;
      }
      return { handle, size: info.size };
    } catch {
      await handle.close().catch(() => undefined);
      return null;
    }
  }

  /** La ligne annonce un fichier que le disque n'a pas. On remet d'accord. */
  private async forgetMissingFile(job: DumpJob): Promise<never> {
    await this.expire(job);
    throw new NotFoundException({
      code: 'DATABASE_DUMP_NOT_READY',
      message: 'Le fichier d’export n’est plus disponible. Relancez un export.',
    });
  }

  /** Réponse entièrement émise : on trace, PUIS on détruit. */
  private async finishDelivery(
    job: DumpJob,
    actor: AuthenticatedUser,
    fileName: string,
    size: number,
  ): Promise<void> {
    await this.audit(actor, AUDIT_DOWNLOADED, {
      jobId: job.id,
      fileName,
      fileSize: size,
      sha256: job.sha256,
    });
    await this.consume(job, actor.id);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Exécution
  // ───────────────────────────────────────────────────────────────────────────

  private async execute(job: DumpJob, actor: AuthenticatedUser): Promise<void> {
    const startedAt = new Date();
    const fileName = dumpFileName(job.id, startedAt);
    const path = join(this.directory, fileName);

    // ═══════════════════════════════════════════════════════════════════════
    // LA LIGNE NOMME SON FICHIER DÈS QU'ELLE PASSE `running`
    // ═══════════════════════════════════════════════════════════════════════
    //
    // `fileName` n'était écrit qu'à l'arrivée, en même temps que `ready`.
    // Pendant tout le `pg_dump`, la ligne durable ne désignait donc AUCUN
    // fichier, et `sweep()` ne calcule sa liste de survivants que sur ce que la
    // ligne nomme : le balayage horaire, qui tombe forcément un jour au milieu
    // d'un export, effaçait le fichier EN COURS D'ÉCRITURE. `pg_dump`
    // continuait d'écrire dans un inode détaché, le `stat` final échouait, et
    // la ligne restait `running` jusqu'à ce que la borne de trente minutes
    // l'enterre. Un export perdu, sans autre trace qu'une erreur dans le
    // journal.
    //
    // Le nom est donc calculé AVANT et publié AVEC l'état `running`. Le
    // balayage peut alors distinguer un fichier vivant d'un orphelin, ce qui
    // est exactement ce qu'il prétend faire.
    let running: DumpJob = {
      ...job,
      status: 'running',
      startedAt: startedAt.toISOString(),
      fileName,
    };
    // ═══════════════════════════════════════════════════════════════════════
    // LA PRISE PERDUE ARRÊTE TOUT, ET ELLE L'ARRÊTE AVANT `pg_dump`
    // ═══════════════════════════════════════════════════════════════════════
    //
    // `writeOwned` partout dans ce chemin : si la ligne a changé de main, ce
    // travail n'existe plus pour personne et n'a plus rien à y écrire. La
    // valeur rendue était pourtant IGNORÉE ici, et seulement ici : le
    // passage à `ready` plus bas l'honore depuis toujours, en effaçant
    // l'archive et en rendant la main. Cette transition-ci partait donc lancer
    // `pg_dump` en sachant déjà que la ligne ne lui appartenait plus.
    //
    // Deux dégâts, et aucun ne se voit dans le journal :
    //  · DEUX `pg_dump` sur la même base en même temps, celui-ci et celui du
    //    travail qui a pris la clé, alors que tout le module est écrit pour
    //    qu'il n'y en ait jamais qu'un ;
    //  · `sweepOrphans()` ne garde que le fichier que la ligne DURABLE nomme.
    //    Cette ligne nomme désormais le fichier de l'autre travail : la sortie
    //    en cours d'écriture de celui-ci est donc un orphelin, et le premier
    //    balayage qui passe l'efface sous le processus qui écrit dedans.
    //
    // ABANDONNER AVANT `pg_dump` EST LA SEULE BRANCHE SÛRE, et c'est ce qui la
    // distingue du passage à `ready`. Là-bas, le fichier existe déjà et la
    // seule chose à faire est de le détruire. Ici, rien n'a encore été écrit :
    // ne pas démarrer ne laisse RIEN derrière soi, ni copie de la clientèle, ni
    // processus concurrent, ni ligne à corriger. Toute autre issue en laisse
    // au moins une. Démarrer puis renoncer plus tard reviendrait à produire
    // sciemment un exemplaire complet de la base que plus aucune ligne ne
    // nomme, donc que plus rien ne saurait ni servir ni détruire.
    //
    // Et l'on n'écrit RIEN de plus : pas même un `failed`, qui écraserait
    // l'état du travail qui détient légitimement la clé. Le journal porte la
    // trace, la ligne appartient à l'autre.
    if (!(await this.writeOwned(running, actor.id))) {
      this.logger.warn(
        `Export de la base ${job.id} : la ligne d’état a changé de main avant le démarrage, ` +
          'l’export est abandonné sans lancer pg_dump.',
      );
      return;
    }

    try {
      await mkdir(this.directory, { recursive: true });
      await this.runner.run(path);
    } catch (error) {
      // Le fichier partiel est effacé : un `.sql.gz` tronqué serait
      // indiscernable d'un export valide pour qui le trouverait sur le volume.
      await rm(path, { force: true });
      const reason = error instanceof Error ? error.message : String(error);
      await this.writeOwned(
        {
          ...running,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          failureReason: reason,
        },
        actor.id,
      );
      this.logger.error(`Export de la base demandé par ${actor.username} : échec. ${reason}`);
      return;
    }

    const finishedAt = new Date();
    const fileSize = (await stat(path)).size;
    running = {
      ...running,
      status: 'ready',
      finishedAt: finishedAt.toISOString(),
      fileSize,
      sha256: await this.sha256(path),
      expiresAt: new Date(finishedAt.getTime() + DUMP_TTL_MS).toISOString(),
    };

    // Si la ligne ne nous appartient plus, le fichier qu'on vient de produire
    // n'a AUCUN moyen d'être nommé, donc servi, donc détruit. On l'efface
    // immédiatement plutôt que de le laisser en orphelin sur le volume.
    if (!(await this.writeOwned(running, actor.id))) {
      await rm(path, { force: true });
      this.logger.warn(
        `Export de la base ${job.id} : la ligne d’état a changé de main, l’archive est détruite.`,
      );
      return;
    }

    // L'avis part APRÈS que l'état soit prêt : l'administrateur qui clique dans
    // la seconde qui suit la réception doit trouver un fichier téléchargeable,
    // et non un écran qui dit encore « en cours ».
    const notice = await this.notify(running, actor);
    await this.writeOwned({ ...running, ...notice }, actor.id);

    // Aucun minuteur de destruction n'est armé ici, et c'est un CHANGEMENT.
    // Un `setTimeout` ne survit pas au processus : il donnait l'illusion d'une
    // échéance tout en laissant le fichier vivre indéfiniment dès le premier
    // redéploiement. L'échéance est désormais tenue par `sweepExpired()`, qui
    // repasse toutes les heures quoi qu'il arrive, et par la réconciliation
    // d'amorçage. Voir `sweep()`.
  }

  /**
   * Avis de fin : LA CLOCHE DU PANEL, et elle seule. Sans le moindre lien.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * IL N'Y A PAS D'E-MAIL, ET CE FICHIER L'A LONGTEMPS AFFIRMÉ
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `NotificationsService.create` écrit la ligne de boîte de réception ET
   * déclenche un envoi Brevo. Mais la sélection des destinataires de l'e-mail
   * filtre sur `role: COMMERCIAL`, par conception : ce sont les commerciaux sur
   * le terrain qu'on va chercher hors du panel. L'ADMINISTRATEUR qui demande un
   * export n'est jamais dans cette liste. Aucun e-mail ne part donc JAMAIS pour
   * cet avis-ci, et l'état enregistrait pourtant `SENT`, que l'écran présentait
   * comme « l'e-mail est parti ».
   *
   * La conséquence n'était pas cosmétique : l'administrateur attend un message
   * qui ne viendra pas, conclut à une panne, et relance l'export, ce qui remet
   * un exemplaire complet de la clientèle sur le disque. Une promesse fausse,
   * sur cette fonctionnalité-là, PRODUIT des copies.
   *
   * Deux réparations étaient possibles : élargir la sélection des destinataires
   * aux ADMIN, ou dire la vérité. La première touche une règle partagée par
   * toutes les notifications du produit, dont ce module n'est pas propriétaire
   * et dont il ne peut pas juger l'intention ; on ne l'élargit pas depuis ici.
   * La seconde est écrite ci-dessous, et la cloche, elle, fonctionne
   * réellement.
   *
   * `INBOX_ONLY` est donc l'issue nominale, et l'écran ne promet plus rien
   * d'autre. `transportStatus` n'est PAS relu : il vaudrait `SENT` pour un
   * envoi qui n'a eu aucun destinataire, ce qui est la valeur qui a menti.
   *
   * L'ÉCHEC DE L'AVIS N'EST PAS L'ÉCHEC DE L'EXPORT. Le fichier est prêt ; il
   * le reste. Ce qui serait inacceptable, c'est de n'en rien dire : l'issue est
   * donc RENDUE et enregistrée dans l'état, où l'écran la lit.
   */
  private async notify(
    job: DumpJob,
    actor: AuthenticatedUser,
  ): Promise<{ noticeStatus: string | null; noticeDetail: string | null }> {
    try {
      await this.notifications.create(actor, {
        title: 'Export de la base prêt',
        body:
          'L’export intégral que vous avez demandé est terminé. Ouvrez Paramètres ' +
          'dans le panel et téléchargez-le depuis la carte « Export intégral ». ' +
          'Aucun lien n’est joint à cet avis, et il n’y en aura pas : le fichier ' +
          'contient toute la base et ne quitte le serveur que dans une session ' +
          'authentifiée.',
        category: NotificationCategory.SYSTEME,
        audience: NotificationAudience.USERS,
        audienceUserIds: [actor.id],
      });
      return { noticeStatus: 'INBOX_ONLY', noticeDetail: null };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Export de la base : avis de fin non envoyé. ${detail}`);
      return { noticeStatus: 'FAILED', noticeDetail: detail };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Interne
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Ramène l'état enregistré à ce que l'horloge et le disque disent vraiment.
   *
   * C'est le seul endroit qui DÉTRUIT sur échéance et qui enterre un travail
   * mort avec le conteneur. Toutes les entrées du service passent par lui.
   */
  private async reconcile(now: Date, deliveriesLost = false): Promise<Stored | null> {
    const current = await this.read();
    if (current === null) return null;
    const { job } = current;

    const status = effectiveStatus(job, now);

    // ═══════════════════════════════════════════════════════════════════════
    // UNE RÉSERVATION ABANDONNÉE FAIT DÉTRUIRE, ELLE NE FAIT PAS RELÂCHER
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Le réflexe serait de relâcher la prise et de rendre l'archive de nouveau
    // téléchargeable. Ce serait le mauvais côté du doute. Une réservation
    // abandonnée veut dire « un processus a commencé à livrer ce fichier, puis
    // a disparu » ; personne ne peut dire si les octets sont arrivés. Relâcher,
    // c'est risquer une SECONDE livraison d'un exemplaire complet de la
    // clientèle ; détruire, c'est coûter un export à relancer.
    //
    // Le second coût est payé par un administrateur qui recliquera. Le premier
    // ne se voit jamais. On détruit.
    //
    // `deliveriesLost` est posé par la réconciliation d'AMORÇAGE. En marche, on
    // laisse le bail s'écouler, pour ne pas détruire sous les pieds d'une
    // réplique qui livre.
    //
    // ═══════════════════════════════════════════════════════════════════════
    // CE RACCOURCI REPOSE SUR UNE HYPOTHÈSE DE DÉPLOIEMENT. LA VOICI.
    // ═══════════════════════════════════════════════════════════════════════
    //
    // « Au démarrage, le détenteur est nécessairement mort » n'est vrai que si
    // UNE SEULE instance d'API tourne à la fois. C'est le cas aujourd'hui :
    // `infra/docker/docker-compose.prod.yml` fixe `container_name`, ce qui
    // interdit deux conteneurs d'API simultanés et impose l'arrêt de l'ancien
    // avant le démarrage du neuf.
    //
    // SI CELA CHANGE, cette ligne devient dangereuse, et dans le sens qui ne se
    // voit pas : une instance qui démarre pendant qu'une SŒUR diffuse une
    // archive réservée depuis dix secondes détruirait le fichier sous son flux,
    // et écrirait « échu » sur une livraison en cours. Tout le reste du module
    // est pourtant écrit pour plusieurs répliques (voir `claim`) : l'hypothèse
    // est isolée ICI, et c'est la seule du fichier.
    //
    // La correction, le jour venu, tient en une ligne : retirer le raccourci et
    // laisser `RESERVATION_LEASE_MS` valoir aussi à l'amorçage. Elle ne coûte
    // aucune sûreté, une réservation en cours interdisant déjà tout second
    // téléchargement ; elle coûte seulement de garder l'archive au plus une
    // heure de plus après un arrêt brutal en pleine livraison.
    if (
      status === 'ready' &&
      job.reservedAt !== null &&
      (deliveriesLost || now.getTime() - Date.parse(job.reservedAt) > RESERVATION_LEASE_MS)
    ) {
      this.logger.warn(
        `Export de la base : réservation abandonnée (${job.id}), l’archive est détruite.`,
      );
      return this.expire(job);
    }

    if (status === job.status) return current;

    if (status === 'expired') return this.expire(job);

    // Travail en cours trop vieux : le processus est mort sans écrire son
    // échec. `queued` compris, voir `DUMP_MAX_RUNTIME_MS`.
    const next: DumpJob = {
      ...job,
      status,
      finishedAt: now.toISOString(),
      failureReason: STALLED_REASON,
      reservedAt: null,
    };
    const value = JSON.stringify(next);
    if (await this.writeOwned(next, null)) return { job: next, value };
    return this.read();
  }

  /**
   * Détruit l'archive et enterre la ligne. Le seul chemin vers `expired`.
   *
   * `writeOwned` et non une écriture nue : entre la lecture et ici, un autre
   * administrateur a pu inscrire un travail NEUF sous la même clé unique.
   * L'écraser avec un état « échu » le ferait disparaître alors qu'il vient de
   * démarrer, et rouvrirait la porte à un second `pg_dump` concurrent.
   *
   * Le fichier est effacé DANS TOUS LES CAS, y compris quand l'écriture perd :
   * il est nommé par la ligne qu'on vient de remplacer, donc plus rien ne le
   * désigne, et un orphelin est exactement ce qu'on refuse de laisser.
   */
  private async expire(job: DumpJob): Promise<Stored | null> {
    await this.removeFile(job.fileName);
    const next: DumpJob = { ...job, status: 'expired', fileName: null, reservedAt: null };
    const value = JSON.stringify(next);
    if (await this.writeOwned(next, null)) return { job: next, value };
    return this.read();
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * LA VIE DU FICHIER EST BORNÉE, Y COMPRIS À TRAVERS UN REDÉMARRAGE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * C'est le filet, et il manquait. Trois trous se rejoignaient pour rendre la
   * durée de vie de l'archive INDÉFINIE, alors que tout le reste du module est
   * écrit autour de l'idée qu'elle est courte :
   *
   *  · la destruction après envoi était lancée sans être attendue, depuis un
   *    gestionnaire d'événement. Un processus qui tombe entre la fin de la
   *    réponse et la destruction laissait une ligne `ready` DURABLE et un
   *    fichier téléchargeable, qui repassaient tels quels le redémarrage ;
   *  · un conteneur tué pendant `pg_dump` laissait une archive partielle que
   *    RIEN n'effaçait, jusqu'à une éventuelle demande suivante. S'il n'y en
   *    avait pas, le fichier restait ;
   *  · l'échéance reposait sur un `setTimeout`, perdu au redémarrage, doublé
   *    d'une application PARESSEUSE au premier regard. Sans regard, un `ready`
   *    échu depuis des jours restait sur le volume, où passent les instantanés
   *    de sauvegarde du fournisseur.
   *
   * Ensemble, ces trois trous faisaient de « le fichier ne survit pas » une
   * intention, pas une propriété. Ce balayage la rétablit : il est appelé à
   * L'AMORÇAGE (le seul moment qui rattrape ce qu'un arrêt brutal a laissé) et
   * périodiquement (le seul moyen de borner un fichier que personne ne regarde).
   *
   * Il compare le RÉPERTOIRE à la LIGNE DURABLE, et le répertoire perd toujours :
   * un fichier que la ligne ne nomme pas n'a par construction plus aucun moyen
   * d'être servi ni détruit par le reste du module. Il ne peut que traîner.
   */
  async sweep(now = new Date(), deliveriesLost = false): Promise<void> {
    const current = await this.reconcile(now, deliveriesLost);
    await this.sweepOrphans(current === null ? null : liveFile(current.job, now));
  }

  /** Le fichier a été livré : il n'a plus de raison d'exister. */
  private async consume(job: DumpJob, actorId: string): Promise<void> {
    await this.removeFile(job.fileName);
    // `writeOwned` : ce gestionnaire s'exécute APRÈS la réponse, donc
    // potentiellement longtemps après. Un administrateur a pu inscrire un
    // travail neuf entre-temps, et une écriture nue l'aurait écrasé avec
    // l'état « échu » du travail précédent. Le fichier, lui, est effacé dans
    // tous les cas : il porte le nom de l'archive livrée, pas celui du neuf.
    await this.writeOwned(
      {
        ...job,
        status: 'expired',
        fileName: null,
        reservedAt: null,
        downloadedAt: new Date().toISOString(),
      },
      actorId,
    );
    this.logger.log(`Export de la base téléchargé puis détruit (${job.id}).`);
  }

  private async removeFile(fileName: string | null): Promise<void> {
    if (fileName === null) return;
    await rm(join(this.directory, basename(fileName)), { force: true });
  }

  /**
   * Efface tout ce qui traîne dans le répertoire, hormis `keep`.
   *
   * Un redéploiement au milieu d'un export laisse un `.sql.gz` que plus aucune
   * ligne d'état ne désigne. Personne ne le sert, personne ne le détruit, et
   * il contient la base entière.
   */
  private async sweepOrphans(keep: string | null): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.directory);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === keep) continue;
      await rm(join(this.directory, entry), { force: true }).catch(() => undefined);
    }
  }

  private async sha256(path: string): Promise<string> {
    // Une seconde lecture du fichier, assumée : la compression est faite par un
    // flux que le lanceur possède, et y greffer un condensat obligerait chaque
    // implémentation de `DumpRunner`, doublures de test comprises, à le
    // calculer correctement. L'empreinte sert à vérifier un téléchargement, pas
    // à aller vite.
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  /**
   * L'état enregistré ET la chaîne exacte qui le porte.
   *
   * La chaîne est rendue avec l'objet, et ce n'est pas un détail : c'est le
   * témoin des écritures conditionnelles. Une comparaison-et-échange sur cette
   * table ne peut porter que sur `value`, puisqu'`app_settings` n'a ni colonne
   * de version ni identifiant de travail (voir le bloc `LA PRISE EST
   * CONDITIONNELLE` plus haut).
   */
  private async read(): Promise<Stored | null> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!setting) return null;
    const job = parseJob(setting.value);
    return job === null ? null : { job, value: setting.value };
  }

  /**
   * PRISE ATOMIQUE de la clé, en une seule instruction SQL.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * POURQUOI UN `upsert` NE VERROUILLAIT RIEN
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * L'ancienne écriture était un `upsert` inconditionnel, précédé d'une lecture
   * et d'un drapeau `private starting` en mémoire. Ce drapeau ne vaut que dans
   * UN processus : sur deux répliques, les deux lisent « aucun export en
   * cours », les deux passent leur drapeau local, les deux écrivent la clé, et
   * DEUX `pg_dump` partent sur la même base. Le second écrase l'état du
   * premier, dont le fichier devient un orphelin que plus rien ne nomme.
   *
   * Une ligne d'`app_settings` n'est un verrou que si l'écriture est
   * CONDITIONNELLE. C'est l'idiome déjà employé pour l'arbitrage des demandes
   * clients (`updateMany` sur `status: PENDING`, puis `count === 0` pour le
   * perdant) et pour le bail des rappels programmés. Sous READ COMMITTED, la
   * seconde transaction se bloque sur le verrou de ligne, réévalue son `where`
   * après le commit de la première, et ne met à jour AUCUNE ligne.
   *
   * Le cas « la ligne n'existe pas encore » est traité à part, par un `create` :
   * la clé est la clé primaire, donc le second insérant reçoit une violation
   * d'unicité, qui est exactement le même arbitrage rendu par la base.
   *
   * Rend `true` au gagnant, `false` au perdant. Aucun appelant n'a le droit
   * d'ignorer cette valeur.
   */
  private async claim(
    next: DumpJob,
    actorId: string | null,
    previous: string | null,
  ): Promise<boolean> {
    const value = JSON.stringify(next);
    if (previous === null) {
      try {
        await this.prisma.appSetting.create({
          data: { key: SETTING_KEY, value, updatedById: actorId },
        });
        return true;
      } catch {
        // Violation d'unicité : une autre réplique a inscrit la clé entre notre
        // lecture et notre écriture. Elle a gagné, et c'est très bien.
        return false;
      }
    }
    const claimed = await this.prisma.appSetting.updateMany({
      where: { key: SETTING_KEY, value: previous },
      data: { value, updatedById: actorId },
    });
    return claimed.count === 1;
  }

  /**
   * Écriture de PROGRESSION, réservée au propriétaire du travail.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * CE QU'ELLE EMPÊCHE : L'ÉCRASEMENT D'UN TRAVAIL PAR UN AUTRE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * La clé est UNIQUE, donc partagée par tous les travaux successifs. Une
   * écriture inconditionnelle laissait un travail terminé écraser la ligne d'un
   * travail SUIVANT : le gestionnaire de fin d'un téléchargement encore en
   * cours réinscrivait son propre état `expired` par-dessus le `queued` qu'un
   * administrateur venait de créer. Dans la fenêtre ainsi ouverte, le nouveau
   * travail n'était plus « en cours » pour personne, un POST de plus lançait
   * un SECOND `pg_dump`, et le balayage d'orphelins effaçait le fichier partiel
   * du premier en pleine écriture.
   *
   * Le prédicat porte sur l'identifiant du travail, présent en clair dans le
   * JSON. `count === 0` veut dire « la ligne ne t'appartient plus » : l'appelant
   * doit alors se taire, jamais réécrire.
   */
  private async writeOwned(job: DumpJob, actorId: string | null): Promise<boolean> {
    const written = await this.prisma.appSetting.updateMany({
      where: { key: SETTING_KEY, value: { contains: `"id":"${job.id}"` } },
      data: { value: JSON.stringify(job), updatedById: actorId },
    });
    return written.count === 1;
  }

  /**
   * Trace, dans le MÊME journal que la purge de la base.
   *
   * `entity: 'database'` et `action` explicites : ce sont les deux seules
   * opérations qui portent sur la base dans son ensemble, et elles doivent se
   * retrouver côte à côte quand quelqu'un demande « qui a touché aux données ».
   */
  private async audit(
    actor: AuthenticatedUser,
    action: string,
    payload: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action,
        entity: 'database',
        entityId: actor.id,
        after: payload,
      },
    });
  }

  private toDto(job: DumpJob | null, now: Date): DatabaseDumpJobDto {
    if (job === null) {
      return {
        id: null,
        status: 'idle',
        requestedByName: null,
        requestedAt: null,
        finishedAt: null,
        fileSize: null,
        sha256: null,
        expiresAt: null,
        failureReason: null,
        noticeStatus: null,
        noticeDetail: null,
        downloadable: false,
      };
    }
    const status: DumpStatus = effectiveStatus(job, now);
    return {
      id: job.id,
      status,
      requestedByName: job.requestedByName,
      requestedAt: job.requestedAt,
      finishedAt: job.finishedAt,
      fileSize: status === 'ready' ? job.fileSize : null,
      sha256: status === 'ready' ? job.sha256 : null,
      expiresAt: status === 'ready' ? job.expiresAt : null,
      failureReason: status === 'failed' ? job.failureReason : null,
      noticeStatus: job.noticeStatus,
      noticeDetail: job.noticeDetail,
      downloadable: status === 'ready',
    };
  }
}
