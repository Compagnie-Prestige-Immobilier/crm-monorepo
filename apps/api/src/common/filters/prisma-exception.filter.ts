import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { normalizeErrorBody, type NormalizedError } from '../errors/normalize.js';

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
 * la fait pas retomber sur le filtre suivant, elle sort du cycle Nest et la
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
    // Pool de connexions saturé : la requête n'a jamais atteint PostgreSQL.
    // C'est une SURCHARGE, pas une panne, et surtout pas une faute du client.
    // En 500, le mobile abandonnait le lot et l'utilisateur voyait « erreur
    // serveur » là où réessayer dans dix secondes suffisait. En 503, la
    // condition est temporaire par définition et le rejeu est légitime : c'est
    // exactement ce que la file de synchronisation sait faire.
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

/**
 * Filtre global des erreurs.
 *
 * Il fait DEUX choses, et les deux tiennent dans le même filtre parce qu'un
 * filtre global `@Catch()` intercepte tout et qu'un second filtre ne verrait
 * jamais rien passer :
 *
 * 1. il traduit les erreurs Prisma connues en réponses HTTP typées ;
 * 2. il NORMALISE le corps de toutes les autres, vers `ApiErrorDto`.
 *
 * Le point 2 est ce qui rend le contrat honnête. Sans lui, quatre chemins
 * produisaient quatre formes de corps : le client ne pouvait pas lire `code`
 * sans se demander d'où venait l'erreur. Normaliser ICI plutôt que dans chaque
 * service garde les services inchangés : ils lèvent leurs exceptions typées
 * comme avant, le filtre complète ce qui manque.
 *
 * Rien n'est effacé au passage, sauf le champ `error` de Nest (« Bad Request »),
 * qui faisait double emploi avec `code` en moins stable.
 */
@Catch()
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('PrismaException');

  override catch(error: unknown, host: ArgumentsHost): void {
    const prismaBody = isPrismaKnownError(error) ? mapPrismaError(error) : undefined;

    // Tout ce qui n'est ni une erreur Prisma traduisible ni une exception HTTP
    // est une panne : on laisse Nest la journaliser et rendre son 500, plutôt
    // que d'habiller en contrat ce qui n'en est pas un.
    //
    // LES REFUS PRODUITS PAR FASTIFY LUI-MÊME (429 du limiteur, 413 de
    // `bodyLimit`, 416 des plages) NE PASSENT PAS PAR ICI : ils sont levés hors
    // du cycle Nest et c'est le gestionnaire posé dans `bootstrap.ts` qui les
    // normalise. Vérifié en l'instrumentant, il tourne bel et bien, et
    // `bootstrap.error-handler.test.ts` lit le corps réellement émis.
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
