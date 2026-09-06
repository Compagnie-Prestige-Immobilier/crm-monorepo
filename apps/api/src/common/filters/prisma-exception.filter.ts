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

export function isPrismaKnownError(error: unknown): error is KnownPrismaError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^P\d{4}$/.test(error.code)
  );
}

const targetOf = (error: KnownPrismaError): string[] | undefined => {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') return [target];
  const field = error.meta?.field_name;
  if (typeof field === 'string') return [field];
  return undefined;
};

function mapPrismaError(error: KnownPrismaError): PrismaErrorBody | undefined {
  const target = targetOf(error);
  switch (error.code) {
    case 'P2002':
      return {
        statusCode: HttpStatus.CONFLICT,
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: 'Cette valeur existe déjà.',
        ...(target ? { target } : {}),
      };
    case 'P2025':
      return {
        statusCode: HttpStatus.NOT_FOUND,
        code: 'RECORD_NOT_FOUND',
        message: 'Enregistrement introuvable.',
      };
    case 'P2003':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
        message: 'Référence invalide : l’enregistrement lié n’existe pas.',
        ...(target ? { target } : {}),
      };
    case 'P2024':
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DATABASE_BUSY',
        message: 'Base momentanément saturée. Réessayez dans quelques instants.',
      };
    default:
      return undefined;
  }
}

@Catch()
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('PrismaException');

  override catch(error: unknown, host: ArgumentsHost): void {
    const prismaBody = isPrismaKnownError(error) ? mapPrismaError(error) : undefined;

    if (!prismaBody && !(error instanceof HttpException)) {
      super.catch(error, host);
      return;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<{ id?: string; method?: string; url?: string } | undefined>();
    const reply = http.getResponse<{
      code: (status: number) => { send: (payload: NormalizedError) => void };
    }>();

    const status = prismaBody ? prismaBody.statusCode : (error as HttpException).getStatus();
    const payload = prismaBody ?? (error as HttpException).getResponse();
    const body = normalizeErrorBody(status, payload, request?.id);

    this.logger.warn(
      `${request?.method ?? '?'} ${request?.url ?? '?'} -> ${String(status)} ${body.code}`,
    );

    reply.code(status).send(body);
  }
}
