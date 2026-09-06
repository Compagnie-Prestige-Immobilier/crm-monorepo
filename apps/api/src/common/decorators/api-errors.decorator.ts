import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { ApiErrorDto } from '../dto/api-error.dto.js';

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 503;

const DEFAULT_DESCRIPTIONS: Record<ApiErrorStatus, string> = {
  400: 'Requête mal formée : paramètre invalide ou corps refusé par la validation.',
  401: 'Jeton absent, expiré ou invalide.',
  403: 'Jeton valide mais rôle insuffisant, ou ressource hors du périmètre de l’utilisateur.',
  404: 'Ressource introuvable, ou supprimée.',
  409: 'Conflit avec l’état courant de la ressource.',
  413: 'Charge utile trop volumineuse.',
  415: 'Type de contenu non pris en charge.',
  422: 'Requête bien formée, mais refusée par une règle métier.',
  429: 'Trop de requêtes : réessayez plus tard.',
  503: 'Service momentanément indisponible.',
};

export function ApiErrors(
  errors: Partial<Record<ApiErrorStatus, string | true>>,
): ClassDecorator & MethodDecorator {
  const decorators = Object.entries(errors).map(([status, description]) => {
    const code = Number(status) as ApiErrorStatus;
    return ApiResponse({
      status: code,
      description: description === true ? DEFAULT_DESCRIPTIONS[code] : description,
      type: ApiErrorDto,
    });
  });

  return applyDecorators(...decorators);
}
