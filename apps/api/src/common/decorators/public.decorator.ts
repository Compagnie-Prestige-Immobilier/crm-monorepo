import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Ouvre une route à un appelant non authentifié.
 *
 * Le JwtAuthGuard est global : l'absence de décorateur ferme la route. C'est
 * l'inverse du réglage habituel, et c'est délibéré, un oubli produit un 401,
 * jamais une fuite.
 */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
