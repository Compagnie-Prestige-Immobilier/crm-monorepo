import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Role } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Phase2SyncService } from '../phase2/phase2-sync.service.js';
import { SyncBatchStore } from './batch-store.js';
import { SyncService } from './sync.service.js';
import { FakePrisma } from './fake-prisma.js';
import { SyncEntity, SyncOp, SyncOpStatus, dependencyKeyOf } from './dto.js';
import type { SyncOperationDto, SyncPushDto } from './dto.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

const alice: AuthenticatedUser = {
  id: 'com-alice',
  email: 'alice@cpi.sn',
  username: 'alice',
  fullName: 'Alice Diop',
  role: Role.COMMERCIAL,
};
const bob: AuthenticatedUser = { ...alice, id: 'com-bob', username: 'bob', fullName: 'Bob Sarr' };

const REP_A = '0198a000-0000-7000-8000-000000000001';
const REP_B = '0198a000-0000-7000-8000-000000000002';

let db: FakePrisma;
let sync: SyncService;

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm';
  process.env.NODE_ENV ??= 'test';

  db = new FakePrisma();
  const prisma = db as unknown as PrismaService;
  sync = new SyncService(
    prisma,
    new SyncBatchStore(prisma),
    new Phase2SyncService(),
    fakeDemoVisibility(),
  );
});

let counter = 0;
const opId = (): string => `0198b000-0000-7000-8000-${String(++counter).padStart(12, '0')}`;

function createRep(entityId: string, phone: string, seq = 0): SyncOperationDto {
  return {
    opId: opId(),
    seq,
    entity: SyncEntity.REPRESENTANT,
    op: SyncOp.CREATE,
    entityId,
    clientUpdatedAt: '2026-08-10T10:00:00.000Z',
    data: {
      fullName: `Rep ${entityId.slice(-1)}`,
      phone,
      departementId: '0198c000-0000-7000-8000-000000000001',
    },
  };
}

function createProspect(
  entityId: string,
  representantId: string,
  phone: string,
  seq: number,
): SyncOperationDto {
  return {
    opId: opId(),
    seq,
    entity: SyncEntity.PROSPECT,
    op: SyncOp.CREATE,
    entityId,
    clientUpdatedAt: '2026-08-10T10:00:00.000Z',
    data: {
      nom: 'Fall',
      prenom: 'Moussa',
      phone,
      banqueId: '0198d000-0000-7000-8000-000000000001',
      syndicatId: '0198e000-0000-7000-8000-000000000001',
      representantId,
    },
  };
}

const batch = (operations: SyncOperationDto[], id = 'batch-1'): SyncPushDto => ({
  clientBatchId: id,
  payloadVersion: 1,
  operations,
});

const statuses = (results: { status: SyncOpStatus }[]): SyncOpStatus[] =>
  results.map((result) => result.status);

// ─────────────────────────────────────────────────────────────────────────────

describe('idempotence, niveau 1 (le lot)', () => {
  it('rejouer le MÊME lot n’écrit qu’une fois et rejoue la réponse mémorisée', async () => {
    const body = batch([createRep(REP_A, '77 123 45 67')]);

    const first = await sync.push(alice, body);
    expect(first.replayed).toBe(false);
    expect(statuses(first.body.results)).toEqual([SyncOpStatus.APPLIED]);
    expect(db.representants.size).toBe(1);

    const second = await sync.push(alice, body);
    expect(second.replayed).toBe(true);
    // UNE seule ligne : c'est l'invariant que tout le mécanisme protège.
    expect(db.representants.size).toBe(1);
    expect(second.body).toEqual(first.body);
  });

  it('le marqueur du lot est posé HORS de la transaction de travail', async () => {
    // Si le marqueur vivait dans la transaction de travail, un rollback
    // l'effacerait et le rejeu réappliquerait tout le lot. On le vérifie en
    // faisant échouer le travail : le marqueur doit tout de même exister
    // pendant le traitement.
    const body = batch([createRep(REP_A, '77 123 45 67')]);
    await sync.push(alice, body);
    expect(db.batches.size).toBe(1);
    expect([...db.batches.values()][0]?.status).toBe('COMPLETED');
  });

  it('même clé, contenu différent → 422 explicite plutôt qu’une réponse sans rapport', async () => {
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')]));

    await expect(sync.push(alice, batch([createRep(REP_B, '77 000 00 00')]))).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('un traitement déjà en cours répond 409 IDEMPOTENCY_IN_PROGRESS', async () => {
    db.batches.set('com-alice|batch-1', {
      key: 'batch-1',
      userId: 'com-alice',
      requestHash: 'peu-importe',
      status: 'IN_PROGRESS',
      httpStatus: null,
      responseJson: null,
      createdAt: new Date(),
      completedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await expect(sync.push(alice, batch([createRep(REP_A, '77 123 45 67')]))).rejects.toThrow(
      ConflictException,
    );
  });

  it('un marqueur IN_PROGRESS abandonné depuis plus de 60 s est repris', async () => {
    db.batches.set('com-alice|batch-1', {
      key: 'batch-1',
      userId: 'com-alice',
      requestHash: 'abandonne',
      status: 'IN_PROGRESS',
      httpStatus: null,
      responseJson: null,
      createdAt: new Date(Date.now() - 120_000),
      completedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const result = await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')]));
    expect(statuses(result.body.results)).toEqual([SyncOpStatus.APPLIED]);
  });

  it('la clé d’un utilisateur n’est pas celle d’un autre', async () => {
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')]));
    // Même clé de lot, autre compte : le lot doit être traité, pas rejoué.
    const other = await sync.push(bob, batch([createRep(REP_B, '77 000 00 00')]));
    expect(other.replayed).toBe(false);
    expect(db.batches.size).toBe(2);
  });
});

describe('idempotence, niveau 2 (l’opération)', () => {
  it('une opération déjà appliquée dans un AUTRE lot ressort en duplicate, sans réécriture', async () => {
    const operation = createRep(REP_A, '77 123 45 67');
    await sync.push(alice, batch([operation], 'batch-1'));
    expect(db.representants.get(REP_A)?.rev).toBe(1);

    // Cas réel que le niveau 1 ne couvre pas : le client reconstitue un lot
    // DIFFÉRENT, sous un NOUVEAU batchId, contenant la même opération.
    const second = await sync.push(
      alice,
      batch([operation, createRep(REP_B, '76 555 44 33', 1)], 'batch-2'),
    );

    expect(statuses(second.body.results)).toEqual([SyncOpStatus.DUPLICATE, SyncOpStatus.APPLIED]);
    expect(db.representants.get(REP_A)?.rev).toBe(1);
    expect(db.representants.size).toBe(2);
  });

  it('une opération REFUSÉE rejouée réémet son refus, pas un duplicate', async () => {
    // Le scénario de perte de données. Le serveur mémorisait le verdict mais
    // réémettait un `DUPLICATE` constant : le téléphone lisait « déjà fait »,
    // classait la ligne close, et la saisie du commercial disparaissait sans
    // trace. Il faut que le refus survive au rejeu, sinon le client ne peut
    // pas faire la différence entre « c'est passé » et « ça a été refusé ».
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')], 'batch-1'));

    const stale: SyncOperationDto = {
      opId: opId(),
      seq: 0,
      entity: SyncEntity.REPRESENTANT,
      op: SyncOp.UPDATE,
      entityId: REP_A,
      clientUpdatedAt: '2026-08-10T11:00:00.000Z',
      baseRev: 99,
      data: { fullName: 'Écrasé', phone: '77 123 45 67' },
    };

    const first = await sync.push(alice, batch([stale], 'batch-2'));
    expect(statuses(first.body.results)).toEqual([SyncOpStatus.CONFLICT]);
    expect(first.body.results[0]?.errorCode).toBe('REV_CONFLICT');

    // Même opération, lot reconstitué : le verdict doit être IDENTIQUE.
    const replay = await sync.push(alice, batch([stale], 'batch-3'));
    expect(statuses(replay.body.results)).toEqual([SyncOpStatus.CONFLICT]);
    expect(replay.body.results[0]?.errorCode).toBe('REV_CONFLICT');
    expect(db.representants.get(REP_A)?.fullName).not.toBe('Écrasé');
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * DÉCALAGE DE DÉPLOIEMENT : UN VERDICT QUE CE BINAIRE NE CONNAÎT PAS
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `FROM_DB_RESULT` traduit l'énumération PostgreSQL en statut de protocole.
   * Les deux évoluent SÉPARÉMENT : les migrations partent avec le déploiement
   * de la base, le binaire de l'API arrive après. Il existe donc une fenêtre,
   * de quelques secondes à quelques minutes, pendant laquelle la colonne
   * `result` peut porter un membre ajouté que cette version ne sait pas lire.
   * La table rend alors `undefined`.
   *
   * Ce qu'il ne faut À AUCUN PRIX, c'est que ce trou se referme sur
   * `DUPLICATE`. `DUPLICATE` veut dire « c'est passé, tu peux clore la ligne » :
   * le téléphone efface la saisie du commercial et personne ne l'apprend
   * jamais. C'est exactement la perte de données que le rejeu de verdict
   * existe pour empêcher, réintroduite par la porte de derrière.
   *
   * Le repli est donc `INVALID`, assorti d'un code qui NOMME la cause : la
   * ligne remonte dans « À corriger », un humain la voit, et l'exploitant
   * comprend en lisant le code que c'est le serveur qui est en retard, pas la
   * saisie qui est fautive.
   *
   * La conversion ci-dessous est le cœur de l'épreuve, pas un contournement :
   * elle SIMULE la base en avance sur le code. Sans elle, le cas est
   * inatteignable depuis TypeScript, et c'est bien pour cela qu'il n'était
   * couvert par rien.
   */
  it('un verdict INCONNU du serveur se rejoue en INVALID, JAMAIS en duplicate', async () => {
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')], 'batch-1'));

    const operation = createRep(REP_B, '77 222 22 22');
    const premier = await sync.push(alice, batch([operation], 'batch-2'));
    expect(statuses(premier.body.results)).toEqual([SyncOpStatus.APPLIED]);

    // La base part en avant : elle mémorise un verdict d'une version future.
    // `OperationRow.result` est volontairement typé `string` dans la doublure,
    // et c'est la vérité du système : la colonne PostgreSQL est une énumération
    // que les migrations font évoluer AVANT que ce binaire ne soit reconstruit.
    // Le type TypeScript décrit ce que le code sait lire, pas ce que la base
    // peut contenir, et c'est tout l'objet de cette épreuve.
    const memoire = db.operations.get(operation.opId);
    expect(memoire, 'l’opération devrait être mémorisée').toBeDefined();
    if (memoire) memoire.result = 'QUARANTINED';

    const rejeu = await sync.push(alice, batch([operation], 'batch-3'));
    const ligne = rejeu.body.results[0];

    expect(ligne?.status).toBe(SyncOpStatus.INVALID);
    expect(ligne?.status).not.toBe(SyncOpStatus.DUPLICATE);
    expect(ligne?.errorCode).toBe('UNKNOWN_STORED_RESULT');
    // Le message est destiné à l'exploitant, pas au commercial : il doit dire
    // que c'est le SERVEUR qui ne sait pas lire, sinon le support cherche du
    // côté de la saisie.
    expect(ligne?.error).toContain('inconnu');
  });

  /**
   * Le témoin. Sans lui, un repli qui rendrait `INVALID` pour TOUT rejeu
   * satisferait l'épreuve ci-dessus sans rien prouver : c'est la DIFFÉRENCE
   * entre un verdict connu et un verdict inconnu qui est en jeu.
   */
  it('un verdict CONNU se rejoue toujours en duplicate, sans code d’erreur', async () => {
    const operation = createRep(REP_A, '77 123 45 67');
    await sync.push(alice, batch([operation], 'batch-1'));

    const rejeu = await sync.push(alice, batch([operation], 'batch-2'));
    const ligne = rejeu.body.results[0];

    expect(ligne?.status).toBe(SyncOpStatus.DUPLICATE);
    expect(ligne?.errorCode).toBeNull();
  });
});

describe('granularité transactionnelle, une transaction par groupe', () => {
  it('groupe le prospect avec SON représentant', () => {
    expect(dependencyKeyOf(createRep(REP_A, '77 123 45 67'))).toBe(`representant:${REP_A}`);
    expect(dependencyKeyOf(createProspect('p-1', REP_A, '77 111 11 11', 1))).toBe(
      `representant:${REP_A}`,
    );
    // Une mise à jour sans parent explicite forme son propre groupe : la mêler
    // aux autres ferait échouer ensemble des lignes indépendantes.
    expect(dependencyKeyOf({ entity: SyncEntity.PROSPECT, entityId: 'p-9', data: undefined })).toBe(
      'prospect:p-9',
    );
  });

  it('ouvre une transaction PAR GROUPE, pas une pour tout le lot', async () => {
    await sync.push(
      alice,
      batch([
        createRep(REP_A, '77 123 45 67', 0),
        createProspect('0198f000-0000-7000-8000-000000000001', REP_A, '77 111 11 11', 1),
        createRep(REP_B, '76 555 44 33', 2),
        createProspect('0198f000-0000-7000-8000-000000000002', REP_B, '78 222 22 22', 3),
      ]),
    );

    expect(db.transactionCount).toBe(2);
    expect(db.representants.size).toBe(2);
    expect(db.prospects.size).toBe(2);
  });

  it('un conflit de téléphone n’annule PAS les écritures valides du même groupe', async () => {
    // Un prospect occupe déjà le numéro.
    db.prospects.set('deja-la', {
      id: 'deja-la',
      nom: 'Autre',
      prenom: 'Personne',
      phoneE164: '+221771111111',
      rev: 1,
      statut: 'NOUVEAU',
      banqueId: 'b',
      syndicatId: 's',
      representantId: 'r',
      createdById: bob.id,
      clientCreatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = await sync.push(
      alice,
      batch([
        createRep(REP_A, '77 123 45 67', 0),
        // celui-ci entre en conflit
        createProspect('0198f000-0000-7000-8000-000000000010', REP_A, '77 111 11 11', 1),
        // celui-ci doit tout de même passer
        createProspect('0198f000-0000-7000-8000-000000000011', REP_A, '78 222 22 22', 2),
      ]),
    );

    expect(statuses(result.body.results)).toEqual([
      SyncOpStatus.APPLIED,
      SyncOpStatus.CONFLICT,
      SyncOpStatus.APPLIED,
    ]);
    // Le doublon est détecté par une LECTURE : la transaction n'est jamais
    // empoisonnée, donc rien n'est annulé.
    expect(db.rollbackCount).toBe(0);
    expect(db.representants.size).toBe(1);
    // La fiche préexistante, plus le seul prospect non conflictuel.
    expect(db.prospects.size).toBe(2);

    const conflict = result.body.results[1];
    expect(conflict?.errorCode).toBe('PROSPECT_PHONE_CONFLICT');
  });

  it('l’échec d’un groupe laisse intact le groupe voisin', async () => {
    const operations = [
      createRep(REP_A, '77 123 45 67', 0),
      createProspect('0198f000-0000-7000-8000-000000000020', REP_A, '77 111 11 11', 1),
      createRep(REP_B, '76 555 44 33', 2),
      createProspect('0198f000-0000-7000-8000-000000000021', REP_B, '78 222 22 22', 3),
    ];

    // On sabote l'écriture du SECOND représentant par une panne d'infrastructure,
    // qui empoisonne réellement sa transaction.
    const upsert = db.representant.upsert.bind(db.representant);
    db.representant.upsert = (args) => {
      if (args.where.id === REP_B) throw new Error('panne simulée du serveur');
      return upsert(args);
    };

    const result = await sync.push(alice, batch(operations));

    expect(db.rollbackCount).toBe(1);
    expect(statuses(result.body.results)).toEqual([
      SyncOpStatus.APPLIED,
      SyncOpStatus.APPLIED,
      SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
      SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
    ]);

    // Le premier groupe a bien été conservé : c'est tout l'intérêt d'une
    // transaction par groupe plutôt qu'une par lot.
    expect(db.representants.has(REP_A)).toBe(true);
    expect(db.prospects.size).toBe(1);
    expect(db.representants.has(REP_B)).toBe(false);
  });

  it('un prospect n’atterrit jamais sans son représentant', async () => {
    // Le représentant est invalide (département manquant) : ses prospects
    // doivent être marqués dépendants échoués, pas écrits.
    const rep = createRep(REP_A, '77 123 45 67', 0);
    delete rep.data?.departementId;

    const result = await sync.push(
      alice,
      batch([
        rep,
        createProspect('0198f000-0000-7000-8000-000000000030', REP_A, '77 111 11 11', 1),
      ]),
    );

    expect(statuses(result.body.results)).toEqual([
      SyncOpStatus.INVALID,
      SyncOpStatus.SKIPPED_DEPENDENCY_FAILED,
    ]);
    expect(db.prospects.size).toBe(0);
  });
});

describe('garde anti-squat d’identifiant', () => {
  it('refuse de réécrire la ligne d’un autre commercial', async () => {
    db.representants.set(REP_A, {
      id: REP_A,
      fullName: 'Fiche de Bob',
      phoneE164: '+221770000000',
      notes: null,
      rev: 3,
      departementId: 'd',
      createdById: bob.id,
      clientCreatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')]));

    expect(statuses(result.body.results)).toEqual([SyncOpStatus.CONFLICT]);
    expect(result.body.results[0]?.errorCode).toBe('ENTITY_ID_OWNED_BY_ANOTHER_USER');
    // Aucune écriture : la fiche de Bob est intacte.
    expect(db.representants.get(REP_A)?.fullName).toBe('Fiche de Bob');
    expect(db.representants.get(REP_A)?.rev).toBe(3);
  });
});

describe('écriture conditionnelle sur la révision', () => {
  it('un baseRev périmé produit un conflit au lieu d’écraser', async () => {
    await sync.push(alice, batch([createRep(REP_A, '77 123 45 67')], 'batch-1'));

    const stale: SyncOperationDto = {
      opId: opId(),
      seq: 0,
      entity: SyncEntity.REPRESENTANT,
      op: SyncOp.UPDATE,
      entityId: REP_A,
      clientUpdatedAt: '2026-08-10T11:00:00.000Z',
      baseRev: 99,
      data: { fullName: 'Écrasé', phone: '77 123 45 67' },
    };

    const result = await sync.push(alice, batch([stale], 'batch-2'));
    expect(statuses(result.body.results)).toEqual([SyncOpStatus.CONFLICT]);
    expect(result.body.results[0]?.errorCode).toBe('REV_CONFLICT');
    expect(db.representants.get(REP_A)?.fullName).not.toBe('Écrasé');
  });
});

describe('réponse du push', () => {
  it('rend un résultat par opération, dans l’ordre de la requête', async () => {
    const operations = [createRep(REP_A, '77 123 45 67', 0), createRep(REP_B, '76 555 44 33', 1)];
    const result = await sync.push(alice, batch(operations));

    expect(result.body.results.map((row) => row.opId)).toEqual(operations.map((row) => row.opId));
    expect(result.body.batchId).toBe('batch-1');
  });
});

/**
 * LA CONSÉQUENCE DE L'EXEMPTION ABSOLUE.
 *
 * `DemoReadOnlyGuard` refuse toute écriture interactive tant que le mode
 * démonstration est allumé, SAUF la remontée hors ligne du mobile. Il ne reste
 * donc, par ce chemin, que du travail RÉEL : une file constituée des heures
 * plus tôt, dans un village sans réseau, par quelqu'un qui ignore tout de la
 * réunion en cours au bureau.
 *
 * Ces lignes ne doivent SURTOUT PAS hériter de l'interrupteur. C'est
 * exactement le défaut que toute cette correction répare : quatre prospects
 * réels écrits `isDemo: true` pendant la fenêtre, puis disparus de tous les
 * écrans et de tous les exports à l'extinction, sans que la purge sache même
 * les reprendre.
 */
describe('mode démonstration allumé, la remontée hors ligne reste du travail RÉEL', () => {
  let demoDb: FakePrisma;
  let demoSync: SyncService;

  beforeEach(() => {
    demoDb = new FakePrisma();
    const prisma = demoDb as unknown as PrismaService;
    demoSync = new SyncService(
      prisma,
      new SyncBatchStore(prisma),
      new Phase2SyncService(),
      // L'interrupteur est ALLUMÉ pendant tout ce bloc.
      fakeDemoVisibility(true),
    );
  });

  it('un représentant remonté n’est PAS marqué de démonstration', async () => {
    await demoSync.push(alice, batch([createRep(REP_A, '77 123 45 67')]));

    // `?? false` : le service ne pose pas la colonne du tout, c'est le défaut
    // du schéma qui vaut `false`. L'assertion échoue si quelqu'un se remet à
    // recopier l'interrupteur ici.
    expect(demoDb.representants.get(REP_A)?.isDemo ?? false).toBe(false);
  });

  it('un prospect remonté n’est PAS marqué de démonstration', async () => {
    const prospectId = '0198f000-0000-7000-8000-000000000001';
    await demoSync.push(
      alice,
      batch([
        createRep(REP_A, '77 123 45 67', 0),
        createProspect(prospectId, REP_A, '78 222 33 44', 1),
      ]),
    );

    expect(demoDb.prospects.get(prospectId)?.isDemo ?? false).toBe(false);
  });
});

/**
 * MAIS L'ANIMATEUR, LUI, N'EST PAS UN VRAI COMMERCIAL.
 *
 * Le bloc précédent est juste, et sa conclusion a pourtant été tirée trop
 * loin : « tout ce qui arrive par le chemin dispensé est du travail réel ».
 * C'est faux pour UN cas, et c'est précisément celui que la démonstration
 * met en scène. L'animateur se connecte sur le téléphone avec un compte de
 * démonstration pour montrer la saisie terrain ; ce qu'il pousse est fictif.
 *
 * Le drapeau ne suit donc pas l'INTERRUPTEUR (le bloc précédent le prouve),
 * il suit l'AUTEUR et le PARENT.
 */
describe('la remontée d’un COMPTE de démonstration écrit du fictif', () => {
  const animateur: AuthenticatedUser = { ...alice, id: 'demo-awa', username: 'demo.awa' };
  const PROSPECT = '0198f000-0000-7000-8000-000000000009';

  beforeEach(() => {
    db.addDemoUser(animateur.id);
  });

  it('LE REPRÉSENTANT SAISI PAR L’ANIMATEUR EST FICTIF', async () => {
    await sync.push(animateur, batch([createRep(REP_A, '77 123 45 67')]));

    // Sans cela, la fiche fictive entre dans l'annuaire RÉEL : listée,
    // exportée, et tirée dans les campagnes.
    expect(db.representants.get(REP_A)?.isDemo).toBe(true);
  });

  it('et il est INSCRIT AU REGISTRE, sans quoi la purge resterait bloquée', async () => {
    await sync.push(animateur, batch([createRep(REP_A, '77 123 45 67')]));

    // `Representant.createdById` est en `onDelete: Restrict` : une fiche
    // fictive hors registre retient le compte semé qui l'a créée, et la purge
    // entière échoue. Le jeu de démonstration devient indéboulonnable.
    expect(db.demoEntities).toContainEqual(
      expect.objectContaining({ entityType: 'representant', entityId: REP_A }),
    );
  });

  it('le prospect suit, et part du registre AVANT son représentant', async () => {
    await sync.push(
      animateur,
      batch([
        createRep(REP_A, '77 123 45 67', 0),
        createProspect(PROSPECT, REP_A, '78 222 33 44', 1),
      ]),
    );

    expect(db.prospects.get(PROSPECT)?.isDemo).toBe(true);

    // La purge parcourt le registre à l'ENVERS : le prospect doit donc porter
    // un rang plus élevé que son représentant, sinon `onDelete: Restrict`
    // arrête la suppression sur le parent.
    const rang = (entityId: string): number =>
      db.demoEntities.find((row) => row.entityId === entityId)?.sequence ?? -1;
    expect(rang(PROSPECT)).toBeGreaterThan(rang(REP_A));
  });

  it('UN VRAI COMMERCIAL rattaché à un représentant FICTIF écrit du fictif', async () => {
    // L'annuaire de phase 2 n'est pas cloisonné par commercial : un vrai
    // commercial peut compléter n'importe quel numéro, y compris fictif. Le
    // prospect doit suivre son parent, sans quoi la paire se désolidarise à
    // l'extinction et la purge bute sur le prospect resté réel.
    await sync.push(animateur, batch([createRep(REP_A, '77 123 45 67')]));

    const admin: AuthenticatedUser = { ...alice, id: 'com-admin', role: Role.ADMIN };
    await sync.push(admin, batch([createProspect(PROSPECT, REP_A, '78 222 33 44', 0)]));

    expect(db.prospects.get(PROSPECT)?.isDemo).toBe(true);
  });

  it('un compte RÉEL sur un représentant RÉEL n’écrit rien de fictif', async () => {
    // Le contrôle inverse : la correction ne doit pas colorier la production.
    await sync.push(
      alice,
      batch([
        createRep(REP_B, '77 999 88 77', 0),
        createProspect(PROSPECT, REP_B, '78 222 33 44', 1),
      ]),
    );

    expect(db.representants.get(REP_B)?.isDemo ?? false).toBe(false);
    expect(db.prospects.get(PROSPECT)?.isDemo ?? false).toBe(false);
    expect(db.demoEntities).toHaveLength(0);
  });
});
