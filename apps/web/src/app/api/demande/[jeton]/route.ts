import { NextResponse } from 'next/server';

import {
  API_PREFIX,
  ApiConfigurationError,
  configErrorBody,
  serverApiOrigin,
} from '@/lib/api/config';
import { demandePubliqueSchema } from '@/lib/schemas';

const REFUS: Readonly<Record<number, string>> = {
  400: 'Vérifiez les champs signalés.',
  404: 'Ce lien ne fonctionne plus. Demandez-en un nouveau à votre conseiller CPI.',
  429: 'Trop d’envois depuis cette connexion. Patientez une minute.',
};

/**
 * Le relais `/api/v1` attache toujours un jeton de session et renvoie 401 sans
 * cookie : une page publique ne peut pas l'emprunter. Ce relais-ci ne porte
 * aucune identité et ne sert que cette route.
 *
 * L'adresse du visiteur est reportée : sans elle, l'API compte tous les envois
 * sur l'adresse du panel, et la limitation par adresse réseau ne limite plus
 * rien (elle exige `API_TRUST_PROXY_HEADERS` côté API).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ jeton: string }> },
): Promise<NextResponse> {
  const { jeton } = await context.params;

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: 'Demande illisible.' }, { status: 400 });
  }

  const parsed = demandePubliqueSchema.safeParse(corps);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Vérifiez les champs signalés.' }, { status: 400 });
  }

  const { site, email, profession, employeur, message, ...identite } = parsed.data;
  const demande = {
    ...identite,
    ...(email === '' ? {} : { email }),
    ...(profession === '' ? {} : { profession }),
    ...(employeur === '' ? {} : { employeur }),
    ...(message === '' ? {} : { message }),
    ...(site === '' ? {} : { site }),
  };

  let origin: string;
  try {
    origin = serverApiOrigin();
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json(configErrorBody(error), { status: 500 });
    }
    throw error;
  }

  const visiteur = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');

  let amont: Response;
  try {
    amont = await fetch(`${origin}${API_PREFIX}/formulaire-public/${encodeURIComponent(jeton)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(visiteur === null ? {} : { 'x-forwarded-for': visiteur }),
      },
      body: JSON.stringify(demande),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { error: 'Le serveur CPI est injoignable. Réessayez dans un instant.' },
      { status: 502 },
    );
  }

  if (amont.ok) return NextResponse.json({ ok: true });

  const connu = REFUS[amont.status];
  if (connu !== undefined) return NextResponse.json({ error: connu }, { status: amont.status });

  return NextResponse.json(
    { error: 'Votre demande n’a pas pu être enregistrée. Réessayez dans un instant.' },
    { status: 502 },
  );
}
