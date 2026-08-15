import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
import {
  DEMO_DELETERS,
  DEMO_ENTITY_TYPES,
  DEMO_MODE_SETTING,
  DEMO_SEEDED_AT_SETTING,
  DemoRegistry,
  type DemoEntityType,
} from './demo-registry.js';
import { seedDemoData } from './demo-seeder.js';
import type { DemoCountsDto, DemoStatusDto } from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

/**
 * L'ensemencement touche plusieurs milliers de lignes : le délai par défaut de
 * Prisma (5 s) ne suffit pas, et il n'est pas question de découper en plusieurs
 * transactions, une démonstration à moitié semée est pire qu'une démonstration
 * absente.
 */
const DEMO_TRANSACTION_TIMEOUT_MS = 120_000;

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: DemoVisibilityService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Garde-fou d'environnement
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * En production, activer le mode démonstration est refusé tant que
   * `DEMO_MODE_ALLOWED` ne vaut pas `true`.
   *
   * Des prospects fictifs mêlés à de vraies fiches dans un export transmis au
   * siège serait un incident sérieux, et la fiabilité de la base tout entière
   * deviendrait suspecte. Le garde-fou est délibérément une variable
   * d'environnement et non un réglage en base : il doit rester hors de portée
   * de l'interface, y compris pour un administrateur.
   */
  private guard(): { allowed: boolean; reason: string | null } {
    const env = readEnv();
    if (env.NODE_ENV !== 'production') return { allowed: true, reason: null };
    if (env.DEMO_MODE_ALLOWED) return { allowed: true, reason: null };
    return {
      allowed: false,
      reason:
        'Le mode démonstration est désactivé en production. Pour l’autoriser, ' +
        'positionnez DEMO_MODE_ALLOWED=true sur le serveur et redémarrez l’API.',
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lecture
  // ───────────────────────────────────────────────────────────────────────────

  async status(): Promise<DemoStatusDto> {
    const [mode, seededAt, rows] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: DEMO_MODE_SETTING } }),
      this.prisma.appSetting.findUnique({ where: { key: DEMO_SEEDED_AT_SETTING } }),
      this.prisma.demoEntity.groupBy({ by: ['entityType'], _count: { _all: true } }),
    ]);

    const byType = new Map(rows.map((row) => [row.entityType, row._count._all]));
    const counts: DemoCountsDto = {
      users: byType.get('user') ?? 0,
      representants: byType.get('representant') ?? 0,
      prospects: byType.get('prospect') ?? 0,
      campaigns: byType.get('callCampaign') ?? 0,
      campaignCommerciaux: byType.get('callCampaignCommercial') ?? 0,
      callTasks: byType.get('callTask') ?? 0,
      callAttempts: byType.get('callAttempt') ?? 0,
      bankCases: byType.get('bankCase') ?? 0,
      bankCaseTransitions: byType.get('bankCaseTransition') ?? 0,
    };

    const guard = this.guard();
    return {
      // L'état fait foi sur le registre, pas sur le réglage : si les deux
      // divergent, ce qui existe réellement en base est ce qui compte.
      enabled: mode?.value === 'true' && rows.length > 0,
      seededAt: seededAt?.value ?? null,
      canToggle: guard.allowed,
      reason: guard.reason,
      counts,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Activation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Allume la bascule d'affichage.
   *
   * N'ensemence QUE si le jeu de démonstration n'existe pas encore. Une fois
   * semé, il reste en base ; allumer et éteindre ne fait plus que changer sa
   * visibilité. C'est ce qui rend l'interrupteur sans danger : il ne détruit
   * rien, ni côté réel, ni côté démonstration.
   */
  async enable(adminId: string): Promise<DemoStatusDto> {
    const guard = this.guard();
    if (!guard.allowed) {
      throw new ForbiddenException({ code: 'DEMO_MODE_NOT_ALLOWED', message: guard.reason });
    }

    // Le décompte ne porte QUE sur les types connus, et c'est le pendant de la
    // purge : elle laisse derrière elle les lignes de type inconnu, faute de
    // savoir les supprimer. Un décompte nu les prendrait pour un jeu de
    // démonstration en place et se contenterait d'allumer l'interrupteur, sur
    // une base où il n'y a plus rien à montrer.
    const alreadySeeded = await this.prisma.demoEntity.count({
      where: { entityType: { in: [...DEMO_ENTITY_TYPES] } },
    });
    if (alreadySeeded > 0) {
      // Le jeu existe : on se contente d'allumer. Aucune écriture de données.
      await this.afterCommit(
        this.prisma.$transaction(async (tx) => {
          await this.setSetting(tx, DEMO_MODE_SETTING, 'true', adminId);
        }),
      );
      this.logger.log('Mode démonstration allumé (jeu déjà en place).');
      return this.status();
    }

    const registry = new DemoRegistry();
    await this.afterCommit(
      this.prisma.$transaction(
        async (tx) => {
          await seedDemoData(tx, registry);

          // Le registre est écrit DANS la même transaction que les données. Il
          // ne sert plus à la bascule, c'est la colonne `isDemo` qui porte la
          // visibilité, mais il reste l'inventaire exact de ce qui a été créé,
          // et donc la seule base sûre d'une suppression définitive.
          await tx.demoEntity.createMany({ data: registry.toRows() });
          await this.setSetting(tx, DEMO_MODE_SETTING, 'true', adminId);
          await this.setSetting(tx, DEMO_SEEDED_AT_SETTING, new Date().toISOString(), adminId);
        },
        { timeout: DEMO_TRANSACTION_TIMEOUT_MS },
      ),
    );

    this.logger.log(`Mode démonstration semé et allumé : ${String(registry.size)} entités.`);
    return this.status();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Désactivation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Éteint la bascule. NE SUPPRIME RIEN.
   *
   * Les lignes de démonstration restent en base, invisibles : aucune lecture ne
   * les rend plus, export Excel compris. C'est ce qui empêche une fiche fictive
   * de se retrouver dans un document transmis au siège.
   *
   * La suppression définitive est une action SÉPARÉE et explicite (`purge`) :
   * confondre les deux, c'est risquer qu'un administrateur qui voulait
   * simplement masquer la démonstration efface les données.
   */
  async disable(adminId: string): Promise<DemoStatusDto> {
    await this.afterCommit(
      this.prisma.$transaction(async (tx) => {
        await this.setSetting(tx, DEMO_MODE_SETTING, 'false', adminId);
      }),
    );
    this.logger.log('Mode démonstration éteint, aucune donnée supprimée.');
    return this.status();
  }

  /**
   * Supprime DÉFINITIVEMENT le jeu de démonstration.
   *
   * Supprime exactement ce que le registre liste, dans l'ordre inverse de
   * création. Aucune heuristique n'intervient : ni motif de nom, ni fenêtre de
   * dates, ni appartenance à un compte. Une ligne absente du registre n'est
   * jamais touchée, quelle que soit sa ressemblance avec une donnée de
   * démonstration.
   *
   * Action distincte de `disable` : celle-ci est irréversible et l'interface
   * doit la faire confirmer explicitement.
   */
  async purge(adminId: string): Promise<DemoStatusDto> {
    const entries = await this.prisma.demoEntity.findMany({
      orderBy: { sequence: 'desc' },
    });

    if (entries.length === 0) {
      await this.afterCommit(
        this.prisma.$transaction(async (tx) => {
          await this.setSetting(tx, DEMO_MODE_SETTING, 'false', adminId);
        }),
      );
      return this.status();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // L'ORDRE DE SUPPRESSION SUIT LES TYPES, PAS LES SÉQUENCES
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Le regroupement se faisait sur la séquence décroissante, en découpant la
    // liste à chaque changement de type. Cela suppose que la séquence d'une
    // ligne est TOUJOURS supérieure à celle de son parent, et cette invariante
    // ne tient pas : le registre est aussi alimenté hors ensemenceur, par la
    // remontée hors ligne, et une ligne DÉJÀ inscrite n'y est jamais
    // re-numérotée (`recordDemoEntity` ne fait rien sur conflit). Il suffit
    // donc qu'un animateur crée un prospect, puis un second représentant, puis
    // rattache le prospect à ce représentant-là : le prospect porte un rang
    // INFÉRIEUR à son nouveau parent, la purge tente de supprimer le
    // représentant en premier, `Prospect.representantId` est en
    // `onDelete: Restrict`, et la transaction entière échoue. Le jeu de
    // démonstration devient indéboulonnable, ce que la purge existe précisément
    // pour empêcher.
    //
    // Re-numéroter à chaque rattachement ne réparerait rien : hisser un
    // prospect au sommet le ferait passer AVANT ses propres enfants (une tâche
    // d'appel, un dossier bancaire semés) et casserait la purge dans l'autre
    // sens. L'ordre correct n'est pas chronologique, il est structurel.
    //
    // `DEMO_ENTITY_TYPES` le porte déjà : sa doc dit qu'un parent y précède
    // toujours ses enfants, et c'est vérifiable sur le schéma, aucune clé
    // étrangère ne remonte cette liste. La parcourir à l'envers donne donc un
    // ordre de suppression valide QUELLES QUE SOIENT les séquences. Celles-ci
    // ne servent plus qu'à départager deux lignes du même type, où aucune clé
    // étrangère ne les relie.
    // ═══════════════════════════════════════════════════════════════════════
    // UNE LIGNE INCONNUE NE BLOQUE PAS LA PURGE, ELLE SE FAIT SIGNALER
    // ═══════════════════════════════════════════════════════════════════════
    //
    // `DemoEntity.entityType` est un `String` NU au schéma : rien, côté base,
    // n'oblige sa valeur à figurer dans `DEMO_ENTITY_TYPES`. Une valeur héritée
    // d'une version antérieure, ou écrite à la main lors d'une réparation,
    // suffit donc à en produire une inconnue.
    //
    // Ce cas LEVAIT, avant la transaction. La conséquence était l'inverse exact
    // de ce que la purge existe pour garantir : la ligne fautive restait, mais
    // les DEUX MILLE autres aussi, l'interrupteur restait allumé, et la seule
    // action capable de retirer les données fictives de la base était morte
    // pour toujours. Une ligne illisible faisait tenir en otage tout le jeu de
    // démonstration.
    //
    // On supprime donc TOUT CE QU'ON SAIT SUPPRIMER, et on signale le reste.
    // Une ligne dont on ignore le type, on ignore aussi quelle table la porte :
    // il n'y a rien à faire d'autre que de la nommer, fort, à l'opérateur.
    const byType = new Map<DemoEntityType, string[]>();
    const unknown: string[] = [];
    for (const entry of entries) {
      const type = entry.entityType as DemoEntityType;
      if (!DEMO_ENTITY_TYPES.includes(type)) {
        unknown.push(entry.entityType);
        continue;
      }
      const bucket = byType.get(type);
      if (bucket) bucket.push(entry.entityId);
      else byType.set(type, [entry.entityId]);
    }

    if (unknown.length) {
      this.logger.error(
        `Registre de démonstration : ${String(unknown.length)} ligne(s) de type inconnu, ` +
          `laissées en place et NON supprimées (${[...new Set(unknown)].join(', ')}). ` +
          'La purge a traité tout le reste. Ces lignes désignent des données ' +
          'qu’aucun code ne sait effacer : elles demandent une intervention manuelle.',
      );
    }

    const groups = [...DEMO_ENTITY_TYPES]
      .reverse()
      .map((type) => ({ type, ids: byType.get(type) ?? [] }))
      .filter((group) => group.ids.length > 0);

    await this.afterCommit(
      this.prisma.$transaction(
        async (tx) => {
          for (const group of groups) {
            await DEMO_DELETERS[group.type](tx, group.ids);
          }
          // Le registre n'est vidé que de ce qui a RÉELLEMENT été supprimé.
          // Effacer aussi les lignes de type inconnu ferait disparaître la
          // seule trace de données fictives que personne ne sait plus atteindre.
          await tx.demoEntity.deleteMany({
            where: { entityType: { in: [...DEMO_ENTITY_TYPES] } },
          });
          await this.setSetting(tx, DEMO_MODE_SETTING, 'false', adminId);
          await this.setSetting(tx, DEMO_SEEDED_AT_SETTING, '', adminId);
        },
        { timeout: DEMO_TRANSACTION_TIMEOUT_MS },
      ),
    );

    this.logger.log(`Jeu de démonstration supprimé : ${String(entries.length)} entités.`);
    return this.status();
  }

  private async setSetting(
    tx: Prisma.TransactionClient,
    key: string,
    value: string,
    adminId: string,
  ): Promise<void> {
    // `updatedById` est une information d'audit, pas une dépendance dure : si
    // l'auteur a disparu entre-temps, typiquement l'administrateur de
    // démonstration, supprimé par la purge en cours, le réglage doit tout de
    // même s'écrire. Sans ce garde-fou, purger emporte l'auteur puis échoue en
    // voulant enregistrer l'extinction, et le mode reste allumé sur une base
    // vide.
    const author = await tx.user.findUnique({ where: { id: adminId }, select: { id: true } });
    const updatedById = author ? adminId : null;

    await tx.appSetting.upsert({
      where: { key },
      create: { key, value, updatedById },
      update: { value, updatedById },
    });

    // Le cache de visibilité est vidé ICI, dans l'unique fonction qui écrit un
    // réglage, et non à la sortie de `enable` / `disable` / `purge` : ces trois
    // méthodes ont sept points de retour à elles trois, et il suffirait d'en
    // oublier un pour qu'un administrateur bascule l'interrupteur sans que
    // l'écran change, le pire symptôme possible pour un interrupteur.
    //
    // CE VIDAGE-CI NE SUFFIT PAS À LUI SEUL, et `afterCommit` le complète : il
    // a lieu AVANT le commit, donc pendant que la base rend encore l'ancienne
    // valeur. Voir le doc-bloc d'`afterCommit`.
    this.visibility.invalidate();
  }

  /**
   * Vide le cache de visibilité UNE SECONDE FOIS, après le commit.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * POURQUOI UN SEUL VIDAGE NE SUFFIT PAS
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `setSetting` s'exécute DANS la transaction : quand il vide le cache, la
   * nouvelle valeur n'est visible que de cette transaction-là. Toute lecture
   * concurrente (`state()`, donc chaque écriture jugée par `DemoReadOnlyGuard`
   * et chaque émission de jeton) part alors en base, y lit l'ANCIENNE valeur,
   * et la met en cache pour la durée pleine du TTL. Plus rien ensuite ne
   * l'invalide : la bascule est déjà passée.
   *
   * Le symptôme est borné à deux secondes, mais il porte sur la garde
   * d'écriture et sur la connexion : après avoir éteint la démonstration, des
   * comptes fictifs pouvaient encore obtenir un jeton, et le doc de
   * `DemoVisibilityService` affirmait l'inverse (« `invalidate()` supprime même
   * ce délai sur l'instance qui a traité la bascule »).
   *
   * `finally` et non `then` : une transaction annulée peut avoir laissé un
   * appelant concurrent mettre en cache une valeur lue en cours de route, et
   * repartir d'un cache vide est de toute façon correct, seulement un peu plus
   * coûteux.
   */
  private async afterCommit<T>(work: Promise<T>): Promise<T> {
    try {
      return await work;
    } finally {
      this.visibility.invalidate();
    }
  }
}
