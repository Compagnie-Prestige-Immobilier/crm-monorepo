export interface PgEnvironment {
  PGHOST: string;
  PGPORT: string;
  PGUSER: string;
  PGPASSWORD: string;
  PGDATABASE: string;
  PGSSLMODE?: string;
}

export class InvalidDatabaseUrlError extends Error {}

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
    PGPORT: url.port === '' ? '5432' : url.port,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
    ...(sslmode === null || sslmode === '' ? {} : { PGSSLMODE: sslmode }),
  };
}
