/**
 * NFD puis retrait des diacritiques. L'accord avec le dictionnaire de
 * PostgreSQL, dont `immutable_unaccent` est la version SQL, est vérifié par un
 * test d'intégration sur les accents que portent réellement les noms d'ici.
 */
export const sansAccents = (valeur: string): string =>
  valeur.normalize('NFD').replace(/\p{Diacritic}/gu, '');
