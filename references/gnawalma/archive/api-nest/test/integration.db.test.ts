import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { AdminService } from '../src/admin/admin.service';
import { AuthService } from '../src/auth/auth.service';
import { AtelierAccessService } from '../src/atelier/atelier-access.service';
import { OperationsService } from '../src/operations/operations.service';
import { SyncService } from '../src/sync/sync.service';
import type { AuthClaims } from '../src/auth/auth.types';

describe('PostgreSQL integration invariants', () => {
  let db: DatabaseService;
  let ownerId: string;
  let otherAccountId: string;
  let atelierId: string;
  let clientId: string;
  let orderId: string;
  let adminId: string;
  let chainAtelierId: string;
  let positionlessAtelierId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for DB integration tests');
    db = new DatabaseService(new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }));
    ownerId = randomUUID();
    otherAccountId = randomUUID();
    adminId = randomUUID();
    atelierId = randomUUID();
    clientId = randomUUID();
    orderId = randomUUID();
    await db.query(
      `INSERT INTO accounts (id,phone_e164,pin_hash,display_name,role) VALUES
       ($1,$4,'test','Integration owner','atelier_owner'),
       ($2,$5,'test','Other account','atelier_owner'),
       ($3,$6,'test','Integration admin','platform_admin')`,
      [
        ownerId,
        otherAccountId,
        adminId,
        `+22170${ownerId.replaceAll('-', '').slice(0, 7)}`,
        `+22170${otherAccountId.replaceAll('-', '').slice(0, 7)}`,
        `+22170${adminId.replaceAll('-', '').slice(0, 7)}`,
      ],
    );
    await db.query(
      `INSERT INTO ateliers (id,owner_account_id,name,phone_e164,status)
       VALUES ($1,$2,'Integration atelier',$3,'verified')`,
      [atelierId, ownerId, `+22176${ownerId.replaceAll('-', '').slice(0, 7)}`],
    );
    await db.query(
      `INSERT INTO clients (id,atelier_id,full_name) VALUES ($1,$2,'Integration client')`,
      [clientId, atelierId],
    );
    await db.query(
      `INSERT INTO orders (id,atelier_id,client_id,public_reference,total_cfa)
       VALUES ($1,$2,$3,$4,100)`,
      [orderId, atelierId, clientId, `integration-${orderId.slice(0, 8)}`],
    );
  });

  afterAll(async () => {
    await db.query('DELETE FROM payments WHERE order_id=$1', [orderId]);
    await db.query('DELETE FROM orders WHERE id=$1', [orderId]);
    // `atelier_verifications`, `atelier_memberships`, `change_log` and
    // `audit_events` all cascade from the atelier; `audit_events` does not, so
    // it goes first.
    await db.query('DELETE FROM audit_events WHERE atelier_id = ANY($1::uuid[])', [
      [atelierId, chainAtelierId, positionlessAtelierId].filter(Boolean),
    ]);
    await db.query('DELETE FROM ateliers WHERE id = ANY($1::uuid[])', [
      [atelierId, chainAtelierId, positionlessAtelierId].filter(Boolean),
    ]);
    await db.query('DELETE FROM accounts WHERE id IN ($1,$2,$3)', [ownerId, otherAccountId, adminId]);
    await db.onModuleDestroy();
  });

  it('rejects cross-atelier writes', async () => {
    const access = new AtelierAccessService(db);
    const otherUser: AuthClaims = { sub: otherAccountId, role: 'atelier_owner', sid: randomUUID() };
    await expect(access.requireWriteAccess(otherUser, atelierId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects stale sync writes without changing the client', async () => {
    const sync = new SyncService(db, new AtelierAccessService(db));
    const owner: AuthClaims = { sub: ownerId, role: 'atelier_owner', sid: randomUUID() };
    const result = await sync.push(owner, atelierId, randomUUID(), [{
      operationId: randomUUID(),
      entityType: 'client',
      entityId: clientId,
      baseVersion: 99,
      operation: 'upsert',
      payload: { fullName: 'Must not win' },
    }]);
    expect(result.results[0]).toMatchObject({
      status: 'conflict',
      code: 'VERSION_CONFLICT',
    });
    const client = await db.one<{ full_name: string; version: number }>('SELECT full_name,version FROM clients WHERE id=$1', [clientId]);
    expect(client).toEqual({ full_name: 'Integration client', version: '1' });
  });

  /**
   * The chain a client depends on, exercised against the real database.
   *
   * Static assertions could not have caught either bug this covers. The
   * submission route did not exist at all, and the approval statement was
   * syntactically fine TypeScript that Postgres refused outright — it deduced
   * two different types for one parameter and answered with an error, so every
   * approval and every rejection returned a 500 and no atelier could reach
   * 'verified' even once its dossier was in the queue.
   */
  it('carries an atelier from draft to listed in the marketplace', async () => {
    const operations = new OperationsService(db, new AtelierAccessService(db));
    const admin = new AdminService(db);
    const owner: AuthClaims = { sub: ownerId, role: 'atelier_owner', sid: randomUUID() };
    const administrator: AuthClaims = { sub: adminId, role: 'platform_admin', sid: randomUUID() };

    const created = await operations.createAtelier(owner, {
      name: 'Chain atelier',
      // Given unformatted on purpose: the column is `phone_e164` and the
      // marketplace hands its value straight to a `tel:` link.
      phone: `77 ${ownerId.replaceAll(/\D/g, '').slice(0, 3)} 00 ${ownerId.replaceAll(/\D/g, '').slice(3, 5)}`.replace(/\s+/g, ' '),
      latitude: 14.6937,
      longitude: -17.4441,
    });
    chainAtelierId = created.id;

    const draft = await db.one<{ status: string; phone_e164: string }>(
      'SELECT status::text, phone_e164 FROM ateliers WHERE id=$1',
      [chainAtelierId],
    );
    expect(draft?.status).toBe('draft');
    expect(draft?.phone_e164).toMatch(/^\+221\d{9}$/);

    // D-010: verification is automatic, the admin review is remote. A complete
    // dossier publishes the atelier now and queues it for review — it does not
    // wait on a human. Gating visibility on that decision made the marketplace
    // depend on a staffed `platform_admin` account, so with none, no atelier
    // was ever visible to any client.
    const submitted = await operations.submitForVerification(owner, chainAtelierId, {
      idDocumentRef: 'CNI-INTEGRATION-0001',
    });
    expect(submitted.status).toBe('verified');

    const published = await db.one<{ status: string; verified_at: Date | null }>(
      'SELECT status::text, verified_at FROM ateliers WHERE id=$1',
      [chainAtelierId],
    );
    expect(published?.status).toBe('verified');
    expect(published?.verified_at).not.toBeNull();

    // Idempotent: a retried submission must not stack a second dossier in
    // front of the same reviewer.
    const again = await operations.submitForVerification(owner, chainAtelierId, {
      idDocumentRef: 'CNI-INTEGRATION-0001',
    });
    expect(again.verificationId).toBe(submitted.verificationId);

    // Published, and still reviewable: the dossier stays in the queue.
    const queue = await admin.pendingAteliers(administrator);
    expect(queue.some((row) => (row as { id: string }).id === chainAtelierId)).toBe(true);

    const decision = await admin.decideVerification(administrator, submitted.verificationId, true);
    expect(decision).toMatchObject({ atelierId: chainAtelierId, decision: 'approved' });

    const verified = await db.one<{ status: string; verified_at: Date | null }>(
      'SELECT status::text, verified_at FROM ateliers WHERE id=$1',
      [chainAtelierId],
    );
    expect(verified?.status).toBe('verified');
    expect(verified?.verified_at).not.toBeNull();

    // Deciding twice is not an error the reviewer caused twice over.
    await expect(
      admin.decideVerification(administrator, submitted.verificationId, true),
    ).rejects.toThrow();
  });

  it('refuses to publish an atelier the marketplace could never list', async () => {
    // Search filters on `location IS NOT NULL`, so approving a positionless
    // atelier would verify a row that still appears in no result.
    const operations = new OperationsService(db, new AtelierAccessService(db));
    const owner: AuthClaims = { sub: ownerId, role: 'atelier_owner', sid: randomUUID() };
    const created = await operations.createAtelier(owner, {
      name: 'Positionless atelier',
      phone: `+2217${ownerId.replaceAll(/\D/g, '').slice(0, 8)}`,
    });
    positionlessAtelierId = created.id;

    await expect(
      operations.submitForVerification(owner, positionlessAtelierId, {
        idDocumentRef: 'CNI-INTEGRATION-0002',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // And the repair path puts it back on track.
    await operations.updateAtelier(owner, positionlessAtelierId, {
      latitude: 14.75,
      longitude: -17.39,
    });
    await expect(
      operations.submitForVerification(owner, positionlessAtelierId, {
        idDocumentRef: 'CNI-INTEGRATION-0002',
      }),
    ).resolves.toMatchObject({ status: 'verified' });
  });

  /**
   * Rows created while publication still waited on a manual decision.
   *
   * They carry both a pending dossier and a `pending_review` status, so an
   * early return on "a dossier already exists" would leave them invisible for
   * good. Resubmitting has to converge, not merely report that nothing was
   * needed.
   */
  it('publishes an atelier left stranded at pending_review', async () => {
    const operations = new OperationsService(db, new AtelierAccessService(db));
    const owner: AuthClaims = { sub: ownerId, role: 'atelier_owner', sid: randomUUID() };
    await db.query(
      `UPDATE ateliers SET status='pending_review', verified_at=NULL WHERE id=$1`,
      [positionlessAtelierId],
    );

    const result = await operations.submitForVerification(owner, positionlessAtelierId, {
      idDocumentRef: 'CNI-INTEGRATION-0002',
    });
    expect(result.status).toBe('verified');

    const row = await db.one<{ status: string; dossiers: string }>(
      `SELECT a.status::text,
              (SELECT count(*) FROM atelier_verifications v
                WHERE v.atelier_id=a.id AND v.decision='pending') AS dossiers
         FROM ateliers a WHERE a.id=$1`,
      [positionlessAtelierId],
    );
    expect(row?.status).toBe('verified');
    // Converged without queueing a duplicate for the reviewer.
    expect(Number(row?.dossiers)).toBe(1);
  });

  /**
   * A wrong PIN is the single most common thing a user does.
   *
   * It answered 500 "le service rencontre un problème temporaire" — the same
   * defect as the verification decision, one parameter deduced as two types:
   * `failed_login_count=$2` alongside `$2 >= 5`. The statement never ran, so
   * the counter never left zero and the five-attempt lockout could not fire
   * either. Both halves are asserted here because the failure was silent in
   * both directions.
   */
  it('rejects a wrong PIN with 401 and locks the account after five', async () => {
    const jwt = new JwtService({ secret: 'integration-access-secret' });
    const config = new ConfigService({
      JWT_REFRESH_SECRET: 'integration-refresh-secret',
    });
    const auth = new AuthService(db, jwt, config);
    // Nine digits after the country code, since `register` normalises to
    // E.164 rather than storing what it was handed.
    const phone = `+2217${adminId.replace(/\D/g, '').padEnd(8, '0').slice(0, 8)}`;
    await auth.register({
      phone,
      pin: '4321',
      displayName: 'Login probe',
      role: 'client',
    });

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(auth.login(phone, '0000', {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      const row = await db.one<{ failed_login_count: number }>(
        'SELECT failed_login_count FROM accounts WHERE phone_e164=$1',
        [phone],
      );
      expect(Number(row?.failed_login_count)).toBe(attempt);
    }

    await expect(auth.login(phone, '0000', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const locked = await db.one<{ locked: boolean }>(
      'SELECT locked_until IS NOT NULL AS locked FROM accounts WHERE phone_e164=$1',
      [phone],
    );
    expect(locked?.locked).toBe(true);

    // Even the correct PIN is refused while the lockout stands.
    await expect(auth.login(phone, '4321', {})).rejects.toThrow();

    await db.query('DELETE FROM accounts WHERE phone_e164=$1', [phone]);
  });

  it('serializes concurrent payments and never exceeds the order total', async () => {
    const operations = new OperationsService(db, new AtelierAccessService(db));
    const owner: AuthClaims = { sub: ownerId, role: 'atelier_owner', sid: randomUUID() };
    const attempts = [randomUUID(), randomUUID()].map((idempotencyKey) => operations.recordPayment(
      owner, atelierId, orderId, { amountCfa: 70, method: 'cash', idempotencyKey },
    ));
    const results = await Promise.allSettled(attempts);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const order = await db.one<{ paid_cfa: number; total_cfa: number }>('SELECT paid_cfa,total_cfa FROM orders WHERE id=$1', [orderId]);
    expect(Number(order?.paid_cfa)).toBeLessThanOrEqual(Number(order?.total_cfa ?? 0));
    expect(Number(order?.paid_cfa)).toBe(70);
  });
});
