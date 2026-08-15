import {
  NotificationAudience,
  NotificationDeliveryStatus,
  NotificationStatus,
  Role,
} from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import {
  DELIVERY_ABANDONED,
  DELIVERY_INBOX_ONLY,
  DELIVERY_RETRY_ERROR,
  DISPATCH_DEADLINE_MS,
  EMAIL_PERSIST_GROUP_SIZE,
  NotificationsService,
  buildEmailContent,
} from './notifications.service.js';
import { NotificationError } from './errors.js';
import { SENDING_LEASE_MS } from './dispatch-claim.js';
import {
  BrokenBrevoTransport,
  FakeBrevoTransport,
  FakePrisma,
  ThrowingBrevoTransport,
} from './fake-prisma.js';
import {
  BREVO_MAX_CONCURRENT_CALLS,
  BrevoHttpTransport,
  chunkRecipients,
  classifyBrevoFailure,
  mapWithConcurrency,
  readBrevoErrorCode,
  type BrevoDispatchResult,
  type BrevoMessage,
  type BrevoTransport,
} from './brevo.transport.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

const admin: AuthenticatedUser = {
  id: 'usr-admin',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
};

const asUser = (id: string): AuthenticatedUser => ({
  id,
  email: `${id}@cpi.sn`,
  username: id,
  fullName: id,
  role: Role.COMMERCIAL,
});

/** Exécute et rend l'erreur levée. Échoue explicitement si l'appel réussit. */
async function refusal(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
}

const codeOf = (error: unknown): string | undefined =>
  ((error as { response?: { code?: string } }).response ?? {}).code;

/**
 * L'instant d'une REPRISE LÉGITIME, c'est-à-dire après expiration du bail.
 *
 * ═══ POURQUOI LES REPRISES DE CES TESTS SONT DATÉES ═══
 *
 * `dispatch()` réclame l'envoi avant d'envoyer quoi que ce soit, et une
 * notification laissée `SENDING` par un passage précédent GARDE son bail
 * jusqu'à expiration. C'est ce qui fixe la cadence de réessai à une tentative
 * par bail : relâcher le bail en fin de passage ferait reprendre l'envoi à
 * chaque tick de `dispatchDue`, soit soixante fois par heure contre un
 * transport déjà en panne.
 *
 * Un test qui rejoue l'envoi à la seconde suivante décrirait donc une reprise
 * que la production ne fait pas. Il avance l'horloge, comme le vrai passage
 * suivant l'aurait trouvée.
 */
const apresLeBail = (from: Date = new Date()): Date =>
  new Date(from.getTime() + SENDING_LEASE_MS + 60_000);

let db: FakePrisma;
let brevo: FakeBrevoTransport;
let service: NotificationsService;

const baseBody = {
  title: 'Réunion demain',
  body: 'Point commercial à 9 h au siège.',
  audience: NotificationAudience.ALL,
};

beforeEach(() => {
  db = new FakePrisma();
  // Éteint par défaut : c'est l'état du dépôt sans clé Brevo, et celui que la
  // très grande majorité de ces tests doit exercer.
  brevo = new FakeBrevoTransport();
  service = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);
});

// ─────────────────────────────────────────────────────────────────────────────
// Public
// ─────────────────────────────────────────────────────────────────────────────

describe('résolution du public', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', role: Role.COMMERCIAL, departementId: 'dep-1' });
    db.addUser({ id: 'usr-2', role: Role.COMMERCIAL, departementId: 'dep-2' });
    db.addUser({ id: 'usr-3', role: Role.BANQUE_FINANCE, departementId: 'dep-1' });
    db.addUser({ id: 'usr-inactif', role: Role.COMMERCIAL, isActive: false });
    db.addUser({ id: 'usr-supprime', role: Role.COMMERCIAL, deletedAt: new Date() });
  });

  it('« tout le monde » exclut les comptes désactivés et supprimés', async () => {
    // Un commercial dont l'accès a été fermé ne doit plus recevoir de consignes
    // de travail.
    const preview = await service.previewAudience({ audience: NotificationAudience.ALL });
    expect(preview.recipientCount).toBe(4); // admin + usr-1 + usr-2 + usr-3
  });

  it('« par rôle » ne retient que ce rôle', async () => {
    const preview = await service.previewAudience({
      audience: NotificationAudience.ROLE,
      audienceRole: Role.COMMERCIAL,
    });
    expect(preview.recipientCount).toBe(2);
  });

  it('« par département » ne retient que ce département', async () => {
    const preview = await service.previewAudience({
      audience: NotificationAudience.DEPARTEMENT,
      audienceDepartementId: 'dep-1',
    });
    expect(preview.recipientCount).toBe(2); // usr-1 + usr-3
  });

  it('« comptes choisis » déduplique avant de compter', async () => {
    // Choisir deux fois la même personne afficherait « 2 destinataires » pour
    // une seule, au moment précis où l'admin décide de confirmer.
    const preview = await service.previewAudience({
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-1', 'usr-2'],
    });
    expect(preview.recipientCount).toBe(2);
  });

  it('LE NOMBRE ANNONCÉ EST CELUI QUI EST SERVI', async () => {
    // C'est l'invariant qui justifie que l'aperçu et l'envoi partagent
    // `buildAudienceWhere`. Deux implémentations divergentes produiraient un
    // compteur qui ment sur une action non annulable.
    const selector = {
      audience: NotificationAudience.ROLE,
      audienceRole: Role.COMMERCIAL,
    } as const;
    const preview = await service.previewAudience(selector);

    const created = await service.create(admin, { ...baseBody, ...selector });

    expect(created.counts.total).toBe(preview.recipientCount);
  });

  it('refuse un public vide plutôt que d’enregistrer un envoi sans destinataire', async () => {
    const empty = new FakePrisma();
    empty.users.length = 0;
    const isolated = new NotificationsService(
      empty.asService(),
      fakeDemoVisibility(),
      new FakeBrevoTransport(),
    );

    const error = await refusal(() => isolated.create(admin, baseBody));
    expect(codeOf(error)).toBe(NotificationError.AUDIENCE_EMPTY);
  });

  it('refuse « par rôle » sans rôle', async () => {
    const error = await refusal(() =>
      service.create(admin, { ...baseBody, audience: NotificationAudience.ROLE }),
    );
    expect(codeOf(error)).toBe(NotificationError.AUDIENCE_ROLE_REQUIRED);
  });

  it('refuse une programmation dans le passé', async () => {
    const error = await refusal(() =>
      service.create(admin, {
        ...baseBody,
        scheduledFor: new Date(Date.now() - 60_000).toISOString(),
      }),
    );
    expect(codeOf(error)).toBe(NotificationError.SCHEDULE_IN_PAST);
  });

  it('refuse un lien profond absolu', async () => {
    // Une URL dans une notification portant le logo de l'application est un
    // vecteur d'hameçonnage que l'utilisateur ne peut pas inspecter.
    const error = await refusal(() =>
      service.create(admin, { ...baseBody, route: 'https://exemple.test/piege' }),
    );
    expect(codeOf(error)).toBe(NotificationError.ROUTE_INVALID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Éventail
// ─────────────────────────────────────────────────────────────────────────────

describe('éventail', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', role: Role.COMMERCIAL, email: 'un@cpi.sn' });
    db.addUser({ id: 'usr-2', role: Role.COMMERCIAL, email: 'deux@cpi.sn' });
    db.addUser({ id: 'usr-3', role: Role.COMMERCIAL, email: 'trois@cpi.sn' });
  });

  it('UNE ADRESSE REFUSÉE N’EMPORTE PAS LE LOT', async () => {
    brevo = new FakeBrevoTransport((email) =>
      email === 'deux@cpi.sn'
        ? { email, ok: false, errorCode: 'invalid_parameter', kind: 'permanent' }
        : { email, ok: true },
    );
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
    });

    expect(created.counts.sent).toBe(2);
    expect(created.counts.failed).toBe(1);

    const detail = await service.get(created.id);
    const broken = detail.recipients.find((recipient) => recipient.userId === 'usr-2');
    expect(broken?.status).toBe(NotificationDeliveryStatus.FAILED);
    expect(broken?.error).toBe('invalid_parameter');
  });

  it('UN ÉCHEC PASSAGER RESTE EN FILE, il n’est PAS enterré', async () => {
    // C'est la propriété qui rend le réessai possible. Écrire FAILED sur un 429
    // condamnerait définitivement un envoi que la seule attente aurait fait
    // passer, et personne ne le remarquerait.
    brevo = new FakeBrevoTransport((email) =>
      email === 'deux@cpi.sn'
        ? { email, ok: false, errorCode: 'HTTP_429', kind: 'transient' }
        : { email, ok: true },
    );
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
    });

    expect(created.counts.failed).toBe(0);
    expect(created.counts.pending).toBe(1);

    const detail = await service.get(created.id);
    const stalled = detail.recipients.find((recipient) => recipient.userId === 'usr-2');
    expect(stalled?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(stalled?.error).toBe(DELIVERY_RETRY_ERROR);
  });

  it('UNE LIVRAISON À RÉESSAYER LAISSE L’ENVOI PRENABLE, jamais SENT', async () => {
    // LE DÉFAUT QUE CE TEST INTERDIT DE REVENIR. La notification était marquée
    // SENT sans condition. Une seule adresse refusée passagèrement laissait donc
    // sa livraison PENDING sous un envoi SENT, et `dispatchDue` ne reprend que
    // les SCHEDULED échues et les SENDING dont le bail a expiré : plus rien ne
    // revenait dessus. Le téléconseiller ne recevait pas son e-mail, et la
    // plateforme affirmait le lui avoir envoyé.
    brevo = new FakeBrevoTransport((email) =>
      email === 'deux@cpi.sn'
        ? { email, ok: false, errorCode: 'HTTP_429', kind: 'transient' }
        : { email, ok: true },
    );
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
    });

    // SENDING et non SENT : c'est l'état qu'un bail expiré rend prenable.
    expect(created.status).toBe(NotificationStatus.SENDING);
    expect(created.sentAt).toBeNull();
  });

  it('et une fois TOUT tranché, l’envoi se referme sur SENT', async () => {
    // Le pendant du test précédent : rester SENDING quand plus rien n'est à
    // reprendre ferait repartir l'envoi toutes les quinze minutes pour rien.
    // Un refus DÉFINITIF ne se réessaie pas, il ne doit donc pas retenir l'envoi.
    brevo = new FakeBrevoTransport((email) =>
      email === 'deux@cpi.sn'
        ? { email, ok: false, errorCode: 'invalid_parameter', kind: 'permanent' }
        : { email, ok: true },
    );
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
    });

    expect(created.status).toBe(NotificationStatus.SENT);
    expect(created.sentAt).not.toBeNull();
  });

  it('un échec passager repart au passage suivant, et finit par passer', async () => {
    let refuse = true;
    brevo = new FakeBrevoTransport((email) =>
      refuse ? { email, ok: false, errorCode: 'HTTP_503', kind: 'transient' } : { email, ok: true },
    );
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(created.counts.pending).toBe(1);

    refuse = false;
    const retry = await service.dispatch(created.id, apresLeBail());

    expect(retry.sent).toBe(1);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.SENT);
  });

  it('UNE PANNE DE TRANSPORT LAISSE TOUT EN FILE', async () => {
    // Aucun lot n'est passé : ce ne sont pas les adresses qui sont en cause,
    // c'est le service ou la clé. Enterrer les livraisons ici perdrait un envoi
    // pour une panne de trente secondes.
    const broken = new NotificationsService(
      db.asService(),
      fakeDemoVisibility(),
      new BrokenBrevoTransport(),
    );

    const created = await broken.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.transportStatus).toBe('TRANSPORT_ERROR');
    expect(created.counts.failed).toBe(0);
    expect(created.counts.pending).toBe(1);
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);
  });

  it('un transport e-mail qui LÈVE laisse la livraison en file, sans propager', async () => {
    // Une exception ici ferait échouer la composition entière : le pire rapport
    // entre le prix payé et le service rendu.
    const throwing = new NotificationsService(
      db.asService(),
      fakeDemoVisibility(),
      new ThrowingBrevoTransport(),
    );

    const created = await throwing.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.transportStatus).toBe('TRANSPORT_ERROR');
    expect(created.counts.pending).toBe(1);
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * LA BASE LÂCHE AVANT MÊME QUE L'ON SACHE QUI SERVIR
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `ThrowingBrevoTransport` échoue APRÈS la lecture des comptes : la liste des
   * destinataires visés est déjà remplie, et le rattrapage la retrouve. La
   * fenêtre laissée ouverte est celle d'AVANT : un délai d'attente du pool ou
   * une requête interrompue sur `user.findMany`. Le rattrapage remettait alors
   * en file une liste vide, `retryable` restait à zéro, et l'envoi se refermait
   * sur SENT.
   *
   * Le symptôme était le pire du produit, et exactement celui que la correction
   * précédente prétendait avoir tué : aucun e-mail parti, toutes les livraisons
   * en file estampillées « boîte de réception seule », et une plateforme qui
   * affirme avoir envoyé.
   */
  /**
   * L'échéance de `scheduleThree`, dépassée d'une minute.
   *
   * `dispatch()` juge lui-même si l'heure est venue, depuis que c'est lui qui
   * réclame l'envoi : expédier une notification programmée pour dans une heure
   * parce qu'un appelant a demandé l'enverrait AVANT l'heure choisie. Les
   * reprises ci-dessous se datent donc, comme le tick réel les daterait.
   */
  const apresEcheance = (): Date => new Date(Date.now() + 3_600_000 + 60_000);

  /** Un envoi programmé, donc écrit sans être expédié : la panne vient après. */
  const scheduleThree = async (): Promise<string> => {
    brevo.configured = true;
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });
    db.breakOn('user.findMany', new Error('Timed out fetching a new connection from the pool'));
    return created.id;
  };

  it('UNE PANNE DE BASE AVANT LE CIBLAGE LAISSE L’ENVOI PRENABLE', async () => {
    const id = await scheduleThree();

    await service.dispatch(id, apresEcheance());
    db.faults.clear();
    const detail = await service.get(id);

    // SENDING : c'est le seul état que le bail expiré rend reprenable.
    expect(detail.notification.status).toBe(NotificationStatus.SENDING);
    expect(detail.notification.sentAt).toBeNull();
    expect(detail.notification.transportStatus).toBe('TRANSPORT_ERROR');

    // Et les trois lignes portent le marqueur de RÉESSAI, pas celui du
    // destinataire qu'on ne sert jamais par e-mail : la seconde valeur ferait
    // croire à un envoi terminé et correct.
    expect(db.deliveries).toHaveLength(3);
    for (const delivery of db.deliveries) {
      expect(delivery.status).toBe(NotificationDeliveryStatus.PENDING);
      expect(delivery.error).toBe(DELIVERY_RETRY_ERROR);
    }
  });

  it('la panne passée, la reprise sert bien les trois destinataires', async () => {
    // Contre-épreuve du test précédent : laisser l'envoi prenable ne vaut que
    // si la reprise aboutit réellement.
    const id = await scheduleThree();
    const echeance = apresEcheance();
    await service.dispatch(id, echeance);

    db.faults.clear();
    const retry = await service.dispatch(id, apresLeBail(echeance));

    expect(retry.sent).toBe(3);
    expect(brevo.allAddresses).toHaveLength(3);
  });

  /**
   * LE MARQUEUR DE RÉESSAI NE DOIT PAS ÊTRE EFFACÉ PAR UN PASSAGE AVEUGLE.
   *
   * Sans clé Brevo, la branche e-mail ne juge PERSONNE : elle rend une table de
   * verdicts vide. Toutes les livraisons tombaient alors dans la branche « rien
   * à envoyer au-dehors » et se faisaient estampiller `INBOX_ONLY`, ce qui
   * affirme d'un téléconseiller parfaitement joignable qu'il ne sera jamais
   * servi par e-mail, et efface la seule trace disant « celle-ci est à
   * reprendre ».
   */
  it('un passage sans clé n’efface pas le marqueur de réessai d’un passage précédent', async () => {
    brevo = new FakeBrevoTransport((email) => ({
      email,
      ok: false,
      errorCode: 'HTTP_503',
      kind: 'transient',
    }));
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);

    // La clé disparaît entre deux passages (rotation ratée, variable perdue).
    brevo.configured = false;
    await service.dispatch(created.id, apresLeBail());

    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * UNE CLÉ INVALIDE NE SE RÉESSAIE PAS TOUTES LES QUINZE MINUTES
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Le transport annonce `TRANSPORT_ERROR` dès qu'aucun lot n'est passé, quelle
   * que soit la nature des refus. Un public de moins de cent adresses tient
   * dans un seul lot : c'est donc l'état rendu pour TOUT refus définitif de
   * l'audience normale de ce produit. Le traduire en bloc par « tout le monde
   * réessaie » épinglait la notification en SENDING pour toujours.
   */
  it('UN REFUS DÉFINITIF DE TOUT LE PUBLIC EST ENTERRÉ, PAS RÉESSAYÉ', async () => {
    brevo = new FakeBrevoTransport((email) => ({
      email,
      ok: false,
      errorCode: 'unauthorized',
      kind: 'permanent',
    }));
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1', 'usr-2', 'usr-3'],
    });

    expect(created.counts.failed).toBe(3);
    expect(created.counts.pending).toBe(0);
    expect(db.deliveries.every((row) => row.error === 'unauthorized')).toBe(true);

    // ET SURTOUT : l'envoi est refermé. Il ne repartira pas au prochain tick.
    expect(created.status).toBe(NotificationStatus.SENT);
  });

  it('mais un refus PASSAGER de tout le public reste, lui, en file', async () => {
    // Contre-épreuve : la correction ci-dessus ne doit pas enterrer un 429.
    brevo = new FakeBrevoTransport((email) => ({
      email,
      ok: false,
      errorCode: 'HTTP_429',
      kind: 'transient',
    }));
    brevo.configured = true;
    service = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.status).toBe(NotificationStatus.SENDING);
    expect(created.counts.failed).toBe(0);
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);
  });

  it('un destinataire non servi par e-mail reste en file, pas en échec', async () => {
    db.addUser({ id: 'usr-banque', role: Role.BANQUE_FINANCE, email: 'banque@cpi.sn' });
    brevo.configured = true;

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-banque'],
    });

    // Rien n'a échoué : il n'y avait rien à envoyer au-dehors. La personne
    // verra le message en ouvrant l'application.
    expect(created.counts.pending).toBe(1);
    expect(created.counts.failed).toBe(0);
    const detail = await service.get(created.id);
    expect(detail.recipients[0]?.error).toBe(DELIVERY_INBOX_ONLY);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Durabilité de l'acceptation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CE QUE BREVO A ACCEPTÉ EST ACQUIS, MÊME SI LA SUITE MEURT.
 *
 * Confier un lot à Brevo est irréversible. Tant que la livraison n'est pas
 * écrite `SENT`, la base ignore cet envoi : la notification garde son bail,
 * expire, se fait reprendre, et le message repart vers des gens qui l'ont déjà
 * reçu. En n'écrivant qu'à la fin, la fenêtre couvrait TOUTE l'expédition.
 */
describe('écriture des acceptations au fil de l’eau', () => {
  /** Transport qui sert la première vague, puis meurt sur la seconde. */
  class DyingBrevoTransport implements BrevoTransport {
    readonly served: string[][] = [];
    calls = 0;

    isConfigured(): boolean {
      return true;
    }

    unavailableReason(): string | null {
      return null;
    }

    send(messages: readonly BrevoMessage[]): Promise<BrevoDispatchResult> {
      this.calls += 1;
      const recipients = messages.flatMap((message) =>
        message.recipients.map((recipient) => recipient.email),
      );
      this.served.push(recipients);
      // La seconde vague meurt APRÈS que la première a été acceptée : c'est
      // exactement le processus tué en cours d'expédition.
      if (this.calls === 2) return Promise.reject(new Error('processus interrompu'));
      return Promise.resolve({
        status: 'SENT',
        outcomes: recipients.map((email) => ({ email, ok: true })),
      });
    }
  }

  const TOTAL = EMAIL_PERSIST_GROUP_SIZE + 8;
  let dying: DyingBrevoTransport;

  beforeEach(() => {
    for (let index = 0; index < TOTAL; index += 1) {
      const suffix = String(index);
      db.addUser({ id: `usr-${suffix}`, role: Role.COMMERCIAL, email: `${suffix}@cpi.sn` });
    }
    dying = new DyingBrevoTransport();
    service = new NotificationsService(db.asService(), fakeDemoVisibility(), dying);
  });

  it('LA REPRISE NE RENVOIE QUE CE QUI N’A PAS ÉTÉ ACCEPTÉ', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.ROLE,
      audienceRole: Role.COMMERCIAL,
    });

    // Deux vagues : la première acceptée, la seconde interrompue.
    expect(dying.calls).toBe(2);
    expect(dying.served[0]).toHaveLength(EMAIL_PERSIST_GROUP_SIZE);

    // L'acceptation de la première vague est en base MALGRÉ l'interruption.
    const acquises = db.deliveries.filter(
      (row) => row.status === NotificationDeliveryStatus.SENT,
    ).length;
    expect(acquises).toBe(EMAIL_PERSIST_GROUP_SIZE);

    // Et l'envoi reste prenable, puisqu'il reste des livraisons à reprendre.
    expect(created.status).toBe(NotificationStatus.SENDING);

    // LA PROPRIÉTÉ QUI COMPTE : la reprise ne réexpédie que les 8 restantes.
    // Sans écriture au fil de l'eau, les 800 repartaient, et 792 personnes
    // recevaient le message une seconde fois.
    await service.dispatch(created.id, apresLeBail());
    expect(dying.served[2]).toHaveLength(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mode dégradé
// ─────────────────────────────────────────────────────────────────────────────

describe('absence de clé Brevo', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', role: Role.COMMERCIAL, email: 'un@cpi.sn' });
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * CE TEST AFFIRMAIT `SENT`, ET IL ENCODAIT UN DÉFAUT COMME UN CONTRAT
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Sans clé, la branche e-mail ne rendait aucun verdict, `retryable` restait à
   * zéro, et `settleNotification` écrivait SENT. La plateforme affirmait donc
   * avoir envoyé un e-mail qu'elle n'avait même pas tenté, sur une ligne restée
   * `PENDING` et sans marqueur. Et comme `dispatchDue` ne reprend JAMAIS une
   * notification SENT, brancher une clé le lendemain ne rattrapait rien : ces
   * e-mails-là n'existaient plus pour personne.
   *
   * LE CONTRAT VOULU : un téléconseiller joignable qu'on n'a pas pu servir
   * RETIENT la notification en SENDING. C'est le bail, mécanisme déjà en place,
   * qui la fera reprendre, et le jour où une clé est branchée l'e-mail part.
   */
  it('RETIENT l’envoi en SENDING : l’e-mail n’a pas été tenté, il est encore dû', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    expect(created.status).toBe(NotificationStatus.SENDING);
    expect(created.transportStatus).toBe('NOT_CONFIGURED');
    expect(created.counts.pending).toBe(1);
    expect(created.counts.sent).toBe(0);

    // Et la ligne ne porte AUCUN marqueur : elle n'est ni « boîte de réception
    // seule » (ce serait faux d'un téléconseiller joignable) ni en réessai
    // après échec (rien n'a été tenté).
    expect(db.deliveries[0]?.error).toBeNull();
  });

  /**
   * LA CONTRE-ÉPREUVE, et elle est indispensable : retenir TOUT en SENDING
   * ferait passer le test ci-dessus en cassant le cas le plus courant du
   * produit. Un destinataire qui n'est pas servi par e-mail n'attend rien, clé
   * ou pas : sa nature se lit en base, pas sur la présence d'une clé Brevo.
   */
  it('referme l’envoi sur SENT quand PERSONNE n’est servi par e-mail', async () => {
    db.addUser({ id: 'usr-banque', role: Role.BANQUE_FINANCE, email: 'banque@cpi.sn' });

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-banque'],
    });

    expect(created.status).toBe(NotificationStatus.SENT);
    expect(created.transportStatus).toBe('NOT_CONFIGURED');
    expect(db.deliveries[0]?.error).toBe(DELIVERY_INBOX_ONLY);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * LE RÉESSAI D'UN AUTRE PASSAGE NE DOIT PAS ÊTRE ENTERRÉ PAR CELUI-CI
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `settleNotification` recevait un `retryable` compté par l'expédition qui
   * l'appelle. Ce chiffre ne décrit QUE ce passage-là, et deux passages
   * peuvent se chevaucher : l'un persiste `EMAIL_RETRY`, l'autre, qui n'a rien
   * jugé, referme la notification sur SENT par-dessus. La livraison reste
   * `PENDING` avec son marqueur, et `dispatchDue` ne revient JAMAIS sur une
   * SENT : le réessai est perdu pour de bon.
   *
   * Ci-dessous, le premier passage laisse un vrai `EMAIL_RETRY` (transport en
   * panne), et le second ne juge personne. C'est l'état des LIVRAISONS, et non
   * le compteur du second passage, qui doit décider.
   */
  it('ne referme pas sur SENT tant qu’une livraison porte le marqueur de réessai', async () => {
    service = new NotificationsService(
      db.asService(),
      fakeDemoVisibility(),
      new BrokenBrevoTransport(),
    );

    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(db.deliveries[0]?.error).toBe(DELIVERY_RETRY_ERROR);
    expect(created.status).toBe(NotificationStatus.SENDING);

    // Second passage, qui ne juge personne : la clé a disparu entre-temps.
    service = new NotificationsService(db.asService(), fakeDemoVisibility(), brevo);
    await service.dispatch(created.id, apresLeBail());

    const detail = await service.get(created.id);
    expect(detail.notification.status).toBe(NotificationStatus.SENDING);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.PENDING);
  });

  /**
   * LA PROPRIÉTÉ QUI DONNE SON SENS À LA PRÉCÉDENTE : la clé branchée plus
   * tard, l'e-mail part. C'est exactement ce que l'ancien `SENT` rendait
   * impossible, et aucun test ne le disait.
   */
  it('l’e-mail part dès qu’une clé est branchée, sur la MÊME notification', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(brevo.sent).toHaveLength(0);

    brevo.configured = true;
    await service.dispatch(created.id, apresLeBail());

    expect(brevo.allAddresses).toEqual(['un@cpi.sn']);
    const detail = await service.get(created.id);
    expect(detail.notification.status).toBe(NotificationStatus.SENT);
    expect(detail.notification.counts.sent).toBe(1);
  });

  it('la boîte de réception fonctionne quand même, c’est le point du mode dégradé', async () => {
    await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    const inbox = await service.inbox(asUser('usr-1'), {});
    expect(inbox.items).toHaveLength(1);
    expect(inbox.unreadCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Boîte de réception
// ─────────────────────────────────────────────────────────────────────────────

describe('boîte de réception', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1' });
    db.addUser({ id: 'usr-2' });
  });

  it('ne montre que ses propres notifications', async () => {
    await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-2'],
    });

    expect((await service.inbox(asUser('usr-1'), {})).items).toHaveLength(0);
    expect((await service.inbox(asUser('usr-2'), {})).items).toHaveLength(1);
  });

  it('marque lue, et l’opération est idempotente', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });

    await service.markRead(asUser('usr-1'), created.id);
    const first = (await service.inbox(asUser('usr-1'), {})).items[0]?.readAt;

    await service.markRead(asUser('usr-1'), created.id);
    const second = (await service.inbox(asUser('usr-1'), {})).items[0]?.readAt;

    // La PREMIÈRE lecture est la seule intéressante : elle ne doit pas être
    // réécrite par un second appel.
    expect(second).toBe(first);
    expect((await service.inbox(asUser('usr-1'), {})).unreadCount).toBe(0);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * OUVRIR L'APPLICATION N'EFFACE PAS UN ÉCHEC D'ENVOI
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `markRead` écrivait `status: READ` sans prédicat de statut. Une livraison
   * FAILED devenait donc READ à la première ouverture, et l'échec disparaissait
   * des compteurs de l'écran d'administration : l'envoi s'affichait « lu » par
   * quelqu'un qui n'a jamais reçu l'e-mail. La date de lecture, elle, est
   * légitime : c'est le STATUT qui ne doit pas mentir.
   */
  it('LIRE UNE LIVRAISON EN ÉCHEC N’EFFACE PAS L’ÉCHEC', async () => {
    const failing = new FakeBrevoTransport((email) => ({
      email,
      ok: false,
      errorCode: 'invalid_parameter',
      kind: 'permanent',
    }));
    failing.configured = true;
    const isolated = new NotificationsService(db.asService(), fakeDemoVisibility(), failing);

    const created = await isolated.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.FAILED);

    await isolated.markRead(asUser('usr-1'), created.id);

    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.FAILED);
    expect(db.deliveries[0]?.error).toBe('invalid_parameter');
    // La lecture est tout de même horodatée : la pastille de non-lues se vide.
    expect(db.deliveries[0]?.readAt).not.toBeNull();
    expect((await isolated.inbox(asUser('usr-1'), {})).unreadCount).toBe(0);
    expect((await isolated.get(created.id)).notification.counts.failed).toBe(1);
  });

  /**
   * LE MÊME DÉFAUT, CÔTÉ RÉESSAI. Une livraison laissée en file attend le
   * passage suivant ; la faire passer READ la sort de la population `PENDING`
   * que la reprise interroge, et annule ce réessai sans que rien ne le dise.
   */
  it('LIRE UNE LIVRAISON EN ATTENTE DE RÉESSAI N’ANNULE PAS LE RÉESSAI', async () => {
    let refuse = true;
    const flaky = new FakeBrevoTransport((email) =>
      refuse ? { email, ok: false, errorCode: 'HTTP_503', kind: 'transient' } : { email, ok: true },
    );
    flaky.configured = true;
    const isolated = new NotificationsService(db.asService(), fakeDemoVisibility(), flaky);

    const created = await isolated.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.PENDING);

    // L'utilisateur ouvre l'application AVANT que la reprise n'ait lieu.
    await isolated.markRead(asUser('usr-1'), created.id);
    refuse = false;
    const retry = await isolated.dispatch(created.id, apresLeBail());

    // La reprise a bien retrouvé la ligne, et l'e-mail est parti.
    expect(retry.sent).toBe(1);
    expect(flaky.allAddresses).toHaveLength(2);
  });

  it('refuse de marquer lue la notification d’un autre', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-2'],
    });

    const error = await refusal(() => service.markRead(asUser('usr-1'), created.id));
    expect(codeOf(error)).toBe(NotificationError.NOT_FOUND);
  });

  it('n’expose pas une notification encore programmée', async () => {
    // Elle n'a pas encore eu lieu : la faire figurer dans la boîte de réception
    // révélerait le contenu avant l'heure choisie.
    await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });

    expect((await service.inbox(asUser('usr-1'), {})).items).toHaveLength(0);
  });

  it('filtre les non lues sur demande', async () => {
    const lu = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    await service.create(admin, {
      ...baseBody,
      title: 'Autre',
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-1'],
    });
    await service.markRead(asUser('usr-1'), lu.id);

    const unread = await service.inbox(asUser('usr-1'), { unreadOnly: true });
    expect(unread.items).toHaveLength(1);
    expect(unread.items[0]?.title).toBe('Autre');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Programmation et annulation
// ─────────────────────────────────────────────────────────────────────────────

describe('programmation', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-1', role: Role.COMMERCIAL, email: 'un@cpi.sn' });
    brevo.configured = true;
  });

  it('n’envoie rien tant que l’heure n’est pas venue', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });

    expect(created.status).toBe(NotificationStatus.SCHEDULED);
    expect(brevo.sent).toHaveLength(0);
  });

  it('annule un envoi programmé', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });

    const cancelled = await service.cancel(created.id);
    expect(cancelled.status).toBe(NotificationStatus.CANCELLED);
    expect(cancelled.cancelledAt).not.toBeNull();
  });

  it('REFUSE d’annuler un envoi déjà parti', async () => {
    // Un e-mail parti ne se rappelle pas. Marquer « annulée » une notification
    // déjà lue serait un mensonge dans l'historique.
    const created = await service.create(admin, baseBody);

    const error = await refusal(() => service.cancel(created.id));
    expect(codeOf(error)).toBe(NotificationError.NOT_SCHEDULED);
  });

  it('refuse d’annuler un identifiant inconnu', async () => {
    const error = await refusal(() => service.cancel('ntf-inexistante'));
    expect(codeOf(error)).toBe(NotificationError.NOT_FOUND);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Canal e-mail
// ─────────────────────────────────────────────────────────────────────────────

describe('canal e-mail', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-tc1', role: Role.COMMERCIAL, email: 'tc1@cpi.sn', fullName: 'Awa Diop' });
    // Un compte sans adresse : le schéma exige la colonne, l'usage réel la
    // laisse parfois vide sur les comptes de terrain.
    db.addUser({ id: 'usr-tc2', role: Role.COMMERCIAL, email: '' });
    db.addUser({ id: 'usr-banque', role: Role.BANQUE_FINANCE, email: 'banque@cpi.sn' });
  });

  /**
   * `status: SENDING` comme `create()` l'écrit, et ce n'est pas un détail de
   * doublure : `dispatch()` RÉCLAME l'envoi avant d'envoyer, et une
   * notification déjà `SENT` n'est pas à prendre. Le défaut de colonne du
   * schéma est justement `SENT` ; amorcer une expédition dessus décrirait un
   * état que le service ne produit jamais.
   */
  const dispatchTo = async (userIds: readonly string[]) => {
    const row = await db.notification.create({
      data: {
        title: 'Réunion demain',
        body: 'Point commercial à 9 h au siège.',
        status: NotificationStatus.SENDING,
        deliveries: { createMany: { data: userIds.map((userId) => ({ userId })) } },
      },
    });
    return service.dispatch(row.id);
  };

  it('SANS CLÉ, rien ne part et rien ne casse', async () => {
    // L'absence de clé est l'état nominal du dépôt : elle doit se voir dans le
    // résumé, et nulle part ailleurs.
    const summary = await dispatchTo(['usr-tc1']);

    expect(summary.emailStatus).toBe('NOT_CONFIGURED');
    expect(summary.emailed).toBe(0);
    expect(brevo.sent).toHaveLength(0);
    expect(summary.failed).toBe(0);
    expect(summary.pending).toBe(1);
  });

  it('ne sert QUE les commerciaux disposant d’une adresse', async () => {
    brevo.configured = true;

    const summary = await dispatchTo(['usr-tc1', 'usr-tc2', 'usr-banque', 'usr-admin']);

    // Le rôle banque et l'administrateur ont une adresse valide : ils sont
    // écartés par le RÔLE, pas par l'adresse. `usr-tc2` est commercial mais
    // sans adresse.
    expect(brevo.allAddresses).toEqual(['tc1@cpi.sn']);
    expect(summary.emailed).toBe(1);
    expect(summary.sent).toBe(1);
    expect(summary.pending).toBe(3);
    expect(summary.emailStatus).toBe('SENT');
  });

  it('adresse l’e-mail avec le titre et le corps de la notification', async () => {
    brevo.configured = true;

    await dispatchTo(['usr-tc1']);

    const message = brevo.sent[0];
    expect(message?.subject).toBe('Réunion demain');
    expect(message?.textContent).toContain('Point commercial à 9 h au siège.');
    expect(message?.htmlContent).toContain('Point commercial à 9 h au siège.');
    expect(message?.recipients[0]?.name).toBe('Awa Diop');
  });

  it('échappe le texte saisi avant de le poser dans le HTML', () => {
    // Titre et corps sont saisis par un administrateur. Une balise recopiée
    // telle quelle ferait de l'e-mail portant notre nom un support
    // d'hameçonnage que le lecteur ne peut pas inspecter.
    const content = buildEmailContent('<script>alert(1)</script>', 'a & b');
    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;');
    expect(content.html).toContain('a &amp; b');
    // Le texte brut, lui, n'est pas du balisage : il reste tel quel.
    expect(content.text).toContain('a & b');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Détails du transport e-mail
// ─────────────────────────────────────────────────────────────────────────────

describe('découpage et classement Brevo', () => {
  it('respecte le plafond de 99 destinataires par appel', () => {
    // Une adresse de trop et Brevo refuse l'appel EN BLOC : les 99 autres ne
    // partent pas non plus.
    const chunks = chunkRecipients(Array.from({ length: 200 }, (_, index) => index));
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(99);
    expect(chunks[2]).toHaveLength(2);
  });

  it('lit le code d’erreur Brevo quand il y en a un', () => {
    expect(readBrevoErrorCode({ code: 'invalid_parameter' })).toBe('invalid_parameter');
    expect(readBrevoErrorCode({})).toBeUndefined();
    expect(readBrevoErrorCode(null)).toBeUndefined();
  });

  it('classe 429 et 5xx comme passagers, le reste comme définitif', () => {
    expect(classifyBrevoFailure(429)).toBe('transient');
    expect(classifyBrevoFailure(503)).toBe('transient');
    expect(classifyBrevoFailure(400)).toBe('permanent');
    expect(classifyBrevoFailure(401)).toBe('permanent');
  });

  it('le pool de travail respecte l’ordre d’entrée et n’avale pas les rejets', async () => {
    const settled = await mapWithConcurrency([1, 2, 3, 4], 2, (value) =>
      value === 3 ? Promise.reject(new Error('trois')) : Promise.resolve(value * 10),
    );

    expect(settled.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
    expect(settled[3]).toEqual({ status: 'fulfilled', value: 40 });
  });
});

describe('appels HTTP Brevo', () => {
  const configured = { BREVO_API_KEY: 'cle', BREVO_SENDER_EMAIL: 'no-reply@cpi.sn' };

  const message = (count: number) => ({
    recipients: Array.from({ length: count }, (_, index) => ({
      email: `u${String(index)}@cpi.sn`,
    })),
    subject: 'Sujet',
    htmlContent: '<p>x</p>',
    textContent: 'x',
  });

  it('PLAFONNE LES APPELS SIMULTANÉS', async () => {
    // Sans plafond, une campagne générale ouvre autant de requêtes que de lots
    // d'un coup, et Brevo écrête la queue de la vague en 429 : ce sont les
    // derniers destinataires qui disparaissent, ceux dont personne ne remarque
    // l'absence.
    let inFlight = 0;
    let peak = 0;
    let calls = 0;

    vi.stubGlobal('fetch', async () => {
      calls += 1;
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return new Response('{}', { status: 201 });
    });

    try {
      const transport = new BrevoHttpTransport(configured);
      // 2 000 adresses : 21 lots de 99, donc 21 appels si rien ne bride.
      await transport.send([message(2000)]);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(calls).toBe(21);
    expect(peak).toBeLessThanOrEqual(BREVO_MAX_CONCURRENT_CALLS);
  });

  it('POSE UN DÉLAI D’ABANDON SUR CHAQUE APPEL', async () => {
    // Sans signal explicite, `fetch` hérite du défaut d'undici, cinq minutes,
    // pendant lesquelles le tick de rappels reste bloqué sur une socket muette.
    const seen: (AbortSignal | null | undefined)[] = [];

    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      seen.push(init?.signal);
      return Promise.resolve(new Response('{}', { status: 201 }));
    });

    try {
      const transport = new BrevoHttpTransport(configured);
      await transport.send([message(1)]);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
  });

  it('classe un 429 en passager jusque dans l’issue rendue', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('{"code":"too_many_requests"}', { status: 429 })),
    );

    let result;
    try {
      const transport = new BrevoHttpTransport(configured);
      result = await transport.send([message(1)]);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(result.outcomes[0]?.ok).toBe(false);
    expect(result.outcomes[0]?.kind).toBe('transient');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Ce que `dispatch` fait de chaque réponse possible
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Envoie `count` adresses à travers une doublure de `fetch`, et rend à la
   * fois l'issue et les corps postés. Les corps comptent : c'est le seul moyen
   * de prouver que le découpage en lots de 99 se retrouve VRAIMENT dans les
   * requêtes, et pas seulement dans la fonction `chunkRecipients` prise à part.
   */
  const withFetch = async (
    count: number,
    handler: (call: number) => Promise<Response>,
  ): Promise<{
    result: Awaited<ReturnType<BrevoHttpTransport['send']>>;
    bodies: Record<string, unknown>[];
  }> => {
    const bodies: Record<string, unknown>[] = [];
    let call = 0;

    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      const brut = typeof init?.body === 'string' ? init.body : '{}';
      bodies.push(JSON.parse(brut) as Record<string, unknown>);
      call += 1;
      return handler(call);
    });

    try {
      return { result: await new BrevoHttpTransport(configured).send([message(count)]), bodies };
    } finally {
      vi.unstubAllGlobals();
    }
  };

  it('un 201 rend SENT, chaque destinataire du lot marqué passé', async () => {
    const { result, bodies } = await withFetch(3, () =>
      Promise.resolve(new Response('{"messageId":"<x>"}', { status: 201 })),
    );

    expect(result.status).toBe('SENT');
    expect(result.outcomes).toHaveLength(3);
    expect(result.outcomes.every((outcome) => outcome.ok)).toBe(true);
    // Un succès ne porte NI code d'erreur NI nature d'échec : ces deux champs
    // pilotent le sort de la ligne de livraison chez l'appelant.
    expect(result.outcomes[0]?.errorCode).toBeUndefined();
    expect(result.outcomes[0]?.kind).toBeUndefined();

    // L'appel est bien UN message pour N destinataires, et non N appels.
    expect(bodies).toHaveLength(1);
    expect((bodies[0]?.to as unknown[]).length).toBe(3);
    expect(bodies[0]?.sender).toEqual({ email: 'no-reply@cpi.sn', name: 'CPI GO' });
  });

  /**
   * Un 400 décrit un état qui ne bougera pas tout seul : adresse refusée, corps
   * invalide. Le classer en `transient` ferait réessayer indéfiniment à chaque
   * passage du tick, sur une ligne qui ne passera jamais.
   */
  it('un 400 est DÉFINITIF et remonte le code de Brevo, pas le statut HTTP', async () => {
    const { result } = await withFetch(2, () =>
      Promise.resolve(new Response('{"code":"invalid_parameter"}', { status: 400 })),
    );

    // Un seul lot, entièrement en échec : le service n'a rien délivré.
    expect(result.status).toBe('TRANSPORT_ERROR');
    expect(result.outcomes).toHaveLength(2);
    for (const outcome of result.outcomes) {
      expect(outcome.ok).toBe(false);
      expect(outcome.kind).toBe('permanent');
      // `invalid_parameter` et non `HTTP_400` : c'est ce que l'exploitant lit
      // dans le journal, et les deux ne s'y valent pas.
      expect(outcome.errorCode).toBe('invalid_parameter');
    }
  });

  it('sans code dans le corps, l’issue retombe sur le statut HTTP', async () => {
    const { result } = await withFetch(1, () => Promise.resolve(new Response('', { status: 403 })));

    expect(result.outcomes[0]?.errorCode).toBe('HTTP_403');
    expect(result.outcomes[0]?.kind).toBe('permanent');
  });

  /**
   * Une socket coupée ne dit RIEN de l'adresse visée. L'enterrer en `permanent`
   * est la faute coûteuse : elle condamne un envoi que la simple attente aurait
   * fait passer.
   */
  it('une coupure réseau est PASSAGÈRE et ne fait pas lever `send`', async () => {
    const { result } = await withFetch(2, () => Promise.reject(new Error('ECONNRESET')));

    expect(result.status).toBe('TRANSPORT_ERROR');
    expect(result.detail).toContain('ECONNRESET');
    for (const outcome of result.outcomes) {
      expect(outcome.ok).toBe(false);
      expect(outcome.errorCode).toBe('NETWORK_ERROR');
      expect(outcome.kind).toBe('transient');
    }
  });

  /** Le délai dépassé emprunte le même chemin que la coupure : il repassera. */
  it('un abandon sur délai est traité comme une coupure, donc PASSAGER', async () => {
    const { result } = await withFetch(1, () =>
      Promise.reject(new DOMException('The operation was aborted.', 'TimeoutError')),
    );

    expect(result.outcomes[0]?.kind).toBe('transient');
    expect(result.outcomes[0]?.errorCode).toBe('NETWORK_ERROR');
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * LE CAS QUI DÉCIDE DU RESTE : DES LOTS QUI NE FINISSENT PAS PAREIL
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Le grain de l'échec est le LOT de 99, pas l'adresse. Quand un lot sur trois
   * est refusé, deux propriétés doivent tenir ensemble :
   *
   *  - les 198 adresses des lots passés sont marquées passées, sans quoi elles
   *    repartiraient au passage suivant et les gens recevraient deux fois le
   *    même rappel ;
   *  - le statut d'ensemble reste `SENT`, parce que quelque chose EST parti :
   *    `TRANSPORT_ERROR` est réservé au cas où RIEN ne passe, et il fait
   *    conclure à l'appelant que la clé ou le service est en cause.
   */
  it('des lots aux issues DIFFÉRENTES : chacun garde la sienne, l’envoi reste SENT', async () => {
    const { result, bodies } = await withFetch(250, (call) =>
      Promise.resolve(
        call === 2
          ? new Response('{"code":"invalid_parameter"}', { status: 400 })
          : new Response('{}', { status: 201 }),
      ),
    );

    // 250 adresses : 99 + 99 + 52.
    expect(bodies.map((body) => (body.to as unknown[]).length)).toEqual([99, 99, 52]);

    expect(result.status).toBe('SENT');
    expect(result.outcomes).toHaveLength(250);
    expect(result.outcomes.filter((outcome) => outcome.ok)).toHaveLength(151);

    const refusees = result.outcomes.filter((outcome) => !outcome.ok);
    expect(refusees).toHaveLength(99);
    expect(refusees.every((outcome) => outcome.kind === 'permanent')).toBe(true);
    // Ce sont bien les adresses du DEUXIÈME lot, pas d'autres : l'appariement
    // entre lots et issues suit l'ordre d'entrée.
    expect(refusees[0]?.email).toBe('u99@cpi.sn');
    expect(refusees.at(-1)?.email).toBe('u197@cpi.sn');
  });

  it('sans clé, aucun appel réseau et un état NOT_CONFIGURED', async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);

    let result;
    try {
      result = await new BrevoHttpTransport({ BREVO_SENDER_EMAIL: 'no-reply@cpi.sn' }).send([
        message(5),
      ]);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.outcomes).toEqual([]);
    expect(result.detail).toContain('BREVO_API_KEY');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('une liste vide ne touche pas au réseau', async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);

    let result;
    try {
      result = await new BrevoHttpTransport(configured).send([]);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(result).toEqual({ status: 'SENT', outcomes: [] });
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Visibilité de démonstration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT CORRIGÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le schéma porte `isDemo` sur `Notification` et sur `NotificationDelivery`
 * depuis toujours ; le service l'ignorait dans les deux sens.
 *
 * En ÉCRITURE, la colonne prenait son défaut, FALSE : une annonce composée
 * pendant une démonstration devenait une VRAIE annonce, arrivait dans la boîte
 * de réception de vrais commerciaux avec un texte d'exemple, survivait à
 * l'extinction du mode.
 *
 * En LECTURE, ni la liste d'administration ni la boîte de réception ne
 * cloisonnaient : le mode éteint ne cachait rien de ce que le mode allumé avait
 * produit.
 *
 * Le balayage `demo-visibility.sweep.test.ts` ne voyait rien de tout cela : sa
 * liste de modèles s'était arrêtée à douze entrées quand le schéma en portait
 * quinze. C'est ce trou-là qu'un test de dérive contre `schema.prisma` ferme
 * désormais.
 */
describe('visibilité de démonstration', () => {
  const enDemonstration = (): NotificationsService =>
    new NotificationsService(db.asService(), fakeDemoVisibility(true), brevo);

  beforeEach(() => {
    db.addUser({ id: 'usr-1' });
  });

  const ciblee = {
    ...baseBody,
    audience: NotificationAudience.USERS,
    audienceUserIds: ['usr-1'],
  };

  it('mode ÉTEINT : l’envoi et ses livraisons sont réels', async () => {
    await service.create(admin, ciblee);

    expect(db.notifications.map((row) => row.isDemo)).toEqual([false]);
    expect(db.deliveries.map((row) => row.isDemo)).toEqual([false]);
  });

  it('mode ALLUMÉ : l’envoi ET ses livraisons sont de démonstration', async () => {
    await enDemonstration().create(admin, ciblee);

    expect(db.notifications.map((row) => row.isDemo)).toEqual([true]);
    // Les livraisons portent la MÊME valeur : une livraison visible accrochée
    // à une notification masquée afficherait une ligne vide dans la boîte.
    expect(db.deliveries.map((row) => row.isDemo)).toEqual([true]);
  });

  it('la liste d’administration cache les envois de démonstration', async () => {
    await enDemonstration().create(admin, ciblee);
    await service.create(admin, { ...ciblee, title: 'Vraie annonce' });

    const page = await service.list({});

    expect(page.items.map((item) => item.title)).toEqual(['Vraie annonce']);
    // Le TOTAL doit suivre la liste : sinon la pagination annonce deux envois
    // et n'en montre qu'un.
    expect(page.meta.total).toBe(1);
  });

  it('l’écran de détail refuse un envoi masqué, il ne l’ouvre pas par son identifiant', async () => {
    const cachee = await enDemonstration().create(admin, ciblee);

    const error = await refusal(() => service.get(cachee.id));
    expect(codeOf(error)).toBe('NOTIFICATION_NOT_FOUND');

    // Mode allumé, le même identifiant s'ouvre : la ligne est masquée, pas
    // supprimée.
    await expect(enDemonstration().get(cachee.id)).resolves.toBeDefined();
  });

  it('la boîte de réception et sa pastille cachent l’un et l’autre', async () => {
    await enDemonstration().create(admin, ciblee);

    const boite = await service.inbox(asUser('usr-1'), {});
    expect(boite.items).toHaveLength(0);
    expect(boite.unreadCount).toBe(0);
    expect(boite.meta.total).toBe(0);

    // Mode allumé, la même boîte montre le message.
    const visible = await enDemonstration().inbox(asUser('usr-1'), {});
    expect(visible.items).toHaveLength(1);
    expect(visible.unreadCount).toBe(1);
  });

  it('refuse de marquer lue une notification masquée', async () => {
    const cachee = await enDemonstration().create(admin, ciblee);

    const error = await refusal(() => service.markRead(asUser('usr-1'), cachee.id));
    expect(codeOf(error)).toBe('NOTIFICATION_NOT_FOUND');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Le bail a un PROPRIÉTAIRE, et celui qui l'a perdu se tait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UN BAIL SANS IDENTITÉ DE PROPRIÉTAIRE N'EST PAS UN BAIL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le renouvellement s'écrivait « poser SENDING sur une ligne SENDING ». Cela
 * prouve QU'UN processus est vivant, jamais que c'est LE BON. L'enchaînement,
 * qui n'a rien d'exotique :
 *
 *   1. un expéditeur se fige plus longtemps que le bail (base lente, transport
 *      en 429 sur chaque vague) ;
 *   2. un second le reprend LÉGITIMEMENT, puisque le bail a expiré ;
 *   3. le premier se réveille, renouvelle le bail DU SECOND, et poursuit ses
 *      vagues sur les mêmes livraisons.
 *
 * Le renouvellement lui-même devenait l'arme du crime : il empêchait toute
 * autre reprise pendant que le mort continuait d'envoyer.
 *
 * Chaque prise écrit désormais un JETON, et toute écriture d'expédition le
 * porte. Ces tests-ci exercent le croisement RÉEL : le second passage tourne
 * entièrement à l'intérieur du point d'attente du premier, comme deux instances
 * derrière un répartiteur de charge.
 */
describe('bail perdu en cours d’expédition', () => {
  /** Trois vagues : la reprise a lieu pendant la deuxième. */
  const TOTAL = 2 * EMAIL_PERSIST_GROUP_SIZE + 8;

  beforeEach(() => {
    for (let index = 0; index < TOTAL; index += 1) {
      const suffix = String(index);
      db.addUser({ id: `usr-${suffix}`, role: Role.COMMERCIAL, email: `${suffix}@cpi.sn` });
    }
  });

  it('LE DÉTENTEUR ÉVINCÉ N’EXPOSE PAS LA VAGUE SUIVANTE', async () => {
    const created = await db.notification.create({
      data: {
        title: 'Annonce générale',
        body: 'Corps',
        status: NotificationStatus.SENDING,
        deliveries: {
          createMany: {
            data: Array.from({ length: TOTAL }, (_unused, index) => ({
              userId: `usr-${String(index)}`,
            })),
          },
        },
      },
    });

    /** Vagues confiées au transport par le PREMIER expéditeur. */
    let vaguesDuPremier = 0;
    /** Vrai pendant que le repreneur travaille : ses vagues ne sont pas au premier. */
    let dansLaReprise = false;

    const lent = new (class implements BrevoTransport {
      calls = 0;
      readonly servies: string[] = [];

      isConfigured(): boolean {
        return true;
      }

      unavailableReason(): string | null {
        return null;
      }

      async send(messages: readonly BrevoMessage[]): Promise<BrevoDispatchResult> {
        this.calls += 1;
        if (!dansLaReprise) vaguesDuPremier += 1;
        const adresses = messages.flatMap((message) =>
          message.recipients.map((recipient) => recipient.email),
        );

        // La DEUXIÈME vague du premier expéditeur s'éternise : le bail expire
        // pendant qu'elle est en vol, et un autre passage reprend la
        // notification pour de bon. Le premier n'en sait encore rien.
        //
        // LE REPRENEUR ÉCHOUE PASSAGÈREMENT, ET C'EST ESSENTIEL : la
        // notification reste `SENDING`, donc un renouvellement qui ne
        // regarderait que le STATUT passerait encore. Seule l'identité du
        // propriétaire distingue ici le vivant du mort, et c'est exactement la
        // propriété qu'on veut exercer. Un repreneur qui refermerait l'envoi
        // ferait passer ce test pour la mauvaise raison.
        if (this.calls === 2 && !dansLaReprise) {
          const apres = new Date(Date.now() + 10 * SENDING_LEASE_MS);
          db.clock = () => apres;
          dansLaReprise = true;
          await new NotificationsService(
            db.asService(),
            fakeDemoVisibility(),
            new BrokenBrevoTransport(),
          ).dispatch(created.id, apres);
          dansLaReprise = false;
        }

        this.servies.push(...adresses);
        return { status: 'SENT', outcomes: adresses.map((email) => ({ email, ok: true })) };
      }
    })();

    const premier = new NotificationsService(db.asService(), fakeDemoVisibility(), lent);
    await premier.dispatch(created.id);

    // LE POINT DU TEST : le premier s'arrête à sa deuxième vague. Sans jeton,
    // son renouvellement passait (la notification est toujours `SENDING`), et
    // il exposait la troisième vague à des destinataires dont il n'a plus la
    // charge, pendant que le repreneur les servait de son côté.
    expect(vaguesDuPremier).toBe(2);

    // Les huit derniers n'ont donc PAS été confiés au transport par l'évincé.
    expect(lent.servies).toHaveLength(2 * EMAIL_PERSIST_GROUP_SIZE);
    expect(lent.servies).not.toContain(`${String(TOTAL - 1)}@cpi.sn`);

    // Et la notification appartient toujours au repreneur : elle reste
    // `SENDING`, avec SON jeton, prête à être reprise au prochain bail.
    const row = db.notifications.find((candidate) => candidate.id === created.id);
    expect(row?.status).toBe(NotificationStatus.SENDING);
    expect(row?.dispatchClaim).not.toBeNull();
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * LA CONCLUSION D'UN MORT NE DOIT PAS ÉCRASER CELLE D'UN VIVANT
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * La clôture comptait les livraisons en attente dans une requête, puis
   * écrivait sa conclusion dans une autre. Entre les deux, un autre passage
   * pouvait tout terminer : celui qui avait compté des lignes en attente
   * écrivait alors son propre verdict PAR-DESSUS. Le décompte est passé DANS
   * l'écriture, et l'écriture porte le jeton : un expéditeur évincé n'écrit
   * plus rien du tout.
   *
   * L'état du TRANSPORT rend la substitution visible : le repreneur a réussi,
   * l'évincé a échoué. Si l'évincé pouvait encore conclure, l'écran
   * d'administration afficherait « panne de transport » sur un envoi
   * intégralement remis.
   */
  it('L’ÉVINCÉ NE RÉÉCRIT PAS LA CONCLUSION DU REPRENEUR', async () => {
    const tardif = new FakePrisma();
    tardif.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn' });
    const created = await tardif.notification.create({
      data: {
        title: 'Annonce',
        body: 'Corps',
        status: NotificationStatus.SENDING,
        deliveries: { createMany: { data: [{ userId: 'usr-tc' }] } },
      },
    });

    const bon = new FakeBrevoTransport();
    bon.configured = true;

    /** Transport de l'évincé : il échoue, et il échoue APRÈS la reprise. */
    const casse = new (class implements BrevoTransport {
      isConfigured(): boolean {
        return true;
      }

      unavailableReason(): string | null {
        return null;
      }

      async send(): Promise<BrevoDispatchResult> {
        // Le bail expire pendant l'appel, et un repreneur sert la notification
        // en entier avant que celui-ci ne rende la main.
        const apres = new Date(Date.now() + 10 * SENDING_LEASE_MS);
        tardif.clock = () => apres;
        await new NotificationsService(tardif.asService(), fakeDemoVisibility(), bon).dispatch(
          created.id,
          apres,
        );
        return { status: 'TRANSPORT_ERROR', outcomes: [], detail: 'HTTP_503' };
      }
    })();

    await new NotificationsService(tardif.asService(), fakeDemoVisibility(), casse).dispatch(
      created.id,
    );

    const row = tardif.notifications.find((candidate) => candidate.id === created.id);
    expect(row?.status).toBe(NotificationStatus.SENT);
    // La conclusion du REPRENEUR, pas celle de l'évincé.
    expect(row?.transportStatus).toBe('SENT');
    expect(row?.dispatchClaim).toBeNull();
    expect(tardif.deliveries[0]?.status).toBe(NotificationDeliveryStatus.SENT);
    expect(bon.allAddresses).toEqual(['tc@cpi.sn']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La reprise est BORNÉE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * « MIEUX QUE LE DÉFAUT PRÉCÉDENT » N'EST PAS UNE SPÉCIFICATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Refermer un envoi sur SENT alors qu'aucun e-mail n'est parti était le pire
 * défaut de ce module, et il est réparé : la notification RESTE `SENDING` tant
 * qu'une livraison attend. Mais l'état le plus banal du dépôt, l'absence de clé
 * Brevo, produit exactement cette attente : la notification repartait donc
 * toutes les quinze minutes, POUR TOUJOURS, quatre-vingt-seize fois par jour et
 * par envoi. Une panne de vivacité non bornée reste une panne.
 *
 * La borne est le TEMPS, pas un compteur de tentatives : voir
 * `DISPATCH_DEADLINE_MS`. Ces deux tests-ci l'épinglent des deux côtés, parce
 * qu'une borne dont on ne teste qu'un côté est une borne qu'on peut mettre à
 * zéro sans que rien ne rougisse.
 */
describe('borne de reprise', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn' });
  });

  /** L'envoi composé, jamais servi faute de clé, tel que le dépôt le produit. */
  const jamaisServi = async (): Promise<string> => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-tc'],
    });
    // L'état de départ : rien n'est parti, rien n'est enterré, l'envoi est dû.
    expect(created.status).toBe(NotificationStatus.SENDING);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(db.deliveries[0]?.error).toBeNull();
    return created.id;
  };

  it('AVANT L’ÉCHÉANCE, l’envoi reste dû et rien n’est enterré', async () => {
    const id = await jamaisServi();

    const veille = await service.dispatch(id, new Date(Date.now() + DISPATCH_DEADLINE_MS - 60_000));

    expect(veille.claimed).toBe(true);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.PENDING);
    expect((await service.get(id)).notification.status).toBe(NotificationStatus.SENDING);
  });

  it('PASSÉE L’ÉCHÉANCE, l’envoi est abandonné, et l’échec est ÉCRIT', async () => {
    const id = await jamaisServi();

    const tardif = await service.dispatch(id, new Date(Date.now() + DISPATCH_DEADLINE_MS + 60_000));

    // L'échec est celui de la LIVRAISON, la seule qui puisse le porter sans
    // mentir : la personne n'a pas reçu son e-mail, et personne ne réessaiera.
    expect(tardif.failed).toBe(1);
    expect(db.deliveries[0]?.status).toBe(NotificationDeliveryStatus.FAILED);
    expect(db.deliveries[0]?.error).toBe(DELIVERY_ABANDONED);

    // L'envoi se referme : plus rien ne l'attend, donc plus rien ne le reprend.
    const detail = await service.get(id);
    expect(detail.notification.status).toBe(NotificationStatus.SENT);
    expect(detail.notification.counts.failed).toBe(1);

    // Et la reprise s'arrête pour de bon : le passage suivant ne réclame plus.
    const encore = await service.dispatch(id, new Date(Date.now() + 3 * DISPATCH_DEADLINE_MS));
    expect(encore.claimed).toBe(false);
  });

  /**
   * La boîte de réception, elle, n'est PAS abandonnée. C'est tout l'intérêt de
   * ne pas avoir enterré la notification elle-même : le destinataire lit son
   * message dans l'application, et seul l'e-mail est perdu.
   */
  it('l’abandon ne retire rien à la boîte de réception', async () => {
    const id = await jamaisServi();
    await service.dispatch(id, new Date(Date.now() + DISPATCH_DEADLINE_MS + 60_000));

    const inbox = await service.inbox(asUser('usr-tc'), {});
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]?.notificationId).toBe(id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// On n'envoie pas sans détenir l'envoi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA PORTE EST UNE SEULE, ET ELLE EST GARDÉE POUR TOUT LE MONDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La prise en charge vivait chez `dispatchDue` : les trois autres appelants de
 * `dispatch()` envoyaient sans rien réclamer, et le prochain appelant écrit
 * aurait fait de même, puisque rien ne l'y obligeait. Ces tests-ci épinglent la
 * propriété au niveau où elle vaut désormais pour TOUS les appelants, présents
 * et à venir : `dispatch()` ne sert que ce qu'il a pu RÉCLAMER.
 */
describe('prise en charge de l’envoi', () => {
  beforeEach(() => {
    db.addUser({ id: 'usr-tc', role: Role.COMMERCIAL, email: 'tc@cpi.sn' });
    brevo.configured = true;
  });

  it('N’ENVOIE PAS un envoi programmé dont l’heure n’est pas venue', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-tc'],
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });

    // L'échéance est jugée par la PRISE, et non par l'appelant : sans cela, un
    // appel direct expédierait une annonce programmée pour la semaine
    // prochaine, avec son texte au futur.
    const tropTot = await service.dispatch(created.id);

    expect(tropTot.claimed).toBe(false);
    expect(brevo.sent).toHaveLength(0);
    expect((await service.get(created.id)).notification.status).toBe(NotificationStatus.SCHEDULED);
  });

  it('N’ENVOIE PAS une seconde fois un envoi déjà refermé', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-tc'],
    });
    expect(created.status).toBe(NotificationStatus.SENT);
    expect(brevo.allAddresses).toEqual(['tc@cpi.sn']);

    const encore = await service.dispatch(created.id, apresLeBail());

    expect(encore.claimed).toBe(false);
    expect(brevo.allAddresses).toEqual(['tc@cpi.sn']);
  });

  it('N’ENVOIE PAS un envoi annulé', async () => {
    const created = await service.create(admin, {
      ...baseBody,
      audience: NotificationAudience.USERS,
      audienceUserIds: ['usr-tc'],
      scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await service.cancel(created.id);

    const apres = await service.dispatch(created.id, new Date(Date.now() + 7_200_000));

    expect(apres.claimed).toBe(false);
    expect(brevo.sent).toHaveLength(0);
  });
});
