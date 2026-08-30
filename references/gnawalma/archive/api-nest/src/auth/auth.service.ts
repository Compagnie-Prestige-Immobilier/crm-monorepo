import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { assertPin, normalizePhone } from './phone';
import type { AccountRole, AuthClaims } from './auth.types';

interface AccountRow { id: string; role: AccountRole; pin_hash: string; is_active: boolean; locked_until: Date | null; failed_login_count: number; }

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: { phone?: string; email?: string; pin: string; displayName: string; role: 'atelier_owner' | 'client' }): Promise<{ accountId: string }> {
    assertPin(input.pin);
    if (!input.phone && !input.email) throw new UnauthorizedException('Phone or email is required');
    const phone = input.phone ? normalizePhone(input.phone) : null;
    const pinHash = await argon2.hash(input.pin, { type: argon2.argon2id });
    let row: { id: string } | undefined;
    try {
      row = await this.db.one<{ id: string }>(
        `INSERT INTO accounts (phone_e164,email,pin_hash,display_name,role)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [phone, input.email?.toLowerCase() ?? null, pinHash, input.displayName.trim(), input.role],
      );
    } catch (error) {
      // Signing up twice is the most ordinary thing a person can do, and it
      // surfaced as "Le service rencontre un problème temporaire" — a 500 that
      // told them to wait and try again, which could never succeed. 23505 is
      // the unique violation on phone_e164 / email.
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('An account already exists for this phone or email');
      }
      throw error;
    }
    if (!row) throw new Error('Account creation failed');
    return { accountId: row.id };
  }

  async me(user: AuthClaims): Promise<Record<string, unknown>> {
    const account = await this.db.one<{
      id: string;
      display_name: string;
      role: AccountRole;
      phone_e164: string | null;
      email: string | null;
    }>(
      `SELECT id,display_name,role,phone_e164,email
         FROM accounts
        WHERE id=$1 AND is_active=true`,
      [user.sub],
    );
    if (!account) throw new UnauthorizedException('Account unavailable');

    const ateliers = await this.db.query<{
      id: string;
      name: string;
      status: string;
      created_at: Date;
      membership_role: AccountRole;
    }>(
      // `a.created_at` has to be in the select list: Postgres rejects a
      // SELECT DISTINCT ordered by an expression that is not projected.
      `SELECT DISTINCT
         a.id,
         a.name,
         a.status::text,
         a.created_at,
         CASE
           WHEN a.owner_account_id=$1 THEN 'atelier_owner'::account_role
           ELSE m.role
         END AS membership_role
       FROM ateliers a
       LEFT JOIN atelier_memberships m
         ON m.atelier_id=a.id AND m.account_id=$1
       WHERE a.owner_account_id=$1 OR m.account_id=$1
       ORDER BY a.created_at ASC`,
      [user.sub],
    );

    return {
      accountId: account.id,
      displayName: account.display_name,
      role: account.role,
      phone: account.phone_e164,
      email: account.email,
      ateliers: ateliers.map((atelier) => ({
        id: atelier.id,
        name: atelier.name,
        status: atelier.status,
        membershipRole: atelier.membership_role,
      })),
    };
  }

  async login(identifier: string, pin: string, metadata: { userAgent?: string; ip?: string }): Promise<Record<string, unknown>> {
    assertPin(pin);
    const phone = identifier.includes('@') ? null : normalizePhone(identifier);
    const account = await this.db.one<AccountRow>(
      'SELECT id,role,pin_hash,is_active,locked_until,failed_login_count FROM accounts WHERE phone_e164=$1 OR email=$2',
      [phone, identifier.includes('@') ? identifier.toLowerCase() : null],
    );
    if (!account || !account.is_active) throw new UnauthorizedException('Invalid credentials');
    if (account.locked_until && account.locked_until > new Date()) {
      throw new HttpException('Account temporarily locked', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!(await argon2.verify(account.pin_hash, pin))) {
      const next = account.failed_login_count + 1;
      // The counter is assigned and compared through two separate parameters,
      // each explicitly typed.
      //
      // A single `$2` used both as the `smallint` column value and in
      // `$2 >= 5` made PostgreSQL deduce two types for one parameter and
      // refuse the statement — so *every* mistyped PIN raised a 500 and told
      // the user "le service rencontre un problème temporaire" instead of that
      // their credentials were wrong. The lockout was dead for the same
      // reason: the update never ran, so `failed_login_count` never left 0 and
      // the five-attempt throttle could not trigger.
      await this.db.query(
        `UPDATE accounts SET
           failed_login_count=$2::smallint,
           locked_until=CASE WHEN $3 THEN now() + interval '30 seconds' ELSE NULL END
         WHERE id=$1`,
        [account.id, next, next >= 5],
      );
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.db.query('UPDATE accounts SET failed_login_count=0, locked_until=NULL WHERE id=$1', [account.id]);
    return this.issueSession(account.id, account.role, metadata);
  }

  async refresh(refreshToken: string, metadata: { userAgent?: string; ip?: string }): Promise<Record<string, unknown>> {
    let payload: AuthClaims;
    try {
      payload = await this.jwt.verifyAsync<AuthClaims>(refreshToken, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET') });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const session = await this.db.one<{ id: string; account_id: string; role: AccountRole; refresh_token_hash: string }>(
      `SELECT s.id,s.account_id,a.role,s.refresh_token_hash FROM sessions s JOIN accounts a ON a.id=s.account_id
       WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at > now()`, [payload.sid],
    );
    if (!session || !(await argon2.verify(session.refresh_token_hash, refreshToken))) throw new UnauthorizedException('Invalid refresh token');
    await this.db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [session.id]);
    return this.issueSession(session.account_id, session.role, metadata);
  }

  async revoke(sessionId: string, accountId: string): Promise<void> {
    await this.db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1 AND account_id=$2', [sessionId, accountId]);
  }

  private async issueSession(accountId: string, role: AccountRole, metadata: { userAgent?: string; ip?: string }): Promise<Record<string, unknown>> {
    const sessionId = randomUUID();
    const claims: AuthClaims = { sub: accountId, role, sid: sessionId };
    const accessToken = await this.jwt.signAsync(claims, { expiresIn: '15m' });
    const refreshToken = await this.jwt.signAsync(claims, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: '30d' });
    await this.db.query(
      `INSERT INTO sessions (id,account_id,refresh_token_hash,user_agent,ip,expires_at)
       VALUES ($1,$2,$3,$4,$5,now()+interval '30 days')`,
      [sessionId, accountId, await argon2.hash(refreshToken), metadata.userAgent ?? null, metadata.ip ?? null],
    );
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresInSeconds: 900, sessionId };
  }
}
