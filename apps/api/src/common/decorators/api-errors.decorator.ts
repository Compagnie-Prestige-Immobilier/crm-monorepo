import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { ApiErrorDto } from '../dto/api-error.dto.js';

/**
 * Déclaration des réponses d'erreur d'une opération, avec leur SCHÉMA.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE DÉCORATEUR EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aucune des 55 déclarations `@ApiResponse` 4xx du projet ne portait de
 * `type:`. OpenAPI les publiait donc sans `content`, et les deux clients
 * générés en déduisaient `unknown`. Chacun a fini par décoder les erreurs à la
 * main, avec sa propre idée de la forme du corps.
 *
 * Le remède ne peut pas être « ajouter `type: ApiErrorDto` partout à la
 * main » : c'est exactement ce qui a été oublié 55 fois. Il faut que la
 * déclaration soit PLUS COURTE que l'oubli, sinon elle sera oubliée à
 * nouveau. D'où ce décorateur.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMMENT L'UTILISER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   @ApiAuthErrors()                      // 401 et 403, sur une route protégée
 *   @ApiErrors({ 404: 'PROSPECT_NOT_FOUND · fiche absente ou supprimée.' })
 *
 * La valeur passée pour chaque statut est la DESCRIPTION, qui garde la
 * convention en place : les codes métier d'abord, séparés par ` · `, puis la
 * phrase qui explique quand ils surviennent. Ce sont ces codes que le client
 * lit dans `ApiErrorDto.code`.
 *
 * Le 400 de validation d'entrée n'a pas à être déclaré route par route : il
 * peut survenir sur TOUTE opération qui accepte un corps ou des paramètres, et
 * il est posé une fois pour toutes par `ApiValidationError()`.
 */

/** Statuts d'erreur que le contrat sait décrire. */
export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 503;

/** Phrases par défaut, pour que le cas courant ne demande aucune rédaction. */
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

/**
 * Attache une ou plusieurs réponses d'erreur, toutes typées `ApiErrorDto`.
 *
 * Passer `true` plutôt qu'une phrase retient la description par défaut.
 */
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

/**
 * Les deux erreurs que porte TOUTE route authentifiée.
 *
 * Elles n'étaient déclarées que 3 fois (401) et 4 fois (403) sur 119
 * opérations, alors que la garde de rôles s'applique globalement : le contrat
 * laissait donc croire que la plupart des routes ne pouvaient pas refuser.
 */
export const ApiAuthErrors = (): ClassDecorator & MethodDecorator =>
  ApiErrors({ 401: true, 403: true });

/**
 * Le 400 de la `ValidationPipe`, posé au niveau du contrôleur.
 *
 * `forbidNonWhitelisted: true` fait que TOUT champ inconnu produit un 400, y
 * compris un paramètre de requête mal orthographié. Ce refus concerne donc
 * toutes les opérations qui prennent une entrée, pas seulement celles qui ont
 * pensé à le documenter.
 */
export const ApiValidationError = (): ClassDecorator & MethodDecorator => ApiErrors({ 400: true });
