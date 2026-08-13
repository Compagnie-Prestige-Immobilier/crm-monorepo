import { NextResponse } from 'next/server';

import {
  API_PREFIX,
  ApiConfigurationError,
  configErrorBody,
  serverApiOrigin,
} from '@/lib/api/config';
import {
  clearSessionCookies,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
  toAuthTokens,
} from '@/lib/api/server';
import { rotateRefreshToken } from '@/lib/api/tokens';
import { getSession } from '@/lib/session';
import type { Role } from '@/lib/types';

/**
 * Relais commun des exports `.xlsx`.
 *
 * Il existe parce que le jeton est en cookie `httpOnly` : le navigateur ne peut
 * pas poser lui-même l'en-tête `Authorization`, donc un simple `<a href>` vers
 * le backend partirait sans authentification.
 *
 * Le corps est relayé EN FLUX, sans être bufferisé : un export de plusieurs
 * dizaines de milliers de lignes ne doit pas transiter par la mémoire du
 * processus Node.
 *
 * Ces exports ne passent pas par `/api/v1/[...path]` : il leur faut un
 * `Content-Disposition` daté que l'API ne fabrique pas sous ce nom, et une
 * vérification de session — et de RÔLE — explicite avant d'ouvrir le flux.
 */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface XlsxRelayOptions {
  /** Chemin amont, après `/api/v1`. Exemple : `export/prospects.xlsx`. */
  upstreamPath: string;
  /** Paramètres déjà validés. Jamais l'URL entrante telle quelle. */
  search: URLSearchParams;
  /** Nom du fichier proposé au téléchargement. */
  filename: string;
  /** Rôles autorisés. Vide = tout utilisateur authentifié. */
  allowedRoles?: readonly Role[] | undefined;
}

async function requestUpstream(options: XlsxRelayOptions, accessToken: string): Promise<Response> {
  const query = options.search.toString();
  const url = `${serverApiOrigin()}${API_PREFIX}/${options.upstreamPath}${query === '' ? '' : `?${query}`}`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: XLSX_MIME },
    cache: 'no-store',
  });
}

export async function relayXlsx(options: XlsxRelayOptions): Promise<Response> {
  // Même garde que le relais `/api/v1/*` : une variable manquante n'est pas un
  // serveur injoignable, et l'export doit le dire plutôt que de laisser croire
  // à une coupure.
  try {
    serverApiOrigin();
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json(configErrorBody(error), { status: 500 });
    }
    throw error;
  }

  const session = await getSession();
  if (session === null) {
    return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });
  }

  const allowed = options.allowedRoles;
  if (allowed !== undefined && !allowed.includes(session.role)) {
    // 403 et non 401 : la session est valide, c'est le rôle qui ne l'est pas.
    // Les confondre enverrait l'utilisateur se reconnecter pour rien.
    return NextResponse.json(
      { error: 'Cet export n’est pas accessible avec votre rôle.' },
      { status: 403 },
    );
  }

  const accessToken = await getAccessToken();
  if (accessToken === null || accessToken === '') {
    return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await requestUpstream(options, accessToken);

    if (upstream.status === 401) {
      const refreshToken = await getRefreshToken();
      const rotated =
        refreshToken === null || refreshToken === ''
          ? null
          : await rotateRefreshToken(serverApiOrigin(), refreshToken);

      if (rotated === null) {
        await clearSessionCookies();
        return NextResponse.json(
          { error: 'Session expirée. Reconnectez-vous.', code: 'SESSION_EXPIRED' },
          { status: 401 },
        );
      }

      await setSessionCookies(toAuthTokens(rotated));
      upstream = await requestUpstream(options, rotated.accessToken);
    }
  } catch {
    return NextResponse.json({ error: 'Le serveur CPI est injoignable.' }, { status: 502 });
  }

  if (!upstream.ok || upstream.body === null) {
    // Surtout pas de fichier de repli : un .xlsx contenant un message d'erreur
    // serait transmis à la direction sans que personne ne l'ouvre.
    return NextResponse.json(
      { error: `L'export a échoué (code ${String(upstream.status)}).` },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${options.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * `toFilterQuery` n'écrit que les critères réellement renseignés, et
 * `exactOptionalPropertyTypes` interdit d'y poser un `undefined` explicite :
 * toute entrée présente porte donc une valeur.
 */
export function toSearchParams(query: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }
  return params;
}
