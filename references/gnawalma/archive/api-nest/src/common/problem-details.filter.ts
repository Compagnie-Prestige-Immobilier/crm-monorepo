import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { z } from 'zod';

interface HttpRequestLike {
  id?: string;
  url?: string;
}

interface HttpReplyLike {
  header(name: string, value: string): HttpReplyLike;
  status(code: number): { send(body: unknown): void };
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpReplyLike>();

    const problem = this.toProblem(exception, request);
    if (problem.status >= 500) {
      this.logger.error(
        `Unhandled request failure ${problem.instance ?? ''}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response
      .header('content-type', 'application/problem+json')
      .status(problem.status)
      .send(problem);
  }

  private toProblem(exception: unknown, request: HttpRequestLike) {
    if (exception instanceof z.ZodError) {
      return {
        type: 'https://gnawalma.app/problems/validation',
        title: 'Requête invalide',
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        detail: 'Certaines informations ne respectent pas le format attendu.',
        instance: request.url,
        requestId: request.id,
        fieldErrors: exception.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }

    // Postgres constraint violations, mapped once here rather than caught at
    // each call site.
    //
    // A duplicate is a client error: the second review of the same contact hit
    // `reviews_contact_event_id_key` and came back as a 500 telling the reader
    // the service had "un problème temporaire" and to try again — advice that
    // could never work, for a request that was simply already done. `23505` is
    // unique violation, `23503` a missing foreign key, `23514` a failed CHECK
    // (a payment above the order total, a rating outside 1–5), `22P02` a
    // malformed uuid or enum value. None of them are the server failing.
    const constraint = this.constraintProblem(exception);
    if (constraint) {
      return {
        type: `https://gnawalma.app/problems/${this.codeFor(constraint.status).toLowerCase()}`,
        title: this.defaultTitle(constraint.status),
        status: constraint.status,
        code: this.codeFor(constraint.status),
        detail: constraint.detail,
        instance: request.url,
        requestId: request.id,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const payload = typeof raw === 'object' && raw !== null
        ? raw as Record<string, unknown>
        : {};
      const rawMessage = payload.message ?? raw;
      const detail = Array.isArray(rawMessage)
        ? rawMessage.join('. ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : this.defaultTitle(status);

      return {
        type: `https://gnawalma.app/problems/${this.codeFor(status).toLowerCase()}`,
        title: this.defaultTitle(status),
        status,
        code: typeof payload.code === 'string' ? payload.code : this.codeFor(status),
        detail,
        instance: request.url,
        requestId: request.id,
        ...(Array.isArray(payload.fieldErrors)
          ? { fieldErrors: payload.fieldErrors }
          : {}),
      };
    }

    return {
      type: 'https://gnawalma.app/problems/internal-server-error',
      title: 'Service indisponible',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      detail: 'Le service rencontre un problème temporaire.',
      instance: request.url,
      requestId: request.id,
    };
  }

  /**
   * Recognises the `pg` errors that describe a bad request rather than a
   * broken server, and gives each one a sentence the reader can act on.
   *
   * Deliberately narrow: anything not listed keeps falling through to a 500,
   * because an unrecognised database failure genuinely is one.
   */
  private constraintProblem(
    exception: unknown,
  ): { status: number; detail: string } | null {
    if (!exception || typeof exception !== 'object') return null;
    const code = (exception as { code?: unknown }).code;
    if (typeof code !== 'string') return null;

    switch (code) {
      case '23505':
        return {
          status: HttpStatus.CONFLICT,
          detail: 'Cette donnée existe déjà. Aucune action supplémentaire n’est nécessaire.',
        };
      case '23503':
        return {
          status: HttpStatus.CONFLICT,
          detail: 'Cette opération référence un élément qui n’existe pas ou plus.',
        };
      case '23514':
        return {
          status: HttpStatus.CONFLICT,
          detail: 'Les valeurs envoyées ne respectent pas une règle de gestion.',
        };
      case '22P02':
        return {
          status: HttpStatus.BAD_REQUEST,
          detail: 'Un identifiant ou une valeur envoyée n’a pas le format attendu.',
        };
      default:
        return null;
    }
  }

  private defaultTitle(status: number): string {
    switch (status) {
      case 400: return 'Requête invalide';
      case 401: return 'Authentification requise';
      case 403: return 'Action non autorisée';
      case 404: return 'Ressource introuvable';
      case 409: return 'Conflit de données';
      case 422: return 'Données non valides';
      case 429: return 'Trop de tentatives';
      default: return status >= 500 ? 'Service indisponible' : 'Erreur de requête';
    }
  }

  private codeFor(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 422: return 'UNPROCESSABLE_ENTITY';
      case 429: return 'RATE_LIMITED';
      default: return status >= 500 ? 'INTERNAL_SERVER_ERROR' : `HTTP_${status}`;
    }
  }
}
