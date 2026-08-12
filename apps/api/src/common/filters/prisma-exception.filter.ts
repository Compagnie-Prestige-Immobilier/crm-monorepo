import { Catch, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

/**
 * Traduit les erreurs Prisma en réponses HTTP typées.
 *
 * Sans ce filtre, une violation de contrainte remonte en 500 : le client ne
 * peut pas distinguer « ce numéro existe déjà » (action utilisateur, message
 * métier) d'une panne serveur (réessai automatique). Le mobile en particulier
 * rejouerait indéfiniment un lot voué à échouer.
 *
 * Il étend `BaseExceptionFilter` plutôt que d'être posé à côté : un filtre
 * global `@Catch()` intercepte TOUT, et relancer l'erreur depuis un filtre ne
 * la fait pas retomber sur le filtre suivant — elle sort du cycle Nest et la
 * requête reste pendante. On délègue donc explicitement au comportement par
 * défaut pour tout ce qui n'est pas une erreur Prisma traduisible.
 */

export interface PrismaErrorBody {
  statusCode: number;
  code: string;
  message: string;
  /** Champs à l'origine du conflit, quand Prisma les expose. */
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

/** Table de correspondance code Prisma → réponse HTTP. */
export function mapPrismaError(error: KnownPrismaError): PrismaErrorBody | undefined {
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
    default:
      return undefined;
  }
}

@Catch()
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('PrismaException');

  override catch(error: unknown, host: ArgumentsHost): void {
    const body = isPrismaKnownError(error) ? mapPrismaError(error) : undefined;
    if (!body) {
      super.catch(error, host);
      return;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<{ id?: string; method?: string; url?: string } | undefined>();
    const reply = http.getResponse<{
      code: (status: number) => { send: (payload: PrismaErrorBody) => void };
    }>();

    this.logger.warn(
      `${request?.method ?? '?'} ${request?.url ?? '?'} -> ${String(body.statusCode)}`,
    );

    reply.code(body.statusCode).send({
      ...body,
      ...(request?.id ? { requestId: request.id } : {}),
    });
  }
}
