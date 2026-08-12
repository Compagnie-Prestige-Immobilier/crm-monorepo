import { ApiError } from '@crm/api-client/query';
import { NextResponse } from 'next/server';

import { getAnonymousApiClient, setSessionCookies } from '@/lib/api/server';
import { authenticate } from '@/lib/data/auth';
import { loginSchema } from '@/lib/schemas';

/**
 * `POST /api/auth/login`
 *
 * Le navigateur ne parle jamais au backend NestJS directement. Il poste ici,
 * ce handler relaie, et les jetons repartent en cookies `httpOnly` — jamais
 * dans le corps de la réponse. C'est la seule façon d'empêcher qu'un JWT
 * atterrisse dans du JavaScript, donc à portée d'une XSS.
 *
 * La réponse ne contient que le profil public de l'utilisateur.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête illisible.' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 400 });
  }

  let result;
  try {
    // Client ANONYME : le login est le seul appel qui ne doit porter aucun
    // jeton. Passer par le client de session déclencherait une rotation sur le
    // 401 d'un mot de passe faux, et brûlerait le refresh token de la session
    // précédente pour rien.
    result = await authenticate(
      parsed.data.identifier,
      parsed.data.password,
      getAnonymousApiClient(),
    );
  } catch (error) {
    // 429 : le limiteur de débit de l'API. Le dire, sinon l'utilisateur
    // réessaie en boucle en croyant s'être trompé de mot de passe.
    if (error instanceof ApiError && error.status === 429) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Patientez une minute avant de réessayer.' },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: 'Le serveur CPI est injoignable. Réessayez dans un instant.' },
      { status: 502 },
    );
  }

  // Message unique quel que soit le motif : ne pas laisser deviner si un compte
  // existe, s'il est désactivé, ou si le rôle est refusé.
  if (result === null) {
    return NextResponse.json(
      { error: 'Identifiants incorrects ou compte non autorisé.' },
      { status: 401 },
    );
  }

  await setSessionCookies(result.tokens);
  return NextResponse.json({ user: result.user });
}
