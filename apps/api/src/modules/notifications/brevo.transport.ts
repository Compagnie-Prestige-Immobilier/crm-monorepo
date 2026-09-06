import { Injectable, Logger } from '@nestjs/common';

import { readNotificationsEnv } from './notifications.env.js';

export const BREVO_MAX_RECIPIENTS_PER_CALL = 99;

export const BREVO_MAX_CONCURRENT_CALLS = 8;

const BREVO_REQUEST_TIMEOUT_MS = 15_000;

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const DEFAULT_SENDER_NAME = 'CPI GO';

export interface BrevoRecipient {
  readonly email: string;
  readonly name?: string;
}

export interface BrevoMessage {
  readonly recipients: readonly BrevoRecipient[];
  readonly subject: string;
  readonly htmlContent: string;
  readonly textContent: string;
}

export type BrevoFailureKind = 'transient' | 'permanent';

interface BrevoSendOutcome {
  readonly email: string;
  readonly ok: boolean;
  readonly errorCode?: string;
  readonly kind?: BrevoFailureKind;
}

export type BrevoTransportStatus = 'SENT' | 'NOT_CONFIGURED' | 'TRANSPORT_ERROR';

export interface BrevoDispatchResult {
  readonly status: BrevoTransportStatus;
  readonly outcomes: readonly BrevoSendOutcome[];
  readonly detail?: string;
}

export interface BrevoTransport {
  isConfigured(): boolean;
  unavailableReason(): string | null;
  send(messages: readonly BrevoMessage[]): Promise<BrevoDispatchResult>;
}

export const BREVO_TRANSPORT = Symbol('BREVO_TRANSPORT');

export const chunkRecipients = <T>(
  items: readonly T[],
  size = BREVO_MAX_RECIPIENTS_PER_CALL,
): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = Array.from({ length: items.length });
  let cursor = 0;

  const drain = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index] as T) };
      } catch (error) {
        results[index] = { status: 'rejected', reason: error };
      }
    }
  };

  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, () => drain()));
  return results;
};

const classifyBrevoFailure = (httpStatus: number): BrevoFailureKind =>
  httpStatus === 429 || httpStatus >= 500 ? 'transient' : 'permanent';

const trimmedOrNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const trimmedOrDefault = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
};

const missingBrevoConfigReason = (apiKey: string | null, senderEmail: string | null): string | null => {
  if (!apiKey) return 'BREVO_API_KEY est absent : aucun transport e-mail configuré.';
  if (!senderEmail) {
    return "BREVO_SENDER_EMAIL est absent : Brevo refuse un envoi sans adresse d'expédition.";
  }
  return null;
};

@Injectable()
export class BrevoHttpTransport implements BrevoTransport {
  private readonly logger = new Logger(BrevoHttpTransport.name);
  private readonly apiKey: string | null;
  private readonly senderEmail: string | null;
  private readonly senderName: string;
  private readonly reason: string | null;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const config = readNotificationsEnv(env);
    this.apiKey = trimmedOrNull(config.BREVO_API_KEY);
    this.senderEmail = trimmedOrNull(config.BREVO_SENDER_EMAIL);
    this.senderName = trimmedOrDefault(config.BREVO_SENDER_NAME, DEFAULT_SENDER_NAME);
    this.reason = missingBrevoConfigReason(this.apiKey, this.senderEmail);

    if (this.reason) {
      this.logger.warn(`${this.reason} Les notifications partent en push uniquement.`);
    } else {
      this.logger.log(`Transport e-mail Brevo actif (expéditeur ${this.senderEmail ?? '?'}).`);
    }
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.senderEmail !== null;
  }

  unavailableReason(): string | null {
    if (this.isConfigured()) return null;
    return this.reason ?? 'Transport e-mail indisponible.';
  }

  async send(messages: readonly BrevoMessage[]): Promise<BrevoDispatchResult> {
    if (!messages.length) return { status: 'SENT', outcomes: [] };

    const apiKey = this.apiKey;
    const senderEmail = this.senderEmail;
    if (!apiKey || !senderEmail) {
      const detail = this.unavailableReason();
      return {
        status: 'NOT_CONFIGURED',
        outcomes: [],
        ...(detail === null ? {} : { detail }),
      };
    }

    const outcomes: BrevoSendOutcome[] = [];
    let delivered = 0;
    let attempted = 0;
    let firstError: string | undefined;

    for (const message of messages) {
      const chunks = chunkRecipients(message.recipients);
      const settled = await mapWithConcurrency(chunks, BREVO_MAX_CONCURRENT_CALLS, (chunk) =>
        this.sendOne(apiKey, senderEmail, message, chunk),
      );

      settled.forEach((result, index) => {
        attempted += 1;
        const chunk = chunks[index] ?? [];
        if (result.status === 'fulfilled') {
          if (result.value.ok) delivered += 1;
          else firstError ??= result.value.errorCode;
          for (const recipient of chunk) {
            outcomes.push({
              email: recipient.email,
              ok: result.value.ok,
              ...(result.value.errorCode === undefined
                ? {}
                : { errorCode: result.value.errorCode }),
              ...(result.value.kind === undefined ? {} : { kind: result.value.kind }),
            });
          }
          return;
        }

        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        firstError ??= reason;
        for (const recipient of chunk) {
          outcomes.push({
            email: recipient.email,
            ok: false,
            errorCode: 'NETWORK_ERROR',
            kind: 'transient',
          });
        }
        this.logger.warn(`Envoi Brevo échoué (réseau) : ${reason}`);
      });
    }

    if (attempted > 0 && delivered === 0) {
      return {
        status: 'TRANSPORT_ERROR',
        outcomes,
        ...(firstError === undefined ? {} : { detail: firstError }),
      };
    }

    return { status: 'SENT', outcomes };
  }

  private async sendOne(
    apiKey: string,
    senderEmail: string,
    message: BrevoMessage,
    chunk: readonly BrevoRecipient[],
  ): Promise<{ ok: boolean; errorCode?: string; kind?: BrevoFailureKind }> {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(BREVO_REQUEST_TIMEOUT_MS),
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: this.senderName },
        to: chunk.map((recipient) => ({
          email: recipient.email,
          ...(recipient.name === undefined ? {} : { name: recipient.name }),
        })),
        subject: message.subject,
        htmlContent: message.htmlContent,
        textContent: message.textContent,
      }),
    });

    if (response.ok) return { ok: true };

    const payload: unknown = await response.json().catch(() => null);
    return {
      ok: false,
      errorCode: readBrevoErrorCode(payload) ?? `HTTP_${String(response.status)}`,
      kind: classifyBrevoFailure(response.status),
    };
  }
}

const readBrevoErrorCode = (payload: unknown): string | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' && code ? code : undefined;
};

export class NullBrevoTransport implements BrevoTransport {
  constructor(private readonly reason = 'Aucun transport e-mail configuré.') {}

  isConfigured(): boolean {
    return false;
  }

  unavailableReason(): string | null {
    return this.reason;
  }

  send(): Promise<BrevoDispatchResult> {
    return Promise.resolve({ status: 'NOT_CONFIGURED', outcomes: [], detail: this.reason });
  }
}
