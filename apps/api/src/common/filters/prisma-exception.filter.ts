import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { normalizeErrorBody, type NormalizedError } from '../errors/normalize.js';

interface PrismaErrorBody {
  statusCode: number;
  code: string;
  message: string;
  target?: string[];
  requestId?: string;
}

interface KnownPrismaError {
  code: string;
  meta?: { target?: unknown; field_name?: unknown; modelName?: unknown };
}

const hasStringCode = (error: object): error is { code: string } =>
  'code' in error && typeof error.code === 'string';

export function isPrismaKnownError(error: unknown): error is KnownPrismaError {
  if (typeof error !== 'object' || error === null) return false;
  return hasStringCode(error) && /^P\d{4}$/.test(error.code);
}

const targetOf = (error: KnownPrismaError): string[] | undefined => {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') return [target];
  const field = error.meta?.field_name;
  if (typeof field === 'string') return [field];
  return undefined;
};

type PrismaErrorBodyFactory = (target: string[] | undefined) => PrismaErrorBody;

const PRISMA_ERROR_BODIES: Record<string, PrismaErrorBodyFactory> = {
  P2002: (target) => ({
    statusCode: HttpStatus.CONFLICT,
    code: 'UNIQUE_CONSTRAINT_VIOLATION',
    message: 'Cette valeur existe déjà.',
    ...(target ? { target } : {}),
  }),
  P2025: () => ({
    statusCode: HttpStatus.NOT_FOUND,
    code: 'RECORD_NOT_FOUND',
    message: 'Enregistrement introuvable.',
  }),
  P2003: (target) => ({
    statusCode: HttpStatus.BAD_REQUEST,
    code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
    message: 'Référence invalide : l’enregistrement lié n’existe pas.',
    ...(target ? { target } : {}),
  }),
  P2024: () => ({
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'DATABASE_BUSY',
    message: 'Base momentanément saturée. Réessayez dans quelques instants.',
  }),
  P2004: () => ({
    statusCode: HttpStatus.BAD_REQUEST,
    code: 'CHECK_CONSTRAINT_VIOLATION',
    message: 'Cette valeur ne respecte pas une règle de cohérence des données.',
  }),
};

function mapPrismaError(error: KnownPrismaError): PrismaErrorBody | undefined {
  return PRISMA_ERROR_BODIES[error.code]?.(targetOf(error));
}

const resolvePrismaBody = (error: unknown): PrismaErrorBody | undefined =>
  isPrismaKnownError(error) ? mapPrismaError(error) : undefined;

const resolveStatusAndPayload = (
  prismaBody: PrismaErrorBody | undefined,
  error: HttpException,
): [number, unknown] =>
  prismaBody ? [prismaBody.statusCode, prismaBody] : [error.getStatus(), error.getResponse()];

const describeRequest = (request?: { method?: string; url?: string }): string =>
  `${request?.method ?? '?'} ${request?.url ?? '?'}`;

@Catch()
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('PrismaException');

  override catch(error: unknown, host: ArgumentsHost): void {
    const prismaBody = resolvePrismaBody(error);

    if (!prismaBody && !(error instanceof HttpException)) {
      super.catch(error, host);
      return;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<{ id?: string; method?: string; url?: string } | undefined>();
    const reply = http.getResponse<{
      code: (status: number) => { send: (payload: NormalizedError) => void };
    }>();

    const [status, payload] = resolveStatusAndPayload(prismaBody, error as HttpException);
    const body = normalizeErrorBody(status, payload, request?.id);

    this.logger.warn(`${describeRequest(request)} -> ${String(status)} ${body.code}`);

    reply.code(status).send(body);
  }
}
