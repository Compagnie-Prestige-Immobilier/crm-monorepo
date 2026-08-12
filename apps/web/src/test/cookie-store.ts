import { vi } from 'vitest';

/**
 * Magasin de cookies minimal, substitué à `next/headers` dans les tests de
 * Route Handlers.
 *
 * Les handlers d'authentification n'ont qu'un seul effet observable qui compte
 * — ce qu'ils écrivent dans les cookies — et Next refuse de fournir
 * `cookies()` hors d'un contexte de requête. Sans ce double, la logique de
 * session ne serait vérifiable qu'en bout de chaîne, dans un navigateur.
 */

export interface StoredCookie {
  value: string;
  httpOnly?: boolean;
  sameSite?: string;
  secure?: boolean;
  path?: string;
  maxAge?: number;
}

export class FakeCookieStore {
  private readonly jar = new Map<string, StoredCookie>();

  get(name: string): { name: string; value: string } | undefined {
    const entry = this.jar.get(name);
    return entry === undefined ? undefined : { name, value: entry.value };
  }

  set(name: string, value: string, options: Omit<StoredCookie, 'value'> = {}): void {
    this.jar.set(name, { value, ...options });
  }

  /** Ce que le handler a réellement écrit, options comprises. */
  raw(name: string): StoredCookie | undefined {
    return this.jar.get(name);
  }

  /**
   * `true` si le cookie a été effacé au sens du navigateur : valeur vide ET
   * `maxAge` nul. Une valeur vide sans `maxAge: 0` laisserait un cookie de
   * session vivant jusqu'à la fermeture de l'onglet.
   */
  isCleared(name: string): boolean {
    const entry = this.jar.get(name);
    return entry !== undefined && entry.value === '' && entry.maxAge === 0;
  }

  seed(name: string, value: string): void {
    this.jar.set(name, { value });
  }
}

/**
 * Installe le double. À appeler AVANT d'importer le module testé, puisque
 * `vi.mock` est hissé mais que le magasin doit être neuf à chaque test.
 */
export function mockCookies(): FakeCookieStore {
  const store = new FakeCookieStore();
  vi.doMock('next/headers', () => ({
    cookies: () => Promise.resolve(store),
  }));
  return store;
}
