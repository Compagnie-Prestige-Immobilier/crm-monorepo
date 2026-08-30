import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { DatabaseService } from '../database/database.service';
import { assertPin, normalizePhone } from './phone';

/**
 * Ensures the platform administrator exists, from configuration.
 *
 * `POST /auth/register` only issues `atelier_owner` and `client` roles — an
 * account that approves ateliers and publishes reviews must not be
 * self-service. That left a real deployment with a back-office no one could
 * sign in to: the verification queue could not be worked, no atelier could
 * reach `verified`, and `GET /marketplace/ateliers` (verified only) answered
 * an empty list however many dossiers were waiting. The client app looked
 * broken when the platform was merely unstaffed.
 *
 * `scripts/create-admin.mjs` covers that from a shell, but it needs the
 * database URL. This path needs only the two values, set where the rest of the
 * service's secrets already live, so bringing up an environment never requires
 * direct database access.
 *
 * Deliberately narrow:
 * - runs only when **both** variables are set; unset means do nothing;
 * - creates or re-keys exactly one account and grants exactly one role;
 * - is idempotent, so every restart converges rather than accumulating;
 * - never writes the PIN to a log, and never echoes the phone in full;
 * - refuses a PIN that would not pass `assertPin`, rather than storing a
 *   credential the login endpoint would then reject.
 *
 * It is not an HTTP surface: nothing reachable from the network can invoke it.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const phoneInput = this.config.get<string>('BOOTSTRAP_ADMIN_PHONE')?.trim();
    const pin = this.config.get<string>('BOOTSTRAP_ADMIN_PIN')?.trim();
    const displayName =
      this.config.get<string>('BOOTSTRAP_ADMIN_NAME')?.trim() || 'Administration';

    if (!phoneInput && !pin) return;
    if (!phoneInput || !pin) {
      this.logger.warn(
        'BOOTSTRAP_ADMIN_PHONE and BOOTSTRAP_ADMIN_PIN must be set together; no administrator was provisioned.',
      );
      return;
    }

    let phone: string;
    try {
      phone = normalizePhone(phoneInput);
      assertPin(pin);
    } catch {
      // The reason is stated without repeating either value back into a log.
      this.logger.error(
        'BOOTSTRAP_ADMIN_PHONE must be a valid phone number and BOOTSTRAP_ADMIN_PIN 4–8 digits; no administrator was provisioned.',
      );
      return;
    }

    try {
      const pinHash = await argon2.hash(pin, { type: argon2.argon2id });
      const row = await this.db.one<{ id: string; created: boolean }>(
        `INSERT INTO accounts (phone_e164,pin_hash,display_name,role)
         VALUES ($1,$2,$3,'platform_admin')
         ON CONFLICT (phone_e164) DO UPDATE SET
           pin_hash=EXCLUDED.pin_hash,
           display_name=EXCLUDED.display_name,
           role='platform_admin',
           is_active=true,
           failed_login_count=0,
           locked_until=NULL,
           updated_at=now()
         RETURNING id, (xmax = 0) AS created`,
        [phone, pinHash, displayName],
      );
      if (!row) return;
      this.logger.log(
        `Platform administrator ${row.created ? 'created' : 'updated'} for ${maskPhone(phone)}.`,
      );
    } catch (error) {
      // A failure here must not stop the service from serving everything else.
      this.logger.error(
        'Could not provision the platform administrator.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

/** `+221780000000` → `+221…0000`. Enough to identify, not enough to publish. */
function maskPhone(phone: string): string {
  return phone.length <= 8 ? '…' : `${phone.slice(0, 4)}…${phone.slice(-4)}`;
}
