/**
 * Traduction de `DATABASE_URL` en variables d'environnement libpq.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI L'ENVIRONNEMENT ET NON LA LIGNE DE COMMANDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `pg_dump` accepte l'URI complète en argument (`pg_dump "$DATABASE_URL"`).
 * C'est la forme la plus courte, et c'est aussi celle qui écrit le MOT DE PASSE
 * DE LA BASE dans `argv`. Or `argv` est lisible par tout ce qui liste les
 * processus : un `ps aux` dans le conteneur, un journal de supervision qui
 * échantillonne les processus, un plantage qui capture la ligne de commande.
 * L'environnement d'un processus, lui, n'est lisible que par son propriétaire
 * (`/proc/<pid>/environ` est en 0400).
 *
 * Le gain est modeste et il est réel : ni l'un ni l'autre ne protège d'un
 * attaquant qui est DÉJÀ le même utilisateur, mais seule la ligne de commande
 * fuit vers des outils qui n'ont jamais demandé le mot de passe.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUI EST DÉLIBÉRÉMENT IGNORÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `?schema=public` est une convention PRISMA, pas un paramètre libpq. La
 * traduire en `--schema=public` serait une faute : elle restreindrait l'export
 * à un seul schéma, alors que la demande porte sur la base ENTIÈRE. On la
 * laisse donc tomber, et `pg_dump` fait ce qu'il fait par défaut, c'est-à-dire
 * tout.
 *
 * `sslmode`, en revanche, est un paramètre libpq et il est repris : une base
 * gérée qui exige TLS refuserait la connexion sans lui.
 */

/** Les variables reconnues par libpq, dans l'ordre où on les renseigne. */
export interface PgEnvironment {
  PGHOST: string;
  PGPORT: string;
  PGUSER: string;
  PGPASSWORD: string;
  PGDATABASE: string;
  PGSSLMODE?: string;
}

export class InvalidDatabaseUrlError extends Error {}

/**
 * Décompose `DATABASE_URL`.
 *
 * Les composants sont DÉCODÉS, EXPLICITEMENT, tous les trois.
 *
 * C'est le piège de ce fichier, et il a été pris à l'écriture : `URL` NE
 * décode ni `username`, ni `password`, ni `pathname`. Elle rend les octets
 * percent-encodés tels qu'ils apparaissent dans l'URI. Or un mot de passe
 * contenant `@`, `/` ou `#` est obligatoirement encodé, et le transmettre
 * encodé à libpq fait échouer l'authentification sur un « password
 * authentication failed » qui accuse le mot de passe au lieu de l'encodage.
 * Trois `decodeURIComponent` explicites, donc, et un test par composant.
 */
export function pgEnvironmentFrom(databaseUrl: string): PgEnvironment {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new InvalidDatabaseUrlError('DATABASE_URL n’est pas une URL exploitable.');
  }

  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new InvalidDatabaseUrlError(
      `DATABASE_URL doit être une URL postgresql://, et non ${url.protocol}//.`,
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//u, ''));
  if (database === '') {
    throw new InvalidDatabaseUrlError('DATABASE_URL ne nomme aucune base de données.');
  }

  const sslmode = url.searchParams.get('sslmode');

  return {
    PGHOST: url.hostname,
    // libpq retombe sur 5432 quand la variable est vide ; on l'écrit tout de
    // même, pour que l'environnement transmis décrive entièrement la connexion.
    PGPORT: url.port === '' ? '5432' : url.port,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
    ...(sslmode === null || sslmode === '' ? {} : { PGSSLMODE: sslmode }),
  };
}
